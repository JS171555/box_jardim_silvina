-- BOX Jardim Silvina · Fila durável de notificações de recompensas
-- As notificações são inseridas na mesma transação que origina cada recompensa.

create table public.reward_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null unique,
  event_type text not null check (event_type in ('xp','achievement','level')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  claim_token uuid,
  claim_expires_at timestamptz,
  acknowledged_at timestamptz
);
create index reward_notifications_pending on public.reward_notifications (user_id, id)
  where acknowledged_at is null;
alter table public.reward_notifications enable row level security;
-- Leitura e confirmação passam pelas RPCs SECURITY DEFINER; clientes não acessam a tabela diretamente.
revoke all on public.reward_notifications from public, anon, authenticated;

create or replace function public.enqueue_xp_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- O aviso de conquista já contém seu XP e sua origem; evita um segundo aviso duplicado.
  if new.amount > 0 and new.source <> 'achievement' then
    insert into public.reward_notifications (user_id, event_key, event_type, payload, created_at)
    values (new.user_id, 'xp:' || new.id::text, 'xp',
      jsonb_build_object('amount', new.amount, 'source', new.source, 'reason', new.reason), new.created_at)
    on conflict (event_key) do nothing;
  end if;
  return new;
end $$;
-- Executa antes de xp_tx_apply por ordenação dos nomes de triggers AFTER INSERT:
-- o aviso de XP da atividade antecede eventual aviso de subida de nível causado por ela.
create trigger xp_tx_01_reward_notification after insert on public.xp_transactions
  for each row execute function public.enqueue_xp_notification();

create or replace function public.enqueue_achievement_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.achievements;
begin
  select * into a from public.achievements where id = new.achievement_id;
  if not found then return new; end if;
  insert into public.reward_notifications (user_id, event_key, event_type, payload, created_at)
  values (new.user_id, 'achievement:' || new.user_id::text || ':' || new.achievement_id::text, 'achievement',
    jsonb_build_object('name', a.name, 'icon', a.icon, 'rarity', a.rarity, 'xp', a.xp_reward), new.unlocked_at)
  on conflict (event_key) do nothing;
  return new;
end $$;
create trigger user_achievements_reward_notification after insert on public.user_achievements
  for each row execute function public.enqueue_achievement_notification();

create or replace function public.enqueue_level_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Nível 1 é inicialização do saldo, não uma subida de nível.
  if new.level > 1 then
    insert into public.reward_notifications (user_id, event_key, event_type, payload, created_at)
    values (new.user_id, 'level:' || new.user_id::text || ':' || new.level::text, 'level',
      jsonb_build_object('level', new.level), new.reached_at)
    on conflict (event_key) do nothing;
  end if;
  return new;
end $$;
create trigger level_history_reward_notification after insert on public.level_history
  for each row execute function public.enqueue_level_notification();

-- Entrega de um aviso por vez. SKIP LOCKED + lease evitam que abas/dispositivos
-- reivindiquem simultaneamente a mesma notificação; um cliente encerrado libera-a após 15 min.
create or replace function public.claim_reward_notification()
returns table (notification_id bigint, event_type text, payload jsonb, claim_token uuid)
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_active();
  return query
  with next_notice as (
    select n.id from public.reward_notifications n
    where n.user_id = auth.uid() and n.acknowledged_at is null
      and (n.claim_expires_at is null or n.claim_expires_at < now())
    order by n.id
    limit 1
    for update skip locked
  )
  update public.reward_notifications n
     set claim_token = gen_random_uuid(), claim_expires_at = now() + interval '15 minutes'
    from next_notice q
   where n.id = q.id
  returning n.id, n.event_type, n.payload, n.claim_token;
end $$;

create or replace function public.ack_reward_notification(p_notification_id bigint, p_claim_token uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public.assert_active();
  update public.reward_notifications
     set acknowledged_at = now(), claim_token = null, claim_expires_at = null
   where id = p_notification_id and user_id = auth.uid()
     and acknowledged_at is null and claim_token = p_claim_token;
  get diagnostics n = row_count;
  return n = 1;
end $$;

revoke all on function public.enqueue_xp_notification(), public.enqueue_achievement_notification(), public.enqueue_level_notification() from public, anon, authenticated;
revoke all on function public.claim_reward_notification(), public.ack_reward_notification(bigint, uuid) from public, anon;
grant execute on function public.claim_reward_notification(), public.ack_reward_notification(bigint, uuid) to authenticated;
