-- BOX Jardim Silvina · Endurecimento conservador de RLS e perfil
-- Aplicar após 001_foundation.sql. A tabela app_settings deve conter somente
-- configurações deliberadamente públicas; valores secretos devem ficar server-side.

-- Limita leitura não administrativa às chaves públicas conhecidas/usadas pelo app.
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to authenticated
  using (public.is_admin() or key in ('box_name', 'timezone', 'whatsapp_number'));

-- Usuários podem editar apenas os campos de perfil usados pelo fluxo de cadastro.
-- Campos de identidade/estado e timestamps de criação são imutáveis para não-admins.
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.status is distinct from old.status
       or new.joined_at is distinct from old.joined_at
       or new.avatar_url is distinct from old.avatar_url
       or new.created_at is distinct from old.created_at then
      raise exception 'Campo protegido: apenas o treinador pode alterar.';
    end if;
  end if;
  return new;
end $$;
