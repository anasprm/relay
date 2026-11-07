'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthProvider';
import { useToast } from '@/lib/ToastProvider';
import { Logo } from '@/components/ui/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { Portal } from '@/components/chat/Portal';
import { SidebarNavigationContainer } from '@/components/chat/SidebarNavigationContainer';
import { BulletproofDropdown } from '@/components/chat/BulletproofDropdown';
import { CopilotPanel } from '@/components/chat/CopilotPanel';
import { ChatComposer } from '@/components/chat/ChatComposer';
import {
  ArrowRight,
  CheckCheck,
  Image as ImageIcon,
  LogOut,
  Mic,
  MicOff,
  MessageCircle,
  MessageSquarePlus,
  MoreVertical,
  Paperclip,
  Phone,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  Smile,
  Sparkles,
  User,
  UserRound,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { dbPutConversation, dbGetAllConversations, dbPutMessage } from '@/lib/db';
import { useRealtimeMessages } from '@/lib/hooks/useRealtimeMessages';
import { sendMessage } from '@/lib/actions/sendMessage';
import { toggleReaction } from '@/lib/actions/reactions';
import { markConversationRead } from '@/lib/actions/reads';
import type { Conversation, Message, User } from '@/lib/types';

/**
 * Writes a message into IndexedDB so it survives reloads and stays available
 * offline. Used for both optimistic local sends and realtime arrivals.
 */
function cacheMessage(msg: Message): void {
  dbPutMessage({
    messageId: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId ?? '',
    kind: msg.kind,
    text: msg.text,
    attachment: msg.attachment
      ? {
          url: msg.attachment.url,
          name: msg.attachment.name,
          size: msg.attachment.size,
          mime: msg.attachment.mime,
          kind: msg.attachment.kind ?? 'text',
          width: msg.attachment.width,
          height: msg.attachment.height,
        }
      : null,
    createdAt: msg.createdAt,
    isEncrypted: false,
    ephemeral: msg.ephemeral,
  }).catch((err) => console.error('[db] Failed to persist message:', err));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Builds a `Record<userId, emoji>` map for seeded demo reactions. */
function seededReactions(
  emoji: string,
  count: number,
  offset = 0,
): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`usr_seed_${offset + i}`, emoji]),
  );
}

/* ------------------------------------------------------------------ */
/* Design tokens                                                      */
/* ------------------------------------------------------------------ */
const MOCK_USER: User = {
  id: 'usr_me',
  username: 'alexmercer',
  displayName: 'Alex Mercer',
  email: 'alex@relay.pro',
  accent: 'emerald',
  avatarUrl:
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  online: true,
  lastSeen: new Date().toISOString(),
};

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_relay_assistant',
    conversationId: 'conv_relay_assistant',
    title: 'Relay Assistant',
    kind: 'direct',
    participantIds: ['usr_me', 'usr_ai'],
    other: {
      id: 'usr_ai',
      username: 'relay_ai',
      displayName: 'Relay AI',
      accent: 'emerald',
      avatarUrl:
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
      online: true,
      lastSeen: new Date().toISOString(),
    },
    participantCount: 2,
    lastMessage: {
      id: 'msg_ai_1',
      conversationId: 'conv_relay_assistant',
      senderId: 'usr_ai',
      sender: {
        id: 'usr_ai',
        username: 'relay_ai',
        displayName: 'Relay AI',
        accent: 'emerald',
        avatarUrl:
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
        online: true,
      },
      kind: 'text',
      text: 'Hi Alex! How can I help you with Relay Messenger Pro today?',
      attachment: null,
      anonymous: false,
      ephemeral: false,
      viewOnce: false,
      viewOnceOpened: false,
      reactions: {},
      readBy: ['usr_me'],
      starred: false,
      createdAt: new Date(Date.now() - 300000).toISOString(),
    },
    unreadCount: 0,
    modes: { anonymity: false, vanish: false },
    locked: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
    messageCount: 12,
  },
  {
    id: 'conv_general_community',
    conversationId: 'conv_general_community',
    title: 'General Community',
    kind: 'group',
    participantIds: ['usr_me', 'usr_2', 'usr_3'],
    createdBy: 'usr_2',
    other: null,
    participantCount: 3,
    lastMessage: {
      id: 'msg_gen_1',
      conversationId: 'conv_general_community',
      senderId: 'usr_2',
      sender: {
        id: 'usr_2',
        username: 'elena_rostova',
        displayName: 'Elena Rostova',
        accent: 'rose',
        avatarUrl:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        online: true,
      },
      kind: 'text',
      text: 'The new glassmorphic UI looks amazing! Great work on the workspace design.',
      attachment: null,
      anonymous: false,
      ephemeral: false,
      viewOnce: false,
      viewOnceOpened: false,
      reactions: {
        ...seededReactions('🔥', 3),
        ...seededReactions('💎', 2, 3),
      },
      readBy: ['usr_me'],
      starred: false,
      createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    unreadCount: 2,
    modes: { anonymity: false, vanish: false },
    locked: false,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
    messageCount: 45,
  },
  {
    id: 'conv_design_systems',
    conversationId: 'conv_design_systems',
    title: 'Glassmorphic UI Systems',
    kind: 'group',
    participantIds: ['usr_me', 'usr_2'],
    createdBy: 'usr_2',
    other: null,
    participantCount: 2,
    lastMessage: {
      id: 'msg_design_1',
      conversationId: 'conv_design_systems',
      senderId: 'usr_2',
      sender: {
        id: 'usr_2',
        username: 'elena_rostova',
        displayName: 'Elena Rostova',
        accent: 'rose',
        avatarUrl:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        online: true,
      },
      kind: 'text',
      text: 'Backdrop-filter blur(32px) with OLED pure-black theme looks stunning on Vercel.',
      attachment: null,
      anonymous: false,
      ephemeral: false,
      viewOnce: false,
      viewOnceOpened: false,
      reactions: seededReactions('🚀', 4),
      readBy: ['usr_me'],
      starred: true,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    unreadCount: 0,
    modes: { anonymity: false, vanish: false },
    locked: false,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    messageCount: 28,
  },
];

const MOCK_MESSAGES: Message[] = [
  {
    id: 'msg_1',
    conversationId: 'conv_general_community',
    senderId: 'usr_2',
    sender: MOCK_CONVERSATIONS[1].other ?? {
      id: 'usr_2',
      username: 'elena_rostova',
      displayName: 'Elena Rostova',
      accent: 'rose',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      online: true,
    },
    kind: 'text',
    text: 'Welcome to Relay Messenger Pro! The spatial glassmorphic architecture is fully active.',
    attachment: null,
    anonymous: false,
    ephemeral: false,
    viewOnce: false,
    viewOnceOpened: false,
    reactions: seededReactions('🔥', 3),
    readBy: ['usr_me'],
    starred: false,
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'msg_2',
    conversationId: 'conv_general_community',
    senderId: 'usr_me',
    sender: MOCK_USER,
    kind: 'text',
    text: 'Thanks Elena! The backdrop-filter blur(32px) with OLED pure-black theme looks stunning on Vercel.',
    attachment: null,
    anonymous: false,
    ephemeral: false,
    viewOnce: false,
    viewOnceOpened: false,
    reactions: {},
    readBy: ['usr_me'],
    starred: false,
    createdAt: new Date(Date.now() - 850000).toISOString(),
  },
  {
    id: 'msg_3',
    conversationId: 'conv_general_community',
    senderId: 'usr_me',
    sender: MOCK_USER,
    kind: 'text',
    text: `const greet = () => {
  console.log('Hello from Relay');
};`,
    attachment: null,
    anonymous: false,
    ephemeral: false,
    viewOnce: false,
    viewOnceOpened: false,
    reactions: {},
    readBy: ['usr_me'],
    starred: false,
    createdAt: new Date(Date.now() - 800000).toISOString(),
  },
];

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '😊', '😇', '🙂', '🙃',
  '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝',
  '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '😐', '😑', '😶', '🫨', '😏', '😒', '🙄',
  '😬', '🤥', '😮', '😯', '😲', '🥳', '😵', '🤯', '🙏', '🫶', '🤝', '👋', '🤚',
];

