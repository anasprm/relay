'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';

import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/lib/types';
import { useAuth as useStore } from '@/lib/AuthProvider';
import { api } from '@/lib/api';
import { useStories } from '@/lib/useStories';
import { useCall, type CallKind } from '@/lib/useCall';
import { useGroupCall } from '@/lib/useGroupCall';
import { installRingtoneUnlock, stopRingtone } from '@/lib/ringtones';
import { Search } from 'lucide-react';
import { isGroupConversation } from '@/lib/conversations';
import SmartBrief from './SmartBrief';

/**
 * ChatFilters — persistent filter tabs at the top of the conversation list
 * and within individual conversations, matching WhatsApp's "All / Unread /
 * Favorites / Groups" pattern with Relay-specific extensions.
 */
export function ChatFilters({ filter, setFilter }: { filter: string; setFilter: (f: string) => void }) {
  const { user } = useStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Available filters with labels and icons
  const filters = useMemo(() => [
    { key: 'all', label: 'All', count: null, description: 'Show all messages' },
    { key: 'unread', label: 'Unread', count: 0, description: 'Show only unread messages' },
    { key: 'favorites', label: 'Favorites', count: 0, description: 'Pinned & starred only' },
    { key: 'groups', label: 'Groups', count: 0, description: 'Group conversations only' },
    { key: 'muted', label: 'Muted', count: 0, description: 'Mutied conversations only' },
  ], []);

  // Update filter counts from server
  useEffect(() => {
    async function updateCounts() {
      try {
        const resp = await api.get<{ conversations: Conversation[] }>('/api/conversations');
        const convs = resp.data.conversations;

        // Count unread per conversation
        const unreadMap = new Map<string, number>();
        convs.forEach((c: Conversation) => {
          const unseen = c.messages?.filter(
            (m: Message) => m.senderId !== user?.id && m.readBy?.[user?.id as string]?.indexOf(m.id) === -1,
          ).length || 0;
          unreadMap.set(c.id, unseen);
        });

        // Count groups
        const groupCount = convs.filter((c: Conversation) => isGroupConversation(c)).length;

        // Count muted (conversations with modes.muted=true)
        const mutedCount = convs.filter(
          (c) => c.modes?.[user?.id]?.muted,
        ).length;

        // Update filter options
        filters[1].count = unreadMap.size; // approximate
        filters[2].count = 0; // favorites - would need stars system
        filters[3].count = groupCount;
        filters[4].count = mutedCount;
      } catch (e) {
        console.warn('[ChatFilters] Count update failed:', e);
      }
    }
    updateCounts();
  }, [user?.id, filters]);

  // Apply a filter
  const applyFilter = useCallback((key: string) => {
    setFilter(key);
    setSearchOpen(false);
    setSearchQuery('');
  }, [setFilter]);

  // Reset to all messages
  const resetFilter = useCallback(() => {
    applyFilter('all');
  }, [applyFilter]);

  return (
    <div className="flex flex-wrap items-center gap-2 px-2 py-1 rounded-md bg-border/20 text-[10px] font-medium text-foreground/60">
      {(filters || []).map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => applyFilter(key)}
          className={cn(
            'rounded-full px-3 py-1.5 mr-1 transition-colors hover:bg-border/30',
            filter === key && 'bg-primary text-primary-foreground',
            searchOpen && 'hidden',
          )}
          title={key}
        >
          {label}
          {count !== null && count > 0 && (
            <span className="ml-1 rounded bg-primary/20 text-[10px]">{count}</span>
          )}
        </button>
      ))}

      {/* Search overlay */}
      <button
        onClick={() => setSearchOpen(true)}
        className="ml-2 rounded-md p-1.5 hover:bg-border/30 transition-colors"
        aria-label="Search messages"
      >
        <Search className="h-4 w-4" />
      </button>

      {searchOpen && (
        <div className="absolute right-0 mt-1 w-64 rounded-md bg-background/80 p-3 shadow-md border border-border/30 max-h-80 overflow-y-auto">
          <input
            type="search"
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={() => setSearchOpen(false)}
            value={searchQuery}
            placeholder="Search in conversation..."
            className="bg-transparent outline-none w-full placeholder:text-foreground/40 text-[10px]"
          />
          <div className="mt-2 text-[10px] text-foreground/40">
            <p>Search in: {filters.map((f) => f.label).join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  );
}