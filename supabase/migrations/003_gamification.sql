-- BOX Jardim Silvina · Fase 3 · XP, níveis, conquistas, rankings e O Trono
-- Níveis: min_xp(n) = 50*n*(n-1) (tabela editável `levels`). Todo XP nasce em xp_transactions
-- (imutável, idempotente); user_xp é o saldo mantido por trigger e reconciliável (admin_reconcile_xp).

create table public.xp_rules (
  code text primary key, label text not null,
  xp int not null check (xp between 0 and 10000), active boolean not null default true,
  updated_at timestamptz not null default now());
insert into public.xp_rules (code,label,xp) values
 ('checkin','Check-in diário válido',20),('workout_completed','Treino concluído',50),('result_logged','Registro de resultado válido',10);

create table public.levels (level int primary key check (level >= 1), min_xp int not null unique check (min_xp >= 0), title text);
insert into public.levels (level,min_xp) select n, 50*n*(n-1) from generate_series(1,50) n;

create table public.user_xp (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp_total int not null default 0 check (xp_total >= 0), level int not null default 1,
  updated_at timestamptz not null default now());
create table public.level_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  level int not null, reached_at timestamptz not null default now(), primary key (user_id, level));

create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null check (amount <> 0 and amount between -10000 and 10000),
  source text not null check (source in ('checkin','workout_completed','result_logged','achievement','event','manual_bonus','adjustment','reversal')),
  reason text, ref_id text,
  idempotency_key text not null unique,
  reverses_id uuid references public.xp_transactions(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (source <> 'reversal' or reverses_id is not null));
create unique index xp_one_reversal on public.xp_transactions (reverses_id) where reverses_id is not null;
create index xp_tx_user on public.xp_transactions (user_id, created_at desc);
create index xp_tx_created on public.xp_transactions (created_at);
create or replace function public.xp_immutable() returns trigger language plpgsql as $$
begin raise exception 'Transações de XP são imutáveis: use estorno.'; end $$;
create trigger xp_tx_no_update before update on public.xp_transactions for each row execute function public.xp_immutable();

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null, description text not null,
  icon text not null default 'fa-trophy' check (icon ~ '^fa-[a-z0-9-]+$'),
  category text not null default 'geral',
  rarity text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  criteria_type text not null check (criteria_type in ('presences','workouts','streak','level','throne_hours','throne_days','weekly_champion','monthly_champion','comeback_days')),
  criteria_value int not null check (criteria_value > 0),
  xp_reward int not null default 0 check (xp_reward between 0 and 10000),
  sort_order int not null default 100, active boolean not null default true,
  created_at timestamptz not null default now());
create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_id));          -- cada conquista é desbloqueada uma única vez

create table public.throne_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(), ended_at timestamptz);
create unique index one_open_reign on public.throne_history ((true)) where ended_at is null;
create table public.leaderboard_periods (
  id uuid primary key default gen_random_uuid(),
  period_type text not null check (period_type in ('week','month')),
  period_start date not null, period_end date not null,
  winner_id uuid references public.profiles(id) on delete set null, winner_xp int,
  closed_at timestamptz not null default now(), unique (period_type, period_start));

insert into public.achievements (code,name,description,icon,category,rarity,criteria_type,criteria_value,xp_reward,sort_order) values
 ('first_presence','Primeira presença','Faça seu primeiro check-in.','fa-door-open','frequência','common','presences',1,10,10),
 ('first_wod','Primeiro WOD','Conclua seu primeiro treino.','fa-dumbbell','treino','common','workouts',1,20,20),
 ('workouts_5','5 treinos','Conclua 5 treinos.','fa-fire','treino','common','workouts',5,30,30),
 ('workouts_10','10 treinos','Conclua 10 treinos.','fa-fire-flame-curved','treino','rare','workouts',10,50,40),
 ('workouts_25','25 treinos','Conclua 25 treinos.','fa-bolt','treino','rare','workouts',25,100,50),
 ('workouts_50','50 treinos','Conclua 50 treinos.','fa-medal','treino','epic','workouts',50,200,60),
 ('streak_7','7 dias seguidos','7 dias de treino programado seguidos com presença.','fa-calendar-check','frequência','rare','streak',7,70,70),
 ('presences_30','30 presenças','Acumule 30 presenças.','fa-calendar-days','frequência','rare','presences',30,100,80),
 ('level_3','Nível 3','Chegue ao nível 3.','fa-arrow-up','nível','common','level',3,0,90),
 ('level_5','Nível 5','Chegue ao nível 5.','fa-angles-up','nível','rare','level',5,50,100),
 ('level_10','Nível 10','Chegue ao nível 10.','fa-ranking-star','nível','epic','level',10,150,110),
 ('comeback_14','De volta ao box','Volte a treinar após 14+ dias de ausência.','fa-rotate-left','frequência','common','comeback_days',14,30,120),
 ('weekly_champion','Campeão semanal','Seja quem mais ganhou XP em uma semana.','fa-trophy','trono','epic','weekly_champion',1,100,130),
 ('monthly_champion','Campeão do mês','Seja quem mais ganhou XP em um mês.','fa-crown','trono','legendary','monthly_champion',1,250,140),
 ('throne_24h','24h no Trono','Acumule 24 horas no primeiro lugar.','fa-chess-king','trono','epic','throne_hours',24,100,150),
 ('throne_7d','7 dias no Trono','7 dias seguidos no primeiro lugar.','fa-gem','trono','legendary','throne_days',7,250,160);

