'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type User } from '@/lib/AuthProvider';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { ChatFilters } from './ChatFilters';
import { StoriesRail } from './StoriesRail';
import { MessageList } from './MessageList';
import { MessageSquarePlus } from 'lucide-react';
import type { Conversation, Message } from '@/lib/types';

type CacheState = 'idle' | 'bootstrapping' | 'synching' | 'error';

interface Brief {
  source: string;
  stats: { messages: number; readingMinutes: number };
  highlights: Array<{ sender: string; text: string }>;
  actionItems: Array<{ kind: string; text: string }>;
  topics: string[];
}

/**
 * 3-pane glassmorphic layout:
 *  - Pane 1 (200px): Chats sidebar — conversation list, new chat, groups
 *  - Pane 2 (main): Hybrid feed — stories rail when no conversation active,
 *    conversation messages when a thread is selected
 *  - Pane 3 (280px): AI Copilot — smart thread brief, highlights, action items,
 *    topics, unread stats, privacy controls
 */
export function GlassmorphicLayout({
  user,
  token,
  conversations,
  activeId,
  activeConversation,
  messages,
  cacheState,
  filter,
  onFilterChange,
}: {
  user: User | null;
  token: string | null;
  conversations: Conversation[];
  activeId: string | null;
  activeConversation: Conversation | null;
  messages: Message[];
  cacheState: CacheState;
  filter: 'all' | 'unread' | 'favorites' | 'groups' | 'muted';
  onFilterChange: (f: 'all' | 'unread' | 'favorites' | 'groups' | 'muted') => void;
  onNewChat?: () => void;
  loading?: boolean;
}) {
  const router = useRouter();

  // When not authenticated, render welcome / auth screen inside the
  // left pane so the layout chrome stays consistent.
  if (!user || !token) {
    return (
      <div className="flex min-h-screen bg-[#020204]/70 backdrop-blur-lg transition-colors">
        <aside
          className="w-24 flex flex-col border-r border-[#27272a]/30 bg-[#121219]/70 backdrop-blur-sm transition-all hover:bg-[#121219]/80"
          aria-label="Chats sidebar"
        >
          <div className="flex h-14 items-center justify-between px-3">
            <span className="font-medium text-sm">Chats</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            <div className="text-center text-[#9ca3af]">
              {token ? 'Loading…' : 'Sign in to Relay'}
            </div>
          </div>
        </aside>
        <main
          className="flex-1 flex flex-col border-l border-[#27272a]/30 bg-[#121219]/70 backdrop-blur-sm overflow-hidden"
          aria-label="Hybrid feed"
        >
          <div className="h-24 border-b border-[#27272a]/20 bg-[#020204]/50 flex items-center px-4">
            <h1 className="font-semibold">Relay</h1>
          </div>
          <div className="p-6 flex flex-col items-center justify-center h-full">
            <div className="text-[#9ca3af]">
              Sign in to see your conversations
            </div>
          </div>
        </main>
        <aside
          className="w-28 flex flex-col border-l border-[#27272a]/30 bg-[#121219]/70 backdrop-blur-sm min-h-screen"
          aria-label="AI Copilot"
        >
          <div className="flex h-14 items-center justify-between px-3 border-b border-[#27272a]/20">
            <span className="font-medium text-sm">AI Copilot</span>
          </div>
          <div className="p-3 text-[#9ca3af] text-xs">
            Sign in for smart briefs
          </div>
        </aside>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleEnd, setVisibleEnd] = useState(conversations.length - 1);
  const [compressionPending, setCompressionPending] = useState(false);
  const [compressionResult, setCompressionResult] = useState<
    | { kind: 'image'; compressedBlob: Blob; previewUrl: string; originalSize: number; compressedSize: number; ratio: number }
    | { kind: 'video-thumbnail'; previewCanvas: HTMLCanvasElement; duration: number }
    | null
  >(null);

  // -------------------------------------------------------------------------
  // AI Copilot brief state
  // -------------------------------------------------------------------------
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(true);

  useEffect(() => {
    if (!activeConversation || !token) {
      setLoadingBrief(false);
      return;
    }
    fetch(`/api/insights/${activeConversation.id}/brief`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setBrief(data.brief))
      .finally(() => setLoadingBrief(false));
  }, [activeConversation, token]);

  // -------------------------------------------------------------------------
  // Render the 3-pane layout
  // -------------------------------------------------------------------------
  // Pane 1: Chats sidebar (200px) with filter tabs
  const chatsSidebar = (
    <aside
      className="w-24 flex flex-col border-r border-[#27272a]/30 bg-[#121219]/70 backdrop-blur-sm transition-all hover:bg-[#121219]/80"
      aria-label="Chats sidebar"
    >
      <div className="flex h-14 items-center justify-between px-3">
        <span className="font-medium text-sm">Chats</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/')}
            className="p-1 rounded hover:bg-[#27272a]/30 transition-colors"
            aria-label="Back to home"
          >
            ←
          </button>
          <button
            onClick={onNewChat}
            className="p-1 rounded hover:bg-[#27272a]/30 transition-colors text-[#25D366]"
            aria-label="New conversation"
          >
            <MessageSquarePlus size={20} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <ChatFilters
        filter={filter}
        setFilter={onFilterChange}
      />

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="text-[#9ca3af] text-xs">
            No conversations yet
          </div>
        ) : (
          // TODO: render ConversationRow components from the existing sidebar
          <div className="text-[#9ca3af] text-xs hover:text-white cursor-pointer p-1 rounded" onClick={() => router.push('/')}>
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-[#27272a]/20 flex items-center justify-between">
        <button
          onClick={() => navigator.clipboard.writeText(user.username || user.email || '')}
          className="text-xs text-[#9ca3af] hover:underline"
          aria-label="Copy username"
        >
          Copy @{user.username}
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="text-xs text-[#a78bfa] hover:underline"
        >
          Profile
        </button>
      </div>
    </aside>
  );

  // Pane 2: Hybrid feed (main)
  const hybridFeed = (
    <main
      className="flex-1 flex flex-col border-l border-[#27272a]/30 bg-[#121219]/70 backdrop-blur-sm overflow-hidden"
      aria-label="Hybrid feed"
    >
      <div className="h-24 border-b border-[#27272a]/20 bg-[#020204]/50 flex items-center px-4">
        <h1 className="font-semibold">
          {activeConversation?.title || 'Relay'}
        </h1>
      </div>

      {/* Hybrid: Stories rail when no conv active, messages when conv active */}
      {activeConversation ? (
        <MessageList
          conversationId={activeConversation.id}
          userId={user?.id || ''}
        />
      ) : (
        <StoriesRail
          me={user?.id || ''}
          socket={null}
        />
      )}
    </main>
  );

  // Pane 3: AI Copilot (280px)
  const aiCopilot = (
    <>
      {loadingBrief && (
        <aside
          className="w-28 flex flex-col border-l border-[#27272a]/30 bg-[#121219]/70 backdrop-blur-sm min-h-screen"
          aria-label="AI Copilot"
        >
          <div className="flex h-14 items-center justify-between px-3 border-b border-[#27272a]/20">
            <span className="font-medium text-sm">AI Copilot</span>
          </div>
          <div className="p-3 text-[#9ca3af] text-xs">
            Loading brief…
          </div>
        </aside>
      )}
      {!loadingBrief && !brief && (
        <aside
          className="w-28 flex flex-col border-l border-[#27272a]/30 bg-[#121219]/70 backdrop-blur-sm min-h-screen"
          aria-label="AI Copilot"
        >
          <div className="flex h-14 items-center justify-between px-3 border-b border-[#27272a]/20">
            <span className="font-medium text-sm">AI Copilot</span>
          </div>
          <div className="p-3 text-[#9ca3af] text-xs">
            Select a conversation for your smart brief
          </div>
        </aside>
      )}
      {!loadingBrief && brief && (
        <aside
          className="w-28 flex flex-col border-l border-[#27272a]/30 bg-[#121219]/70 backdrop-blur-sm min-h-screen"
          aria-label="AI Copilot"
        >
          <div className="flex h-14 items-center justify-between px-3 border-b border-[#27272a]/20">
            <span className="font-medium text-sm">AI Copilot</span>
            <button
              onClick={() => navigator.clipboard.writeText('copilot-summary-placeholder')}
              className="text-xs text-[#9ca3af] hover:underline"
              aria-label="Copy summary"
            >
              Summary
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <h3 className="font-semibold text-sm">Morning Brief</h3>
            <p className="text-[#9ca3af] text-xs">
              {brief.source}: {brief.stats.messages} messages · {brief.stats.readingMinutes} min read
            </p>

            {/* Highlights */}
            {brief.highlights.length > 0 && (
              <div>
                <p className="font-medium text-xs">Key points:</p>
                <ul className="list-disc pl-3 truncate text-xs space-y-1">
                  {brief.highlights.map((h, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium">{h.sender}:</span> {h.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action items */}
            {brief.actionItems.length > 0 && (
              <div>
                <p className="font-medium text-xs">Action items:</p>
                <ul className="list-decimal pl-3 truncate text-xs space-y-1">
                  {brief.actionItems.map((a, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium">{a.kind}:</span> {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Topics */}
            {brief.topics.length > 0 && (
              <div>
                <p className="font-medium text-xs">Topics:</p>
                <div className="flex flex-wrap gap-1">
                  {brief.topics.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded bg-[#27272a]/30 text-white/50"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-2 border-t border-[#27272a]/20 flex items-center justify-between">
            <button
              onClick={() => router.push('/settings/privacy')}
              className="text-xs text-[#9ca3af] hover:underline"
              aria-label="Privacy controls"
            >
              Privacy
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="text-xs text-[#9ca3af] hover:underline"
              aria-label="Settings"
            >
              Settings
            </button>
          </div>
        </aside>
      )}
    </>
  );
  // Render the full page
  return (
    <div className="flex min-h-screen bg-[#020204]/70 backdrop-blur-lg transition-colors">
      {chatsSidebar}
      {hybridFeed}
      {aiCopilot}
    </div>
  );
}
