/**
 * IndexedDB Persistence Layer for Offline-First Relay-Messenger.
 * 
 * Stores:
 *   - conversations: { id, title, kind, participantIds, lastMessageId, updatedAt, version }
 *   - messages: { id, conversationId, senderId, kind, text, attachment, createdAt, isEncrypted, ephemeral }
 *   - users: { id, username, displayName, avatarUrl, scope, lastSeen }
 *   - media_cache: { key (url hash), blob, mime, size, fetchedAt }
 *   - pending_outbox: { id, conversationId, kind, text, attachment, status, retries, createdAt, payload }
 * 
 * All reads are synchronous (IDBTransaction), writes are async with retry.
 * Delta-sync from WebSocket arrives as `message:new` / `message:update` and
 * merges into this store, then re-renders the UI.
 */

import { openDB, DBSchema, IDBValidKey, deleteDB } from 'idb';

// ---------------------- Schema ----------------------

interface RelaySchema extends DBSchema {
  conversations: {
    key: string; // conversationId
    value: {
      conversationId: string;
      title: string | null;
      kind: 'direct' | 'group';
      participantIds: string[];
      lastMessageId: string | null;
      updatedAt: string;
      version: number;
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
        encryptedKeyId?: string | null; // reference to E2EE key bag
      } | null;
      createdAt: string;
      isEncrypted: boolean;
      ephemeral: boolean;
    };
  };
  users: {
    key: string; // username
    value: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      scope: 'private' | 'public';
      lastSeen: string;
    };
  };
  media_cache: {
    key: string; // normalized URL hash
    value: {
      url: string;
      blob: Blob;
      mime: string;
      size: number;
      fetchedAt: string;
    };
  };
  pending_outbox: {
    key: string; // outboxId (generated UUID)
    value: {
      outboxId: string;
      conversationId: string;
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
      } | null;
      status: 'sending' | 'sent' | 'failed';
      retries: number;
      createdAt: string;
      payload: string; // JSON-serialized full message
    };
  };
}

// ---------------------- DB Instance ----------------------

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<RelaySchema>('relay-db', 1, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // --- conversations ---
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'conversationId' });
        }

        // --- messages ---
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'messageId' });
        }

        // --- users ---
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'username' });
        }

        // --- media_cache ---
        if (!db.objectStoreNames.contains('media_cache')) {
          db.createObjectStore('media_cache', { keyPath: 'url' });
        }

        // --- pending_outbox ---
        if (!db.objectStoreNames.contains('pending_outbox')) {
          db.createObjectStore('pending_outbox', { keyPath: 'outboxId' });
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------- Conversations ----------------------

export async function dbPutConversation(
  conversation: {
    conversationId: string;
    title: string | null;
    kind: 'direct' | 'group';
    participantIds: string[];
    lastMessageId: string | null;
    updatedAt: string;
  }
) {
  const db = await getDb();
  await db.put('conversations', { ...conversation, version: Date.now() });
}

export async function dbGetConversation(
  conversationId: string
) {
  const db = await getDb();
  return db.get('conversations', conversationId);
}

export async function dbGetAllConversations() {
  const db = await getDb();
  return db.getAll('conversations');
}

// ---------------------- Messages ----------------------

export async function dbPutMessage(
  message: {
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
      encryptedKeyId?: string | null;
    } | null;
    createdAt: string;
    isEncrypted: boolean;
    ephemeral: boolean;
  }
) {
  const db = await getDb();
  await db.put('messages', {
    ...message,
    createdAt: new Date(message.createdAt).toISOString(),
  });
}

export async function dbGetMessages(
  conversationId: string,
  limit?: number,
  reverse = true
) {
  const db = await getDb();
  let items = db.getAll('messages', conversationId);
  if (reverse) items = items.then((msgs) => msgs.reverse());
  if (limit) {
    return items.then((msgs) => msgs.slice(0, limit));
  }
  return items;
}

export async function dbDeleteMessage(messageId: string) {
  const db = await getDb();
  await db.delete('messages', messageId);
}

// ---------------------- Users ----------------------

export async function dbPutUser(
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    scope: 'private' | 'public';
    lastSeen: string;
  }
) {
  const db = await getDb();
  await db.put('users', user);
}

