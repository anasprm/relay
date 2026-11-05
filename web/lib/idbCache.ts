/**
 * IndexedDB caching layer for Offline-First relay-messenger.
 * 
 * Caches:
 *   - conversations: sorted list with participant summaries
 *   - messages: per-conversation message arrays (oldest → newest)
 *   - media blobs: URL-safe base64 data for images/audio/ video thumbnails
 *   - user contacts: lookup map username→user record
 * 
 * API is deliberately synchronous for the hot path (React render), but
 * every write goes through the idb `async` API and queues behind the
 * scenes.  The caller may `await cache.xxx()` when they don't mind a
 * brief yield, or call the bare `db.*()` methods for fully async usage.
 */

import { openDB, deleteDB, type DBSchema, type IDBValidKey } from 'idb';

const DB_NAME = 'relay-messenger';
const DB_VERSION = 1;

// ---------------------- Schema ----------------------

interface RelayDB extends DBSchema {
  conversations: {
    key: string; // conversationId
    value: {
      conversationId: string;
      title: string | null;
      kind: 'direct' | 'group';
      participantIds: string[];
      lastMessageId: string | null;
      updatedAt: string;
    };
    index: {
      'by-participant': string; // participantId → conversationId
    };
  };
  messages: {
    key: string; // messageId
    value: {
      messageId: string;
      conversationId: string;
      senderId: string;
      kind: 'text' | 'image' | 'audio' | 'video' | 'file';
      text: string;
      attachment: {
        url: string;
        name: string;
        size: number;
        mime: string;
        width?: number;
        height?: number;
        duration?: number;
        grade?: { score: number; label: string; sharpness: number; exposure: number; contrast: number; colour: number } | null;
        transcript?: string | null;
      } | null;
      createdAt: string;
      reactedBy: Record<string, string>; // userId → reaction emoji
    };
  };
  contacts: {
    key: string; // username
    value: {
      username: string;
      displayName: string;
      avatarUrl: string | null;
      scope: 'private' | 'public';
    };
  };
}

// ---------------------- DB Instance ----------------------

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<RelayDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // ---- conversations store ----
        if (!db.objectStoreNames.contains('conversations')) {
          const convOS = db.createObjectStore('conversations', { keyPath: 'conversationId' });
          convOS.createIndex('by-participant', 'participantIds', { unique: false });
        }

        // ---- messages store ----
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'messageId' });
        }

        // ---- contacts store ----
        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'username' });
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------- Conversations ----------------------

export function cacheConversations(
  conversations: Array<{
    conversationId: string;
    title: string | null;
    kind: 'direct' | 'group';
    participantIds: string[];
    lastMessageId: string | null;
    updatedAt: string;
  }>
) {
  return getDb().then((db) =>
    Promise.all(
      conversations.map((c) =>
        db.put('conversations', {
          ...c,
          updatedAt: new Date().toISOString(),
        })
      )
    )
  );
}

export function cacheConversation(
  conversation: {
    conversationId: string;
    title: string | null;
    kind: 'direct' | 'group';
    participantIds: string[];
    lastMessageId: string | null;
    updatedAt: string;
  }
) {
  return getDb().then((db) =>
    db.put('conversations', conversation)
  );
}

export function getAllConversations(): Promise<
  Array<{
    conversationId: string;
    title: string | null;
    kind: 'direct' | 'group';
    participantIds: string[];
    lastMessageId: string | null;
    updatedAt: string;
  }>
> {
  return getDb().then((db) => db.getAll('conversations'));
}

export function getConversation(conversationId: string) {
  return getDb().then((db) => db.get('conversations', conversationId));
}

// Query conversations by participantId (one of the participants)
export function getConversationsForParticipant(
  participantId: string
): Promise<
  Array<{
    conversationId: string;
    title: string | null;
    kind: 'direct' | 'group';
    participantIds: string[];
    lastMessageId: string | null;
    updatedAt: string;
  }>
> {
  return getDb()
    .then((db) => db.getAllFromIndex('conversations', 'by-participant', participantId))
    .then((results) => results.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ));
}

// ---------------------- Messages ----------------------

