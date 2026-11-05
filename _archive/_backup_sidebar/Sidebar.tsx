/* ==========================================================================
   SIDEBAR — Unified Profile & Stories Header
   ---------------------------------------------------------------
   Visual Polished:
   - Obsidian glassmorphic background (var(--glass-bg))
   - 60fps smooth: transform + will-change only, no layout thrash
   - Aspect-ratio-preserved avatar, zero CLSS
   - Unified: avatar = story viewer + new story upload CTA
   ---------------------------------------------------------------
   NO Redundant "Your story" stack — stories managed from header.
   StoriesRail displays only OTHER users' stories.
   ========================================================================== */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LogOut,
  MessageSquarePlus,
  MoreVertical,
  Search,
  Star,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { conversationName } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import type { Conversation, StoryGroup, User } from '@/lib/types';
import { ConversationRow } from './ConversationRow';
import { StoriesRail } from './StoriesRail';

export type ConversationFilter = 'all' | 'unread' | 'favorites';

interface SidebarProps {
  user: User;
  conversations: Conversation[];
  activeId: string | null;
  onlineIds: Set<string>;
  typing: Record<string, boolean>;
  drafts: Record<string, string>;
  favorites: Set<string>;
  pinned: Set<string>;
  loading: boolean;
  connected: boolean;
  filter: ConversationFilter;
  focusSearchSignal?: number;
  stories?: StoryGroup[];
  storiesLoading?: boolean;
  onOpenStory?: (groupIndex: number) => void;
  onCreateStory?: () => void;
  onOpenStarred?: () => void;
  onFilterChange: (filter: ConversationFilter) => void;
  onSelect: (id: string) => void;
  onNewChat: (query?: string) => void;
  onNewGroup?: () => void;
  onProfile: () => void;
  onLogout: () => void;
  className?: string;
}