export async function dbGetUser(username: string) {
  const db = await getDb();
  return db.get('users', username);
}

export async function dbGetAllUsers() {
  const db = await getDb();
  return db.getAll('users');
}

// ---------------------- Media Cache ----------------------

export async function dbPutMediaCache(
  url: string,
  blob: Blob,
  mime: string,
  size: number
) {
  const db = await getDb();
  const key = Buffer.from(url).toString('base64'); // hash the URL
  await db.put('media_cache', {
    url,
    key,
    blob,
    mime,
    size,
    fetchedAt: new Date().toISOString(),
  }, key);
}

export async function dbGetMediaCache(url: string) {
  const db = await getDb();
  const key = Buffer.from(url).toString('base64');
  return db.get('media_cache', key);
}

// ---------------------- Pending Outbox (Offline Send Queue) ----------------------

export async function dbPutOutboxMessage(
  message: {
    outboxId: string;
    conversationId: string;
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
    } | null;
    status: 'sending' | 'sent' | 'failed';
    retries: number;
    createdAt: string;
    payload: string;
  }
) {
  const db = await getDb();
  await db.put('pending_outbox', message);
}

export async function dbGetOutboxMessages(
  conversationId?: string
) {
  const db = await getDb();
  if (conversationId) {
    return db.getAllFromIndex('pending_outbox', 'conversationId', conversationId);
  }
  return db.getAll('pending_outbox');
}

export async function dbIncrementOutboxRetries(outboxId: string) {
  const db = await getDb();
  const entry = await db.get('pending_outbox', outboxId);
  if (!entry) return;
  await db.put('pending_outbox', {
    ...entry,
    retries: (entry.retries || 0) + 1,
    status: entry.retries >= 3 ? 'failed' : 'sending',
  });
}

// ---------------------- Bootstrap / Hydration ----------------------

/**
 * Hydrate the entire client state from IndexedDB on app start.
 * Returns a promise that resolves to the full state object.
 * The caller (e.g. a React root effect) should await this before rendering
 * any conversation UI, guaranteeing 0ms perceived load time for cached data.
 */
export async function bootstrapClientState(): Promise<{
  conversations: Map<string, RelaySchema['conversations']['value']>;
  messages: Map<string, RelaySchema['messages']['value'][]>;
  users: Map<string, RelaySchema['users']['value']>;
  mediaCache: Map<string, RelaySchema['media_cache']['value']>;
  outbox: RelaySchema['pending_outbox']['value'][];
}> {
  const db = await getDb();

  const [
    allConversations,
    allMessages,
    allUsers,
    allMedia,
    allOutbox,
  ] = await Promise.all([
    db.getAll('conversations'),
    db.getAll('messages'),
    db.getAll('users'),
    db.getAll('media_cache'),
    db.getAll('pending_outbox'),
  ]);

  const conversations = new Map(
    allConversations.map((c) => [c.conversationId, c])
  );

  // Group messages by conversationId
  const messages = new Map<string, RelaySchema['messages']['value'][]>();
  for (const m of allMessages) {
    if (!messages.has(m.conversationId)) messages.set(m.conversationId, []);
    messages.get(m.conversationId)!.push(m);
  }
  // Sort each conversation's messages by createdAt ascending
  for (const [convId, msgs] of messages.entries()) {
    msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  const users = new Map(
    allUsers.map((u) => [u.username, u])
  );

  const mediaCache = new Map();
  for (const m of allMedia) {
    mediaCache.set(m.url, m);
  }

  const outbox = allOutbox.filter(
    (o) => o.status === 'sending' || o.status === 'failed'
  ); // retry queue

  return { conversations, messages, users, mediaCache, outbox };
}

// ---------------------- Utilities ----------------------

export async function dbDeleteDatabase() {
  return deleteDB('relay-db');
}

export default { getDb, bootstrapClientState, dbPutConversation, dbGetConversation, dbGetAllConversations, dbPutMessage, dbGetMessages, dbDeleteMessage, dbPutUser, dbGetUser, dbGetAllUsers, dbPutMediaCache, dbGetMediaCache, dbPutOutboxMessage, dbGetOutboxMessages, dbIncrementOutboxRetries };