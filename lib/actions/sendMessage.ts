'use server';

import { parseSessionToken } from '@/lib/server/authStore';
import { stableUuid, usernameFor } from '@/lib/server/relayIds';
import { broadcastToConversation } from '@/lib/server/realtime';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Attachment, Message } from '@/lib/types';

export interface SendMessageInput {
  token: string;
  conversationId: string;
  body: string;
  kind?: Message['kind'];
  attachment?: Attachment | null;
  /** Optimistic local id, echoed back so the sender tab can dedupe. */
  clientId?: string;
}

export type SendMessageResult =
  | { success: true; message: Message }
  | { success: false; error: string };

/**
 * Persists a message with the service-role client (bypassing RLS for the write)
 * and then broadcasts it to the conversation's Realtime channel.
 *
 * The broadcast is what other tabs actually receive: Postgres change events are
 * filtered through RLS per subscriber, and Relay's custom JWT is not a Supabase
 * Auth session, so `auth.uid()` would be null and no rows would be delivered.
 */
export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();
  const body = input?.body ?? '';
  const kind = input?.kind ?? 'text';
  const attachment = input?.attachment ?? null;

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No conversation selected.' };
  if (!body.trim() && !attachment) {
    return { success: false, error: 'Message is empty.' };
  }

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const senderUuid = stableUuid(`user:${session.userId}`);
    const conversationUuid = stableUuid(`conversation:${conversationId}`);
    const username = usernameFor(session.userId, session.email);
    const displayName = session.displayName || username;

    // Make sure the sender and thread exist so the message FKs are valid.
    const { error: userError } = await admin.from('users').upsert(
      {
        id: senderUuid,
        username,
        display_name: displayName,
        email: session.email,
        accent: 'emerald',
        online: true,
        last_seen: now,
      },
      { onConflict: 'id' },
    );
    if (userError) throw new Error(`Could not sync user: ${userError.message}`);

    const { error: conversationError } = await admin.from('conversations').upsert(
      {
        id: conversationUuid,
        is_group: false,
        created_by: senderUuid,
        updated_at: now,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (conversationError) {
      throw new Error(`Could not sync conversation: ${conversationError.message}`);
    }

    const { error: participantError } = await admin
      .from('conversation_participants')
      .upsert(
        { conversation_id: conversationUuid, user_id: senderUuid },
        { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
      );
    if (participantError) {
      throw new Error(`Could not sync participant: ${participantError.message}`);
    }

    const { data: row, error: insertError } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationUuid,
        sender_id: senderUuid,
        body,
        kind,
        attachment,
      })
      .select('id, conversation_id, sender_id, body, kind, attachment, created_at')
      .single();

    if (insertError) throw new Error(`Could not save message: ${insertError.message}`);

    const message: Message = {
      id: row.id,
      conversationId,
      senderId: session.userId,
      sender: {
        id: session.userId,
        username,
        displayName,
        accent: 'emerald',
        online: true,
        lastSeen: null,
      },
      kind: (row.kind || 'text') as Message['kind'],
      text: row.body || '',
      attachment: (row.attachment as Attachment | null) ?? null,
      anonymous: false,
      ephemeral: false,
      viewOnce: false,
      viewOnceOpened: false,
      reactions: {},
      readBy: [session.userId],
      starred: false,
      createdAt: row.created_at,
      ...(input.clientId ? { clientId: input.clientId } : {}),
    } as Message;

    await broadcastToConversation(conversationId, 'message', {
      ...message,
      clientId: input.clientId,
    });

    return { success: true, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send message.';
    console.error('[sendMessage]', message);
    return { success: false, error: message };
  }
}