-- ===== Funções internas (sem acesso direto do cliente) =====
create or replace function public.rule_xp(p_code text) returns int language sql stable security definer set search_path = public as
$$ select coalesce((select xp from xp_rules where code = p_code and active), 0) $$;

create or replace function public.ensure_user_xp(p_uid uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into user_xp (user_id) values (p_uid) on conflict do nothing;
  insert into level_history (user_id, level) values (p_uid, 1) on conflict do nothing;
end $$;

create or replace function public.apply_xp() returns trigger language plpgsql security definer set search_path = public as $$
declare old_lvl int; tot int; new_lvl int;
begin
  perform ensure_user_xp(new.user_id);
  select level into old_lvl from user_xp where user_id = new.user_id for update;
  update user_xp set xp_total = xp_total + new.amount, updated_at = now() where user_id = new.user_id returning xp_total into tot;
  new_lvl := coalesce((select max(level) from levels where min_xp <= tot), 1);
  update user_xp set level = new_lvl where user_id = new.user_id;
  if new_lvl > old_lvl then
    insert into level_history (user_id, level) select new.user_id, l.level from levels l where l.level > old_lvl and l.level <= new_lvl on conflict do nothing;
  end if;
  return new;
end $$;
create trigger xp_tx_apply after insert on public.xp_transactions for each row execute function public.apply_xp();

create or replace function public.award_xp(p_uid uuid, p_amount int, p_source text, p_reason text, p_key text,
  p_ref text default null, p_by uuid default null, p_reverses uuid default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int; cur int;
begin
  if p_amount = 0 then return false; end if;
  if p_amount < 0 then
    select xp_total into cur from user_xp where user_id = p_uid;
    if coalesce(cur, 0) + p_amount < 0 then raise exception 'O saldo de XP do aluno ficaria negativo.'; end if;
  end if;
  insert into xp_transactions (user_id, amount, source, reason, ref_id, idempotency_key, created_by, reverses_id)
  values (p_uid, p_amount, p_source, p_reason, p_ref, p_key, p_by, p_reverses)
  on conflict (idempotency_key) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.user_streak(p_uid uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare t date := today_sp(); s int := 0; r record;
begin
  for r in
    select w.workout_date d,
      exists (select 1 from attendance a where a.user_id = p_uid and a.attendance_date = w.workout_date and a.status = 'present') ok,
      exists (select 1 from attendance a where a.user_id = p_uid and a.attendance_date = w.workout_date and a.status = 'justified') jus
    from workouts w where w.status = 'published' and w.workout_date <= t order by w.workout_date desc limit 400
  loop
    if r.ok then s := s + 1; elsif r.d = t or r.jus then continue; else exit; end if;
  end loop;
  return s;
end $$;

create or replace function public.my_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t date := today_sp(); pres int; done int; today_in boolean;
begin
  perform assert_active();
  select count(*) into pres from attendance where user_id = auth.uid() and status = 'present';
  select count(*) into done from workout_sessions where user_id = auth.uid() and status = 'completed';
  select exists (select 1 from attendance where user_id = auth.uid() and attendance_date = t and status = 'present') into today_in;
  return jsonb_build_object('presences', pres, 'completed', done, 'streak', user_streak(auth.uid()), 'checked_in_today', today_in);
end $$;

-- ===== O Trono =====
-- Líder = maior xp_total (>0) entre alunos ativos; desempate: quem atingiu o total primeiro (user_xp.updated_at), depois id.
create or replace function public.refresh_throne() returns void language plpgsql security definer set search_path = public as $$
declare leader uuid; cur_id uuid; cur_user uuid;
begin
  perform pg_advisory_xact_lock(777001);
  select p.id into leader from profiles p join user_xp x on x.user_id = p.id
   where p.status = 'active' and p.profile_setup_done and x.xp_total > 0
     and not exists (select 1 from user_roles r where r.user_id = p.id and r.active)
   order by x.xp_total desc, x.updated_at asc, p.id asc limit 1;
  select id, user_id into cur_id, cur_user from throne_history where ended_at is null;
  if cur_id is not null and (leader is null or cur_user <> leader) then
    update throne_history set ended_at = now() where id = cur_id; cur_id := null;
  end if;
  if leader is not null and cur_id is null then insert into throne_history (user_id) values (leader); end if;
end $$;
create or replace function public.on_user_xp_change() returns trigger language plpgsql security definer set search_path = public as $$
begin perform refresh_throne(); return new; end $$;
create trigger user_xp_throne after update of xp_total on public.user_xp for each row execute function public.on_user_xp_change();

-- Fecha semanas/meses concluídos: campeão = quem mais ganhou XP no período (mesmos desempates, por data de São Paulo).
create or replace function public.close_periods() returns void language plpgsql security definer set search_path = public as $$
declare t text; step interval; cur_start date; last_closed date; s date; e date; first_tx date; win uuid; wxp int;
begin
  perform pg_advisory_xact_lock(777002);
  select (min(created_at) at time zone 'America/Sao_Paulo')::date into first_tx from xp_transactions;
  if first_tx is null then return; end if;
  foreach t in array array['week','month'] loop
    step := case t when 'week' then interval '7 days' else interval '1 month' end;
    cur_start := date_trunc(t, today_sp()::timestamp)::date;
    select max(period_start) into last_closed from leaderboard_periods where period_type = t;
    s := coalesce(last_closed + step, date_trunc(t, first_tx::timestamp))::date;
    while s < cur_start loop
      e := (s + step)::date;
      win := null; wxp := null;
      select x.user_id, sum(x.amount)::int into win, wxp from xp_transactions x join profiles p on p.id = x.user_id
       where (x.created_at at time zone 'America/Sao_Paulo')::date >= s and (x.created_at at time zone 'America/Sao_Paulo')::date < e
         and p.status = 'active' and not exists (select 1 from user_roles r where r.user_id = x.user_id and r.active)
       group by x.user_id having sum(x.amount) > 0
       order by sum(x.amount) desc, max(x.created_at) asc, x.user_id asc limit 1;
      insert into leaderboard_periods (period_type, period_start, period_end, winner_id, winner_xp) values (t, s, e - 1, win, wxp) on conflict do nothing;
      s := e;
    end loop;
  end loop;
end $$;

-- Métricas separadas: tempo total no trono x dias consecutivos (derivadas do histórico persistido).
create or replace function public.throne_summary(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare total bigint; cur bigint; best int; curdays int;
begin
  select coalesce(sum(extract(epoch from (coalesce(ended_at, now()) - started_at))), 0)::bigint into total from throne_history where user_id = p_uid;
  select extract(epoch from now() - started_at)::bigint into cur from throne_history where user_id = p_uid and ended_at is null;
  with d as (select distinct gs::date as day from throne_history t,
      generate_series((t.started_at at time zone 'America/Sao_Paulo')::date::timestamp, (coalesce(t.ended_at, now()) at time zone 'America/Sao_Paulo')::date::timestamp, interval '1 day') gs
      where t.user_id = p_uid),
    g as (select day, day - (row_number() over (order by day))::int as grp from d),
    runs as (select max(day) as e, count(*)::int as n from g group by grp)
  select coalesce(max(n), 0), coalesce(max(n) filter (where e = today_sp()), 0) into best, curdays from runs;
  return jsonb_build_object('total_seconds', total, 'current_reign_seconds', coalesce(cur, 0), 'best_consecutive_days', best, 'current_consecutive_days', curdays);
end $$;

-- ===== Conquistas =====
create or replace function public.ach_value(p_uid uuid, p_type text) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare v numeric;
begin
  case p_type
    when 'presences' then select count(*) into v from attendance where user_id = p_uid and status = 'present';
    when 'workouts' then select count(*) into v from workout_sessions where user_id = p_uid and status = 'completed';
    when 'streak' then v := user_streak(p_uid);
    when 'level' then select coalesce(max(level), 1) into v from user_xp where user_id = p_uid;
    when 'throne_hours' then v := (throne_summary(p_uid)->>'total_seconds')::numeric / 3600;
    when 'throne_days' then v := (throne_summary(p_uid)->>'best_consecutive_days')::numeric;
    when 'weekly_champion' then select count(*) into v from leaderboard_periods where period_type = 'week' and winner_id = p_uid;
    when 'monthly_champion' then select count(*) into v from leaderboard_periods where period_type = 'month' and winner_id = p_uid;
    when 'comeback_days' then
      select coalesce(max(gap), 0) into v from (select attendance_date - lag(attendance_date) over (order by attendance_date) as gap
        from attendance where user_id = p_uid and status = 'present') g;
    else v := 0;
  end case;
  return coalesce(v, 0);
end $$;

-- Sem recursão: laço limitado (máx. 5 passadas) em vez de trigger; o XP de conquista não chama este laço de novo.
create or replace function public.check_achievements(p_uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb := '[]'; a record; ins int; changed boolean := true; loops int := 0;
begin
  perform close_periods();
  while changed and loops < 5 loop
    changed := false; loops := loops + 1;
    for a in select * from achievements ac where ac.active and not exists
        (select 1 from user_achievements ua where ua.user_id = p_uid and ua.achievement_id = ac.id) order by ac.sort_order loop
      if ach_value(p_uid, a.criteria_type) >= a.criteria_value then
        insert into user_achievements (user_id, achievement_id) values (p_uid, a.id) on conflict do nothing;
        get diagnostics ins = row_count;
        if ins > 0 then
          changed := true;
          res := res || jsonb_build_object('name', a.name, 'icon', a.icon, 'rarity', a.rarity, 'xp', a.xp_reward);
          perform award_xp(p_uid, a.xp_reward, 'achievement', 'Conquista: ' || a.name, 'ach:' || p_uid || ':' || a.id, a.id::text);
        end if;
      end if;
    end loop;
  end loop;
  return res;
end $$;

-- ===== Caminhos controlados de XP =====
create or replace function public.check_in() returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := today_sp(); n int; xp int := 0; l0 int; l1 int; ach jsonb;
begin
  perform assert_active();
  select coalesce(max(level), 1) into l0 from user_xp where user_id = auth.uid();
  insert into attendance (user_id, attendance_date, status, source, created_by) values (auth.uid(), d, 'present', 'self', auth.uid())
  on conflict (user_id, attendance_date) do nothing;
  get diagnostics n = row_count;
  if n > 0 and award_xp(auth.uid(), rule_xp('checkin'), 'checkin', 'Check-in diário', 'checkin:' || auth.uid() || ':' || d, d::text) then xp := rule_xp('checkin'); end if;
  ach := check_achievements(auth.uid());
  select coalesce(max(level), 1) into l1 from user_xp where user_id = auth.uid();
  return jsonb_build_object('date', d, 'created', n > 0, 'xp', xp, 'level_up', l1 > l0, 'level', l1, 'unlocked', ach);
end $$;

drop function public.finish_workout_session(uuid, jsonb);
create function public.finish_workout_session(p_session_id uuid, p_result jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.workout_sessions; wt text; valid boolean; xp int := 0; l0 int; l1 int; ach jsonb;
begin
  perform assert_active();
  select * into s from workout_sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then raise exception 'Sessão não encontrada.'; end if;
  if s.status = 'completed' then raise exception 'Este treino já foi finalizado.'; end if;
  select coalesce(max(level), 1) into l0 from user_xp where user_id = auth.uid();
  select result_type into wt from workouts where id = s.workout_id;
  update workout_sessions set status = 'completed', finished_at = now() where id = s.id;
  insert into workout_results (session_id, time_seconds, rounds, reps, load_kg, notes)
  values (s.id, nullif(p_result->>'time_seconds','')::int, nullif(p_result->>'rounds','')::int,
          nullif(p_result->>'reps','')::int, nullif(p_result->>'load_kg','')::numeric, nullif(left(p_result->>'notes', 500), ''));
  valid := wt <> 'none' and (coalesce(nullif(p_result->>'time_seconds','')::int, 0) > 0 or coalesce(nullif(p_result->>'rounds','')::int, 0) > 0
        or coalesce(nullif(p_result->>'reps','')::int, 0) > 0 or coalesce(nullif(p_result->>'load_kg','')::numeric, 0) > 0);
  if award_xp(auth.uid(), rule_xp('workout_completed'), 'workout_completed', 'Treino concluído', 'workout:' || s.id, s.id::text) then xp := xp + rule_xp('workout_completed'); end if;
  if valid and award_xp(auth.uid(), rule_xp('result_logged'), 'result_logged', 'Resultado registrado', 'result:' || s.id, s.id::text) then xp := xp + rule_xp('result_logged'); end if;
  ach := check_achievements(auth.uid());
  select coalesce(max(level), 1) into l1 from user_xp where user_id = auth.uid();
  return jsonb_build_object('xp', xp, 'level_up', l1 > l0, 'level', l1, 'unlocked', ach);
end $$;

-- Presença registrada pelo treinador concede o mesmo XP de check-in (mesma chave: sem duplicar).
create or replace function public.admin_set_attendance(p_user uuid, p_date date, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Acesso restrito ao treinador.'; end if;
  if p_note is null or length(trim(p_note)) < 3 then raise exception 'Informe uma justificativa.'; end if;
  if p_status not in ('present','justified') then raise exception 'Status inválido.'; end if;
  insert into attendance (user_id, attendance_date, status, source, note, created_by)
  values (p_user, p_date, p_status, 'admin', trim(p_note), auth.uid())
  on conflict (user_id, attendance_date) do update set status = excluded.status, source = 'admin', note = excluded.note, created_by = auth.uid();
  insert into admin_audit_logs (actor_id, action, target_table, target_id, details)
  values (auth.uid(), 'set_attendance', 'attendance', p_user::text, jsonb_build_object('date', p_date, 'status', p_status, 'note', trim(p_note)));
  if p_status = 'present' then
    perform award_xp(p_user, rule_xp('checkin'), 'checkin', 'Presença registrada pelo treinador', 'checkin:' || p_user || ':' || p_date, p_date::text, auth.uid());
    perform check_achievements(p_user);
  end if;
end $$;

create or replace function public.admin_grant_xp(p_user uuid, p_amount int, p_kind text, p_reason text, p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare done boolean;
begin
  if not is_admin() then raise exception 'Acesso restrito ao treinador.'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Informe uma justificativa.'; end if;
  if p_kind not in ('manual_bonus','adjustment') then raise exception 'Tipo inválido.'; end if;
  if p_amount = 0 or abs(p_amount) > 10000 then raise exception 'Valor de XP inválido.'; end if;
  if p_key is null or length(p_key) < 8 then raise exception 'Chave de idempotência ausente.'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'Aluno não encontrado.'; end if;
  done := award_xp(p_user, p_amount, p_kind, trim(p_reason), 'manual:' || p_key, null, auth.uid());
  if done then
    insert into admin_audit_logs (actor_id, action, target_table, target_id, details)
    values (auth.uid(), 'grant_xp', 'xp_transactions', p_user::text, jsonb_build_object('amount', p_amount, 'kind', p_kind, 'reason', trim(p_reason)));
    perform check_achievements(p_user);
  end if;
  return done;
end $$;

create or replace function public.admin_reverse_xp(p_tx uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
declare t xp_transactions; done boolean;
begin
  if not is_admin() then raise exception 'Acesso restrito ao treinador.'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Informe uma justificativa.'; end if;
  select * into t from xp_transactions where id = p_tx;
  if not found then raise exception 'Transação não encontrada.'; end if;
  if t.source = 'reversal' then raise exception 'Não é possível estornar um estorno.'; end if;
  done := award_xp(t.user_id, -t.amount, 'reversal', trim(p_reason), 'reversal:' || t.id, t.id::text, auth.uid(), t.id);
  if done then
    insert into admin_audit_logs (actor_id, action, target_table, target_id, details)
    values (auth.uid(), 'reverse_xp', 'xp_transactions', t.id::text, jsonb_build_object('amount', -t.amount, 'reason', trim(p_reason)));
  end if;
  return done;
end $$;

create or replace function public.admin_reconcile_xp() returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'Acesso restrito ao treinador.'; end if;
  with sums as (select user_id, sum(amount)::int total from xp_transactions group by user_id)
  update user_xp x set xp_total = s.total, level = coalesce((select max(l.level) from levels l where l.min_xp <= s.total), 1), updated_at = now()
  from sums s where s.user_id = x.user_id
    and (x.xp_total <> s.total or x.level <> coalesce((select max(l.level) from levels l where l.min_xp <= s.total), 1));
  get diagnostics n = row_count;
  insert into admin_audit_logs (actor_id, action, target_table, details) values (auth.uid(), 'reconcile_xp', 'user_xp', jsonb_build_object('fixed', n));
  return jsonb_build_object('fixed', n);
end $$;

-- ===== Leituras para o app =====
create or replace function public.get_xp_ranking(p_limit int default 50, p_offset int default 0)
returns table (rank bigint, user_id uuid, display_name text, avatar_path text, avatar_url text, level int, xp_total int, gap_to_first int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_active();
  return query
  with r as (
    select p.id as pid, p.display_name as dn, p.avatar_path as ap, p.avatar_url as au, coalesce(x.level, 1) as lvl, coalesce(x.xp_total, 0) as xp,
      row_number() over (order by coalesce(x.xp_total, 0) desc, x.updated_at asc nulls last, p.id) as rn
    from profiles p left join user_xp x on x.user_id = p.id
    where p.status = 'active' and p.profile_setup_done and not exists (select 1 from user_roles ur where ur.user_id = p.id and ur.active))
  select r.rn, r.pid, r.dn, r.ap, r.au, r.lvl, r.xp, (max(r.xp) over () - r.xp)::int, r.pid = auth.uid()
  from r order by r.rn limit greatest(least(p_limit, 100), 1) offset greatest(p_offset, 0);
end $$;

-- Frequência (janela em dias). Faltas só aparecem para o próprio aluno e para o treinador.
create or replace function public.get_attendance_ranking(p_days int default 30)
returns table (user_id uuid, display_name text, avatar_path text, avatar_url text, presences int, completed int, workout_days int, frequency_pct int, streak int, absences int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare t date := today_sp(); d1 date := today_sp() - (greatest(least(p_days, 365), 7) - 1);
begin
  perform assert_active();
  return query
  with dd as (select workout_date as d from workouts where status = 'published' and workout_date between d1 and t),
  nd as (select count(*)::int as n from dd),
  q as (
    select p.id as pid, p.display_name as dn, p.avatar_path as ap, p.avatar_url as au,
      (select count(*) from attendance a where a.user_id = p.id and a.status = 'present' and a.attendance_date between d1 and t)::int as pres,
      (select count(*) from workout_sessions w where w.user_id = p.id and w.status = 'completed' and (w.finished_at at time zone 'America/Sao_Paulo')::date between d1 and t)::int as comp,
      (select count(*) from attendance a join dd on dd.d = a.attendance_date where a.user_id = p.id and a.status = 'present')::int as onday,
      (select count(*) from attendance a join dd on dd.d = a.attendance_date where a.user_id = p.id)::int as anyrec
    from profiles p where p.status = 'active' and p.profile_setup_done and not exists (select 1 from user_roles ur where ur.user_id = p.id and ur.active))
  select q.pid, q.dn, q.ap, q.au, q.pres, q.comp, (select n from nd),
    case when (select n from nd) = 0 then 0 else round(100.0 * q.onday / (select n from nd))::int end,
    user_streak(q.pid),
    case when q.pid = auth.uid() or is_admin() then greatest((select n from nd) - q.anyrec, 0) end,
    q.pid = auth.uid()
  from q order by 8 desc, 5 desc, 9 desc, q.dn;
end $$;

create or replace function public.get_throne() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform assert_active(); perform refresh_throne(); perform close_periods();
  return jsonb_build_object(
    'king', (select jsonb_build_object('name', p.display_name, 'avatar_path', p.avatar_path, 'avatar_url', p.avatar_url, 'level', x.level, 'xp', x.xp_total,
               'since', t.started_at, 'summary', throne_summary(p.id))
             from throne_history t join profiles p on p.id = t.user_id join user_xp x on x.user_id = p.id where t.ended_at is null),
    'history', coalesce((select jsonb_agg(h order by h->>'started_at' desc) from (select jsonb_build_object('name', p.display_name, 'avatar_path', p.avatar_path, 'avatar_url', p.avatar_url,
        'started_at', t.started_at, 'ended_at', t.ended_at, 'seconds', extract(epoch from (coalesce(t.ended_at, now()) - t.started_at))::bigint) as h
        from throne_history t join profiles p on p.id = t.user_id order by t.started_at desc limit 15) q), '[]'::jsonb),
    'hall', coalesce((select jsonb_agg(h order by (h->>'seconds')::bigint desc) from (select jsonb_build_object('name', p.display_name, 'avatar_path', p.avatar_path, 'avatar_url', p.avatar_url,
        'seconds', sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at)))::bigint) as h
        from throne_history t join profiles p on p.id = t.user_id group by p.id order by sum(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at))) desc limit 5) q), '[]'::jsonb),
    'champions', coalesce((select jsonb_agg(jsonb_build_object('type', lp.period_type, 'start', lp.period_start, 'name', p.display_name, 'xp', lp.winner_xp) order by lp.period_start desc)
        from (select * from leaderboard_periods where winner_id is not null order by period_start desc limit 8) lp join profiles p on p.id = lp.winner_id), '[]'::jsonb));
end $$;

create or replace function public.my_gamification() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); x user_xp; cur_min int; nxt int; rnk bigint; tot int; gap int; ach jsonb;
begin
  perform assert_active();
  perform ensure_user_xp(uid);
  ach := check_achievements(uid);
  select * into x from user_xp where user_id = uid;
  select min_xp into cur_min from levels where level = x.level;
  select min_xp into nxt from levels where level = x.level + 1;
  select r.rank, r.gap_to_first into rnk, gap from get_xp_ranking(1000, 0) r where r.is_me;
  select count(*) into tot from get_xp_ranking(1000, 0);
  return jsonb_build_object('xp_total', x.xp_total, 'level', x.level, 'level_min_xp', cur_min, 'next_level_xp', nxt,
    'progress_pct', case when nxt is null then 100 else round(100.0 * (x.xp_total - cur_min) / (nxt - cur_min)) end,
    'rank', rnk, 'total_students', tot, 'gap_to_first', gap, 'unlocked', ach,
    'achievements_unlocked', (select count(*) from user_achievements where user_id = uid),
    'recent_achievements', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'icon', a.icon, 'rarity', a.rarity) order by ua.unlocked_at desc)
        from (select * from user_achievements where user_id = uid order by unlocked_at desc limit 3) ua join achievements a on a.id = ua.achievement_id), '[]'::jsonb),
    'levels', coalesce((select jsonb_agg(jsonb_build_object('level', level, 'reached_at', reached_at) order by level) from level_history where user_id = uid), '[]'::jsonb),
    'throne', throne_summary(uid));
end $$;

create or replace function public.my_achievements() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  perform assert_active();
  perform check_achievements(uid);
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'description', a.description, 'icon', a.icon, 'category', a.category,
      'rarity', a.rarity, 'xp_reward', a.xp_reward, 'target', a.criteria_value,
      'current', round(least(ach_value(uid, a.criteria_type), a.criteria_value)::numeric, 1), 'unlocked_at', ua.unlocked_at)
      order by (ua.unlocked_at is null), a.sort_order)
    from achievements a left join user_achievements ua on ua.achievement_id = a.id and ua.user_id = uid where a.active), '[]'::jsonb);
