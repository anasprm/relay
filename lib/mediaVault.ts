'use client';

import { dbGetMessages } from '@/lib/db';

export interface VaultItem {
  id: string;
  messageId: string;
  conversationId: string;
  senderId: string;
  createdAt: string;
  kind: 'image' | 'video' | 'audio' | 'file' | 'link';
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Extracts all shareable assets from a conversation's cached messages:
 * - media: images & videos
 * - docs: PDFs, office files, archives, and generic attachments
 * - audio: voice notes & uploaded audio files
 * - links: URLs embedded in text messages
 *
 * Results are newest-first within each category.
 */
export async function getConversationMediaVault(
  conversationId: string,
): Promise<{
  media: VaultItem[];
  docs: VaultItem[];
  audio: VaultItem[];
  links: VaultItem[];
}> {
  const messages = await dbGetMessages(conversationId);

  const media: VaultItem[] = [];
  const docs: VaultItem[] = [];
  const audio: VaultItem[] = [];
  const links: VaultItem[] = [];

  for (const msg of messages ?? []) {
    if (msg.is_deleted) continue;

    const createdAt = msg.createdAt || msg.created_at;
    const msgId = msg.id || msg.messageId;

    // --- Attachments ---
    if (msg.attachment?.url) {
      const att = msg.attachment;
      const item: VaultItem = {
        id: `${msgId}-att`,
        messageId: msgId,
        conversationId: msg.conversationId,
        senderId: msg.senderId || msg.sender,
        createdAt,
        kind: (att.kind as VaultItem['kind'] ?? 'file'),
        url: att.url,
        name: att.name ?? 'Attachment',
        size: att.size,
        mimeType: att.mime,
      };

      if (item.kind === 'image' || item.kind === 'video') {
        media.push(item);
      } else if (item.kind === 'audio') {
        audio.push(item);
      } else {
        docs.push(item);
      }
    }

    // --- Embedded links in text ---
    if (msg.text) {
      const matches = msg.text.match(URL_REGEX);
      if (matches) {
        matches.forEach((url, idx) => {
          links.push({
            id: `${msgId}-link-${idx}`,
            messageId: msgId,
            conversationId: msg.conversationId,
            senderId: msg.senderId || msg.sender,
            createdAt,
            kind: 'link',
            url,
            name: url,
          });
        });
      }
    }
  }

  const newestFirst = <T extends { createdAt: string }>(arr: T[]) =>
    arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    media: newestFirst(media),
    docs: newestFirst(docs),
    audio: newestFirst(audio),
    links: newestFirst(links),
  };
}
