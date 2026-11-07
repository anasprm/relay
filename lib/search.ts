'use client';

import { dbGetAllMessages, dbGetMessages } from '@/lib/db';

export interface SearchResult {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderUsername: string | null;
  text: string;
  kind: string;
  attachmentName: string | null;
  createdAt: string;
  matchIndex: number;
  matchLength: number;
  isDeleted: boolean;
}

/**
 * Tokenizes a search query into lowercase terms, splitting on whitespace.
 * Empty terms are filtered out.
 */
function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Highlights all occurrences of a query term within a string.
 * Returns an array of { text, isMatch } segments for rendering.
 */
function highlightSegments(text: string, query: string): { text: string; isMatch: boolean }[] {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const segments: { text: string; isMatch: boolean }[] = [];
  let cursor = 0;
  let idx = lowerText.indexOf(lowerQuery);

  while (idx !== -1) {
    if (idx > cursor) {
      segments.push({ text: text.slice(cursor, idx), isMatch: false });
    }
    segments.push({ text: text.slice(idx, idx + query.length), isMatch: true });
    cursor = idx + query.length;
    idx = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), isMatch: false });
  }

  return segments;
}

/**
 * Snips a window of text around a match index, bounded by maxChars.
 */
function snippetAround(text: string, matchIndex: number, matchLength: number, maxChars = 120): string {
  const half = Math.floor(maxChars / 2);
  let start = Math.max(0, matchIndex - half);
  let end = Math.min(text.length, matchIndex + matchLength + half);

  // Expand start to the nearest word boundary
  if (start > 0) {
    const space = text.lastIndexOf(' ', start - 1);
    start = space !== -1 ? space + 1 : 0;
  }

  // Expand end to the nearest word boundary
  if (end < text.length) {
    const space = text.indexOf(' ', end);
    end = space !== -1 ? space : text.length;
  }

  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end) + suffix;
}

/**
 * Client-side full-text search over cached messages in IndexedDB.
 *
 * When `conversationId` is provided, only messages in that conversation are
 * searched. Otherwise all cached messages across every conversation are
 * scanned. Results are ranked by recency (newest first).
 */
export async function searchLocalMessages(
  query: string,
  conversationId?: string,
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const terms = tokenize(trimmed);
  if (terms.length === 0) return [];

  const messages = conversationId
    ? await dbGetMessages(conversationId)
    : await dbGetAllMessages();

  const results: SearchResult[] = [];

  for (const msg of messages ?? []) {
    if (!msg.text || msg.is_deleted) continue;

    const lowerText = msg.text.toLowerCase();

    // Every term must match somewhere in the message (AND semantics).
    const allMatch = terms.every((term) => lowerText.includes(term));
    if (!allMatch) continue;

    // Use the first term for the highlight/snippet position.
    const firstTerm = terms[0];
    const matchIndex = lowerText.indexOf(firstTerm);

    results.push({
      id: msg.messageId,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      senderName: '', // filled in by caller via conversation/participant lookup
      senderUsername: '',
      text: msg.text,
      kind: msg.kind,
      attachmentName: msg.attachment?.name ?? null,
      createdAt: msg.createdAt,
      matchIndex,
      matchLength: firstTerm.length,
      isDeleted: !!msg.is_deleted,
    });
  }

  return results.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Render-ready search result with pre-computed highlight segments and snippet.
 */
export interface SearchResultView extends SearchResult {
  segments: { text: string; isMatch: boolean }[];
  snippet: string;
}

/**
 * Transforms raw search results into view-ready results with highlighting.
 */
export function formatSearchResults(
  results: SearchResult[],
  query: string,
): SearchResultView[] {
  return results.map((r) => {
    const segments = highlightSegments(r.text, query);
    const snippet = snippetAround(r.text, r.matchIndex, r.matchLength);
    return { ...r, segments, snippet };
  });
}
