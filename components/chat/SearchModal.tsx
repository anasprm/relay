'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, Clock, MessageCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { searchLocalMessages, formatSearchResults, type SearchResultView } from '@/lib/search';
import { dbGetAllUsers } from '@/lib/db';
import type { User } from '@/lib/types';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  /** Fired when a user selects a search result. */
  onSelect: (result: {
    conversationId: string;
    messageId: string;
  }) => void;
}

export function SearchModal({ open, onClose, onSelect }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultView[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  // Load cached users so we can show avatars next to results.
  useEffect(() => {
    dbGetAllUsers().then((all) => {
      const map = new Map<string, User>();
      for (const u of all ?? []) map.set(u.id, u);
      setUsers(map);
    });
  }, []);

  // Re-search whenever the query or open state changes.
  useEffect(() => {
    if (!open) return;
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const raw = await searchLocalMessages(query);
        const formatted = formatSearchResults(raw, query);
        if (active) setResults(formatted);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [open, query]);

  const handleSelect = useCallback(
    (r: SearchResultView) => {
      onSelect({ conversationId: r.conversationId, messageId: r.id });
      onClose();
    },
    [onSelect, onClose],
  );

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Search messages" hideClose>
      <div className="flex flex-col gap-3 p-4">
        {/* Search input */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages…"
            autoFocus
            autoCapitalize="none"
            spellCheck={false}
            className="h-10 w-full pl-10 pr-4 rounded-lg border border-transparent bg-panel-2 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-panel focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#2A2A2C] text-[#8E8E93]"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center gap-2 py-8">
            <Clock size={20} className="animate-spin text-faint" />
            <span className="text-[12px] text-faint">Searching…</span>
          </div>
        )}

        {/* Empty query */}
        {query === '' && !loading && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageCircle size={24} className="text-faint" />
            <span className="text-[12.5px] text-faint">Type to search messages</span>
          </div>
        )}

        {/* No results */}
        {!loading && query !== '' && results.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <X size={20} className="text-faint" />
            <span className="text-[12.5px] text-faint">
              No results for “{query}”
            </span>
          </div>
        )}

        {/* Results list */}
        {!loading && query !== '' && results.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-1">
            {results.map((r) => {
              const user = users.get(r.senderId);
              const displayName = user?.displayName ?? 'Unknown';
              const accent = user?.accent ?? 'emerald';
              const avatarUrl = user?.avatarUrl ?? null;
              const time = new Date(r.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-panel-2"
                >
                  <Avatar
                    user={{
                      displayName,
                      accent,
                      avatarUrl,
                    }}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1.5 text-[12.5px]">
                      <span className="font-medium text-ink truncate">{displayName}</span>
                      <span className="text-[11px] text-faint">{time}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words text-[12.5px] text-muted">
                      {r.segments.map((seg, i) => (
                        <span
                          key={i}
                          className={cn(
                            seg.isMatch
                              ? 'font-semibold text-ink bg-accent/20 rounded'
                              : 'text-muted',
                          )}
                        >
                          {seg.text}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
