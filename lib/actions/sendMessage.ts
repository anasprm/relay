'use server';

import { createHash } from 'node:crypto';
import { parseSessionToken } from '@/lib/server/authStore';
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
 * Turns an arbitrary relay id (`conv_general_community`, `usr_me`, …) into a
 * stable UUID so it can be used as a foreign key in the Supabase schema.
 */
function stableUuid(seed: string): string {
  const hex = createHash('sha1').update(seed).digest('hex');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

function usernameFor(userId: string, email: string | null): string {
  const base =
    (email?.split('@')[0] || userId)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 24) || 'relay_user';
  const suffix = userId.replace(/[^a-z0-9]/gi, '').slice(-6) || 'local';
  return `${base}_${suffix}`;
}

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

    await broadcastMessage(conversationId, message, input.clientId);

    return { success: true, message };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send message.';
    console.error('[sendMessage]', message);
    return { success: false, error: message };
  }
}

/**
 * Publishes the message over Realtime Broadcast, which is not subject to RLS.
 * Clients subscribe to `conversation:<relay conversation id>`.
 */
async function broadcastMessage(
  conversationId: string,
  message: Message,
  clientId?: string,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `conversation:${conversationId}`,
            event: 'message',
            payload: { ...message, clientId },
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[sendMessage] broadcast failed', response.status, detail);
    }
  } catch (error) {
    console.error('[sendMessage] broadcast error', error);
  }
}
