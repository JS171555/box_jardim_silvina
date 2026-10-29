-- BOX Jardim Silvina · Fase 2 · Treinos, sessões, resultados e presença
-- Decisões: 1 treino compartilhado por data; movimentos em jsonb (substitui workout_exercises);
-- aluno nunca escreve direto em sessões/resultados/presença: só via funções (RPC).

create or replace function public.today_sp() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.assert_active() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login para continuar.'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and status = 'active') then
    raise exception 'Seu acesso está suspenso. Fale com o treinador.';
  end if;
end $$;

-- ===== Catálogo de categorias =====
create table public.workout_categories (
  id int generated always as identity primary key,
  name text not null unique,
  description text
);
insert into public.workout_categories (name, description) values
 ('WOD','Workout of the Day'),('AMRAP','As Many Rounds/Reps As Possible'),
 ('EMOM','Every Minute on the Minute'),('For Time','Completar o trabalho no menor tempo'),
 ('RFT','Rounds for Time'),('Tabata','20s de esforço / 10s de descanso'),
 ('Chipper','Lista longa de movimentos em sequência'),('Strength / Força','Trabalho de força'),
 ('Weightlifting','Levantamento de peso olímpico'),('Gymnastics','Ginástica'),
 ('Metcon','Metabolic Conditioning'),('Endurance','Resistência'),
 ('Skill / Técnica','Prática de técnica'),('Benchmark','Benchmark WODs (Fran, Cindy, Helen, Grace, Murph…)');

-- ===== Treinos =====
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  workout_date date not null unique,
  title text not null check (length(trim(title)) > 0),
  category_id int references public.workout_categories(id),
  warmup text, mobility text, strength text, wod text,
  movements jsonb not null default '[]'::jsonb,   -- [{ "name": "...", "prescription": "..." }]
  scales text, coach_notes text,
  estimated_minutes int check (estimated_minutes between 1 and 300),
  equipment text[] not null default '{}',
  result_type text not null default 'none' check (result_type in ('time','rounds_reps','load','reps','none')),
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_status_date on public.workouts (status, workout_date);

create table public.individual_workout_overrides (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text, strength text, wod text, movements jsonb, scales text, coach_notes text,
  loads text, restrictions text,                     -- null = herda o treino-base
  status text not null default 'published' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_id, student_id)
);
create index overrides_student on public.individual_workout_overrides (student_id);

create trigger workouts_touch before update on public.workouts for each row execute function public.touch_updated_at();
create trigger overrides_touch before update on public.individual_workout_overrides for each row execute function public.touch_updated_at();

-- ===== Sessões e resultados =====
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete restrict,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  unique (user_id, workout_id),                      -- sem sessões duplicadas
  check ((status = 'completed') = (finished_at is not null))
);
create index sessions_user on public.workout_sessions (user_id, started_at desc);

create table public.workout_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.workout_sessions(id) on delete cascade,
  time_seconds int check (time_seconds between 0 and 86400),
  rounds int check (rounds between 0 and 1000),
  reps int check (reps between 0 and 100000),
  load_kg numeric(6,2) check (load_kg between 0 and 1000),
  notes text check (length(notes) <= 500),
  created_at timestamptz not null default now()
);

-- ===== Presença =====
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,                     -- data em America/Sao_Paulo
  status text not null default 'present' check (status in ('present','justified')),
  source text not null default 'self' check (source in ('self','admin')),
  note text,                                         -- justificativa (obrigatória em ações do admin)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, attendance_date)                  -- no máximo 1 presença por dia
);
create index attendance_date on public.attendance (attendance_date);
create trigger attendance_touch before update on public.attendance for each row execute function public.touch_updated_at();

-- ===== Auditoria automática de treinos =====
create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  if auth.uid() is null then if tg_op = 'DELETE' then return old; else return new; end if; end if;
  insert into admin_audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, r->>'id',
          jsonb_build_object('status', r->>'status', 'date', r->>'workout_date', 'title', r->>'title'));
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
create trigger workouts_audit after insert or update or delete on public.workouts for each row execute function public.audit_row();
create trigger overrides_audit after insert or update or delete on public.individual_workout_overrides for each row execute function public.audit_row();