/* ------------------------------------------------------------------ */
/* Message bubble — Phase 1                                           */
/* ------------------------------------------------------------------ */
type MessageBubbleProps = {
  message: Message;
  isMe: boolean;
  groupStart: boolean;
  onReaction?: (messageId: string, emoji: string) => void;
};

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`\n]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-[#FFFFFF]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} className="rounded bg-black/50 px-1 py-0.5 text-[11px] text-[#E5E5E7]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

function MessageBubble({
  message,
  isMe,
  groupStart,
  onReaction,
}: MessageBubbleProps) {
  const time = formatTime(message.createdAt);
  const myReactionId = isMe ? 'usr_me' : '';
  const myReaction = myReactionId ? message.reactions?.[myReactionId] : null;
  const isSingleEmoji =
    message.text.trim().length <= 3 &&
    /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1FAFF}]$/u.test(
      message.text.trim(),
    ) &&
    !message.attachment;

  return (
    <div
      className={cn(
        'flex w-full gap-2 msg-row',
        isMe ? 'justify-end' : 'justify-start',
        groupStart ? 'mt-3' : 'mt-[3px]',
      )}
    >
      {!isMe && groupStart && (
        <div className="h-7 w-7 shrink-0">
          <div className="h-full w-full rounded-full object-cover border border-[#2A2A2C] shrink-0">
            <img
              src={message.sender.avatarUrl}
              alt={message.sender.displayName}
              className="h-full w-full rounded-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      )}

      <div className="flex max-w-[86%] flex-col sm:max-w-[78%]">
        {groupStart && !isMe && (
          <div className="mb-1 flex items-center gap-1.5 px-1">
            <span className="text-[12px] font-medium text-[#FFFFFF]">
              {message.sender.displayName}
            </span>
          </div>
        )}

        <div
          className={cn(
            'relative max-w-full text-[14px] leading-[19px]',
            message.attachment ? 'p-[3px]' : 'px-[9px] pb-[5px] pt-[6px]',
            isMe
              ? 'bg-[#25D366] text-[#000000] rounded-t-xl rounded-r-xl rounded-b-xl rounded-tr-none'
              : 'bg-[#1C1C1E] border border-[#2A2A2C] text-[#FFFFFF] rounded-t-xl rounded-l-xl rounded-b-xl rounded-tl-none',
          )}
        >
          {message.text && (
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {isSingleEmoji ? (
                <span className="text-[28px] leading-none">{message.text}</span>
              ) : (
                renderInline(message.text, `m-${message.id}`)
              )}
            </p>
          )}
          {message.attachment && (
            <div className="mt-1.5 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[#8E8E93]" />
              <span className="text-[10px] text-[#8E8E93] truncate max-w-[140px]">
                {message.attachment.name}
              </span>
            </div>
          )}

          {/* Tail + timestamp + read receipts (Phase 1) */}
          <div className="mt-0.5 flex items-end gap-1">
            {/* Sent tail: small diamond at bottom-right corner */}
            {isMe && (
              <div
                className="absolute bottom-0 right-[-2px] w-2.5 h-2.5 rotate-45 bg-[#25D366]"
                style={{ bottom: '-1px', right: '-1px' }}
              />
            )}
            {isMe && (
              <span className="ml-0.5 inline-flex items-center">
                {/* Ticks: single gray = sent, double blue = read by a recipient */}
                {message.readBy?.some((id) => id !== 'usr_me') ? (
                  <CheckCheck size={13} className="text-[#25D366]" />
                ) : (
                  <span className="text-[#8E8E93]/70 relative top-[px]">
                    ✓
                  </span>
                )}
                <time dateTime={message.createdAt} className="ml-1 text-[10px] text-[#8E8E93]">
                  {time}
                </time>
              </span>
            )}
            {!isMe && (
              <time dateTime={message.createdAt} className="text-[10px] text-[#8E8E93]">
                {time}
              </time>
            )}
          </div>

          {/* Reaction chips */}
          <div
            className={cn(
              'mt-0.5 flex min-h-[20px] flex-wrap items-center gap-1 px-0.5',
              isMe ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            {(() => {
              const counts = new Map<string, { count: number; mine: boolean }>();
              for (const emoji of Object.values(message.reactions || {})) {
                const entry = counts.get(emoji) || { count: 0, mine: false };
                entry.count += 1;
                counts.set(emoji, entry);
              }
              if (myReaction) {
                const entry = counts.get(myReaction) || { count: 0, mine: false };
                entry.mine = true;
                counts.set(myReaction, entry);
              }
              return Array.from(counts.entries()).map(([emoji, stat]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReaction?.(message.id, emoji)}
                  className={cn(
                    'flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] leading-none transition-all active:scale-[0.97]',
                    stat.mine
                      ? 'border-accent/40 bg-accent-soft text-accent'
                      : 'border-[#2A2A2C] bg-[#121216] text-[#8E8E93] hover:border-[#3A3A3C] hover:text-[#FFFFFF]',
                  )}
                  aria-label={`React ${emoji}`}
                >
                  <span>{emoji}</span>
                  {stat.count > 1 && <span className="tabular-nums">{stat.count}</span>}
                </button>
              ));
            })()}
          </div>
        </div>

        {isMe && (
          <div className="h-7 w-7 shrink-0">
            <div className="h-full w-full rounded-full bg-white/5 flex items-center justify-center text-[9px] text-[#8E8E93] border border-white/10 overflow-hidden">
              {MOCK_USER.displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conversation row (list) — Phase 1/2                                */
/* ------------------------------------------------------------------ */
type ConversationRowLiteProps = {
  conversation: Conversation;
  active: boolean;
  online: boolean;
  onSelect: () => void;
};

function ConversationRowLite({
  conversation,
  active,
  online,
  onSelect,
}: ConversationRowLiteProps) {
  const { other, lastMessage, unreadCount } = conversation;
  const unread = unreadCount > 0;
  const preview = lastMessage?.text || 'No messages yet';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative flex h-[70px] w-full items-center gap-3 px-3 text-left transition-all duration-200',
        active
          ? 'bg-[#25D366]/10 border border-[#25D366] shadow-[0_0_12px_rgba(37,211,102,0.12)]'
          : 'hover:bg-[#2A2A2C] border border-transparent',
        'border rounded-xl',
      )}
      aria-label={`Open ${conversation.title || other?.displayName || 'conversation'}`}
    >
      <div className="relative h-10 w-10 shrink-0">
        <div className="h-full w-full rounded-full object-cover border border-[#2A2A2C] shrink-0">
          {other ? (
            <img
              src={other.avatarUrl}
              alt={other.displayName}
              className="h-full w-full rounded-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="h-full w-full rounded-full bg-[#2A2A2C] flex items-center justify-center">
              <Users className="h-5 w-5 text-[#8E8E93]" />
            </div>
          )}
        </div>
        {unread && (
          <div className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#25D366] border-2 border-black" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm text-[#FFFFFF] truncate">
            {conversation.title || other?.displayName || 'Unknown'}
          </h3>
          <span className="text-[10px] text-[#8E8E93] truncate">
            {lastMessage
              ? new Date(lastMessage.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <p className="text-xs text-[#8E8E93] truncate">{preview}</p>
          {unread && (
            <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[10px] font-bold text-[#000000] leading-none tabular-nums">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
      {online && (
        <span className="h-2 w-2 rounded-full bg-[#25D366] shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Auto-growing composer — Phase 4                                    */
/* ------------------------------------------------------------------ */
type ComposerProps = {
  disabled: boolean;
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  pendingAttachment: { name: string } | null;
  onRemoveAttachment: () => void;
  onToggleEmoji: () => void;
  onSend: () => void;
  emojiOpen: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
};

export function Composer({
  disabled,
  draft,
  setDraft,
  pendingAttachment,
  onRemoveAttachment,
  onToggleEmoji,
  onSend,
  emojiOpen,
  onFileChange,
  fileInputRef,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const isEmpty = !draft.trim() && !pendingAttachment;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="w-full">
      {/* Pending attachment chip */}
      {pendingAttachment && (
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[#2A2A2C] border border-[#2A2A2C] shadow-lg">
          <ImageIcon className="h-4 w-4 text-[#25D366] shrink-0" />
          <span className="text-xs text-[#8E8E93] truncate">{pendingAttachment.name}</span>
          <button
            onClick={onRemoveAttachment}
            className="p-1 rounded hover:bg-[#3A3A3C] text-[#8E8E93] hover:text-[#FF3B30] transition-colors active:scale-[0.97]"
            aria-label="Remove attachment"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-3 bg-[#0A0A0C] border-t border-[#1C1C1E] select-none">
        {/* Left: Attachment Button */}
        <button
          type="button"
          className="p-2.5 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800/60 shrink-0"
          title="Attach media"
        >
          <Plus className="w-5 h-5" />
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            className="hidden"
            accept="image/*,application/pdf,video/*"
          />
        </button>

        {/* Central Input Container Pill */}
        <div className="flex-1 flex items-center bg-[#1C1C1E] rounded-full px-4 py-2 border border-zinc-800/80 focus-within:border-[#25D366] transition-all shadow-inner">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Type a message…"
            rows={1}
            className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none text-sm py-1 resize-none"
            style={{ maxHeight: 120, overflowY: 'auto' }}
          />
          {/* Emoji Picker Trigger */}
          <div className="relative ml-2 shrink-0">
            <button
              type="button"
              onClick={onToggleEmoji}
              className="text-zinc-400 hover:text-white transition-colors p-1"
              title="Emoji"
              disabled={disabled}
            >
              <Smile className="w-5 h-5" />
            </button>
            {emojiOpen && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
            )}
          </div>
        </div>

        {/* Right Send / Mic Action Button */}
        <button
          type="submit"
          disabled={isEmpty || disabled}
          className={cn(
            "p-2.5 rounded-full text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center",
            isEmpty || disabled
              ? "bg-[#1C1C1E] text-[#8E8E93]"
              : "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600",
          )}
          aria-label={isEmpty ? "Record voice message" : "Send message"}
        >
          {isEmpty ? <Mic className="w-5 h-5 text-black" /> : <Send className="w-5 h-5 text-black" />}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Emoji tray — Phase 4                                               */
/* ------------------------------------------------------------------ */
type EmojiTrayProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
};

export function EmojiTray({ open, onClose, onSelect }: EmojiTrayProps) {
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed bottom-0 left-0 right-0 z-[70] pointer-events-none relay-pb-safe">
        <div
          className="pointer-events-auto mx-auto w-full max-w-md mt-1 mb-2 rounded-2xl border border-[#2A2A2C] bg-[#0A0A0C]/95 backdrop-blur-[20px] p-2 shadow-2xl relay-animate-scale-in"
        >
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  onClose();
                }}
                className="h-10 w-10 rounded-lg text-xl hover:bg-[#2A2A2C] transition-all active:scale-[0.97] flex items-center justify-center"
                aria-label={`Emoji ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ------------------------------------------------------------------ */