end $$;

-- ===== Auditoria de configuração =====
create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if tg_op = 'DELETE' then r := to_jsonb(old); else r := to_jsonb(new); end if;
  if auth.uid() is not null then
    insert into admin_audit_logs (actor_id, action, target_table, target_id, details)
    values (auth.uid(), lower(tg_op), tg_table_name, coalesce(r->>'id', r->>'code', r->>'level'),
      jsonb_build_object('status', r->>'status', 'date', r->>'workout_date', 'title', coalesce(r->>'title', r->>'name'), 'xp', coalesce(r->>'xp', r->>'min_xp')));
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
create trigger xp_rules_audit after insert or update or delete on public.xp_rules for each row execute function public.audit_row();
create trigger achievements_audit after insert or update or delete on public.achievements for each row execute function public.audit_row();
create trigger levels_audit after insert or update or delete on public.levels for each row execute function public.audit_row();

-- ===== RLS =====
alter table public.xp_rules enable row level security;
alter table public.levels enable row level security;
alter table public.user_xp enable row level security;
alter table public.level_history enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.throne_history enable row level security;
alter table public.leaderboard_periods enable row level security;

create policy rules_read on public.xp_rules for select to authenticated using (true);
create policy rules_admin on public.xp_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy levels_read on public.levels for select to authenticated using (true);
create policy levels_admin on public.levels for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ach_read on public.achievements for select to authenticated using (true);
create policy ach_admin on public.achievements for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy uxp_read on public.user_xp for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy lh_read on public.level_history for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy xptx_read on public.xp_transactions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy uach_read on public.user_achievements for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy throne_admin_read on public.throne_history for select to authenticated using (public.is_admin());
create policy periods_admin_read on public.leaderboard_periods for select to authenticated using (public.is_admin());
-- user_xp, level_history, xp_transactions, user_achievements, throne_history, leaderboard_periods: sem escrita pelo cliente.
revoke insert, update, delete on public.user_xp, public.level_history, public.xp_transactions, public.user_achievements,
  public.throne_history, public.leaderboard_periods from anon, authenticated;

