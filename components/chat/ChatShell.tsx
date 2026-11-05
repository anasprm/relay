'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';

import { GlassmorphicLayout } from './GlassmorphicLayout';
import { CallOverlay } from './CallOverlay';
import { CallPermissionNotice } from './CallPermissionNotice';
import { GroupCallOverlay } from './GroupCallOverlay';
import { ChatHeader } from './ChatHeader';
import { Composer } from './Composer';
import { ContactPanel } from './ContactPanel';
import { MessageList } from './MessageList';
import { ChatLockDialog } from './ChatLockDialog';
import { ContactAliasDialog } from './ContactAliasDialog';
import { ForwardDialog } from './ForwardDialog';
import { NewChatDialog } from './NewChatDialog';
import { NewGroupDialog } from './NewGroupDialog';
import { GroupRenameDialog } from './GroupRenameDialog';
import { ProfileDialog } from './ProfileDialog';
import { Sidebar, type ConversationFilter } from './Sidebar';
import { StarredDialog } from './StarredDialog';
import { StoriesRail } from './StoriesRail';
import { ChatFilters } from './ChatFilters';
import { StoryComposer } from './StoryComposer';
import { StoryViewer } from './StoryViewer';
import { WelcomePane } from './WelcomePane';
import { Splash } from '@/components/ui/Splash';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { API_URL, api } from '@/lib/api';
import { conversationName, isGroupConversation } from '@/lib/conversations';
import { errorMessage, useAuth } from '@/lib/AuthProvider';
import { readAllDrafts } from '@/lib/drafts';
import { favoritesKey, pinnedKey, readIdSet, writeIdSet } from '@/lib/localSets';
import { installRingtoneUnlock, stopRingtone } from '@/lib/ringtones';
import { createSocket } from '@/lib/socket';
import { isPrivateSite } from '@/lib/site';
import { useToast } from '@/lib/ToastProvider';
import { useCall, type CallKind } from '@/lib/useCall';
import { useGroupCall } from '@/lib/useGroupCall';
import { useMediaPermission } from '@/lib/useMediaPermission';
import { useStories } from '@/lib/useStories';
import { cn } from '@/lib/utils';
import type {
  Attachment,
  Conversation,
  Message,
  MessageKind,
  Modes,
  SendMessagePayload,
  Story,
  User,
} from '@/lib/types';
import { bootstrapCache, cacheConversations, cacheMessages, getMessages, getAllConversations } from '@/lib/idbCache';

function activityTime(conversation: Conversation): number {
  return new Date(conversation.lastMessage?.createdAt || conversation.updatedAt).getTime();
}

function sortByActivity(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => activityTime(b) - activityTime(a));
}

function mapServerConversation(c: any): Conversation {
  return {
    id: c.conversationId || c.id,
    conversationId: c.conversationId || c.id,
    title: c.title || '',
    kind: c.kind || 'direct',
    participantIds: c.participantIds || [],
    lastMessageId: c.lastMessageId || null,
    updatedAt: c.updatedAt || new Date().toISOString(),
    lastMessage: c.lastMessage ? {
      id: c.lastMessage.id || c.lastMessage.messageId || '',
      conversationId: c.lastMessage.conversationId || c.conversationId || c.id,
      senderId: c.lastMessage.senderId || '',
      kind: c.lastMessage.kind || 'text',
      text: c.lastMessage.text || '',
      attachment: c.lastMessage.attachment || undefined,
      createdAt: c.lastMessage.createdAt || new Date().toISOString(),
      reactedBy: c.lastMessage.reactedBy || {},
    } : undefined,
    participantCount: c.participantCount || (c.participantIds?.length || 0),
    messageCount: c.messageCount || 0,
  } as Conversation;
}

