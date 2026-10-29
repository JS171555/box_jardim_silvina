-- Provisionamento do treinador (rodar UMA vez, manualmente, no SQL Editor do Supabase).
-- 1) Authentication → Users → "Add user": crie a conta do treinador com e-mail e senha forte (você define, nada fica no código).
-- 2) Troque o e-mail abaixo e execute:
with u as (select id from auth.users where email = 'treinador@exemplo.com')
insert into public.user_roles (user_id, role) select id, 'admin' from u;
insert into public.admin_audit_logs (actor_id, action, target_table, details)
select id, 'admin_provisioned', 'user_roles', '{"by":"owner via SQL editor"}'::jsonb
from auth.users where email = 'treinador@exemplo.com';
-- O índice one_active_admin impede um segundo administrador ativo.
-- Recomendado: ative MFA para essa conta no Supabase Auth.