revoke all on function public.rule_xp(text), public.ensure_user_xp(uuid), public.award_xp(uuid,int,text,text,text,text,uuid,uuid),
  public.user_streak(uuid), public.refresh_throne(), public.close_periods(), public.throne_summary(uuid),
  public.ach_value(uuid,text), public.check_achievements(uuid), public.apply_xp(), public.on_user_xp_change() from public, anon, authenticated;
revoke all on function public.get_xp_ranking(int,int), public.get_attendance_ranking(int), public.get_throne(), public.my_gamification(),
  public.my_achievements(), public.admin_grant_xp(uuid,int,text,text,text), public.admin_reverse_xp(uuid,text), public.admin_reconcile_xp(),
  public.finish_workout_session(uuid,jsonb), public.my_stats(), public.check_in() from public, anon;
grant execute on function public.get_xp_ranking(int,int), public.get_attendance_ranking(int), public.get_throne(), public.my_gamification(),
  public.my_achievements(), public.admin_grant_xp(uuid,int,text,text,text), public.admin_reverse_xp(uuid,text), public.admin_reconcile_xp(),
  public.finish_workout_session(uuid,jsonb), public.my_stats(), public.check_in() to authenticated;

-- ===== Retroativo: XP do que já existia (idempotente, mesmas chaves dos caminhos novos) =====
insert into public.xp_transactions (user_id, amount, source, reason, ref_id, idempotency_key, created_at)
select a.user_id, public.rule_xp('checkin'), 'checkin', 'Check-in diário (retroativo)', a.attendance_date::text, 'checkin:' || a.user_id || ':' || a.attendance_date, a.created_at
from public.attendance a where a.status = 'present' and public.rule_xp('checkin') > 0
  and not exists (select 1 from public.user_roles r where r.user_id = a.user_id and r.active) order by a.created_at on conflict do nothing;
