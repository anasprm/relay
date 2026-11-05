/** Clip & Snippet Vault - Personal saved cloud drawer.
 * Auto-categorizes links, code snippets, media, and documents shared in any chat.
 */
import { db } from './db';
import { useState, useEffect } from 'react';

/** Item categories */
const CATEGORIES = ['links', 'snippets', 'media', 'documents', 'other'];

/** Clip item interface */
export interface ClipItem {
  id: string;
  type: 'link' | 'code' | 'media' | 'document' | 'other';
  title: string;
  content: string; // URL, code, media info, doc path, or description
  sourceConversation: string;
  savedAt: string;
  category: (typeof CATEGORIES)[number];
}

/** Clip vault state interface */
export interface ClipVaultState {
  items: ClipItem[];
  categories: typeof CATEGORIES;
  loading: boolean;
  error: string | null;
}

/** Clip vault hook */
export function useClipVault() {
  const [state, setState] = useState<ClipVaultState>({
    items: [],
    categories: CATEGORIES,
    loading: false,
    error: null,
  });

  /** Save an item to the vault */
  const saveItem = async (item: Omit<ClipItem, 'id' | 'savedAt'>) => {
    try {
      setState((s) => ({ ...s, loading: true }));
      const normalized: ClipItem = {
        ...item,
        id: item.id || `clip-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        savedAt: new Date().toISOString(),
        category: categorizeItem(item),
      };

      // Persist to IndexedDB
      await db.dbPutKeyValue('clip_vault', normalized.id, normalized);

      setState((s) => ({
        ...s,
        items: [...s.items, normalized],
        loading: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to save clip',
        loading: false,
      }));
    }
  };

  /** Get items by category */
  const getItemsByCategory = (category: (typeof CATEGORIES)[number]) => {
    return state.items.filter((item) => item.category === category);
  };

  /** Remove an item */
  const removeItem = async (id: string) => {
    try {
      await db.dbDeleteKeyValue('clip_vault', id);
      setState((s) => ({
        ...s,
        items: s.items.filter((item) => item.id !== id),
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to remove clip',
      }));
    }
  };

  /** Get all items */
  const getAllItems = () => state.items;

  /** Update item */
  const updateItem = async (id: string, updates: Partial<ClipItem>) => {
    try {
      const existing = state.items.find((i) => i.id === id);
      if (!existing) return;

      const updated = { ...existing, ...updates, savedAt: new Date().toISOString() };
      await db.dbPutKeyValue('clip_vault', id, updated);
      setState((s) => ({
        ...s,
        items: s.items.map((item) => (item.id === id ? updated : item)),
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Failed to update clip',
      }));
    }
  };

  /** Categorize an item */
  function categorizeItem(item: Omit<ClipItem, 'category'>): (typeof CATEGORIES)[number] {
    if (item.type === 'link') return 'links';
    if (item.type === 'code' || item.content?.includes('//') || item.content?.includes('function')) return 'snippets';
    if (item.type === 'media') return 'media';
    if (item.type === 'document') return 'documents';
    return 'other';
  }

  return {
    state,
    saveItem,
    getItemsByCategory,
    removeItem,
    getAllItems,
    updateItem,
    categorizeItem,
    CATEGORIES,
  };
}

// Export default hook
export default useClipVault;