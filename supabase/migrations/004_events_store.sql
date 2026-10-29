-- BOX Jardim Silvina · Fase 4 · Eventos, loja e storage de imagens
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  cover_path text, description text,
  starts_at timestamptz not null,
  location text, category text, extra_info text, rules text,
  external_url text check (external_url is null or external_url ~* '^https?://'),
  status text not null default 'draft' check (status in ('draft','published','closed','cancelled')),
  xp_reward int not null default 0 check (xp_reward between 0 and 10000),
  registration_enabled boolean not null default true,
  rescheduled boolean not null default false,          -- true quando a data muda após publicado
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index events_status_start on public.events (status, starts_at);
create or replace function public.events_before() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.starts_at <> old.starts_at and old.status = 'published' then new.rescheduled := true; end if;
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); end if;
  return new;
end $$;
create trigger events_before before insert or update on public.events for each row execute function public.events_before();

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('interested','confirmed','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (event_id, user_id));
create table public.event_participations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  validated_by uuid references auth.users(id), validated_at timestamptz not null default now(),
  unique (event_id, user_id));                          -- 1 participação (e 1 XP) por aluno por evento

create table public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text, price numeric(10,2) check (price is null or price >= 0),
  category text, image_path text,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  availability text not null default 'available' check (availability in ('available','unavailable')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index products_list on public.products (status, featured desc, sort_order);
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create trigger events_audit after insert or update or delete on public.events for each row execute function public.audit_row();
create trigger products_audit after insert or update or delete on public.products for each row execute function public.audit_row();

-- ===== RLS =====
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_participations enable row level security;
alter table public.products enable row level security;
create policy events_read on public.events for select to authenticated using (status <> 'draft' or public.is_admin());
create policy events_admin on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy reg_read on public.event_registrations for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy part_read on public.event_participations for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy products_read on public.products for select to authenticated using (status = 'published' or public.is_admin());
create policy products_admin on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.event_registrations, public.event_participations from anon, authenticated;

-- ===== Funções =====
create or replace function public.set_event_registration(p_event uuid, p_status text) returns text
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  perform assert_active();
  if p_status not in ('interested','confirmed','cancelled') then raise exception 'Status inválido.'; end if;
  select * into e from events where id = p_event;
  if not found or e.status <> 'published' then raise exception 'Evento indisponível.'; end if;
  if not e.registration_enabled then raise exception 'As inscrições deste evento não estão habilitadas.'; end if;
  if e.starts_at <= now() then raise exception 'O evento já começou.'; end if;
  insert into event_registrations (event_id, user_id, status) values (p_event, auth.uid(), p_status)
  on conflict (event_id, user_id) do update set status = excluded.status, updated_at = now();
  return p_status;
end $$;

-- Só o treinador valida a participação; o XP do evento é concedido uma única vez (chave por evento+aluno).
create or replace function public.admin_validate_participation(p_event uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare e events; n int;
begin
  if not is_admin() then raise exception 'Acesso restrito ao treinador.'; end if;
  select * into e from events where id = p_event;
  if not found or e.status in ('draft','cancelled') then raise exception 'Evento indisponível para validação.'; end if;
  if e.starts_at > now() then raise exception 'O evento ainda não aconteceu.'; end if;
  if not exists (select 1 from profiles where id = p_user and status = 'active') then raise exception 'Aluno não encontrado ou suspenso.'; end if;
  insert into event_participations (event_id, user_id, validated_by) values (p_event, p_user, auth.uid()) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    perform award_xp(p_user, e.xp_reward, 'event', 'Participação: ' || e.title, 'event:' || p_event || ':' || p_user, p_event::text, auth.uid());
    insert into admin_audit_logs (actor_id, action, target_table, target_id, details)
    values (auth.uid(), 'validate_participation', 'event_participations', p_event::text, jsonb_build_object('user', p_user, 'xp', e.xp_reward));
    perform check_achievements(p_user);
  end if;
  return n > 0;
end $$;

create or replace function public.admin_move_product(p_id uuid, p_dir int) returns void
language plpgsql security definer set search_path = public as $$
declare a products; b products;
begin
  if not is_admin() then raise exception 'Acesso restrito ao treinador.'; end if;
  select * into a from products where id = p_id;
  if not found then raise exception 'Produto não encontrado.'; end if;
  if p_dir < 0 then select * into b from products where sort_order < a.sort_order order by sort_order desc limit 1;
  else select * into b from products where sort_order > a.sort_order order by sort_order asc limit 1; end if;
  if found then
    update products set sort_order = b.sort_order where id = a.id;
    update products set sort_order = a.sort_order where id = b.id;
  end if;
end $$;
revoke all on function public.set_event_registration(uuid,text), public.admin_validate_participation(uuid,uuid), public.admin_move_product(uuid,int) from public, anon;
grant execute on function public.set_event_registration(uuid,text), public.admin_validate_participation(uuid,uuid), public.admin_move_product(uuid,int) to authenticated;

-- ===== Conquistas de evento (reaproveita ach_value existente) =====
alter table public.achievements drop constraint achievements_criteria_type_check;
alter table public.achievements add constraint achievements_criteria_type_check check (criteria_type in
  ('presences','workouts','streak','level','throne_hours','throne_days','weekly_champion','monthly_champion','comeback_days','events'));
alter function public.ach_value(uuid, text) rename to ach_value_base;
create function public.ach_value(p_uid uuid, p_type text) returns numeric
language plpgsql stable security definer set search_path = public as $$
begin
  if p_type = 'events' then return (select count(*) from event_participations where user_id = p_uid); end if;
  return ach_value_base(p_uid, p_type);
end $$;
revoke all on function public.ach_value(uuid,text), public.ach_value_base(uuid,text) from public, anon, authenticated;
insert into public.achievements (code,name,description,icon,category,rarity,criteria_type,criteria_value,xp_reward,sort_order) values
 ('first_event','Primeiro evento','Participe (validado pelo treinador) do seu primeiro evento.','fa-flag','eventos','common','events',1,30,170),
 ('events_5','Rato de evento','Participe de 5 eventos.','fa-people-group','eventos','rare','events',5,100,180);

-- ===== Storage: banners e produtos (públicos por serem vitrine; escrita só do treinador) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('event-banners','event-banners', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif']),
 ('product-images','product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy banners_read on storage.objects for select using (bucket_id = 'event-banners');
create policy banners_ins on storage.objects for insert to authenticated with check (bucket_id = 'event-banners' and public.is_admin());
create policy banners_upd on storage.objects for update to authenticated using (bucket_id = 'event-banners' and public.is_admin());
create policy banners_del on storage.objects for delete to authenticated using (bucket_id = 'event-banners' and public.is_admin());
create policy products_img_read on storage.objects for select using (bucket_id = 'product-images');
create policy products_img_ins on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy products_img_upd on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
create policy products_img_del on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
