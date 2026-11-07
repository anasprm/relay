'use server';

import { stableUuid, usernameFor } from '@/lib/server/relayIds';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { parseSessionToken } from '@/lib/server/authStore';

export interface UploadAttachmentInput {
  token: string;
  conversationId: string;
  /** Data URL of the file (base64). */
  dataUrl: string;
  fileName: string;
  mimeType: string;
}

export type UploadAttachmentResult =
  | { success: true; attachment: { url: string; name: string; mime: string; size: number; kind: 'image' | 'audio' | 'video' | 'file'; duration?: number; width?: number; height?: number } }
  | { success: false; error: string };

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const KIND_FOR_MIME = (mime: string): 'image' | 'audio' | 'video' | 'file' => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
};

/**
 * Uploads an attachment to Supabase Storage (media bucket) using the service
 * role key, then returns the public URL and attachment metadata.
 *
 * The file is expected as a data URL (base64) because server actions cannot
 * directly receive `File` objects across the serialization boundary.
 */
export async function uploadAttachment(
  input: UploadAttachmentInput,
): Promise<UploadAttachmentResult> {
  const token = input?.token?.trim();
  const conversationId = input?.conversationId?.trim();
  const dataUrl = input?.dataUrl ?? '';
  const fileName = input?.fileName?.trim() || 'attachment';
  const mimeType = input?.mimeType?.trim() || 'application/octet-stream';

  if (!token) return { success: false, error: 'Not signed in.' };
  if (!conversationId) return { success: false, error: 'No conversation selected.' };
  if (!dataUrl) return { success: false, error: 'No file data provided.' };

  // Parse the data URL: data:<mime>;base64,<base64>
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    return { success: false, error: 'Invalid file data format.' };
  }
  const base64 = dataUrl.slice(commaIdx + 1);
  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length > MAX_FILE_SIZE) {
    return { success: false, error: 'File too large (max 50 MB).' };
  }

  const session = parseSessionToken(token);
  if (!session) return { success: false, error: 'Session is invalid or expired.' };

  try {
    const admin = getSupabaseAdmin();
    const senderUuid = stableUuid(`user:${session.userId}`);
    const conversationUuid = stableUuid(`conversation:${conversationId}`);

    // Ensure the caller is a participant.
    const { data: participant, error: participantError } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationUuid)
      .eq('user_id', senderUuid)
      .maybeSingle();
    if (participantError) throw new Error(participantError.message);
    if (!participant) {
      return { success: false, error: 'You are not a participant in this conversation.' };
    }

    // Ensure the sender user row exists.
    const { error: userError } = await admin.from('users').upsert(
      {
        id: senderUuid,
        username: usernameFor(session.userId, session.email),
        display_name: session.displayName || `user_${session.userId.slice(-6)}`,
        email: session.email,
        accent: 'emerald',
        online: true,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (userError) throw new Error(`Could not sync user: ${userError.message}`);

    // Storage path: conversations/<uuid>/<timestamp>-<filename>
    const kind = KIND_FOR_MIME(mimeType);
    const safeName = fileName.replace(/[^a-z09._-]/gi, '_').slice(0, 60);
    const storagePath = `conversations/${conversationUuid}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await admin.storage
      .from('media')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: publicUrlData } = await admin.storage
      .from('media')
      .getPublicUrl(storagePath);
    const url = publicUrlData.publicUrl;

    const attachment = {
      url,
      name: fileName,
      mime: mimeType,
      size: buffer.length,
      kind,
    } as const;

    return { success: true, attachment };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    console.error('[uploadAttachment]', message);
    return { success: false, error: message };
  }
}
