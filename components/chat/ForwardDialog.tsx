'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Avatar, GroupAvatar } from '@/components/ui/Avatar';
import { conversationName, isGroupConversation } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/lib/types';

interface ForwardDialogProps {
  open: boolean;
  message: Message | null;
  conversations: Conversation[];
  onClose: () => void;
  onForward: (conversationId: string) => Promise<boolean>;
}

export function ForwardDialog({
  open,
  message,
  conversations,
  onClose,
  onForward,
}: ForwardDialogProps) {
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setBusyId(null);
    setError(null);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(
      (conversation) =>
        conversationName(conversation).toLowerCase().includes(needle) ||
        (conversation.other?.username || '').toLowerCase().includes(needle),
    );
  }, [conversations, query]);

  async function forward(conversationId: string) {
    if (busyId) return;
    setBusyId(conversationId);
    setError(null);
    try {
      const ok = await onForward(conversationId);
      if (ok) onClose();
      else setError('Could not forward this message. Try again.');
    } catch {
      setError('Could not forward this message. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busyId) onClose();
      }}
      title="Forward message"
      description={
        message?.text
          ? message.text.slice(0, 120)
          : message?.attachment?.name || 'Attachment'
      }
      className="max-w-md"
    >
      <div className="px-4 pb-4">
        <div className="relative mb-2">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats to forward to"
            autoFocus
            className="h-10 w-full rounded-lg border border-transparent bg-panel-2 pl-9 pr-3 text-[13.5px] text-ink placeholder:text-faint focus:border-accent focus:bg-panel focus:outline-none"
          />
        </div>

        {error && (
          <p className="mb-2 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-[12px] text-danger">
            {error}
          </p>
        )}

        <div className="max-h-[52dvh] space-y-0.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-[11.5px] text-faint">
              No conversations match.
            </p>
          ) : (
            (filtered || []).map((conversation) => {
              const group = isGroupConversation(conversation);
              const busy = busyId === conversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => void forward(conversation.id)}
                  disabled={!!busyId}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors',
                    busy ? 'bg-accent-soft' : 'hover:bg-panel-2',
                    busyId && !busy && 'opacity-50',
                  )}
                >
                  {group ? (
                    <GroupAvatar size="sm" label={conversationName(conversation)} />
                  ) : conversation.other ? (
                    <Avatar user={conversation.other} size="sm" />
                  ) : (
                    <GroupAvatar size="sm" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">
                      {conversationName(conversation)}
                    </span>
                    <span className="block truncate text-[11.5px] text-faint">
                      {group
                        ? `${conversation.memberCount} members`
                        : `@${conversation.other?.username || 'unknown'}`}
                    </span>
                  </span>
                  {busy ? (
                    <Loader2 size={14} className="animate-spin text-accent" />
                  ) : (
                    <Send size={13} className="text-faint" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
