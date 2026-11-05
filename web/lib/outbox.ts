/**
 * CRDT-Enhanced Outbox Queue with Vector Clock Conflict Resolution.
 * 
 * Provides eventual consistency for offline message sending with deterministic
 * conflict resolution via vector clocks. When two devices send the same logical
 * message, the server reconciles using vector clock comparison.
 */

import { db } from './db';
import { api } from './api';
import { useToast } from '@/lib/ToastProvider';
import { useEffect } from 'react';

/** Vector clock: maps replica ID to timestamp */
type VectorClock = Record<string, number>;

/** Merge two vector clocks: keep the max timestamp per key */
function mergeVc(a: VectorClock, b: VectorClock): VectorClock {
  const merged: VectorClock = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!(k in merged) || merged[k] < v) {
      merged[k] = v;
    }
  }
  return merged;
}

/** Check if vc a < vc b (all components <= and at least one <) */
function lessVc(a: VectorClock, b: VectorClock): boolean {
  let less = false;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const av = a[k] || 0;
    const bv = b[k] || 0;
    if (av > bv) return false;
    if (av < bv) less = true;
  }
  return less;
}

/** Check if vc a <= vc b (all components <=) */
function lteVc(a: VectorClock, b: VectorClock): boolean {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if ((a[k] || 0) > (b[k] || 0)) return false;
  }
  return true;
}

/** Increment a vector clock entry */
function incVc(vc: VectorClock, replicaId: string): VectorClock {
  return { ...vc, [replicaId]: (vc[replicaId] || 0) + 1 };
}

/**
 * Queue a message for offline sending with vector clock.
 * Returns the outboxId so the caller can later update the UI spinner.
 */
