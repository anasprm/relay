-- ============================================================================
-- Relay Messenger — Supabase Core Schema Migration
-- ============================================================================
-- Run this in your Supabase project SQL Editor.
-- Creates conversations, conversation_participants, messages tables plus
-- enables Realtime on the messages table for instant sync.
-- ============================================================================

-- Enable Realtime extension (required for postgres_changes subscriptions)
create extension if not exists realtime;

-- ============================================================================
-- Table: users
-- Mirrors lib/types.ts User (server-side source of truth).
-- ============================================================================
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text not null,
  email text,
  accent text default 'emerald',
  avatar_url text,
  online boolean default false,
  last_seen timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.users enable row level security;

-- ============================================================================
-- Table: conversations
-- Mirrors lib/types.ts Conversation (thread metadata).
-- ============================================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean default false,
  name text, -- group name; null for direct threads
  created_by uuid references public.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.conversations enable row level security;

-- ============================================================================
-- Table: conversation_participants
-- Junction table linking users to conversations.
-- ============================================================================
create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  joined_at timestamptz default now(),
  unique (conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;

-- ============================================================================
-- Table: messages
-- Mirrors lib/types.ts Message (message payload).
-- ============================================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.users(id),
  body text,
  kind text default 'text',
  attachment jsonb, -- { url, name, mime, size, kind, duration, width, height }
  anonymous boolean default false,
  ephemeral boolean default false,
  view_once boolean default false,
  view_once_opened boolean default false,
  reactions jsonb default '{}'::jsonb,
  read_by uuid[] default '{}'::uuid[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.messages enable row level security;

-- ============================================================================
-- Indexes for common query patterns
-- ============================================================================
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(created_at desc);
create index if not exists idx_conv_participants_user_id on public.conversation_participants(user_id);
create index if not exists idx_conv_participants_conv_id on public.conversation_participants(conversation_id);

-- ============================================================================
-- Enable Realtime on messages (for instant sync subscriptions)
-- ============================================================================
alter publication supabase_realtime add table public.messages;

-- ============================================================================
-- RLS Policies (permissive for development; tighten for production)
-- ============================================================================

-- Users can read their own profile
create policy if not exists users_select_own
  on public.users for select
  using (auth.uid() = id);

-- Users can read conversations they participate in
create policy if not exists conversations_select_participant
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  );

-- Users can read participants of conversations they join
create policy if not exists participants_select_own
  on public.conversation_participants for select
  using (user_id = auth.uid());

-- Users can read messages in conversations they join
create policy if not exists messages_select_participant
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- Participants can insert messages into conversations they join
create policy if not exists messages_insert_participant
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- Participants can update messages they sent
create policy if not exists messages_update_own
  on public.messages for update
  using (sender_id = auth.uid());