insert into public.xp_transactions (user_id, amount, source, reason, ref_id, idempotency_key, created_at)
select s.user_id, public.rule_xp('workout_completed'), 'workout_completed', 'Treino concluído (retroativo)', s.id::text, 'workout:' || s.id, s.finished_at
from public.workout_sessions s where s.status = 'completed' and public.rule_xp('workout_completed') > 0
  and not exists (select 1 from public.user_roles r where r.user_id = s.user_id and r.active) order by s.finished_at on conflict do nothing;
insert into public.xp_transactions (user_id, amount, source, reason, ref_id, idempotency_key, created_at)
select s.user_id, public.rule_xp('result_logged'), 'result_logged', 'Resultado registrado (retroativo)', s.id::text, 'result:' || s.id, s.finished_at
from public.workout_sessions s join public.workout_results r on r.session_id = s.id join public.workouts w on w.id = s.workout_id
where s.status = 'completed' and w.result_type <> 'none' and public.rule_xp('result_logged') > 0
  and (coalesce(r.time_seconds,0) > 0 or coalesce(r.rounds,0) > 0 or coalesce(r.reps,0) > 0 or coalesce(r.load_kg,0) > 0)
  and not exists (select 1 from public.user_roles ur where ur.user_id = s.user_id and ur.active) order by s.finished_at on conflict do nothing;