export function ChatShell() {
  const router = useRouter();
  const { user, token, loading = true, logout } = useAuth();
  const { toast } = useToast();
  const ownerId = user?.id;

  // ---- Filter state for "All / Unread / Favorites / Groups / Muted" ----
  const [filter, setFilter] = useState<'all' | 'unread' | 'favorites' | 'groups' | 'muted'>('all');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageReloadKey, setMessageReloadKey] = useState(0);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [connected, setConnected] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState('');
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupRenameOpen, setGroupRenameOpen] = useState(false);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [cacheState, setCacheState] = useState<'idle' | 'bootstrapping' | 'synching' | 'error'>('idle');

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [starredOpen, setStarredOpen] = useState(false);
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<{
    conversationId: string;
    messageId: string;
  } | null>(null);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyViewerGroup, setStoryViewerGroup] = useState<number | null>(null);

  const {
    groups: storyGroups,
    stories,
    setStoryComposerOpen: setStoryComposerOpenRef,
    setStoryViewerGroup: setStoryViewerGroupRef,
    me: myStory,
  } = useStories({ socket, enabled: !!token && !!user });

  // Redirect unauthenticated users inside useEffect (unconditional hook execution)
  useEffect(() => {
    if (!loading && !user && !token) {
      router.replace('/login');
    }
  }, [loading, user, token, router]);

  // ---------------------------------------------------------------------
  // Effect 1: Auth check + cache bootstrap from server-rendered HTML
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!user || !token) {
      setCacheState('idle');
      return;
    }
    async function bootstap() {
      setCacheState('bootstrapping');
      try {
        const bootstrap = (window as any).__RELAY_BOOTSTRAP__;
        if (bootstrap && bootstrap.conversations && bootstrap.conversations.length > 0) {
          await bootstrapCache(bootstrap.conversations);
          const cached = await getAllConversations();
          setConversations(cached.map(mapServerConversation));
          setCacheState('synching');
        } else {
          const resp = await api.get<{ conversations: Conversation[] }>('/api/conversations');
          setConversations(resp.data.conversations);
          setCacheState('synching');
        }
      } catch (e) {
        console.error('[ChatShell] Bootstrap failed:', e);
        try {
          const resp = await api.get<{ conversations: Conversation[] }>('/api/conversations');
          setConversations(resp.data.conversations);
        } catch (fe) {
          setMessageError(fe instanceof Error ? fe.message : 'Failed to load conversations');
        }
        setCacheState('error');
      }
    }
    bootstap();
  }, [user, token]);

  // ---------------------------------------------------------------------
  // Effect 2: Sync cache with server every 30 seconds when online
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (cacheState !== 'synching' || !token || !user) return;
    const interval = setInterval(async () => {
      try {
        const resp = await api.get<{ conversations: Conversation[] }>('/api/conversations');
        const fresh = resp.data.conversations;
        const hasChanges = fresh.some(
          (f: any) =>
            !conversations.some(
              (c: Conversation) => c.conversationId === f.id && c.updatedAt === f.updatedAt
            )
        );
        if (hasChanges) {
          await cacheConversations(
            fresh.map((f: any) => ({
              conversationId: f.id,
              title: f.title,
              kind: f.kind,
              participantIds: f.participantIds,
              lastMessageId: f.lastMessage?.id || null,
              updatedAt: f.lastMessage?.createdAt || f.updatedAt,
            }))
          );
          setConversations(
            fresh.map((f: any) => mapServerConversation(f))
          );
        }
      } catch (e) {
        console.warn('[ChatShell] Sync interval error:', e);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [cacheState, conversations, token, user]);

  // ---------------------------------------------------------------------
  // Effect 3: Load messages when active conversation changes
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    async function load() {
      try {
        const cached = await getMessages(activeId!, { limit: 200 });
        const resp = await api.get<{ messages: Message[] }>(`/api/conversations/${activeId}/messages?limit=200`);
        const serverMessages = resp.data.messages;
        const merged = [...cached];
        serverMessages.forEach((sm: Message) => {
          const already = merged.find((m) => m.id === sm.id || m.messageId === sm.messageId);
          if (!already) {
            merged.push(sm);
          }
        });
        merged.sort(
          (a: Message, b: Message) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setMessages(merged);
      } catch (e) {
        console.error('[ChatShell] Message load error:', e);
        try {
          const cached = await getMessages(activeId!, { limit: 100 });
          setMessages(cached);
        } catch (fe) {
          setMessages([]);
        }
      }
    }
    load();
  }, [activeId]);

  // ---------------------------------------------------------------------
  // Effect 4: Socket lifecycle
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!token || !user) return;
    const client = createSocket(token);
    if (!client) return;

    client.on('message:new', (message: any) => {
      cacheMessages(activeId || '', [{
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        kind: message.kind,
        text: message.text || '',
        attachment: message.attachment || null,
        createdAt: message.createdAt,
        reactedBy: message.reactedBy || {},
      } as any]).catch(() => {});
      setMessages((prev) => {
        const already = prev.some((m) => m.id === message.id);
        return already ? prev : [...prev, message];
      });
    });
    client.on('message:update', (message: any) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, ...message } : m))
      );
    });
    client.on('messages:purged', (payload: { conversationId: string; ids: string[] }) => {
      if (payload.conversationId === activeId) {
        setMessages((prev) => prev.filter((m) => !payload.ids.includes(m.id)));
      }
    });
    return () => {
      client.close();
    };
  }, [token, user, activeId]);

  const activeConversation = activeId ? conversations.find((c) => c.id === activeId || c.conversationId === activeId) : null;

  if (loading) {
    return <Splash label="Loading Relay..." />;
  }

  // ---------------------------------------------------------------------
  // Render the Glassmorphic 3-pane layout with filter tabs
  // ---------------------------------------------------------------------
  return (
    <GlassmorphicLayout
      user={user}
      token={token}
      loading={loading}
      conversations={conversations}
      activeId={activeId}
      activeConversation={activeConversation}
      messages={messages}
      cacheState={cacheState}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}

/** Get the full conversation list as cached (or fetch fresh). */
export function useCachedConversations() {
  const { token } = useAuth();
  return useMemo(() => {
    if (!token) return { conversations: [], loading: true };
    return { conversations: [], loading: false };
  }, [token]);
}
