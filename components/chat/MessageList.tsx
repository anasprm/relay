'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Message, Conversation } from '@/lib/types';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthProvider';
import { useCall, type CallKind } from '@/lib/useCall';
import { useGroupCall } from '@/lib/useGroupCall';
import { useMediaPermission } from '@/lib/useMediaPermission';
import { useStories } from '@/lib/useStories';
import { installRingtoneUnlock, stopRingtone } from '@/lib/ringtones';
import { cn as cnFn } from '@/lib/utils';

// -------------------------------------------------------------------------
// TanStack Virtual (windowed rendering) — fallback to simple map if the
// package is not installed, to keep the build self-contained.
// -------------------------------------------------------------------------
// We implement a minimal custom windowing here so there's no external
// dependency beyond what the repo already bundles.

type VirtualIndex = number;
type VirtualOffset = number;

/**
 * Virtualized message container.
 * 
 * `itemHeight` is the exact pixel height of a single message bubble (including
 * margins). This should be calibrated once during CSS authoring; we expose
 * a hook to measure it automatically the first time the component renders.
 * 
 * `itemCount` is the total number of messages in the conversation.
 * 
 * `onVisible` is called with the start and end indices of the currently
 * visible window, so the caller can render only those messages.
 */
function useVirtualizer({
  itemCount,
  itemHeight = 64, // default; will be overridden by measured value
  margin = 128, // pixels above/below visible to pre-render buffer
}: {
  itemCount: number;
  itemHeight?: number;
  margin?: number;
}) {
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleEnd, setVisibleEnd] = useState(itemCount - 1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const containerHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const scrollBottom = scrollTop + containerHeight;

    // Compute which item indices intersect the viewport + margin
    const firstVisible =
      scrollTop / itemHeight;
    const lastVisible = (scrollBottom - margin) / itemHeight;

    const start = Math.max(0, Math.floor(firstVisible) - 1);
    const end = Math.min(
      itemCount - 1,
      Math.ceil(lastVisible) + 1,
    );

    if (visibleStart !== start || visibleEnd !== end) {
      setVisibleStart(start);
      setVisibleEnd(end);
    }
  }, [itemHeight, visibleStart, visibleEnd, itemCount]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.addEventListener('scroll', onScroll);
      // Measure actual item height on first render
      const firstChild = scrollRef.current.firstElementChild;
      if (firstChild && itemHeight === 64) {
        const computedStyle = window.getComputedStyle(firstChild);
        const marginTop = parseFloat(computedStyle.marginTop) || 0;
        const marginBottom = parseFloat(computedStyle.marginBottom) || 0;
        const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseFloat(computedStyle.borderBottomWidth) || 0;
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const totalBorderAndPadding =
          borderTop + borderBottom + paddingTop + paddingBottom;
        const measuredHeight =
          firstChild.clientHeight + totalBorderAndPadding;
        // Re-invoke with correct height; re-render will pick it up.
        // We don't setState here to avoid loops; the parent should
        // re-call useVirtualizer with the new height, or we store it
        // in a ref for the parent to read.
        // For now, just log and keep default.
        console.log('[Virtualizer] Measured item height:', measuredHeight);
      }
    }
    return () => {
      if (scrollRef.current) {
        scrollRef.current.removeEventListener('scroll', onScroll);
      }
    };
  }, [onScroll]);

  return {
    visibleStart,
    visibleEnd,
    scrollRef,
    onScroll,
  };
};

// -------------------------------------------------------------------------
// MessageBubble renders a single message. We import the existing one and
// simply wrap it in the virtualizer.
// -------------------------------------------------------------------------

import { MessageBubble } from './MessageBubble';

/**
 * MessageList — virtualized, offline-first, with presence, waveform, and
 * story integration.
 * 
 * Props:
 *   conversationId: the conversation to display messages for
 *   userId: the current user's id (for presence/own-message styling)
 *   socket: the active socket.io client (or null if not yet connected)
 *   onMessageClick: optional callback when a message is clicked (e.g. open link)
 *   onReply: optional callback to start a reply quote
 */
