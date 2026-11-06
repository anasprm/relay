'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ArrowRight, Check, Loader2, Search, User, UserRound, Users, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Portal } from './Portal';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/AuthProvider';
import { findExistingOneOnOneChat } from '@/lib/chatHelpers';
import { getOrCreateDirectChat } from '@/lib/actions/chatActions';
import { cn } from '@/lib/utils';
import type { Conversation, User } from '@/lib/types';

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
  conversations: Conversation[];
  currentUserId: string | null;
}

interface UserPill {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  accent?: 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate';
  online?: boolean;
}

export function NewChatModal({
  open,
  onClose,
  onSelectConversation,
  conversations,
  currentUserId,
}: NewChatModalProps) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<UserPill[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupName, setGroupName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setUsers([]);
    setError(null);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(
      async () => {
        const trimmed = query.trim();
        if (!trimmed) {
          setUsers([]);
          return;
        }
        setSearching(true);
        try {
          const response = await api.get<{ users: User[] }>(
            `/api/users/search?q=${encodeURIComponent(trimmed)}`,
          );
          if (active) setUsers((response.users || []).filter((u) => u.id !== currentUserId));
        } catch (caught) {
          if (active) setError(errorMessage(caught));
        } finally {
          if (active) setSearching(false);
        }
      },
      trimmed ? 200 : 0,
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query, currentUserId]);

  // Toggle a user in/out of selection
  const toggleUser = useCallback((user: User) => {
    setError(null);
    setSelected((previous) => {
      const exists = previous.some((m) => m.id === user.id);
      if (exists) {
        return previous.filter((m) => m.id !== user.id);
      }
      return [
        ...previous,
        {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          accent: user.accent,
          online: user.online,
        },
      ];
    });
  }, []);

  const removePill = useCallback((id: string) => {
    setSelected((previous) => previous.filter((m) => m.id !== id));
  }, []);

  const isDirect = selected.length === 1;
  const buttonLabel = isDirect ? 'Chat' : 'Create Group';
  const canProceed = selected.length > 0 && !busy;

  async function handleSubmit() {
    if (!canProceed) return;

    setBusy(true);
    setError(null);

    try {
      if (isDirect && selected[0]) {
        // ------------------------------------------------------------------
        // Phase A: Client-side memory check (0ms latency).
        // Look up an existing direct thread in local state before hitting
        // the server. If found, select it immediately and close the modal.
        // ------------------------------------------------------------------
        const existing = findExistingOneOnOneChat(
          conversations,
          currentUserId || '',
          selected[0].id,
        );
        if (existing) {
          onSelectConversation(existing.id);
          onClose();
          return;
        }

        // ------------------------------------------------------------------
        // Phase B: Server-side fallback. No local thread found, so create
        // a new direct conversation via the server action.
        // ------------------------------------------------------------------
        const result = await getOrCreateDirectChat(
          currentUserId || '',
          selected[0].id,
        );
        onSelectConversation(result.conversationId);
        onClose();
      } else {
        // Create group conversation (no dedup needed for groups)
        const response = await api.post<{ conversationId: string }>(
          '/api/conversations',
          {
            type: 'group',
            title: groupName.trim() || 'Group chat',
            participantIds: selected.map((m) => m.id),
          },
        );
        const convId = response.conversationId;
        onSelectConversation(convId);
        onClose();
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
        aria-hidden="true"
      >
        {/* Backdrop with click-outside dismiss */}
        <button
          type="button"
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]"
          aria-label="Close"
        />
        <div
          className="relative z-[71] flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#27272a]/30 bg-[#0a0a0c]/90 backdrop-blur-[24px] shadow-[0_40px_100px_-30px_rgba(2,6,23,0.65)] animate-pop-in"
        >
          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#27272a]/30 bg-[#0a0a0c]/30 px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 id="new-chat-title" className="text-[16px] font-normal leading-[22px] text-ink">
                New Message
              </h2>
              <p id="new-chat-desc" className="mt-1 text-[12.5px] leading-[18px] text-muted">
                Start a new conversation
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-panel-2 hover:text-ink"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  handleSubmit();
                }}
                placeholder="Search username or email…"
                autoCapitalize="none"
                spellCheck={false}
                className="h-11 w-full rounded-lg border border-transparent bg-panel-2 pl-10 pr-4 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-panel focus:outline-none"
                autoFocus
              />
              {searching && (
                <Loader2
                  size={14}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-accent"
                />
              )}
            </div>

            {error && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-[18px] text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            {/* Recipient Pills */}
            {selected.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(selected || []).map((member) => (
                  <span
                    key={member.id}
                    className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent-strong"
                  >
                    <Avatar user={member} size="md" className="h-6 w-6" />
                    <span className="truncate">{member.displayName}</span>
                    <button
                      type="button"
                      onClick={() => removePill(member.id)}
                      className="rounded-full p-0.5 transition-colors hover:bg-accent/15"
                      aria-label={`Remove ${member.displayName}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Group Name Input (only when 2+ selected) */}
            {selected.length > 1 && (
              <div className="mb-3 flex items-center gap-2">
                <label
                  htmlFor="group-name"
                  className="text-[12px] font-medium text-muted"
                >
                  Group name
                </label>
                <input
                  id="group-name"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value.slice(0, 40))}
                  placeholder="Group name (optional)"
                  className="flex-1 h-10 rounded-lg border border-transparent bg-panel-2 pl-3 pr-4 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-panel focus:outline-none"
                />
              </div>
            )}

            {/* Suggested Contacts List */}
            <p className="mb-2 mt-4 text-[12px] text-muted">
              {(query.trim() ? 'Matching people' : 'Suggested contacts')}
            </p>

            <div className="scrollbar-thin -mx-1 max-h-[320px] overflow-y-auto px-1">
              {(users || []).length === 0 && !searching ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <UserRound size={20} className="text-faint" />
                  <p className="text-[12.5px] text-muted">
                    {query.trim()
                      ? `No contacts match “${query.trim()}”`
                      : 'No contacts found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {(users || []).map((user) => {
                    const picked = selected.some((m) => m.id === user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleUser(user)}
                        aria-pressed={picked}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                          picked
                            ? 'bg-accent-soft'
                            : 'hover:bg-panel-2',
                        )}
                      >
                        <Avatar user={user} size="md" online={user.online} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-ink">
                            {user.displayName}
                          </span>
                          <span className="block truncate text-[11.5px] text-muted">
                            @{user.username} · {presenceText(user)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                            picked
                              ? 'border-accent bg-accent text-accent-ink'
                              : 'border-line-strong text-transparent',
                          )}
                          aria-hidden="true"
                        >
                          <Check size={12} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[#27272a]/30 bg-[#0a0a0c]/40 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-[13px] text-faint transition-colors hover:bg-panel-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                canProceed ? 'bg-accent text-accent-ink hover:bg-accent-hover' : 'bg-panel-2 text-muted',
              )}
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin mr-1" />
              ) : null}
              {buttonLabel}
              {selected.length > 1 ? ` · ${selected.length} members` : ''}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function presenceText(user: User): string {
  if (!user.online) return 'offline';
  return 'online';
}
