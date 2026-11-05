'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';

import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Ghost,
  Info,
  Lock,
  LockOpen,
  Maximize2,
  Minimize2,
  MoreVertical,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  Video,
  WifiOff,
  X,
} from 'lucide-react';
import { Avatar, GroupAvatar } from '@/components/ui/Avatar';
import { conversationName, isGroupConversation } from '@/lib/conversations';
import { presenceText } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/lib/types';
import { useAuth as useStore } from '@/lib/AuthProvider';
import { useCall, type CallKind } from '@/lib/useCall';
import { useGroupCall } from '@/lib/useGroupCall';
import SmartBrief from './SmartBrief';

interface ChatHeaderProps {
  conversation: Conversation;
  meId: string;
  onlineMembers: number;
  connected: boolean;
  focusMode: boolean;
  searchOpen: boolean;
  searchQuery: string;
  matchCount: number;
  matchIndex: number;
  onToggleSearch: () => void;
  onSearchQueryChange: (value: string) => void;
  onCloseSearch: () => void;
  onPrevMatch: () => void;
  /** Called when the user selects a different conversation from the sidebar. */
  onConversationSelect: (conversation: Conversation) => void;
  /** Called when the user opens the new-chat / group-chat panel. */
  onNewChat: () => void;
  /** Called when the user starts a new group call. */
  onStartGroupCall: (kind: CallKind) => void;
}

/**
 * ChatHeader — top bar showing:
 *   - Conversation title / participant names
 *   - Modes toggle (anonymity / vanish)
 *   - Smart Thread Morning Brief (for group conversations)
 *   - Search, modes, privacy controls
 */