/* Chat page                                                          */
/* ------------------------------------------------------------------ */

type MobileView = 'LIST' | 'CHAT' | 'COPILOT';

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, token, loading } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Remote reaction updates keyed by message id: { [messageId]: Record<userId, emoji> }
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [draft, setDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  const [mobileView, setMobileView] = useState<MobileView>('LIST');
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [newChatInput, setNewChatInput] = useState('');
  const [isNewChatInputOpen, setIsNewChatInputOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string } | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const moreOptionsRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace('/login');
      return;
    }
    const timer = setTimeout(async () => {
      if (conversations.length === 0) {
        // Try to hydrate from IndexedDB first (persists across reloads)
        try {
          const stored = await dbGetAllConversations();
          if (stored && stored.length > 0) {
            setConversations(
              stored.map((c) => ({
                id: c.conversationId,
                conversationId: c.conversationId,
                title: c.title,
                kind: c.kind,
                participantIds: c.participantIds,
                other: null,
                participantCount: c.participantIds.length,
                lastMessage: null,
                unreadCount: 0,
                modes: { anonymity: false, vanish: false },
                locked: false,
                createdAt: c.updatedAt,
                updatedAt: c.updatedAt,
                messageCount: 0,
              })),
            );
            setActiveId(stored[0].conversationId);
            return;
          }
        } catch {
          // IndexedDB not available or empty — fall through to MOCK seed
        }
        setConversations(MOCK_CONVERSATIONS);
        setActiveId(MOCK_CONVERSATIONS[0].id);
        setMessages(MOCK_MESSAGES);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [loading, user, token, router, conversations.length]);

  const activeConversation = conversations.find((c) => c.id === activeId);
  const effectiveMessages = (messages || []).map((m) => {
    const remote = reactionsByMessage[m.id];
    if (!remote || Object.keys(remote).length === 0) return m;
    return { ...m, reactions: { ...m.reactions, ...remote } };
  });
  const visibleMessages = effectiveMessages
    .filter((m) => m.conversationId === activeId)
    .filter((m) => {
      if (!chatSearchQuery.trim()) return true;
      const needle = chatSearchQuery.trim().toLowerCase();
      return (
        (m.text || '').toLowerCase().includes(needle) ||
        (m.sender?.displayName || '').toLowerCase().includes(needle)
      );
    });

  const filteredConversations = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    let list = conversations.filter((c) => {
      if (!needle) return true;
      return (
        c.title?.toLowerCase().includes(needle) ||
        c.other?.displayName.toLowerCase().includes(needle) ||
        c.lastMessage?.text?.toLowerCase().includes(needle)
      );
    });
    if (filter === 'unread') list = list.filter((c) => c.unreadCount > 0);
    if (filter === 'favorites') list = list.filter((c) => c.starred);
    if (filter === 'groups') list = list.filter((c) => c.kind === 'group');
    return list.sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
  }, [conversations, searchQuery, filter]);

  /* -------------------------------------------------------------- */
  /* Supabase Realtime — instant message sync                       */
  /* -------------------------------------------------------------- */
  useRealtimeMessages({
    conversationId: activeId,
    onNewMessage: (msg) => {
      setMessages((prev) => {
        if (
          prev.some(
            (m) => m.id === msg.id || m.id === (msg as Message & { clientId?: string }).clientId,
          )
        ) {
          return prev;
        }
        const next = [...prev, msg];
        // Persist to local IndexedDB cache for offline availability
        cacheMessage(msg);
        return next;
      });
      // Update the conversation's lastMessage + unread state
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                lastMessage: msg,
                updatedAt: msg.createdAt,
                unreadCount:
                  msg.senderId !== user?.id ? c.unreadCount + 1 : c.unreadCount,
              }
            : c,
        ),
      );
    },
    onReactionUpdate: ({ messageId, reactions }) => {
      setReactionsByMessage((prev) => ({
        ...prev,
        [messageId]: reactions,
      }));
    },
    onMessageRead: ({ conversationId, userId, messageIds }) => {
      // A recipient marked messages as read. Update our outgoing messages'
      // readBy so the sender's ticks flip to blue.
      if (userId === user?.id) return; // our own read, no change needed
      setMessages((prev) =>
        prev.map((m) => {
          if (!messageIds.includes(m.id)) return m;
          if (m.senderId !== user?.id) return m; // only our outgoing messages
          if (m.readBy?.includes(userId)) return m; // already recorded
          return { ...m, readBy: [...(m.readBy ?? []), userId] };
        }),
      );
    },
    onError: (err) => {
      console.warn('[Realtime] Subscription error:', err.message);
    },
  });

  /* -------------------------------------------------------------- */
  /* Navigation helpers                                             */
  /* -------------------------------------------------------------- */
  const openChat = useCallback(() => setMobileView('CHAT'), []);
  const openList = useCallback(() => {
    setMobileView('LIST');
    setActiveId(null);
  }, []);
  const openCopilot = useCallback(() => setMobileView('COPILOT'), []);
  const toggleCopilot = useCallback(() => setCopilotOpen((p) => !p), []);

  const handleSelectConversation = useCallback((conv: Conversation) => {
    // Clear unread count for the selected conversation in local state
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conv.id
          ? { ...c, unreadCount: 0 }
          : c,
      ),
    );

    // Persist read state to IndexedDB
    if (typeof window !== 'undefined') {
      dbPutConversation({
        conversationId: conv.id,
        title: conv.title,
        kind: conv.kind,
        participantIds: conv.participantIds,
        lastMessageId: conv.lastMessage?.id || null,
        updatedAt: conv.updatedAt,
      }).catch((err) => console.error('[db] Failed to persist read state:', err));
    }

    setActiveId(conv.id);

    // Mark messages as read now that the user is viewing this conversation.
    if (token) {
      markConversationRead({ token, conversationId: conv.id })
        .then((result) => {
          if (!result.success) {
            console.debug('[chat] markConversationRead skipped:', result.error);
          }
        })
        .catch((err) => console.error('[chat] markConversationRead failed:', err));
    }
    if (conv.id === 'conv_general_community') {
      setMessages(MOCK_MESSAGES);
    } else if (conv.id === 'conv_relay_assistant') {
      setMessages([
        {
          id: 'msg_ai_welcome',
          conversationId: 'conv_relay_assistant',
          senderId: 'usr_ai',
          sender: MOCK_CONVERSATIONS[0].other!,
          kind: 'text',
          text: "Hi Alex! How can I help you with Relay Messenger Pro today?",
          attachment: null,
          anonymous: false,
          ephemeral: false,
          viewOnce: false,
          viewOnceOpened: false,
          reactions: {},
          readBy: ['usr_me'],
          starred: false,
          createdAt: new Date(Date.now() - 300000).toISOString(),
        },
      ]);
    } else {
      setMessages([]);
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileView('CHAT');
    }
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setDraft('');
    setNewChatInput('');
    setIsNewChatInputOpen(true);
  }, []);

  const handleNewChatSubmit = useCallback(() => {
    const query = newChatInput.trim();
    if (!query) return;

    // Look for existing conversation by title, displayName, or username
    const existing = conversations.find(
      (c) =>
        c.title?.toLowerCase() === query.toLowerCase() ||
        c.other?.displayName.toLowerCase() === query.toLowerCase() ||
        c.other?.username.toLowerCase() === query.toLowerCase(),
    );

    if (existing) {
      setActiveId(existing.id);
      setMessages(existing.lastMessage ? [existing.lastMessage] : []);
      setIsNewChatInputOpen(false);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setMobileView('CHAT');
      }
      return;
    }

    // Create a new direct conversation
    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      conversationId: `conv_${Date.now()}`,
      title: query,
      kind: 'direct',
      participantIds: ['usr_me'],
      other: {
        id: `usr_${Date.now()}`,
        username: query,
        displayName: query,
        accent: 'emerald',
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(query)}&background=25D366&color=fff`,
        online: false,
        lastSeen: null,
      },
      participantCount: 2,
      lastMessage: null,
      unreadCount: 0,
      modes: { anonymity: false, vanish: false },
      locked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    };

    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
    setMessages([]);
    setIsNewChatInputOpen(false);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileView('CHAT');
    }
  }, [newChatInput, conversations]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text && !pendingAttachment) return;

    const isAI = activeId === 'conv_relay_assistant';

    if (isAI) {
      // Append user message immediately (optimistic)
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        conversationId: activeId || 'conv_relay_assistant',
        senderId: 'usr_me',
        sender: MOCK_USER,
        kind: 'text',
        text,
        attachment: null,
        anonymous: false,
        ephemeral: false,
        viewOnce: false,
        viewOnceOpened: false,
        reactions: {},
        readBy: ['usr_me'],
        starred: false,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setDraft('');
      setPendingAttachment(null);
      setEmojiOpen(false);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === (activeId || 'conv_relay_assistant')
            ? {
                ...c,
                lastMessage: userMessage,
                unreadCount: 0,
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      );

      // Call live Gemini API
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        const aiReply =
          data?.response || "I'm having trouble responding right now.";
        const aiSender = MOCK_CONVERSATIONS[0].other!;
        const aiMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          conversationId: 'conv_relay_assistant',
          senderId: 'usr_ai',
          sender: aiSender,
          kind: 'text',
          text: aiReply,
          attachment: null,
          anonymous: false,
          ephemeral: false,
          viewOnce: false,
          viewOnceOpened: false,
          reactions: {},
          readBy: [],
          starred: false,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === 'conv_relay_assistant'
              ? {
                  ...c,
                  lastMessage: aiMessage,
                  unreadCount: 0,
                  updatedAt: new Date().toISOString(),
                }
              : c,
          ),
        );
      } catch {
        const aiSender = MOCK_CONVERSATIONS[0].other!;
        const aiMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          conversationId: 'conv_relay_assistant',
          senderId: 'usr_ai',
          sender: aiSender,
          kind: 'text',
          text: "I'm having trouble responding right now. Please try again.",
          attachment: null,
          anonymous: false,
          ephemeral: false,
          viewOnce: false,
          viewOnceOpened: false,
          reactions: {},
          readBy: [],
          starred: false,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
      return;
    }

    // Non-AI conversation: mock store
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId: activeId || 'conv_general_community',
      senderId: 'usr_me',
      sender: MOCK_USER,
      kind: 'text',
      text,
      attachment: pendingAttachment
        ? {
            url: '',
            name: pendingAttachment.name,
            mime: 'image/*',
            size: 0,
            kind: 'image',
          }
        : null,
      anonymous: false,
      ephemeral: false,
      viewOnce: false,
      viewOnceOpened: false,
      reactions: {},
      readBy: ['usr_me'],
      starred: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMessage]);
    cacheMessage(newMessage);
    setDraft('');
    setPendingAttachment(null);
    setEmojiOpen(false);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === (activeId || 'conv_general_community')
          ? {
              ...c,
              lastMessage: newMessage,
              unreadCount: 0,
              updatedAt: new Date().toISOString(),
            }
          : c,
      ),
    );

    // Persist through the service-role server action and broadcast the message
    // to every other tab subscribed to this conversation.
    if (token && activeId) {
      sendMessage({
        token,
        conversationId: activeId,
        body: text,
        kind: 'text',
        attachment: newMessage.attachment,
        clientId: newMessage.id,
      })
        .then((result) => {
          if (!result.success) {
            console.error('[chat] Supabase sync failed:', result.error);
          }
        })
        .catch((error) => {
          console.error('[chat] Supabase sync failed:', error);
        });
    }
  }, [draft, pendingAttachment, activeId, token]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingAttachment({ name: file.name });
    toast(`Attached: ${file.name}`, 'success');
  }, [toast]);

  const handleRemoveAttachment = useCallback(() => {
    setPendingAttachment(null);
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setDraft((prev) => prev + emoji);
    setEmojiOpen(false);
  }, []);

  const handleStartCall = useCallback((type: 'audio' | 'video') => {
    setCallType(type);
    setIsCalling(true);
  }, []);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    toast('Chat cleared', 'info');
  }, [toast]);

  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!token || !user) return;

      const isDemoMessage = !isUuid(messageId);

      // Optimistically toggle the reaction in local state so the bubble updates
      // instantly. Broadcast uses `self: false`, so the sender never receives
      // their own echo back — the local update is what they see.
      const previousMessages = messages;
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex !== -1) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            const next = { ...m, reactions: { ...m.reactions } };
            if (next.reactions[user.id] === emoji) {
              delete next.reactions[user.id];
            } else {
              next.reactions[user.id] = emoji;
            }
            return next;
          }),
        );
      }

      // Demo / locally-created messages (non-UUID ids) aren't in Supabase, so
      // there is nothing to persist — the optimistic local toggle is enough.
      if (isDemoMessage) return;

      const result = await toggleReaction({
        token,
        conversationId: activeId || '',
        messageId,
        emoji,
      });

      if (!result.success) {
        // Revert the optimistic update on failure.
        setMessages(previousMessages);
        console.error('[chat] reaction sync failed:', result.error);
        toast('Reaction failed', 'error');
      }
    },
    [token, activeId, user, messages, toast],
  );

  /* -------------------------------------------------------------- */
  /* Mobile chat view                                               */
  /* -------------------------------------------------------------- */
  const mobileChat = (
    <div className="flex h-full flex-col pointer-events-auto">
      {/* Sticky header — Phase 2 */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between bg-[#0A0A0C]/90 backdrop-blur-md border-b border-[#2A2A2C] px-4">
        <button onClick={openList} className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97] pointer-events-auto" aria-label="Back">
          <ArrowRight className="h-5 w-5 rotate-180" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative h-10 w-10 shrink-0">
            <img
              src={activeConversation?.other?.avatarUrl || 'https://ui-avatars.com/api/?name=Group&background=25D366&color=fff'}
              alt={activeConversation?.title || 'Conversation'}
              className="h-full w-full rounded-full object-cover border border-[#2A2A2C]"
              loading="lazy"
              decoding="async"
            />
            <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
          </div>
          <div className="min-w-0">
            <h2 className="font-medium text-sm text-[#FFFFFF] truncate">
              {activeConversation?.title || 'Conversation'}
            </h2>
            <p className="text-xs text-[#8E8E93] truncate">
              {activeConversation?.participantCount} members · Active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button onClick={openCopilot} className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97] pointer-events-auto" aria-label="AI Copilot">
            <Sparkles className="h-5 w-5" />
          </button>
          <button onClick={() => setChatSearchOpen((p) => !p)} className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97] pointer-events-auto" aria-label="Search conversation">
            <Search className="h-5 w-5" />
          </button>
          <button className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97] pointer-events-auto" aria-label="Call">
            <Phone className="h-5 w-5" />
          </button>
          <button className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97] pointer-events-auto" aria-label="Video">
            <Video className="h-5 w-5" />
          </button>
        </div>
      </header>
      {/* Scrollable message area — flex-1 min-h-0 prevents header overlap */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 relay-will-change-scroll relay-anti-smear">
        {visibleMessages.length > 0 ? (
          visibleMessages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMe={msg.senderId === 'usr_me'}
              groupStart={
                i === 0 ||
                messages[i - 1]?.senderId !== msg.senderId ||
                new Date(msg.createdAt).getTime() -
                  new Date(messages[i - 1]?.createdAt ?? 0).getTime() >
                5 * 60 * 1000
              }
              onReaction={(emoji) => handleReaction(msg.id, emoji)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#8E8E93] pt-20">
            <p className="text-sm mb-2">No messages yet</p>
            <p className="text-xs">Start the conversation by sending a message below.</p>
          </div>
        )}
      </div>
      {activeId && (
        <div className="relay-pb-safe">
          <ChatComposer
            disabled={!activeId}
            draft={draft}
            setDraft={setDraft}
            pendingAttachment={pendingAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            onToggleEmoji={() => setEmojiOpen((p) => !p)}
            onSend={handleSend}
            emojiOpen={emojiOpen}
            onFileChange={handleFileChange}
            fileInputRef={fileInputRef}
          />
        </div>
      )}
    </div>
  );

  /* -------------------------------------------------------------- */
  /* Desktop main content pane                                      */
  /* -------------------------------------------------------------- */
  const desktopMain = (
    <main className="flex-1 flex flex-col min-h-0 bg-[#0A0A0C]">
      <header className="flex h-16 shrink-0 items-center justify-between bg-[#0A0A0C] border-b border-[#2A2A2C] px-4">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-[#25D366]" compact />
          <span className="font-medium text-sm text-[#FFFFFF] tracking-tight">Relay</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 lg:gap-2">
          <button
            onClick={toggleCopilot}
            className={cn(
              'p-2 rounded-lg transition-all active:scale-[0.97]',
              copilotOpen
                ? 'bg-[#25D366]/10 text-[#25D366]'
                : 'text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF]',
            )}
            aria-label="Toggle AI copilot"
            aria-pressed={copilotOpen}
          >
            <Sparkles className="h-5 w-5" />
          </button>
          {activeConversation?.title !== 'Relay Assistant' ? (
            <>
              <button
                ref={moreOptionsRef}
                onClick={(e) => { e.stopPropagation(); setShowMoreOptions((p) => !p); }}
                className="relative inline-block p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]" aria-label="More options"
              >
                <MoreVertical
                  ref={profileMenuRef}
                  className="h-4 w-4 text-[#8E8E93]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProfileMenu((p) => !p);
                  }}
                />
              </button>
            </>
          ) : null}
          {showProfileMenu && (
            <BulletproofDropdown
              open={showProfileMenu}
              onClose={() => setShowProfileMenu(false)}
              items={[
                {
                  label: 'Profile',
                  icon: <User className="h-4 w-4" />,
                  onClick: () => {
                    toast('Profile settings', 'info');
                  },
                },
                {
                  label: 'Settings',
                  icon: <Settings className="h-4 w-4" />,
                  onClick: () => {
                    toast('Opening settings', 'info');
                  },
                },
              ]}
            />
          )}
          {showMoreOptions && (
            <BulletproofDropdown
              open={showMoreOptions}
              onClose={() => setShowMoreOptions(false)}
              items={[
                {
                  label: 'Clear chat history',
                  onClick: () => {
                    setShowMoreOptions(false);
                    handleClearChat();
                  },
                },
                {
                  label: 'Mute notifications',
                  onClick: () => {
                    setShowMoreOptions(false);
                    toast('Notifications muted', 'info');
                  },
                },
                {
                  label: 'Leave group',
                  onClick: () => {
                    setShowMoreOptions(false);
                    toast('Left the group', 'info');
                    setActiveId(null);
                    setShowMoreOptions(false);
                  },
                },
              ]}
            />
          )}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relay-will-change-scroll relay-anti-smear">
        {activeConversation ? (
          <>
            {visibleMessages.length > 0 ? (
              visibleMessages.map((msg, i) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isMe={msg.senderId === 'usr_me'}
                  groupStart={
                    i === 0 ||
                    messages[i - 1]?.senderId !== msg.senderId ||
                    new Date(msg.createdAt).getTime() -
                      new Date(messages[i - 1]?.createdAt ?? 0).getTime() >
                    5 * 60 * 1000
                  }
                  onReaction={(emoji) => handleReaction(msg.id, emoji)}
                  searchQuery={chatSearchQuery}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#8E8E93] pt-20">
                <MessageSquarePlus className="h-12 w-12 mb-3 opacity-30" />
                <h3 className="font-medium text-sm text-[#8E8E93]">Select a conversation to start messaging</h3>
                <p className="text-xs text-[#8E8E93] mt-1">Pick a thread from the sidebar or create a new one.</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-[#8E8E93] pt-20">
            <MessageSquarePlus className="h-12 w-12 mb-3 opacity-30" />
            <h3 className="font-medium text-sm text-[#8E8E93]">Select a conversation to start messaging</h3>
            <p className="text-xs text-[#8E8E93] mt-1">Pick a thread from the sidebar or create a new one.</p>
          </div>
        )}
      </div>
      <ChatComposer
        disabled={!activeId}
        draft={draft}
        setDraft={setDraft}
        pendingAttachment={pendingAttachment}
        onRemoveAttachment={handleRemoveAttachment}
        onToggleEmoji={() => setEmojiOpen((p) => !p)}
        onSend={handleSend}
        emojiOpen={emojiOpen}
        onFileChange={handleFileChange}
        fileInputRef={fileInputRef}
      />
    </main>
  );

  /* -------------------------------------------------------------- */
  /* Desktop copilot pane                                           */
  /* -------------------------------------------------------------- */
  const desktopCopilot = copilotOpen ? (
    <div className="hidden xl:flex xl:w-[360px] xl:shrink-0 border-l border-[#2A2A2C]">
      <CopilotPanel
        activeConversation={activeConversation}
        messages={visibleMessages}
        open={true}
        onClose={() => setCopilotOpen(false)}
        onToggle={toggleCopilot}
        onSummarize={() => {}}
        onExtractTasks={() => {}}
      />
    </div>
  ) : null;

  return (
    <div className="h-[100dvh] bg-[#0A0A0C] text-[#FFFFFF] overflow-hidden relay-anti-smear relay-pb-safe">
      {/* MOBILE: strict single-pane — only one view mounted at a time */}
      <div className="md:hidden h-full">
        {!activeId ? (
          <>
            <SidebarNavigationContainer />
            {emojiOpen && (
              <EmojiTray open onClose={() => setEmojiOpen(false)} onSelect={handleEmojiSelect} />
            )}
          </>
        ) : (
          mobileChat
        )}
      </div>

      {/* DESKTOP 3-PANE: sidebar + main + optional copilot */}
      <div className="hidden md:flex h-[100dvh]">
        <SidebarNavigationContainer />
        {desktopMain}
        {desktopCopilot}
      </div>

      {isCalling && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md h-[70vh] bg-[#0A0A0C]/95 border border-[#2A2A2C] rounded-3xl shadow-2xl flex flex-col items-center justify-center p-6 relay-animate-scale-in">
            <div className="relative mb-6">
              <div className="absolute -inset-1 rounded-full border-2 border-cyan-500 animate-pulse" />
              <div className="relative h-24 w-24 shrink-0">
                <img
                  src={activeConversation?.other?.avatarUrl || 'https://ui-avatars.com/api/?name=Contact&background=25D366&color=fff'}
                  alt={activeConversation?.title || 'Contact'}
                  className="h-full w-full rounded-full object-cover border-2 border-white/20"
                />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">
              {activeConversation?.title || 'Contact'}
            </h2>
            <p className="text-slate-400 text-sm mb-6">{isCalling ? 'Calling…' : 'Connected'}</p>
            <div className="flex items-center gap-4">
              {callType === 'video' && (
                <button className="p-3 rounded-full bg-[#1C1C1E] text-white transition-colors">
                  <VideoOff className="h-5 w-5" />
                </button>
              )}
              <button className="p-3 rounded-full bg-[#1C1C1E] text-white transition-colors">
                <MicOff className="h-5 w-5" />
              </button>
              <button onClick={() => setIsCalling(false)} className="p-3 rounded-full bg-[#FF3B30] hover:bg-[#E03425] text-[#FFFFFF] transition-colors shadow-lg shadow-[#FF3B30]/30">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
