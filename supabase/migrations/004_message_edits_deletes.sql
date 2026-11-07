-- ============================================================================
-- Relay Messenger — Message Edits, Deletes & View-Once
-- ============================================================================
-- Run this in your Supabase project SQL Editor (or `supabase db push`).
--
-- Adds soft-delete support to messages so thread history continuity is
-- preserved while content is removed, plus indexes for edit/delete lookups.
--
-- Writes go through the `editMessage` / `deleteMessage` / `burnViewOnce`
-- server actions using the service role.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Soft-delete flag on messages
-- ----------------------------------------------------------------------------

alter table public.messages
  add column if not exists is_deleted boolean default false;

create index if not exists idx_messages_is_deleted
  on public.messages(is_deleted);

-- ----------------------------------------------------------------------------
-- RLS policies (mirror existing message policies; service-role actions bypass)
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'messages'
      and policyname = 'messages_update_deleted_own'
  ) then
    create policy messages_update_deleted_own
    on public.messages for update
    using (sender_id = auth.uid());
  end if;
end $$;
