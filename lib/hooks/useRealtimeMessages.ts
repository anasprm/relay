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
  onError?: (error: Error) => void;
}

export function useRealtimeMessages({
  conversationId,
  onNewMessage,
  onError,
}: UseRealtimeMessagesParams) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  const onErrorRef = useRef(onError);
  const warnedRef = useRef(false);

  // Keep callbacks latest without re-subscribing
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onErrorRef.current = onError;
  }, [onNewMessage, onError]);

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
