-- BOX Jardim Silvina · Fase 1 · Fundação (perfis, papéis, settings, auditoria, storage)
create extension if not exists pgcrypto;

-- ===== Perfis =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_path text,          -- arquivo no bucket 'avatars'
  avatar_url text,           -- avatar inicial vindo do Google (opcional)
  profile_setup_done boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== Papéis (somente o backend escreve) =====
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  active boolean not null default true,
  granted_at timestamptz not null default now()
);
-- Apenas UM administrador ativo.
create unique index one_active_admin on public.user_roles (role) where active and role = 'admin';

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles
                 where user_id = auth.uid() and role = 'admin' and active);
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ===== Configurações =====
create table public.app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.app_settings (key, value) values
  ('box_name', '"BOX Jardim Silvina"'),
  ('timezone', '"America/Sao_Paulo"'),
  ('whatsapp_number', 'null')   -- formato internacional, só dígitos. Ex.: 5511999999999
on conflict do nothing;

-- ===== Auditoria =====
create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id),
  action text not null,
  target_table text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ===== Triggers =====
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Aluno não altera campos protegidos (e-mail, status, data de entrada, id).
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id <> old.id or new.email is distinct from old.email
       or new.status <> old.status or new.joined_at <> old.joined_at then
      raise exception 'Campo protegido: apenas o treinador pode alterar.';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Cria o perfil quando o usuário se cadastra (e-mail/senha ou Google).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy roles_select_own on public.user_roles for select to authenticated
  using (user_id = auth.uid());
revoke insert, update, delete on public.user_roles from anon, authenticated;

create policy settings_read on public.app_settings for select to authenticated using (true);
create policy settings_admin_write on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy audit_admin_read on public.admin_audit_logs for select to authenticated using (public.is_admin());
create policy audit_admin_insert on public.admin_audit_logs for insert to authenticated
  with check (public.is_admin() and actor_id = auth.uid());

-- ===== Storage: avatares =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_read on storage.objects for select using (bucket_id = 'avatars');
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