create or replace function public.set_published_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then new.published_at = now();
  elsif new.status = 'draft' then new.published_at = null; end if;
  new.created_by = coalesce(new.created_by, auth.uid());
  return new;
end $$;
create trigger workouts_pub before insert or update on public.workouts for each row execute function public.set_published_at();

-- ===== RLS =====
alter table public.workout_categories enable row level security;
alter table public.workouts enable row level security;
alter table public.individual_workout_overrides enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_results enable row level security;
alter table public.attendance enable row level security;

create policy cat_read on public.workout_categories for select to authenticated using (true);
create policy cat_admin on public.workout_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy workouts_read on public.workouts for select to authenticated using (status = 'published' or public.is_admin());
create policy workouts_admin on public.workouts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy ovr_read on public.individual_workout_overrides for select to authenticated
  using (public.is_admin() or (student_id = auth.uid() and status = 'published'));
create policy ovr_admin on public.individual_workout_overrides for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy sessions_read on public.workout_sessions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy results_read on public.workout_results for select to authenticated
  using (public.is_admin() or exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy attendance_read on public.attendance for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- Sem políticas de insert/update/delete para sessões, resultados e presença: só as funções abaixo escrevem.

-- ===== Funções (RPC) =====
create or replace function public.get_workout_for_me(p_date date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform assert_active();
  select jsonb_build_object(
    'id', w.id, 'date', w.workout_date, 'title', coalesce(o.title, w.title), 'category', c.name,
    'warmup', w.warmup, 'mobility', w.mobility,
    'strength', coalesce(o.strength, w.strength), 'wod', coalesce(o.wod, w.wod),
    'movements', coalesce(o.movements, w.movements), 'scales', coalesce(o.scales, w.scales),
    'coach_notes', coalesce(o.coach_notes, w.coach_notes), 'loads', o.loads, 'restrictions', o.restrictions,
    'estimated_minutes', w.estimated_minutes, 'equipment', w.equipment,
    'result_type', w.result_type, 'personalized', o.id is not null)
  into r
  from workouts w
  left join workout_categories c on c.id = w.category_id
  left join individual_workout_overrides o on o.workout_id = w.id and o.student_id = auth.uid() and o.status = 'published'
  where w.workout_date = p_date and w.status = 'published';
  return r;   -- null quando não há treino publicado
end $$;

create or replace function public.check_in() returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := public.today_sp(); n int;
begin
  perform assert_active();
  insert into attendance (user_id, attendance_date, status, source, created_by)
  values (auth.uid(), d, 'present', 'self', auth.uid())
  on conflict (user_id, attendance_date) do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('date', d, 'created', n > 0);
end $$;

create or replace function public.start_workout_session(p_workout_id uuid) returns public.workout_sessions
language plpgsql security definer set search_path = public as $$
declare s public.workout_sessions;
begin
  perform assert_active();
  if not exists (select 1 from workouts where id = p_workout_id and status = 'published' and workout_date = today_sp()) then
    raise exception 'Só é possível iniciar o treino publicado para hoje.';
  end if;
  insert into workout_sessions (user_id, workout_id) values (auth.uid(), p_workout_id)
  on conflict (user_id, workout_id) do nothing;
  select * into s from workout_sessions where user_id = auth.uid() and workout_id = p_workout_id;
  return s;
end $$;

create or replace function public.finish_workout_session(p_session_id uuid, p_result jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare s public.workout_sessions;
begin
  perform assert_active();
  select * into s from workout_sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then raise exception 'Sessão não encontrada.'; end if;
  if s.status = 'completed' then raise exception 'Este treino já foi finalizado.'; end if;
  update workout_sessions set status = 'completed', finished_at = now() where id = s.id;
  insert into workout_results (session_id, time_seconds, rounds, reps, load_kg, notes)
  values (s.id, nullif(p_result->>'time_seconds','')::int, nullif(p_result->>'rounds','')::int,
          nullif(p_result->>'reps','')::int, nullif(p_result->>'load_kg','')::numeric,
          nullif(left(p_result->>'notes', 500), ''));
end $$;

-- Estatísticas do aluno. Sequência = dias de treino programado consecutivos com presença
-- (hoje sem check-in ainda não quebra; ausência justificada não quebra nem soma).
create or replace function public.my_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t date := today_sp(); s int := 0; r record; pres int; done int; today_in boolean;
begin
  perform assert_active();
  select count(*) into pres from attendance where user_id = auth.uid() and status = 'present';
  select count(*) into done from workout_sessions where user_id = auth.uid() and status = 'completed';
  select exists (select 1 from attendance where user_id = auth.uid() and attendance_date = t and status = 'present') into today_in;
  for r in
    select w.workout_date d,
      exists (select 1 from attendance a where a.user_id = auth.uid() and a.attendance_date = w.workout_date and a.status = 'present') ok,
      exists (select 1 from attendance a where a.user_id = auth.uid() and a.attendance_date = w.workout_date and a.status = 'justified') jus
    from workouts w where w.status = 'published' and w.workout_date <= t order by w.workout_date desc limit 400
  loop
    if r.ok then s := s + 1;
    elsif r.d = t or r.jus then continue;
    else exit; end if;
  end loop;
  return jsonb_build_object('presences', pres, 'completed', done, 'streak', s, 'checked_in_today', today_in);
end $$;

create or replace function public.admin_set_attendance(p_user uuid, p_date date, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Acesso restrito ao treinador.'; end if;
  if p_note is null or length(trim(p_note)) < 3 then raise exception 'Informe uma justificativa.'; end if;
  if p_status not in ('present','justified') then raise exception 'Status inválido.'; end if;
  insert into attendance (user_id, attendance_date, status, source, note, created_by)
  values (p_user, p_date, p_status, 'admin', trim(p_note), auth.uid())
  on conflict (user_id, attendance_date)
  do update set status = excluded.status, source = 'admin', note = excluded.note, created_by = auth.uid();
  insert into admin_audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'set_attendance', 'attendance', p_user::text,
          jsonb_build_object('date', p_date, 'status', p_status, 'note', trim(p_note)));
end $$;

create or replace function public.admin_attendance_summary(p_from date, p_to date)
returns table (user_id uuid, display_name text, present int, justified int, workout_days int, absences int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Acesso restrito ao treinador.'; end if;
  return query
  with days as (select workout_date d from workouts where status = 'published' and workout_date between p_from and p_to),
  nd as (select count(*)::int n from days)
  select p.id, p.display_name,
    (count(*) filter (where dd.d is not null and a.status = 'present'))::int,
    (count(*) filter (where dd.d is not null and a.status = 'justified'))::int,
    (select n from nd),
    greatest((select n from nd) - (count(*) filter (where dd.d is not null))::int, 0)
  from profiles p
  left join attendance a on a.user_id = p.id and a.attendance_date between p_from and p_to
  left join days dd on dd.d = a.attendance_date
  where p.status = 'active' and not exists (select 1 from user_roles ur where ur.user_id = p.id and ur.active)
  group by p.id, p.display_name order by p.display_name;
end $$;

revoke all on function public.get_workout_for_me(date), public.check_in(), public.start_workout_session(uuid),
  public.finish_workout_session(uuid, jsonb), public.my_stats(), public.admin_set_attendance(uuid, date, text, text),
  public.admin_attendance_summary(date, date), public.assert_active() from public, anon;
grant execute on function public.get_workout_for_me(date), public.check_in(), public.start_workout_session(uuid),
  public.finish_workout_session(uuid, jsonb), public.my_stats(), public.admin_set_attendance(uuid, date, text, text),
  public.admin_attendance_summary(date, date) to authenticated;
