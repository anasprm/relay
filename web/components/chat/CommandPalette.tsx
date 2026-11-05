'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth as useStore } from '@/lib/AuthProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/lib/types';

/** Command palette items */
type CommandPaletteItem = {
  id: string;
  title: string;
  description: string;
  action: () => void;
  icon?: string;
  shortcut?: string;
};

/** Command palette sections */
type CommandPaletteSection = {
  title: string;
  divider: boolean;
  items: CommandPaletteItem[];
};

/** Default command palette items */
const DEFAULT_ITEMS: CommandPaletteItem[] = [
  {
    id: 'new-chat',
    title: 'New Chat',
    description: 'Start a new conversation',
    action: () => router.push('/new-chat'),
    shortcut: '⌘N / Ctrl+N',
    icon: 'plus',
  },
  {
    id: 'new-group',
    title: 'New Group',
    description: 'Start a group conversation',
    action: () => router.push('/new-group'),
    shortcut: '⌘ShiftN / Ctrl+Shift+N',
    icon: 'square-plus',
  },
  {
    id: 'search',
    title: 'Search',
    description: 'Search messages and conversations',
    action: () => router.push('/search'),
    shortcut: '⌘K / Ctrl+K',
    icon: 'search',
  },
  {
    divider: true,
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'App settings and preferences',
    action: () => router.push('/settings'),
    shortcut: '⌘, / Ctrl+,',
    icon: 'settings',
  },
  {
    id: 'privacy',
    title: 'Privacy Controls',
    description: 'Privacy and security settings',
    action: () => router.push('/settings/privacy'),
    shortcut: null,
    icon: 'lock',
  },
  {
    divider: true,
  },
  {
    id: 'log-out',
    title: 'Log Out',
    description: 'Sign out from Relay',
    action: async () => {
      await store.logout();
      router.push('/');
    },
    shortcut: null,
    icon: 'log-out',
  },
];

/** CommandPalette - Universal Command Palette (Cmd+K) */
export function CommandPalette() {
  const router = useRouter();
  const { user, token } = useStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const [results, setResults] = useState<CommandPaletteItem[]>(DEFAULT_ITEMS);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!filter) return DEFAULT_ITEMS;
    const lowerFilter = filter.toLowerCase();
    return DEFAULT_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerFilter) ||
        item.description.toLowerCase().includes(lowerFilter) ||
        item.shortcut?.toLowerCase().includes(lowerFilter)
    );
  }, [filter]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setFilter('');
        setFocusedIndex(-1);
        if (inputRef.current) {
          inputRef.current.blur();
        }
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [setOpen, setFilter, focusedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < results.length) {
            const item = results[focusedIndex];
            item.action();
            setOpen(false);
            setFilter('');
            setFocusedIndex(-1);
          }
          break;
        case 'Escape':
          setOpen(false);
          setFilter('');
          setFocusedIndex(-1);
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, results, setOpen, setFilter, focusedIndex]);

  // Filter results when filter changes
  useEffect(() => {
    setResults(filterItems => {
      const lowerFilter = filter.toLowerCase();
      return DEFAULT_ITEMS.filter(
        (item) =>
          item.title.toLowerCase().includes(lowerFilter) ||
          item.description.toLowerCase().includes(lowerFilter) ||
          item.shortcut?.toLowerCase().includes(lowerFilter)
      );
    });
  }, [filter]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (open && inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setOpen(false);
        setFilter('');
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Open palette
  const openPalette = () => {
    setOpen(true);
    // Focus input after render
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Render command palette
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-lg bg-background/90 rounded-xl border border-border/30 p-4 shadow-xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Command Palette</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-[10px] text-muted hover:text-primary transition-colors"
            aria-label="Close palette"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <input
            ref={inputRef}
            type="text"
            onInput={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
            value={filter}
            className="bg-transparent border-none w-full outline-none text-primary placeholder:text-muted/60 text-sm focus:outline-none"
            placeholder="Search commands (Cmd+K)..."
            aria-label="Command palette"
          />
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {results.length === 0
            ? <p className="text-[10px] text-muted/60 text-center py-8">
                No commands match your search
              </p>
            : <div className="space-y-1">
              {results.map((item, index) => {
                const isFocused = focusedIndex === index;
                return (
                  <button
                    key={item.id}
                    onClick={() => item.action()}
                    className={cn(
                      'flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-border/20 transition-colors',
                      isFocused && 'bg-primary/10 text-primary-foreground',
                      'data-disabled="disabled": opacity-50 cursor-not-allowed'
                    )}
                    tabIndex={-1}
                    role="menuitem"
                  >
                    <svg
                      className="h-4 w-4 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      {...(item.icon && {
                        'data-icon': item.icon,
                      })}>
                      <path
                        d="M12 2L2 7l10 5 10-5-5-5zM2 12l7 7 7-7H2zm2.5 6l2.5-2.5 2.5 2.5H5zm7.5-2.5L13 5.5l2.5 2.5-2.5 2.5H11zm4.5 4.5l2.5-2.5 2.5 2.5H9z"
                        fill="currentColor"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium truncate">
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-[10px] text-muted/60 truncate">
                          {item.description}
                        </p>
                      )}
                      {item.shortcut && (
                        <span className="text-[10px] text-muted/60 ml-auto">
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                  </button>
                );
              }
              )
            }
            </div>
          }
        </div>
      </div>
    </div>
  );
}

/** Hook for command palette integration */
export function useCommandPalette() {
  const { user, token } = useStore();
  const router = useRouter();

  const openPalette = () => {
    // In a real app, this would focus the palette component
    // For now, just navigate or show alert
    router.push('/');
  };

  const handleKeyShortcut = (e: KeyboardEvent) => {
    // Cmd+K / Ctrl+K handler
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openPalette();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyShortcut);
    return () => {
      document.removeEventListener('keydown', handleKeyShortcut);
    };
  }, [openPalette]);

  return { openPalette };
}