export function ChatHeader({
  conversation,
  meId,
  onlineMembers,
  connected,
  focusMode,
  searchOpen,
  searchQuery,
  matchCount,
  matchIndex,
  onToggleSearch,
  onSearchQueryChange,
  onCloseSearch,
  onPrevMatch,
  onConversationSelect,
  onNewChat,
  onStartGroupCall,
}: ChatHeaderProps) {
  const { user } = useStore();

  // -----------------------------------------------------------------
  // Smart Brief: show only for group conversations with unread messages.
  // -----------------------------------------------------------------
  const [showBrief, setShowBrief] = useState(false);

  const isGroup = isGroupConversation(conversation);

  useEffect(() => {
    // If this is a group convo and the viewer has unread messages, we
    // want to surface the brief after a brief delay so the user can
    // orient themselves first.
    if (!isGroup) {
      setShowBrief(false);
      return;
    }
    // TODO: check unread count from the conversation or store; for now
    // we simply show the brief after 2s when a group is selected.
    const timeout = setTimeout(() => {
      setShowBrief(true);
    }, 2000);
    return () => clearTimeout(timeout);
  }, [isGroup, conversation.id]);

  // -----------------------------------------------------------------
  // Modes (anonymity, vanish) — simplified for this header
  // -----------------------------------------------------------------
  const modes = conversation.modes?.[user?.id as string] || { anonymity: false, vanish: false };

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  return (
    <header
      className={cn(
        'flex h-16 items-center justify-between border-b border-border/20 bg-card/70 backdrop-blur-sm',
        focusMode && 'py-2',
      )}
      role="navigation"
      aria-label="Chat header"
    >
      {/* Left: conversation title + modes */}
      <div className="flex items-center gap-3">
        <h1 className="font-semibold truncate line-clamp-1">
          {conversation.title || conversationName(conversation)}
        </h1>

        {/* Modes badges */}
        {Object.entries(modes).length > 0 && (
          <div className="flex items-center gap-1">
            {modes.anonymity && (
              <span className="rounded-full bg-gray-200 text-xs px-1.5 py-0.5">
                Anonymous
              </span>
            )}
            {modes.vanish && (
              <span className="rounded-full bg-gray-200 text-xs px-1.5 py-0.5">
                Vanish
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center: Smart Brief for groups */}
      {showBrief && isGroup && (
        <SmartBrief
          conversationId={conversation.id}
          userId={user?.id || ''}
        />
      )}

      {/* Right: search, call, menu */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative group">
          <button
            onClick={onToggleSearch}
            className="rounded-md p-1.5 hover:bg-border/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
          {searchOpen && (
            <div
              className="absolute right-0 mt-1 w-64 rounded-md bg-background/80 p-3 shadow-md border border-border/30"
              role="search"
            >
              <input
                type="search"
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onKeyDown={onCloseSearch}
                value={searchQuery}
                placeholder="Search messages…"
                className="bg-transparent outline-none w-full placeholder:text-foreground/40"
              />
            </div>
          )}
        </div>

        {/* Call / actions */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Video call button (one-to-one only) */}
          {!isGroup && (
            <button
              onClick={() => onStartGroupCall('audio')}
              className="rounded-md px-3 py-1.5 text-sm text-primary hover:bg-primary/10 transition-colors"
              title="Start audio call"
            >
              📞 Call
            </button>
          )}

          {/* New chat */}
          <button
            onClick={onNewChat}
            className="rounded-md px-3 py-1.5 text-sm text-foreground/60 hover:bg-border/30 transition-colors"
            title="New chat"
          >
            + New
          </button>
        </div>

        {/* More vertical menu (modes, privacy, etc.) */}
        <button
          onClick={() => navigator.clipboard.writeText('header-menu-placeholder')}
          className="rounded-md p-1.5 hover:bg-border/30 transition-colors"
          aria-label="More options"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

/* -----------------------------------------------------------------
 * SmartBrief — compact group-chat summary, renders inline in the header.
 * ----------------------------------------------------------------- */
function SmartBrief({ conversationId, userId }: { conversationId: string; userId: string }) {
  const { user } = useStore();
  const briefRef = useRef<HTMLDivElement>(null);

  const [brief, setBrief] = useState<{
    source: string;
    highlights: Array<{ text: string; sender: string }>;
    actionItems: Array<{ text: string; kind: string }>;
    topics: string[];
  } | null>(null);

  useEffect(() => {
    // Fetch the server-side deterministic brief
    fetch(`/api/insights/${conversationId}/brief`, {
      headers: { Authorization: `Bearer ${user?.token || ''}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const b = data.brief;
        if (b) {
          setBrief({
            source: b.source,
            highlights: b.highlights?.map((h: any) => ({
              text: h.text,
              sender: h.sender,
            })) || [],
            actionItems: b.actionItems?.map((a: any) => ({
              text: a.text,
              kind: a.kind,
            })) || [],
            topics: b.topics || [],
          });
        }
      })
      .catch((e) => {
        console.error('[SmartBrief] Fetch error:', e);
      });
  }, [conversationId, userId]);

  if (!brief) return null;

  return (
    <div
      ref={briefRef}
      className="flex items-center gap-2 px-2 py-1 rounded-md bg-border/20 text-[10px] text-foreground/60 animate-in fade-in-up"
    >
      <div className="flex-1 line-clamp-1">
        <div className="font-medium text-[10px]">{brief.highlights.length > 0 ? 'Key points:' : ''}</div>
        <ul className="space-y-0.5">
          {brief.highlights.slice(0, 3).map((h, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-[10px] font-medium">{h.sender}:</span>
              <span className="truncate">{h.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 line-clamp-1">
        <div className="font-medium text-[10px]">{brief.actionItems.length > 0 ? 'Actions:' : ''}</div>
        <ul className="space-y-0.5">
          {brief.actionItems.slice(0, 3).map((a, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-[10px] font-medium">{a.kind}:</span>
              <span className="truncate">{a.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="line-clamp-1">
        <div className="font-medium text-[10px]">{brief.topics.length > 0 ? 'Topics:' : ''}</div>
        <div className="flex flex-wrap gap-1">
          {brief.topics.slice(0, 5).map((t) => (
            <span
              key={t}
              className="text-[10px] px-1.5 py-0.3 rounded bg-border/30 text-foreground/50"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}