'use client';

import { FileText, Flame, Image as ImageIcon, Lock, Mic, Pin, Star, Video } from 'lucide-react';
import { Avatar, GroupAvatar } from '@/components/ui/Avatar';
import { conversationName, isGroupConversation } from '@/lib/conversations';
import { formatSnippetTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/lib/types';

function messagePreview(message: Message): string {
  const anonymousPrefix = message.anonymous ? 'Anonymous: ' : '';
  if (message.kind === 'image') return `${anonymousPrefix}Photo`;
  if (message.kind === 'audio') return `${anonymousPrefix}Voice message`;
  if (message.kind === 'video') return `${anonymousPrefix}Video message`;
  if (message.kind === 'file') return `${anonymousPrefix}${message.attachment?.name || 'File'}`;
  return `${anonymousPrefix}${message.text}`;
}

function KindIcon({ kind }: { kind: Message['kind'] }) {
  const props = { size: 12, className: 'shrink-0 text-faint' };
  if (kind === 'image') return <ImageIcon {...props} />;
  if (kind === 'audio') return <Mic {...props} />;
  if (kind === 'video') return <Video {...props} />;
  if (kind === 'file') return <FileText {...props} />;
  return null;
}

interface ConversationRowProps {
  conversation: Conversation;
  meId: string;
  active: boolean;
  online: boolean;
  typing: boolean;
  draft?: string;
  favorite?: boolean;
  pinned?: boolean;
  onSelect: () => void;
}

export function ConversationRow({
  conversation,
  meId,
  active,
  online,
  typing,
  draft,
  favorite,
  pinned,
  onSelect,
}: ConversationRowProps) {
  const { other, lastMessage, unreadCount } = conversation;
  const group = isGroupConversation(conversation);
  const name = conversationName(conversation);
  const unread = unreadCount > 0;
  const isMine = lastMessage?.senderId === meId;
  const preview = conversation.locked
    ? 'Locked chat'
    : lastMessage
      ? messagePreview(lastMessage)
      : group
        ? `${conversation.memberCount} members · no messages yet`
        : 'No messages yet';
  const draftText = draft?.trim();
  const senderPrefix =
    !lastMessage || isMine
      ? 'You: '
      : group && !lastMessage.anonymous
        ? `${lastMessage.sender.displayName}: `
        : '';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative flex h-[72px] w-full items-center gap-3 px-3 text-left transition-colors',
        active ? 'bg-panel-2' : 'hover:bg-panel-2/70',
      )}
      aria-current={active ? 'true' : undefined}
      aria-label={`Open ${group ? 'group' : 'conversation with'} ${name}${unread ? `, ${unreadCount} unread` : ''}`}
    >
      {group || !other ? (
        <GroupAvatar size="lg" label={name} />
      ) : (
        <Avatar user={other} size="lg" online={online} />
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={cn(
              'truncate text-[16px] leading-[21px] text-ink',
              unread ? 'font-medium' : 'font-normal',
            )}
          >
            {name}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[12px] leading-[21px] tabular-nums text-muted">
            {pinned && <Pin size={12} className="text-muted" aria-label="Pinned" />}
            {favorite && <Star size={12} className="fill-amber-400 text-amber-400" aria-label="Favorite" />}
            {lastMessage && <span>{formatSnippetTime(lastMessage.createdAt)}</span>}
          </span>
        </span>

        <span className="mt-0.5 flex min-h-[20px] items-center gap-1.5">
          {conversation.locked ? (
            <span className="flex min-w-0 items-center gap-1.5 text-[14px] leading-[20px] text-muted">
              <Lock size={12} className="shrink-0" />
              <span className="truncate">Locked chat · tap to unlock</span>
            </span>
          ) : typing ? (
            <span className="truncate text-[14px] leading-[20px] font-medium text-accent">typing…</span>
          ) : draftText ? (
            <span className="truncate text-[14px] leading-[20px] text-accent">
              <span className="font-medium">Draft:</span> {draftText}
            </span>
          ) : (
            <>
              {lastMessage && lastMessage.kind !== 'text' && <KindIcon kind={lastMessage.kind} />}
              {lastMessage?.ephemeral && <Flame size={12} className="shrink-0 text-amber-500/90" />}
              <span
                className={cn(
                  'truncate text-[14px] leading-[20px]',
                  unread ? 'text-ink' : 'text-muted',
                )}
              >
                {lastMessage ? senderPrefix : ''}
                {preview}
              </span>
            </>
          )}

          {unread && (
            <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-badge px-1.5 text-[12px] font-semibold leading-none tabular-nums text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