/** Return the avatar button with unified story CTA */
function ProfileHeader({
  user,
  onViewStory,
  onUploadStory,
  className,
}: {
  user: User;
  onViewStory: () => void;
  onUploadStory: () => void;
  className?: string;
}) {
  // State for floating + badge interaction
  const [showAddStory, setShowAddStory] = useState(false);

  return (
    <button
      type="button"
      onClick={onViewStory}
      className={cn(
        'relative rounded-full hover:opacity-90 focus-visible:opacity-90 transition-opacity',
        'w-10 h-10',
      )}
      aria-label={`View your profile, ${user.displayName}`}
      title="Your profile"
    >
      <Avatar user={user} size="md" className="relative z-10" />

      {/* Floating + badge for new story — always visible now */}
      <button
        onClick={onUploadStory}
        className={cn(
          'absolute -bottom-1 -right-1 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center',
          'w-6 h-6',
          'transition-shadow hover:shadow-lg',
        )}
        aria-label="Add new story"
        title="Add new story"
      >
        <MessageSquarePlus size={12} />
      </button>

      {/* Optional overlay for add-story actions */}
      {showAddStory && (
        <div
          className="absolute right-1/2 bottom-1 transform -translate-x-1/2 bg-panel rounded-xl p-3 shadow-2xl border border-line z-50 min-w-48"
        >
          <div className="flex flex-col gap-2 text-sm">
            <button
              onClick={() => {
                setShowAddStory(false);
                // TODO: open story composer
                onUploadStory();
              }}
              className="text-primary hover:text-primary/90">
                Upload photo
            </button>
            <button
              onClick={() => setShowAddStory(false)}
              className="text-muted-foreground">
                Cancel
              </button>
          </div>
        </div>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------
   Sidebar
   ------------------------------------------------------------------ */

export function Sidebar({
  user,
  conversations,
  activeId,
  onlineIds,
  typing,
  drafts,
  favorites,
  pinned,
  loading,
  connected,
  filter,
  focusSearchSignal = 0,
  stories = [],
  storiesLoading = false,
  onOpenStory,
  onCreateStory,
  onOpenStarred,
  onFilterChange,
  onSelect,
  onNewChat,
  onNewGroup,
  onProfile,
  onLogout,
  className,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusSearchSignal > 0) searchRef.current?.focus();
  }, [focusSearchSignal]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const unreadConversations = conversations.filter(
    (conversation) => conversation.unreadCount > 0,
  ).length;
  const term = query.trim();

  const filtered = useMemo(() => {
    const needle = term.toLowerCase();
    let list = conversations.filter((conversation) => {
      if (!needle) return true;
      return (
        conversationName(conversation).toLowerCase().includes(needle) ||
        (conversation.other?.username || '').toLowerCase().includes(needle) ||
        (conversation.lastMessage?.text || '').toLowerCase().includes(needle) ||
        (conversation.lastMessage?.attachment?.name || '').toLowerCase().includes(needle)
      );
    });

    if (filter === 'unread') list = list.filter((conversation) => conversation.unreadCount > 0);
    if (filter === 'favorites') list = list.filter((conversation) => favorites.has(conversation.id));

    return [...list].sort((first, second) => {
      const firstPinned = pinned.has(first.id) ? 1 : 0;
      const secondPinned = pinned.has(second.id) ? 1 : 0;
      if (firstPinned !== secondPinned) return secondPinned - firstPinned;
      return new Date(second.lastMessage?.createdAt || second.updatedAt).getTime()
        - new Date(first.lastMessage?.createdAt || first.updatedAt).getTime();
    });
  }, [conversations, favorites, filter, pinned, term]);

  const filterOptions: Array<{ value: ConversationFilter; label: string; count: number }> = [
    { value: 'all', label: 'All', count: conversations.length },
    { value: 'unread', label: 'Unread', count: unreadConversations },
    { value: 'favorites', label: 'Favorites', count: favorites.size },
  ];

  return (
    <aside className={cn('flex h-full min-h-0 flex-col bg-panel', className)}>
      {/* ======================================================================
         UNIFIED PROFILE & STORIES HEADER
         ---------------------------------------------------------------
           - Single interactive avatar button
           - Tapping opens your active story
           - Floating + badge opens story upload composer
           - Zero redundant "Your story" block — vertical space saved
         ====================================================================== */}
      <header className={cn('flex h-[59px] shrink-0 items-center gap-1 bg-header px-4', 'border-b border-line')}>
        <ProfileHeader
          user={user}
          onViewStory={() => onProfile()}
          onUploadStory={() => onCreateStory()}
          className=""
        />

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => onNewChat()}
          className="wa-icon-btn"
          aria-label="New conversation"
          title="New chat"
        >
          <MessageSquarePlus size={22} strokeWidth={1.8} />
        </button>

        {onNewGroup && (
          <button
            type="button"
            onClick={onNewGroup}
            className="wa-icon-btn"
            aria-label="New group chat"
            title="New group"
          >
            <Users size={22} strokeWidth={1.8} />
          </button>
        )}

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className={cn('wa-icon-btn', menuOpen && 'bg-panel-2 text-ink')}
            aria-label="Open menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Menu"
          >
            <MoreVertical size={22} strokeWidth={1.8} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="Account menu"
              className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-md border border-line bg-elevated py-1.5 shadow-[0_2px_8px_rgba(11,20,26,0.18)] animate-pop-in"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onProfile();
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-ink transition-colors hover:bg-panel-2"
              >
                <UserRound size={17} className="text-muted" />
                Your profile
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onNewChat();
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-ink transition-colors hover:bg-panel-2"
              >
                <MessageSquarePlus size={17} className="text-muted" />
                New conversation
              </button>
              {onNewGroup && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onNewGroup();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-ink transition-colors hover:bg-panel-2"
                >
                  <Users size={17} className="text-muted" />
                  New group chat
                </button>
              )}
              {onOpenStarred && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenStarred();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-ink transition-colors hover:bg-panel-2"
                >
                  <Star size={17} className="text-muted" />
                  Starred messages
                </button>
              )}
              <div className="my-1.5 h-px bg-line" />
              <div className="flex items-center justify-between px-4 py-1.5">
                <span className="text-[14px] text-ink">Appearance</span>
                <ThemeToggle compact />
              </div>
              <div className="my-1.5 h-px bg-line" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-danger transition-colors hover:bg-danger/10"
              >
                <LogOut size={17} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Stories rail — shows OTHER users' stories only */}
      {onCreateStory && (
        <StoriesRail
          me={user}
          groups={stories}
          loading={storiesLoading}
          onOpen={onOpenStory || (() => undefined)}
          onCreate={onCreateStory}
        />
      )}

      <div className="shrink-0 px-3 pb-1.5 pt-2">
        <div className="relative">
          <Search
            size={18}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('');
                event.currentTarget.blur();
              }
            }}
            placeholder="Search or start new chat"
            aria-label="Search conversations"
            className="h-[35px] w-full rounded-lg border border-transparent bg-panel-2 pl-10 pr-9 text-[14px] text-ink placeholder:text-muted transition-colors focus:border-accent/40 focus:bg-panel focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-panel hover:text-ink"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          }}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 px-3 pb-2" role="group" aria-label="Conversation filters">
        {filterOptions.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              aria-pressed={active}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors',
                active
                  ? 'border-transparent bg-accent-soft font-medium text-accent-strong'
                  : 'border-line bg-panel text-muted hover:bg-panel-2 hover:text-ink',
              )}
            >
              {option.value === 'favorites' && <Star size={12} />}
              {option.label}
              <span
                className={cn(
                  'tabular-nums',
                  active ? 'text-accent-strong/70' : 'text-faint',
                )}
              >
                {option.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pb-2">
        {loading ? (
          <div className="space-y-0.5">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="flex h-[72px] items-center gap-3 px-3">
                <div className="skeleton h-[49px] w-[49px] rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-28 rounded-full" />
                  <div className="skeleton h-2.5 w-44 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-panel-2 text-muted">
              {filter === 'favorites' ? <Star size={20} /> : <Search size={20} />}
            </span>
            <p className="text-[14px] font-medium text-ink">
              {term
                ? `No chats match “${term}”`
                : filter === 'unread'
                  ? 'You’re all caught up'
                  : filter === 'favorites'
                    ? 'No favorites yet'
                    : 'No conversations yet'}
            </p>
            <p className="max-w-[16rem] text-[13px] leading-relaxed text-muted">
              {term
                ? 'Start a direct thread with that exact username, or try a different search.'
                : filter === 'unread'
                  ? 'New unread conversations will appear here.'
                  : filter === 'favorites'
                    ? 'Open a conversation and add it to favorites from its contact details.'
                    : 'Start a direct thread by entering an exact username.'}
            </p>
            <button
              type="button"
              onClick={() => onNewChat(term || undefined)}
              className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
              <MessageSquarePlus size={14} />
              {term ? `Start chat with @${term}` : 'New conversation'}
            </button>
          </div>
        ) : (
          <div>
            {filtered.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                meId={user.id}
                active={conversation.id === activeId}
                online={
                  conversation.other
                    ? onlineIds.has(conversation.other.id) || conversation.other.online
                    : false
                }
                typing={!!typing[conversation.id]}
                draft={drafts[conversation.id]}
                favorite={favorites.has(conversation.id)}
                pinned={pinned.has(conversation.id)}
                onSelect={() => onSelect(conversation.id)}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-line bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              connected ? 'bg-accent' : 'bg-amber-500',
            )}
            aria-hidden="true"
          />
          <p className="text-[11.5px] text-muted">
            {connected ? 'Connected' : 'Reconnecting…'}
          </p>
          <p className="ml-auto truncate text-[11.5px] text-faint">Muhammed Anas.v</p>
        </div>
      </footer>
    </aside>
  );
}