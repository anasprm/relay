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
import { supabase } from '@/lib/supabase/browser';
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

  // Keep callbacks latest without re-subscribing
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onErrorRef.current = onError;
  }, [onNewMessage, onError]);

  const subscribe = useCallback(() => {
    if (!conversationId) return;
    if (channelRef.current) return; // already subscribed

    const channel: RealtimeChannel = supabase
      .channel(`room:${conversationId}`)
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
          console.log(`[Realtime] Subscribed to room:${conversationId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          onErrorRef.current?.(
            new Error(`Realtime channel error for room:${conversationId}`),
          );
        }
      });

    channelRef.current = channel;
  }, [conversationId]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
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
