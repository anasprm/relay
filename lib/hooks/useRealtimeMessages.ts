/**
 * Realtime Hook: useRealtimeMessages
 * ----------------------------------
 * Subscribes to Supabase Realtime on the `messages` table for a given
 * conversation and pipes new messages into local state instantly (0ms
 * optimistic feel), complementing your existing Socket.io layer.
 *
 * Usage:
 *   const { data: newMessage, error, subscribe, unsubscribe } =
 *     useRealtimeMessages(conversationId, onNewMessage);
 *
 *   useEffect(() => {
 *     subscribe();
 *     return () => unsubscribe();
 *   }, [conversationId]);
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/browser';
import type { Message } from '@/lib/types';

interface UseRealtimeMessagesParams {
  conversationId: string | null;
  onNewMessage: (message: Message) => void;
  /** Fired when another tab/user changes a reaction on a message. */
  onReactionUpdate?: (update: { messageId: string; reactions: Record<string, string> }) => void;
  /** Fired when another user marks messages in this conversation as read. */
  onMessageRead?: (update: {
    conversationId: string;
    userId: string;
    messageIds: string[];
    readAt: string;
  }) => void;
  /** Fired when group membership or metadata changes in this conversation. */
  onGroupUpdate?: (update: {
    event: 'group_created' | 'member_added' | 'member_removed' | 'group_left';
    conversationId: string;
    userId: string;
    messageIds?: string[];
    participants?: string[];
    name?: string;
    createdBy?: string;
    createdAt?: string;
  }) => void;
  onError?: (error: Error) => void;
}

export function useRealtimeMessages({
  conversationId,
  onNewMessage,
  onReactionUpdate,
  onMessageRead,
  onGroupUpdate,
  onError,
}: UseRealtimeMessagesParams) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  const onReactionUpdateRef = useRef(onReactionUpdate);
  const onMessageReadRef = useRef(onMessageRead);
  const onGroupUpdateRef = useRef(onGroupUpdate);
  const onErrorRef = useRef(onError);
  const warnedRef = useRef(false);

  // Keep callbacks latest without re-subscribing
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onReactionUpdateRef.current = onReactionUpdate;
    onMessageReadRef.current = onMessageRead;
    onGroupUpdateRef.current = onGroupUpdate;
    onErrorRef.current = onError;
  }, [onNewMessage, onReactionUpdate, onMessageRead, onGroupUpdate, onError]);

  const subscribe = useCallback(() => {
    if (!conversationId) return;
    if (channelRef.current) return; // already subscribed

    // Without real credentials the client can neither connect nor retry
    // successfully — skip subscribing instead of flooding the console.
    if (!isSupabaseConfigured()) {
      if (!warnedRef.current) {
        warnedRef.current = true;
        console.warn(
          '[Realtime] Skipped: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing or invalid.',
        );
      }
      return;
    }

    const sb = getSupabase();
    const channel: RealtimeChannel = sb
      .channel(`conversation:${conversationId}`, {
        config: { broadcast: { self: false } },
      })
      // Messages sent through the `sendMessage` server action arrive here.
      // Broadcast is used because Relay's custom JWT cannot satisfy the RLS
      // policies that Postgres change events are filtered through.
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        try {
          const message = normalizeBroadcastMessage(payload);
          if (message) onNewMessageRef.current(message);
        } catch (err) {
          onErrorRef.current?.(
            err instanceof Error ? err : new Error('Failed to parse realtime message'),
          );
        }
      })
      // Reaction changes made by anyone in the conversation.
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const update = normalizeReactionUpdate(payload);
        if (update) onReactionUpdateRef.current?.(update);
      })
      // Read receipts broadcast when someone views the conversation.
      .on('broadcast', { event: 'message_read' }, ({ payload }) => {
        try {
          const update = normalizeMessageReadUpdate(payload);
          if (update) onMessageReadRef.current?.(update);
        } catch (err) {
          onErrorRef.current?.(
            err instanceof Error ? err : new Error('Failed to parse read receipt'),
          );
        }
      })
      // Group membership / metadata changes.
      .on('broadcast', { event: 'group_created' }, ({ payload }) => {
        const update = normalizeGroupUpdate(payload);
        if (update && update.event === 'group_created')
          onGroupUpdateRef.current?.(update);
      })
      .on('broadcast', { event: 'member_added' }, ({ payload }) => {
        const update = normalizeGroupUpdate(payload);
        if (update && update.event === 'member_added')
          onGroupUpdateRef.current?.(update);
      })
      .on('broadcast', { event: 'member_removed' }, ({ payload }) => {
        const update = normalizeGroupUpdate(payload);
        if (update && update.event === 'member_removed')
          onGroupUpdateRef.current?.(update);
      })
      .on('broadcast', { event: 'group_left' }, ({ payload }) => {
        const update = normalizeGroupUpdate(payload);
        if (update && update.event === 'group_left')
          onGroupUpdateRef.current?.(update);
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          try {
            const message = mapSupabaseMessage(payload.new);
            onNewMessageRef.current(message);
          } catch (err) {
            onErrorRef.current?.(
              err instanceof Error ? err : new Error('Failed to parse realtime message'),
            );
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to conversation:${conversationId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          onErrorRef.current?.(
            new Error(`Realtime channel error for conversation:${conversationId}`),
          );
        }
      });

    channelRef.current = channel;
  }, [conversationId]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      getSupabase().removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Auto-subscribe when conversationId changes
  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [conversationId, subscribe, unsubscribe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => unsubscribe();
  }, [unsubscribe]);

  return { subscribe, unsubscribe, isSubscribed: !!channelRef.current };
}

