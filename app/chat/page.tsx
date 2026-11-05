"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Logo } from "@/components/ui/Logo";
import {
  MessageSquarePlus,
  Search,
  UserRound,
  Users,
  X,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation, Message, User } from "@/lib/types";

/* -------------------------------------------------------------------------
   Mock data fallback — seeded when no conversations exist
   ------------------------------------------------------------------------- */
const MOCK_USER: User = {
  id: "usr_me",
  username: "alexmercer",
  displayName: "Alex Mercer",
  email: "alex@relay.pro",
  accent: "cyan",
  avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
  online: true,
  lastSeen: new Date().toISOString(),
};

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv_relay_assistant",
    conversationId: "conv_relay_assistant",
    title: "Relay Assistant",
    kind: "direct",
    participantIds: ["usr_me", "usr_ai"],
    other: {
      id: "usr_ai",
      username: "relay_ai",
      displayName: "Relay AI",
      accent: "emerald",
      avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150",
      online: true,
      lastSeen: new Date().toISOString(),
    },
    participantCount: 2,
    lastMessage: {
      id: "msg_ai_1",
      conversationId: "conv_relay_assistant",
      senderId: "usr_ai",
      sender: {
        id: "usr_ai",
        username: "relay_ai",
        displayName: "Relay AI",
        accent: "emerald",
        avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150",
        online: true,
      },
      kind: "text",
      text: "Hi Alex! How can I help you with Relay Messenger Pro today?",
      attachment: null,
      anonymous: false,
      ephemeral: false,
      viewOnce: false,
      viewOnceOpened: false,
      reactions: {},
      readBy: ["usr_me"],
      starred: false,
      createdAt: new Date(Date.now() - 300000).toISOString(),
    },
    unreadCount: 0,
    modes: { anonymity: false, vanish: false },
    locked: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
    messageCount: 12,
  },
  {
    id: "conv_general_community",
    conversationId: "conv_general_community",
    title: "General Community",
    kind: "group",
    participantIds: ["usr_me", "usr_2", "usr_3"],
    createdBy: "usr_2",
    other: null,
    participantCount: 3,
    lastMessage: {
      id: "msg_gen_1",
      conversationId: "conv_general_community",
      senderId: "usr_2",
      sender: {
        id: "usr_2",
        username: "elena_rostova",
        displayName: "Elena Rostova",
        accent: "rose",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        online: true,
      },
      kind: "text",
      text: "The new glassmorphic UI looks amazing! Great work on the workspace design.",
      attachment: null,
      anonymous: false,
      ephemeral: false,
      viewOnce: false,
      viewOnceOpened: false,
      reactions: { "🔥": 3, "💎": 2 },
      readBy: ["usr_me"],
      starred: false,
      createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    unreadCount: 2,
    modes: { anonymity: false, vanish: false },
    locked: false,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
    messageCount: 45,
  },
  {
    id: "conv_design_systems",
    conversationId: "conv_design_systems",
    title: "Glassmorphic UI Systems",
    kind: "group",
    participantIds: ["usr_me", "usr_2"],
    createdBy: "usr_2",
    other: null,
    participantCount: 2,
    lastMessage: {
      id: "msg_design_1",
      conversationId: "conv_design_systems",
      senderId: "usr_2",
      sender: {
        id: "usr_2",
        username: "elena_rostova",
        displayName: "Elena Rostova",
        accent: "rose",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        online: true,
      },
      kind: "text",
      text: "Backdrop-filter blur gradients are ready for production deployment.",
      attachment: null,
      anonymous: false,
      ephemeral: false,
      viewOnce: false,
      viewOnceOpened: false,
      reactions: { "🚀": 4 },
      readBy: ["usr_me"],
      starred: true,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    unreadCount: 0,
    modes: { anonymity: false, vanish: false },
    locked: false,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    messageCount: 28,
  },
];

const MOCK_MESSAGES: Message[] = [
  {
    id: "msg_1",
    conversationId: "conv_general_community",
    senderId: "usr_2",
    sender: MOCK_CONVERSATIONS[1].other || MOCK_CONVERSATIONS[1].participants?.[0] || {
      id: "usr_2",
      username: "elena_rostova",
      displayName: "Elena Rostova",
      accent: "rose",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
      online: true,
    },
    kind: "text",
    text: "Welcome to Relay Messenger Pro! The glassmorphic workspace is now live.",
    attachment: null,
    anonymous: false,
    ephemeral: false,
    viewOnce: false,
    viewOnceOpened: false,
    reactions: { "🔥": 5 },
    readBy: ["usr_me"],
    starred: false,
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: "msg_2",
    conversationId: "conv_general_community",
    senderId: "usr_me",
    sender: MOCK_USER,
    kind: "text",
    text: "Thanks Elena! The backdrop-filter blur(32px) with OLED pure-black theme looks stunning on Vercel.",
    attachment: null,
    anonymous: false,
    ephemeral: false,
    viewOnce: false,
    viewOnceOpened: false,
    reactions: {},
    readBy: ["usr_me"],
    starred: false,
    createdAt: new Date(Date.now() - 850000).toISOString(),
  },
];

/* -------------------------------------------------------------------------
   Components
   ------------------------------------------------------------------------- */

function Avatar({ user, size = 40 }: { user: User; size?: number }) {
  return (
    <div className={`relative h-${size / 4} w-${size / 4} shrink-0`}>
      <img
        src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=06b6d4&color=fff`}
        alt={user.displayName}
        className="h-full w-full rounded-full object-cover border-2 border-white/20"
      />
      <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-black bg-emerald-500"></span>
    </div>
  );
}

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div
      className={cn(
        "flex items-end gap-2 max-w-[80%]",
        isMe ? "flex-row-reverse ml-auto" : "mr-auto"
      )}
    >
      {!isMe && (
        <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-slate-300 border border-white/10 overflow-hidden">
          {message.sender.displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm",
          isMe
            ? "bg-cyan-600 text-white rounded-tr-none"
            : "bg-white/5 border border-white/10 text-slate-200 rounded-tl-none"
        )}
      >
        {message.text}
        <div className={`text-[10px] mt-1 text-right ${isMe ? "text-cyan-200/70" : "text-slate-400/70"}`}>
          {time}
        </div>
      </div>
      {isMe && (
        <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-slate-300 border border-white/10 overflow-hidden">
          {MOCK_USER.displayName.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
   Main Chat Page
   ------------------------------------------------------------------------- */

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, token, loading } = useAuth();

  // -----------------------------------------------------------------
  // State
  // -----------------------------------------------------------------
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "favorites" | "groups">("all");
  const [sidebarOpen, setSidebarOpen] = useState(typeof window === "undefined" ? true : window.innerWidth > 768);

  // -----------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------
  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace("/login");
      return;
    }

    // Seed mock data if API returns empty (for immediate UI feedback)
    setTimeout(() => {
      if (conversations.length === 0) {
        setConversations(MOCK_CONVERSATIONS);
        setActiveId(MOCK_CONVERSATIONS[0].id);
        setMessages(MOCK_MESSAGES);
      }
    }, 100);
  }, [loading, user, token, router, conversations.length]);

  // -----------------------------------------------------------------
  // Derived
  // -----------------------------------------------------------------
  const activeConversation = conversations.find((c) => c.id === activeId);
  const visibleMessages = messages.filter((m) => m.conversationId === activeId);

  const filteredConversations = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    let list = conversations.filter((c) => {
      if (!needle) return true;
      return c.title?.toLowerCase().includes(needle) || c.other?.displayName.toLowerCase().includes(needle);
    });
    if (filter === "unread") list = list.filter((c) => c.unreadCount > 0);
    if (filter === "favorites") list = list.filter((c) => c.starred);
    if (filter === "groups") list = list.filter((c) => c.kind === "group");
    return list.sort((a, b) => {
      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
  }, [conversations, searchQuery, filter]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId: activeId || "conv_general_community",
      senderId: "usr_me",
      sender: MOCK_USER,
      kind: "text",
      text: draft,
      attachment: null,
      anonymous: false,
      ephemeral: false,
      viewOnce: false,
      viewOnceOpened: false,
      reactions: {},
      readBy: ["usr_me"],
      starred: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setDraft("");
    setConversations((prev) =>
      prev.map((c) =>
        c.id === (activeId || "conv_general_community")
          ? { ...c, lastMessage: newMessage, unreadCount: 0, updatedAt: new Date().toISOString() }
          : c
      )
    );
  };

  const handleNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setDraft("");
    toast("Start a new conversation by entering a username or email", "info");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-white/30 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-xs">Loading Relay…</p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return null; // redirect handled by effect
  }

  return (
    <div className="flex h-screen bg-[#050505] text-slate-100 overflow-hidden">
      {/* ========================================================
         LEFT SIDEBAR — Conversations
         ======================================================== */}
      <aside
        className="hidden lg:flex flex-col w-80 bg-[#0a0a0c]/60 backdrop-blur-xl border-r border-white/10 transition-all duration-300"
        aria-label="Conversations sidebar"
      >
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center justify-between bg-[#0a0a0c]/30 border-b border-white/5 px-4">
          <div className="flex items-center gap-2">
            <Logo className="h-8 w-8 text-cyan-400" compact />
            <span className="font-bold text-lg tracking-tight text-white">Relay</span>
          </div>
          <button
            onClick={handleNewChat}
            className="relative group flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:text-cyan-400 transition-all text-cyan-300"
            aria-label="New conversation"
          >
            <MessageSquarePlus className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 group-hover:bg-emerald-400 border-2 border-black" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>
          <div className="flex gap-1">
            {["all", "unread", "favorites", "groups"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as typeof filter)}
                className={cn(
                  "flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all",
                  filter === f
                    ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-300"
                    : "bg-transparent text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-500">
              <MessageSquarePlus className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
              <button
                onClick={handleNewChat}
                className="mt-3 text-xs text-cyan-400 underline hover:text-cyan-300"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeId;
              const unread = conv.unreadCount > 0;
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setActiveId(conv.id);
                    setMessages(
                      conv.id === "conv_general_community" ? MOCK_MESSAGES : []
                    );
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-cyan-500/15 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                      : "hover:bg-white/5 border border-transparent"
                  )}
                >
                  <div className="relative h-10 w-10 shrink-0">
                    <img
                      src={conv.other?.avatarUrl || "https://ui-avatars.com/api/?name=Group&background=06b6d4&color=fff"}
                      alt={conv.title || "Conversation"}
                      className="h-full w-full rounded-full object-cover border border-white/10"
                    />
                    {unread && (
                      <div className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 border-2 border-black" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm text-white truncate">
                        {conv.title || conv.other?.displayName || "Unknown"}
                      </h3>
                      <span className="text-[10px] text-slate-500">
                        {new Date(conv.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-xs text-slate-400 truncate">{conv.lastMessage?.text || "No messages yet"}</p>
                      {unread && (
                        <span className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-black">
                          {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Bottom profile */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded-xl p-2 transition-colors">
            <Avatar user={user} size={32} />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-white truncate">{user.displayName}</h3>
              <p className="text-xs text-slate-400 truncate">{user.username}</p>
            </div>
            <MoreVertical className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </aside>

      {/* ========================================================
         MAIN — Chat / Stories Feed
         ======================================================== */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#050505]/80 backdrop-blur-sm">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between bg-[#0a0a0c]/30 border-b border-white/5 px-6">
          <div className="flex items-center gap-3">
            {activeConversation ? (
              <>
                <div className="relative h-10 w-10 shrink-0">
                  <img
                    src={activeConversation.other?.avatarUrl || "https://ui-avatars.com/api/?name=Group&background=06b6d4&color=fff"}
                    alt={activeConversation.title || "Conversation"}
                    className="h-full w-full rounded-full object-cover border border-white/10"
                  />
                  <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 border-2 border-black" />
                </div>
                <div>
                  <h2 className="font-medium text-sm text-white">{activeConversation.title || "Conversation"}</h2>
                  <p className="text-xs text-slate-400">
                    {activeConversation.participantCount} members · {activeConversation.onlineIds?.filter(Boolean).length || 0} online
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-slate-400">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-medium text-sm text-white">Select a conversation</h2>
                  <p className="text-xs text-slate-400">Start a new chat or pick one from the sidebar</p>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" aria-label="Call">
              <Users className="h-5 w-5" />
            </button>
            <button className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" aria-label="Video">
              <MessageSquarePlus className="h-5 w-5" />
            </button>
            <MoreVertical className="h-5 w-5 text-slate-400" />
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeConversation ? (
            <>
              {visibleMessages.length > 0 ? (
                visibleMessages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} isMe={msg.senderId === "usr_me"} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 pt-20">
                  <p className="text-sm mb-2">No messages yet</p>
                  <p className="text-xs">Start the conversation by sending a message below.</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-600 pt-20">
              <MessageSquarePlus className="h-12 w-12 mb-3 opacity-20" />
              <h3 className="font-medium text-sm text-slate-400">Select a conversation to start messaging</h3>
              <p className="text-xs text-slate-500 mt-1">Pick a thread from the sidebar or create a new one.</p>
            </div>
          )}
        </div>

        {/* Message Input Bar */}
        <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-[#0a0a0c]/40 backdrop-blur-xl">
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="p-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              aria-label="Attachments"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="p-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              aria-label="Emoji"
            >
              <Smile className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                rows={1}
                maxRows={4}
                className="w-full bg-transparent text-sm text-white placeholder-slate-500 resize-none focus:outline-none scrollbar-hide"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!draft.trim() || !activeId}
              className={cn(
                "px-5 py-2.5 rounded-xl text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                draft.trim() && activeId
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                  : "bg-white/5 border border-white/10 text-slate-400"
              )}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </form>
      </main>

      {/* ========================================================
         RIGHT — AI Copilot Panel
         ======================================================== */}
      <aside className="hidden lg:flex flex-col w-80 bg-[#0a0a0c]/60 backdrop-blur-xl border-l border-white/10">
        <div className="flex h-16 shrink-0 items-center justify-between bg-[#0a0a0c]/30 border-b border-white/5 px-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              AI
            </div>
            <span className="font-semibold text-sm text-white">Relay Copilot</span>
          </div>
          <button className="p-1.5 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <h3 className="font-semibold text-xs text-white mb-2">Active Conversation Brief</h3>
            {activeConversation ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1" />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <span className="font-medium text-white">Summary:</span> Active discussion on Relay glassmorphic architecture and WebRTC scaling.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-cyan-500 mt-1" />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <span className="font-medium text-white">Action Items:</span> Review deployment logs on Vercel production dashboard.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500 mt-1" />
                  <div className="text-xs text-slate-300 leading-relaxed">
                    <span className="font-medium text-white">Urgency:</span> Medium — respond within 24 hours.
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic">Select a conversation to see AI-powered insights.</div>
            )}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
            <h3 className="font-semibold text-xs text-white mb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-cyan-300 hover:bg-white/10 transition-colors">
                Summarize thread
              </button>
              <button className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-cyan-300 hover:bg-white/10 transition-colors">
                Extract tasks
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
              A
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-white">Relay AI</h3>
              <p className="text-xs text-slate-400">Online · Ready to help</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
