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
import { MoreOptionsMenu } from '@/components/chat/MoreOptionsMenu';
import { CopilotPanel } from '@/components/chat/CopilotPanel';
import {
  ArrowRight,
  CheckCheck,
  Image as ImageIcon,
  Mic,
  MessageCircle,
  MessageSquarePlus,
  MoreVertical,
  Paperclip,
  Phone,
  Play,
  Plus,
  Search,
  Send,
  Smile,
  Sparkles,
  UserRound,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation, Message, User } from '@/lib/types';

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
      reactions: { '🔥': 3, '💎': 2 },
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
      reactions: { '🚀': 4 },
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
    reactions: { '🔥': 3 },
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
  onReaction?: (emoji: string) => void;
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
  const readByMe = isMe && message.readBy?.includes('usr_me');
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
            <time dateTime={message.createdAt} className="text-[10px] text-[#8E8E93]">
              {time}
            </time>
            {isMe && (
              <span className="ml-0.5 inline-flex items-center">
                {readByMe ? (
                  <CheckCheck size={13} className="text-[#25D366]" />
                ) : (
                  <span className="text-[#8E8E93]/70 relative top-[px]">
                    ✓
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Reaction chips */}
          <div
            className={cn(
              'mt-0.5 flex min-h-[20px] flex-wrap items-center gap-1 px-0.5',
              isMe ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            {Object.entries(message.reactions || {}).map(([emoji, count]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReaction?.(emoji)}
                  className={cn(
                    'flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] leading-none transition-all active:scale-[0.97]',
                    'border-[#2A2A2C] bg-[#121216] text-[#8E8E93] hover:border-[#3A3A3C] hover:text-[#FFFFFF]',
                  )}
                  aria-label={`React ${emoji}`}
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="tabular-nums">{count}</span>}
                </button>
              ))}
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
      <div className="flex items-end gap-2">
        <label
          className="p-2 rounded-xl text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97] cursor-pointer"
          aria-label="Attach file"
        >
          <Paperclip className="h-5 w-5" />
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            className="hidden"
            accept="image/*,application/pdf,video/*"
          />
        </label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-xl text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]"
          aria-label="Attach file"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onToggleEmoji}
          className={cn(
            'p-2 rounded-xl text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97] relative',
            emojiOpen ? 'text-[#25D366]' : '',
          )}
          aria-label="Emoji picker"
        >
          <Smile className="h-5 w-5" />
          {emojiOpen && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
          )}
        </button>
        <div className="flex-1 relative min-w-0">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            rows={1}
            maxRows={5}
            disabled={disabled}
            className="w-full bg-transparent text-sm text-[#FFFFFF] placeholder-[#8E8E93] resize-none focus:outline-none relay-scrollbar-hide"
            onKeyDown={handleKeyDown}
            style={{ maxHeight: 120, overflowY: 'auto' }}
          />
          {pendingAttachment && (
            <div className="absolute bottom-full left-0 right-0 mb-1 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#2A2A2C] border border-[#2A2A2C] shadow-lg">
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
        </div>
        {/* Send / Mic morph — Phase 4 */}
        <button
          type="submit"
          disabled={isEmpty || disabled}
          className={cn(
            'p-2 rounded-xl text-[#FFFFFF] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]',
            isEmpty || disabled
              ? 'bg-[#1C1C1E] border border-[#2A2A2C] text-[#8E8E93]'
              : 'bg-[#25D366] hover:bg-[#1E9E52] shadow-[0_0_16px_rgba(37,211,102,0.35)]',
          )}
          aria-label={isEmpty ? 'Record voice message' : 'Send message'}
        >
          {isEmpty ? <Mic className="h-5 w-5" /> : <Send className="h-5 w-5" />}
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

type MobileView = 'LIST' | 'CHAT' | 'COPILOT' | 'STATUS' | 'COMMUNITIES' | 'CALLS';

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, token, loading } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  const [mobileView, setMobileView] = useState<MobileView>('LIST');
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [newChatInput, setNewChatInput] = useState('');
  const [isNewChatInputOpen, setIsNewChatInputOpen] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string } | null>(null);
  const moreOptionsRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace('/login');
      return;
    }
    const timer = setTimeout(() => {
      if (conversations.length === 0) {
        setConversations(MOCK_CONVERSATIONS);
        setActiveId(MOCK_CONVERSATIONS[0].id);
        setMessages(MOCK_MESSAGES);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [loading, user, token, router, conversations.length]);

  const activeConversation = conversations.find((c) => c.id === activeId);
  const visibleMessages = (messages || []).filter(
    (m) => m.conversationId === activeId,
  );

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
  /* Navigation helpers                                             */
  /* -------------------------------------------------------------- */
  const openChat = useCallback(() => setMobileView('CHAT'), []);
  const openList = useCallback(() => setMobileView('LIST'), []);
  const openCopilot = useCallback(() => setMobileView('COPILOT'), []);
  const toggleCopilot = useCallback(() => setCopilotOpen((p) => !p), []);

  const handleSelectConversation = useCallback((conv: Conversation) => {
    setActiveId(conv.id);
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
  }, [draft, pendingAttachment, activeId]);

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

  const handleReaction = useCallback((emoji: string) => {
    toast(`Reacted ${emoji}`, 'success');
  }, []);

  /* -------------------------------------------------------------- */
  /* Panel transforms for mobile slide transitions — Phase 2        */
  /* -------------------------------------------------------------- */
  const panelTransform = useMemo(() => {
    const center = 'translate-x-0';
    const offRight = 'translate-x-full';
    const offLeft = '-translate-x-full';
    switch (mobileView) {
      case 'LIST':
      case 'STATUS':
      case 'COMMUNITIES':
      case 'CALLS':
        return { list: center, chat: offRight, copilot: offLeft };
      case 'CHAT':
        return { list: offLeft, chat: center, copilot: offRight };
      case 'COPILOT':
        return { list: offRight, chat: offLeft, copilot: center };
    }
  }, [mobileView]);

  const panelStyle = {
    transition: 'transform 260ms cubic-bezier(0.23, 1, 0.32, 1)',
    willChange: 'transform',
  } as React.CSSProperties;

  /* -------------------------------------------------------------- */
  /* Mobile views                                                   */
  /* -------------------------------------------------------------- */
  const mobileList = (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between bg-[#0A0A0C] border-b border-[#2A2A2C] px-4 z-20">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-[#25D366]" compact />
          <span className="font-medium text-sm text-[#FFFFFF] tracking-tight">Relay</span>
        </div>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-[#8E8E93]" />
          <button className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]" aria-label="Camera">
            <Play className="h-5 w-5" />
          </button>
          <button
            ref={moreOptionsRef}
            onClick={(e) => { e.stopPropagation(); setShowMoreOptions((p) => !p); }}
            className="relative inline-block p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]"
            aria-label="More options"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {showMoreOptions && (
            <MoreOptionsMenu
              open={true}
              onClose={() => setShowMoreOptions(false)}
              anchorRef={moreOptionsRef}
              onClearChat={handleClearChat}
              onMute={() => toast('Notifications muted', 'info')}
              onLeaveGroup={() => {
                toast('Left the group', 'info');
                setActiveId(null);
                setShowMoreOptions(false);
              }}
            />
          )}
        </div>
      </header>
      {isNewChatInputOpen && (
        <div className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E8E93]" />
            <input
              type="text"
              value={newChatInput}
              onChange={(e) => setNewChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewChatSubmit();
                if (e.key === 'Escape') setIsNewChatInputOpen(false);
              }}
              placeholder="Enter username or email…"
              className="w-full pl-10 pr-10 py-2 bg-[#1C1C1E] border border-[#2A2A2C] rounded-xl text-sm text-[#FFFFFF] placeholder-[#8E8E93] focus:outline-none focus:border-[#25D366] transition-all"
              autoFocus
            />
            <button
              onClick={() => setIsNewChatInputOpen(false)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#2A2A2C] text-[#8E8E93] hover:text-[#FFFFFF] transition-colors"
              aria-label="Close new chat input"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-[#8E8E93]">
            Type a username or email to start a new conversation
          </p>
        </div>
      )}
      <div className="relative flex-1 overflow-y-auto px-2 space-y-1 relay-will-change-scroll relay-anti-smear">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-[#8E8E93]">
            <MessageSquarePlus className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No conversations yet</p>
            <button onClick={handleNewChat} className="mt-3 text-xs text-[#25D366] underline hover:text-[#1E9E52]">
              Start a new chat
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationRowLite
              key={conv.id}
              conversation={conv}
              active={conv.id === activeId}
              online={!!(conv.other?.online)}
              onSelect={() => handleSelectConversation(conv)}
            />
          ))
        )}
        {activeId == null && (
          <button
            onClick={handleNewChat}
            className="fixed bottom-10 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-[#FFFFFF] shadow-[0_8px_24px_rgba(37,211,102,0.35)] hover:bg-[#1E9E52] transition-all active:scale-[0.97]"
            aria-label="New conversation"
          >
            <MessageSquarePlus className="h-6 w-6" />
          </button>
        )}
      </div>
      <div className="h-16 border-t border-[#2A2A2C] bg-[#0A0A0C] px-3 flex items-center justify-around z-20 relay-pb-safe">
        <button
          onClick={() => setMobileView('LIST')}
          className={cn(
            'flex flex-col items-center gap-1',
            mobileView === 'LIST'
              ? 'text-[#25D366]'
              : 'text-[#8E8E93] hover:text-[#FFFFFF] transition-colors',
          )}
          aria-label="Chats"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-[10px]">Chats</span>
        </button>
        <button
          onClick={() => setMobileView('STATUS')}
          className={cn(
            'flex flex-col items-center gap-1',
            mobileView === 'STATUS'
              ? 'text-[#25D366]'
              : 'text-[#8E8E93] hover:text-[#FFFFFF] transition-colors',
          )}
          aria-label="Status"
        >
          <Play className="h-5 w-5" />
          <span className="text-[10px]">Status</span>
        </button>
        <button
          onClick={() => setMobileView('COMMUNITIES')}
          className={cn(
            'flex flex-col items-center gap-1',
            mobileView === 'COMMUNITIES'
              ? 'text-[#25D366]'
              : 'text-[#8E8E93] hover:text-[#FFFFFF] transition-colors',
          )}
          aria-label="Communities"
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px]">Communities</span>
        </button>
        <button
          onClick={() => setMobileView('CALLS')}
          className={cn(
            'flex flex-col items-center gap-1',
            mobileView === 'CALLS'
              ? 'text-[#25D366]'
              : 'text-[#8E8E93] hover:text-[#FFFFFF] transition-colors',
          )}
          aria-label="Calls"
        >
          <Phone className="h-5 w-5" />
          <span className="text-[10px]">Calls</span>
        </button>
      </div>
    </div>
  );

  const mobileChat = (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between bg-[#0A0A0C] border-b border-[#2A2A2C] px-4 z-20">
        <button onClick={openList} className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]" aria-label="Back">
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
        <div className="flex items-center gap-2">
          <button onClick={openCopilot} className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]" aria-label="AI Copilot">
            <Sparkles className="h-5 w-5" />
          </button>
          <button className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]" aria-label="Call">
            <Phone className="h-5 w-5" />
          </button>
          <button className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]" aria-label="Video">
            <Video className="h-5 w-5" />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 relay-will-change-scroll relay-anti-smear">
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
              onReaction={handleReaction}
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
        <Composer
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
      )}
    </div>
  );

  const mobileCopilot = (
    <CopilotPanel
      activeConversation={activeConversation}
      messages={visibleMessages}
      open
      onClose={openList}
      onSummarize={() => {}}
      onExtractTasks={() => {}}
    />
  );

  /* -------------------------------------------------------------- */
  /* Desktop layout                                                 */
  /* -------------------------------------------------------------- */
  const desktopSidebar = (
    <aside className="relative hidden md:flex h-[100dvh] flex-col bg-[#0F0F11] border-r border-[#2A2A2C] lg:w-80 xl:w-[340px]">
      <div className="flex h-16 shrink-0 items-center justify-between bg-[#0A0A0C] border-b border-[#2A2A2C] px-4">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-[#25D366]" compact />
          <span className="font-medium text-sm text-[#FFFFFF] tracking-tight">Relay</span>
        </div>
        <button
          onClick={handleNewChat}
          className="relative group flex h-8 w-8 items-center justify-center rounded-full bg-[#2A2A2C] border border-[#2A2A2C] hover:bg-[#3A3A3C] hover:text-[#25D366] transition-all text-[#25D366]" aria-label="New conversation"
        >
          <MessageSquarePlus className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] group-hover:bg-[#1E9E52] border-2 border-black" />
        </button>
      </div>
      {isNewChatInputOpen && (
        <div className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E8E93]" />
            <input
              type="text"
              value={newChatInput}
              onChange={(e) => setNewChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewChatSubmit();
                if (e.key === 'Escape') setIsNewChatInputOpen(false);
              }}
              placeholder="Enter username or email…"
              className="w-full pl-10 pr-10 py-2 bg-[#1C1C1E] border border-[#2A2A2C] rounded-xl text-sm text-[#FFFFFF] placeholder-[#8E8E93] focus:outline-none focus:border-[#25D366] transition-all"
              autoFocus
            />
            <button
              onClick={() => setIsNewChatInputOpen(false)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#2A2A2C] text-[#8E8E93] hover:text-[#FFFFFF] transition-colors"
              aria-label="Close new chat input"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-[#8E8E93]">
            Type a username or email to start a new conversation
          </p>
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E8E93]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-10 pr-4 py-2 bg-[#1C1C1E] border border-[#2A2A2C] rounded-xl text-sm text-[#FFFFFF] placeholder-[#8E8E93] focus:outline-none focus:border-[#25D366] transition-all"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'unread', 'favorites', 'groups'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as typeof filter)}
              className={cn(
                'flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-[#25D366] border border-[#25D366] text-[#FFFFFF]'
                  : 'bg-transparent text-[#8E8E93] hover:text-[#FFFFFF] hover:bg-[#2A2A2C]',
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 relay-will-change-scroll relay-anti-smear">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-[#8E8E93]">
            <MessageSquarePlus className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No conversations yet</p>
            <button onClick={handleNewChat} className="mt-3 text-xs text-[#25D366] underline hover:text-[#1E9E52]">
              Start a new chat
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationRowLite
              key={conv.id}
              conversation={conv}
              active={conv.id === activeId}
              online={!!(conv.other?.online)}
              onSelect={() => handleSelectConversation(conv)}
            />
          ))
        )}
      </div>
      <div className="flex items-center justify-between p-3 bg-[#0A0A0C] border-t border-[#1C1C1E]">
        {user ? (
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 shrink-0 flex items-center justify-center">
              <Avatar user={user} size="xs" className="w-9 h-9" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-[#FFFFFF] truncate">
                {user.displayName}
              </h3>
              <p className="text-xs text-[#8E8E93] truncate">{user.username}</p>
            </div>
            <MoreVertical className="h-4 w-4 text-[#8E8E93]" />
          </div>
        ) : null}
      </div>
    </aside>
  );

  const desktopMain = (
    <main className="flex-1 flex flex-col min-w-0 bg-[#0A0A0C]">
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 bg-[#0A0A0C] border-b border-[#2A2A2C] px-3 lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {activeConversation ? (
            <>
              <div className="relative h-10 w-10 shrink-0">
                <img
                  src={activeConversation.other?.avatarUrl || 'https://ui-avatars.com/api/?name=Group&background=25D366&color=fff'}
                  alt={activeConversation.title || 'Conversation'}
                  className="h-full w-full rounded-full object-cover border border-[#2A2A2C]"
                  loading="lazy"
                  decoding="async"
                />
                <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
              </div>
              <div className="min-w-0">
                <h2 className="font-medium text-sm text-[#FFFFFF] truncate">{activeConversation.title || 'Conversation'}</h2>
                <p className="text-xs text-[#8E8E93] truncate">{activeConversation.participantCount} members · Active</p>
              </div>
            </>
          ) : (
            <>
              <div className="h-10 w-10 rounded-full bg-[#1C1C1E] flex items-center justify-center text-[#8E8E93]">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-medium text-sm text-[#FFFFFF]">Select a conversation</h2>
                <p className="text-xs text-[#8E8E93]">Pick a thread from the sidebar or create a new one.</p>
              </div>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 lg:gap-2">
          <button
            onClick={toggleCopilot}
            className="hidden xl:inline-flex p-2 rounded-lg transition-all active:scale-[0.97]"
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
                <MoreVertical className="h-5 w-5" />
              </button>
              <button onClick={() => handleStartCall('audio')} className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]" aria-label="Start audio call">
                <Phone className="h-5 w-5" />
              </button>
              <button onClick={() => handleStartCall('video')} className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]" aria-label="Start video call">
                <Video className="h-5 w-5" />
              </button>
            </>
          ) : (
            <button
              ref={moreOptionsRef}
              onClick={(e) => { e.stopPropagation(); setShowMoreOptions((p) => !p); }}
              className="relative inline-block p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-all active:scale-[0.97]" aria-label="More options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          )}
          {showMoreOptions && (
            <MoreOptionsMenu
              open={true}
              onClose={() => setShowMoreOptions(false)}
              anchorRef={moreOptionsRef}
              onClearChat={handleClearChat}
              onMute={() => toast('Notifications muted', 'info')}
              onLeaveGroup={() => {
                toast('Left the group', 'info');
                setActiveId(null);
                setShowMoreOptions(false);
              }}
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
                  onReaction={handleReaction}
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
      <Composer
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
      {/* MOBILE: three panels mounted simultaneously, slide via transform — Phase 2 */}
      <div className="md:hidden relative overflow-hidden h-full">
        <div
          className="absolute inset-0 h-full w-full"
          style={{ transform: panelTransform.list, ...panelStyle }}
        >
          {mobileList}
        </div>
        <div
          className="absolute inset-0 h-full w-full"
          style={{ transform: panelTransform.chat, ...panelStyle }}
        >
          {mobileChat}
        </div>
        <div
          className="absolute inset-0 h-full w-full"
          style={{ transform: panelTransform.copilot, ...panelStyle }}
        >
          {mobileCopilot}
        </div>
        {emojiOpen && (
          <EmojiTray open onClose={() => setEmojiOpen(false)} onSelect={handleEmojiSelect} />
        )}
      </div>

      {/* DESKTOP 3-PANE */}
      <div className="hidden md:flex h-[100dvh]">
        {desktopSidebar}
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