/**
 * Broadcast payloads already use the app's Message shape (they are produced by
 * the `sendMessage` server action). Validate the essentials before handing them
 * to the UI, and tolerate a couple of missing display-only fields.
 */
function normalizeBroadcastMessage(payload: any): Message | null {
  if (!payload || typeof payload !== 'object') return null;
  if (!payload.id || !payload.conversationId) return null;

  return {
    id: payload.id,
    conversationId: payload.conversationId,
    senderId: payload.senderId ?? null,
    sender:
      payload.sender ?? {
        id: payload.senderId ?? '',
        username: '',
        displayName: '',
        accent: 'emerald',
        online: false,
        lastSeen: null,
      },
    kind: (payload.kind || 'text') as Message['kind'],
    text: payload.text ?? '',
    attachment: payload.attachment ?? null,
    anonymous: payload.anonymous ?? false,
    ephemeral: payload.ephemeral ?? false,
    viewOnce: payload.viewOnce ?? false,
    viewOnceOpened: payload.viewOnceOpened ?? false,
    reactions: payload.reactions ?? {},
    readBy: payload.readBy ?? [],
    starred: payload.starred ?? false,
    createdAt: payload.createdAt ?? new Date().toISOString(),
    ...(payload.clientId ? { clientId: payload.clientId } : {}),
  } as Message;
}

/**
 * Reaction broadcast payloads are `{ messageId, reactions }` where reactions is
 * a `Record<userId, emoji>` map.
 */
function normalizeReactionUpdate(
  payload: any,
): { messageId: string; reactions: Record<string, string> } | null {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.messageId !== 'string' || !payload.messageId) return null;

  const reactions: Record<string, string> = {};
  if (payload.reactions && typeof payload.reactions === 'object') {
    for (const [userId, emoji] of Object.entries(payload.reactions)) {
      if (typeof emoji === 'string' && emoji) reactions[userId] = emoji;
    }
  }

  return { messageId: payload.messageId, reactions };
}

/**
 * Read-receipt broadcast payloads are
 * `{ conversationId, userId, messageIds, readAt }`.
 */
function normalizeMessageReadUpdate(
  payload: any,
): {
  conversationId: string;
  userId: string;
  messageIds: string[];
  readAt: string;
} | null {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.conversationId !== 'string' || !payload.conversationId)
    return null;
  if (typeof payload.userId !== 'string' || !payload.userId) return null;
  if (!Array.isArray(payload.messageIds)) return null;

  return {
    conversationId: payload.conversationId,
    userId: payload.userId,
    messageIds: payload.messageIds.filter((id: any) => typeof id === 'string'),
    readAt: typeof payload.readAt === 'string' ? payload.readAt : new Date().toISOString(),
  };
}

/**
 * Group broadcast payloads are
 * `{ event, conversationId, userId, participants?, name?, createdBy?, createdAt? }`.
 */
function normalizeGroupUpdate(
  payload: any,
): {
  event: 'group_created' | 'member_added' | 'member_removed' | 'group_left';
  conversationId: string;
  userId: string;
  messageIds?: string[];
  participants?: string[];
  name?: string;
  createdBy?: string;
  createdAt?: string;
} | null {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.conversationId !== 'string' || !payload.conversationId)
    return null;
  if (typeof payload.userId !== 'string' || !payload.userId) return null;

  const validEvents: Record<string, boolean> = {
    group_created: true,
    member_added: true,
    member_removed: true,
    group_left: true,
  };
  const event = payload.event;
  if (!validEvents[event]) return null;

  return {
    event,
    conversationId: payload.conversationId,
    userId: payload.userId,
    participants: Array.isArray(payload.participants)
      ? payload.participants.filter((id: any) => typeof id === 'string')
      : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    createdBy: typeof payload.createdBy === 'string' ? payload.createdBy : undefined,
    createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : undefined,
  };
}

/**
 * Maps a Supabase messages row to your app's Message type.
 * Fields not present in Supabase (reactions, readBy, etc.) get sensible defaults.
 */
function mapSupabaseMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    sender: {
      id: row.sender_id,
      username: '',
      displayName: '',
      accent: 'emerald',
      online: false,
      lastSeen: null,
    },
    kind: (row.kind || 'text') as Message['kind'],
    text: row.body || '',
    attachment: row.attachment ? (row.attachment as any) : null,
    anonymous: row.anonymous ?? false,
    ephemeral: row.ephemeral ?? false,
    viewOnce: row.view_once ?? false,
    viewOnceOpened: row.view_once_opened ?? false,
    reactions: row.reactions ?? {},
    readBy: row.read_by ?? [],
    createdAt: row.created_at,
  };
}