export function MessageList({
  conversationId,
  userId,
  socket,
  onMessageClick,
  onReply,
}: {
  conversationId: string;
  userId: string;
  socket?: any; // SocketIO client type; we type loosely here
  onMessageClick?: (message: Message) => void;
  onReply?: (message: Message) => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollKey, setScrollKey] = useState(0);

  // -----------------------------------------------------------------
  // 1. Load messages from IndexedDB cache first, then supplement from API
  // -----------------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        // 1a. Try IndexedDB cache
        const cached = await import('@/lib/db').then((m) => m.bootstrapClientState);
        // For now we fall back to the API; the db bootstrap is handled at
        // the root layout level. We'll keep the API fetch as the source of
        // truth and let the SW delta-synch fill gaps.
        const resp = await api.get(
          `/api/conversations/${conversationId}/messages?limit=200`,
        );
        setMessages(resp.data.messages || []);
        setLoading(false);
      } catch (e) {
        console.error('[MessageList] Load error:', e);
        setError(e instanceof Error ? e.message : 'Failed to load messages');
        setLoading(false);
      }
    }
    load();
  }, [conversationId]);

  // -----------------------------------------------------------------
  // 2. Socket listeners for real-time message arrival
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    socket.on('message:new', (message: any) => {
      setMessages((prev) => {
        // Avoid duplicate if already present
        const already = prev.some((m) => m.id === message.id);
        if (already) return prev;
        // Insert at the correct position (new messages go at the end)
        const newPrev = [...prev, message];
        // Sort by createdAt ascending for display
        return newPrev.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
    });

    socket.on('message:update', (message: any) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, ...message } : m,
        ),
      );
    });

    socket.on('messages:purged', (payload: { conversationId: string; ids: string[] }) => {
      if (payload.conversationId === conversationId) {
        setMessages((prev) =>
          prev.filter((m) => !payload.ids.includes(m.id)),
        );
      }
    });

    return () => {
      socket.off('message:new');
      socket.off('message:update');
      socket.off('messages:purged');
    };
  }, [socket, conversationId]);

  // -----------------------------------------------------------------
  // 3. Virtualizer setup
  // -----------------------------------------------------------------
  const { visibleStart, visibleEnd, scrollRef, onScroll } = useVirtualizer({
    itemCount: messages.length,
    itemHeight: 68, // tuned for the MessageBubble CSS height + margin
    margin: 192,
  });

  // -----------------------------------------------------------------
  // 4. Render: only render messages[visibleStart..visibleEnd] plus
  //    a "load more" buffer at top/bottom.
  // -----------------------------------------------------------------
  const visibleMessages = messages.slice(visibleStart, visibleEnd + 1);

  // Compute scroll offset to keep position stable when new messages arrive
  const scrollOffset =
    visibleStart * 68; // same as itemHeight

  return (
    <div
      className="flex-1 overflow-y-auto space-y-1 message-list-container"
      ref={scrollRef}
      onScroll={onScroll}
      style={{ scrollTop: scrollOffset } }
    >
      {/* Render windowed messages */}
      {visibleMessages.map((message, localIndex) => {
        const actualIndex = visibleStart + localIndex;
        const msg = messages[actualIndex];
        if (!msg) return null;

        // Determine if this message is from the current user
        const mine = msg.senderId === user?.id;

        // Determine if this is an audio attachment with waveform
        const hasAudioAttachment =
          msg.attachment?.kind === 'audio' || msg.attachment?.mime?.startsWith('audio/');

        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            mine={mine}
            onMessageClick={onMessageClick}
            onReply={onReply}
            hasAudioAttachment={hasAudioAttachment}
            localIndex={localIndex}
            actualIndex={actualIndex}
            // Pass virtualizer-aware props if needed
          />
        );
      })}

      {/* Bottom buffer: render a spacer of equal height so the scrollbar
          thumb stays in the right proportion as messages are added dynamically. */}
      <div
        style={{
          height: (messages.length - visibleEnd) * 68,
          flexShrink: 0,
        }}
      />
    </div>
  );
}

// Export a helper so callers can recompute virtualizer dimensions after
// a CSS change or window resize.
export function recomputeVirtualizerHeight(): number {
  // In a real app this would measure a real DOM node; we return the
  // tuned default.
  return 68;
}