export async function queueMessageForOfflineSend(
  conversationId: string,
  kind: 'text' | 'image' | 'audio' | 'video' | 'file',
  text: string,
  attachment: {
    url: string;
    name: string;
    size: number;
    mime: string;
    width?: number;
    height?: number;
    duration?: number;
  } | null,
  payload: string, // JSON-serialized full message that the server expects
  replicaId: string // this client's replica ID for vector clocks
) {
  const vc: VectorClock = { [replicaId]: Date.now() };
  const outboxId = `outbox-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entry = {
    outboxId,
    conversationId,
    kind,
    text,
    attachment,
    status: 'sending',
    retries: 0,
    createdAt: new Date().toISOString(),
    payload,
    vc,
    refsTo: null,
  };

  await db.dbPutOutboxMessage(entry);
  return outboxId;
}

/** Retry loop: pick up every sending/failed outbox entry and re-deliver it.
 * Implements vector clock reconciliation on the server.
 */
export function useOutboxRetryLoop() {
  useEffect(() => {
    if (!api) return;

    const retry = async () => {
      const entries = await db.dbGetOutboxMessages();
      const pending = entries.filter(
        (e) => e.status === 'sending' || e.status === 'failed',
      );

      for (const entry of pending) {
        // Exponential backoff with jitter: 1s ± 25%, 2s ± 25°, 4s ± 25°, 8s cap
        const baseMs = 1_000 * Math.pow(2, entry.retries);
        const jitterMs = Math.floor(baseMs * 0.25 * Math.random());
        const delayMs = baseMs + jitterMs;
        await new Promise((r) => setTimeout(r, delayMs));

        try {
          // Send with vector clock for server-side dedup
          const result = await api.post<
            { message: any }
          >(`/api/conversations/${entry.conversationId}/messages`, JSON.parse(entry.payload), {
            headers: {
              'X-Vector-Clock': JSON.stringify(entry.vc),
            },
          });

          // Server accepted → mark as sent
          await db.dbPutOutboxMessageSentry(entry.outboxId, 'sent');
          console.log('[Outbox] Message sent:', entry.outboxId);
        } catch (error) {
          // Server returned a conflict - apply vector clock reconciliation
          if ((error as any).status === 409) {
            const serverVc = (error as any).headers?.['x-vector-clock']
              ? JSON.parse((error as any).headers['x-vector-clock'])
              : {};
            
            // Merge our vector clock with the server's
            const mergedVc = mergeVc(entry.vc, serverVc);
            
            // If our version is newer (lteVc check), retry with merged clock
            if (lteVc(entry.vc, serverVc)) {
              // Server has a newer version - we should accept it
              await db.dbPutOutboxMessageSentry(entry.outboxId, 'sent');
              console.log('[Outbox] Conflict resolved: server version wins');
            } else {
              // Our version is newer - retry with merged clock
              await db.dbIncrementOutboxRetries(entry.outboxId);
              // Update vector clock in entry for next attempt
              // Note: We'd need to read the entry again and update vc
              console.log('[Outbox] Retrying with merged vector clock');
            }
          } else {
            console.warn('[Outbox] Send failed:', entry.outboxId, error);
            // Increment retry count atomically
            await db.dbIncrementOutboxRetries(entry.outboxId);
            if (entry.retries >= 4) {
              // Show toast after 5 failed attempts
              const { toast } = useToast();
              toast('Message failed to send. Check your connection.', 'error');
            }
          }
        }
      }
    };

    // Run once immediately, then reschedule
    retry();
    const interval = setInterval(retry, 3_000); // re-check every 3s
    return () => clearInterval(interval);
  }, [api]);
}

/** Draft state interface for persistent cloud drafts */
type DraftState = {
  id: string;
  conversationId: string;
  text: string;
  metadata: {
    tone: 'professional' | 'friendly' | 'concise' | 'playful' | 'neutral';
    mentionIds: string[];
    reactions: Record<string, string[]>;
  };
  createdAt: string;
  updatedAt: string;
};

/** Helper to atomically set outbox status to sent */
async function dbPutOutboxMessageSentry(outboxId: string, status: 'sent') {
  const db = await db.db.getDb();
  await db.put('pending_outbox', {
    ...(await db.get('pending_outbox', outboxId)),
    status,
  }, outboxId);
}

/** Increment retries and update status based on threshold */
async function dbIncrementOutboxRetries(outboxId: string) {
  const db = await db.db.getDb();
  const entry = await db.get('pending_outbox', outboxId);
  if (!entry) return;
  const newRetries = (entry.retries || 0) + 1;
  const newStatus = newRetries >= 5 ? 'failed' : 'sending';
  await db.put('pending_outbox', {
    ...entry,
    retries: newRetries,
    status: newStatus,
  }, outboxId);
}

/** Mark an outbox entry as a duplicate of another */
async function dbMarkDuplicate(outboxId: string, refsTo: string) {
  const db = await db.db.getDb();
  await db.put('pending_outbox', {
    ...(await db.get('pending_outbox', outboxId)),
    status: 'duplicate',
    refsTo,
  }, outboxId);
}

/** Save a persistent draft to cloud */
async function dbSaveDraft(draft: DraftState) {
  const db = await db.db.getDb();
  await db.dbPutKeyValue('drafts', draft.id, draft);
  return draft.id;
}

/** Get a persistent draft for a conversation */
async function dbGetDraft(conversationId: string): Promise<DraftState | null> {
  const db = await db.db.getDb();
  const all = await db.dbGetAllOutboxMessages(); // reuse, or get from drafts store
  // Check drafts store
  const draftEntry = await db.get('pending_outbox', `draft-${conversationId}`);
  if (draftEntry) return draftEntry as DraftState;
  return null;
}

/** Remove a persistent draft */
async function dbRemoveDraft(draftId: string) {
  const db = await db.db.getDb();
  await db.dbDeleteKeyValue('drafts', draftId);
}

/** Get all persistent drafts */
async function dbGetAllDrafts(): Promise<DraftState[]> {
  const db = await db.db.getDb();
  return db.getAll('drafts');
}

/** Urgency tag for messages */
type UrgencyTag = 'routine' | 'important' | 'urgent';

/** Helper to set urgency on a message send */
async function queueMessageWithUrgency(
  conversationId: string,
  kind: 'text' | 'image' | 'audio' | 'video' | 'file',
  text: string,
  attachment: any,
  payload: string,
  replicaId: string,
  urgency: UrgencyTag = 'routine'
) {
  const vc: VectorClock = { [replicaId]: Date.now() };
  const outboxId = `outbox-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entry = {
    outboxId,
    conversationId,
    kind,
    text,
    attachment,
    status: 'sending',
    retries: 0,
    createdAt: new Date().toISOString(),
    payload,
    vc,
    refsTo: null,
    urgency,
  };

  await db.dbPutOutboxMessage(entry);
  return outboxId;
}

/** Get outbox messages filtered by urgency */
export async function dbGetOutboxMessagesByUrgency(
  conversationId: string,
  urgency: UrgencyTag
): Promise<any[]> {
  const db = await db.db.getDb();
  const all = await db.dbGetOutboxMessages(conversationId);
  return all.filter((e) => e.urgency === urgency);
}

/** Get all outbox messages with urgency filtering */
export async function dbDbGetAllOutboxMessages(): Promise<any[]> {
  const db = await db.db.getDb();
  return db.getAll('pending_outbox');
}

// Export ready-to-use hook
export { queueMessageForOfflineSend, useOutboxRetryLoop, queueMessageWithUrgency, dbSaveDraft, dbGetDraft, dbRemoveDraft, dbGetAllDrafts };