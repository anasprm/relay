'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare, Star } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { formatSnippetTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

interface StarredEntry {
  message: Message;
  conversationId: string;
  conversationKind: 'direct' | 'group';
  conversationTitle: string;
}

interface StarredDialogProps {
  open: boolean;
  onClose: () => void;
  onJump: (conversationId: string, messageId: string) => void;
}

export function StarredDialog({ open, onClose, onJump }: StarredDialogProps) {
  const [entries, setEntries] = useState<StarredEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ messages: StarredEntry[] }>('/api/messages/starred');
      setEntries(response.messages || []);
    } catch {
      setError('Could not load your starred messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [load, open]);

  async function unstar(entry: StarredEntry) {
    if (busyId) return;
    setBusyId(entry.message.id);
    try {
      await api.post(`/api/messages/${entry.message.id}/star`);
      setEntries((previous) => previous.filter((item) => item.message.id !== entry.message.id));
    } catch {
      setError('Could not remove that star.');
    } finally {
      setBusyId(null);
    }
  }

  function snippet(message: Message): string {
    if (message.text) return message.text;
    if (message.kind === 'image') return 'Photo';
    if (message.kind === 'video') return 'Video';
    if (message.kind === 'audio') return 'Voice message';
    return message.attachment?.name || 'Attachment';
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Starred messages"
      description="Messages you saved across every conversation."
      className="max-w-lg"
    >
      <div className="px-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-muted">
            <Loader2 size={14} className="animate-spin text-accent" />
            Loading starred messages…
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-[12.5px] text-danger">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-2 rounded-full border border-line px-3 py-1 text-[12px] text-ink hover:bg-panel-2"
            >
              Try again
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-panel-2 text-faint">
              <Star size={18} />
            </span>
            <p className="text-[14px] text-ink">No starred messages yet</p>
            <p className="max-w-xs text-[12.5px] leading-[18px] text-muted">
              Open a message menu and choose “Star message” to keep it here.
            </p>
          </div>
        ) : (
          <ul className="max-h-[58dvh] space-y-1 overflow-y-auto">
            {entries.map((entry) => (
              <li key={entry.message.id} className="flex items-start gap-2 rounded-lg border border-line bg-panel-2/60 p-3">
                <button
                  type="button"
                  onClick={() => {
                    onJump(entry.conversationId, entry.message.id);
                    onClose();
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="flex items-center gap-1.5 truncate text-[11.5px] text-accent-strong">
                    <MessageSquare size={11} />
                    {entry.conversationTitle}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-ink">
                    <span className="font-medium">{entry.message.sender.displayName}: </span>
                    {snippet(entry.message)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-faint">
                    {formatSnippetTime(entry.message.createdAt)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => void unstar(entry)}
                  disabled={busyId === entry.message.id}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-amber-500 transition-colors hover:bg-amber-500/10',
                    busyId === entry.message.id && 'opacity-50',
                  )}
                  aria-label="Remove star"
                  title="Remove star"
                >
                  {busyId === entry.message.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Star size={15} className="fill-amber-400 text-amber-400" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
