-- ============================================================================
-- Relay Messenger — Message Reads / Delivery Status
-- ============================================================================
-- Run this in your Supabase project SQL Editor (or `supabase db push`).
--
-- Tracks which users have read which messages, enabling WhatsApp-style ticks:
--   single gray  ✓  = sent (persisted to Supabase, not yet read by anyone else)
--   double gray  ✓✓ = delivered (in DB, read only by sender)
--   double blue  ✓✓ = read (read by at least one recipient)
--
-- Writes go through the `markConversationRead` / `markMessageRead` server
-- actions using the service role.
-- ============================================================================

create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_reads enable row level security;

create index if not exists idx_message_reads_message_id
  on public.message_reads(message_id);
create index if not exists idx_message_reads_user_id
  on public.message_reads(user_id);

-- ----------------------------------------------------------------------------
-- RLS policies (permissive mirror of the messages policies)
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'message_reads'
      and policyname = 'message_reads_select_participant'
  ) then
    create policy message_reads_select_participant
    on public.message_reads for select
    using (
      exists (
        select 1
        from public.messages m
        join public.conversation_participants cp
          on cp.conversation_id = m.conversation_id
        where m.id = message_reads.message_id
          and cp.user_id = auth.uid()
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'message_reads'
      and policyname = 'message_reads_insert_own'
  ) then
    create policy message_reads_insert_own
    on public.message_reads for insert
    with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'message_reads'
      and policyname = 'message_reads_delete_own'
  ) then
    create policy message_reads_delete_own
    on public.message_reads for delete
    using (user_id = auth.uid());
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- Realtime (optional; the app delivers read events over Broadcast)
-- ----------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.message_reads;
exception when duplicate_object then null;
end $$;
