-- ============================================================================
-- Relay Messenger — Message Reactions
-- ============================================================================
-- Run this in your Supabase project SQL Editor (or `supabase db push`).
--
-- One row per (message, user). Toggling a reaction is a delete/insert on this
-- table, which lets a user hold exactly one reaction per message — matching the
-- `Record<userId, emoji>` shape used by the client.
--
-- Writes go through the `toggleReaction` server action using the service role,
-- so RLS here only matters for any future direct client reads.
--
-- NOTE: `CREATE POLICY IF NOT EXISTS` is not supported by this Postgres version,
-- so policies are created idempotently inside DO blocks instead.
-- ============================================================================

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_reactions enable row level security;

create index if not exists idx_message_reactions_message_id
  on public.message_reactions(message_id);

-- ----------------------------------------------------------------------------
-- RLS policies (permissive mirror of the messages policies)
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'message_reactions'
      and policyname = 'message_reactions_select_participant'
  ) then
    create policy message_reactions_select_participant
    on public.message_reactions for select
    using (
      exists (
        select 1
        from public.messages m
        join public.conversation_participants cp
          on cp.conversation_id = m.conversation_id
        where m.id = message_reactions.message_id
          and cp.user_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'message_reactions'
      and policyname = 'message_reactions_insert_own'
  ) then
    create policy message_reactions_insert_own
    on public.message_reactions for insert
    with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'message_reactions'
      and policyname = 'message_reactions_update_own'
  ) then
    create policy message_reactions_update_own
    on public.message_reactions for update
    using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'message_reactions'
      and policyname = 'message_reactions_delete_own'
  ) then
    create policy message_reactions_delete_own
    on public.message_reactions for delete
    using (user_id = auth.uid());
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Realtime (optional; the app currently delivers reactions over Broadcast)
-- ----------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null;
end $$;