export function cacheMessages(
  conversationId: string,
  messages: Array<{
    messageId: string;
    conversationId: string;
    senderId: string;
    kind: 'text' | 'image' | 'audio' | 'video' | 'file';
    text: string;
    attachment: {
      url: string;
      name: string;
      size: number;
      mime: string;
      width?: number;
      height?: number;
      duration?: number;
      grade?: { score: number; label: string; sharpness: number; exposure: number; contrast: number; colour: number } | null;
      transcript?: string | null;
    } | null;
    createdAt: string;
    reactedBy: Record<string, string>;
  }>
) {
  return getDb().then((db) =>
    Promise.all(
      messages.map((m) =>
        db.put('messages', {
          ...m,
          createdAt: new Date(m.createdAt).toISOString(),
        })
      )
    )
  );
}

export function getMessages(
  conversationId: string,
  options?: { limit?: number; reverse?: boolean }
): Promise<
  Array<{
    messageId: string;
    conversationId: string;
    senderId: string;
    kind: 'text' | 'image' | 'audio' | 'video' | 'file';
    text: string;
    attachment: {
      url: string;
      name: string;
      size: number;
      mime: string;
      width?: number;
      height?: number;
      duration?: number;
      grade?: { score: number; label: string; sharpness: number; exposure: number; contrast: number; colour: number } | null;
      transcript?: string | null;
    } | null;
    createdAt: string;
    reactedBy: Record<string, string>;
  }>
> {
  return getDb()
    .then((db) => db.getAll('messages', conversationId))
    .then((msgs) => {
      if (options?.reverse) {
        return msgs.reverse();
      }
      return msgs;
    });
}

export function getRecentMessages(
  conversationId: string,
  limit = 50
): Promise<
  Array<{
    messageId: string;
    conversationId: string;
    senderId: string;
    kind: 'text' | 'image' | 'audio' | 'video' | 'file';
    text: string;
    attachment: {
      url: string;
      name: string;
      size: number;
      mime: string;
      width?: number;
      height?: number;
      duration?: number;
      grade?: { score: number; label: string; sharpness: number; exposure: number; contrast: number; colour: number } | null;
      transcript?: string | null;
    } | null;
    createdAt: string;
    reactedBy: Record<string, string>;
  }>
> {
  return getDb()
    .then((db) =>
      db.getAll('messages', conversationId).then((msgs) =>
        msgs
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          .slice(-limit)
      )
    )
    .then((msgs) => msgs.reverse());
}

// ---------------------- Contacts ----------------------

export function cacheContact(
  contact: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    scope: 'private' | 'public';
  }
) {
  return getDb().then((db) => db.put('contacts', contact));
}

export function getAllContacts(): Promise<
  Array<{
    username: string;
    displayName: string;
    avatarUrl: string | null;
    scope: 'private' | 'public';
  }>
> {
  return getDb().then((db) => db.getAll('contacts'));
}

// ---------------------- Utility: warm cache on startup ----------------------

/**
 * Bootstraps the client cache from the server response.
 * Called during initial page load with the serialized conversation data.
 */
export function bootstrapCache(
  conversations: Array<{
    conversationId: string;
    title: string | null;
    kind: 'direct' | 'group';
    participantIds: string[];
    lastMessageId: string | null;
    updatedAt: string;
    messages: Array<{
      messageId: string;
      conversationId: string;
      senderId: string;
      kind: 'text' | 'image' | 'audio' | 'video' | 'file';
      text: string;
      attachment: {
        url: string;
        name: string;
        size: number;
        mime: string;
        width?: number;
        height?: number;
        duration?: number;
        grade?: { score: number; label: string; sharpness: number; exposure: number; contrast: number; colour: number } | null;
        transcript?: string | null;
      } | null;
      createdAt: string;
      reactedBy: Record<string, string>;
    }>;
  }>
) {
  return Promise.all([
    cacheConversations(
      conversations.map((c) => ({
        conversationId: c.conversationId,
        title: c.title,
        kind: c.kind,
        participantIds: c.participantIds,
        lastMessageId: c.lastMessageId,
        updatedAt: c.updatedAt,
      }))
    ),
    // Cache per-conversation messages (newest-first on server, stored newest-first)
    ...(conversations.map((c) =>
      c.messages
        ? cacheMessages(c.conversationId, c.messages)
        : Promise.resolve()
    )),
    // Cache contacts that appear in any participant list
    ...(conversations.flatMap((c) =>
      c.participantIds.map((pid) => {
        // We don't have full user records here; the server will stream them.
        // This is a no-op placeholder for future expansion.
        return Promise.resolve();
      })
    )),
  ]);
}

export default { getDb, cacheConversations, cacheMessages, getMessages, getRecentMessages, cacheContact, getAllContacts, bootstrapCache };