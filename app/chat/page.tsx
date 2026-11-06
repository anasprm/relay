"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Logo } from "@/components/ui/Logo";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  FileText,
  FolderPlus,
  Gift,
  Hash,
  History,
  Home,
  Image as ImageIcon,
  Lock,
  MessageSquarePlus,
  Mic,
  MicOff,
  MoreVertical,
  Paperclip,
  Phone,
  Play,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Star,
  StopWatch,
  UserPlus,
  UserRound,
  Users,
  Video,
  VideoOff,
  X,
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
   Simple emoji list for the picker
   ------------------------------------------------------------------------- */
const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "😊", "😇", "🙂", "🙃", "😉",
  "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗",
  "🤭", "🤫", "🤔", "🫡", "😐", "😑", "😶", "🫨", "😏", "😒", "🙄", "😬", "🤥", "😌",
  "😮", "😯", "😲", "🥳", "😵", "🤯", "😇", "🙏", "🫶", "🤝", "👋", "🤚", "🖐", "✋",
];

/* -------------------------------------------------------------------------
   Subcomponents
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
          "rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm relative",
          isMe
            ? "bg-cyan-600 text-white rounded-tr-none"
            : "bg-white/5 border border-white/10 text-slate-200 rounded-tl-none"
        )}
      >
        {message.text}
        {message.attachment && (
          <div className="mt-2 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-slate-400" />
            <span className="text-[10px] text-slate-300">{message.attachment.name}</span>
          </div>
        )}
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

function CopilotBriefPanel({
  activeConversation,
  messages,
  onSummarize,
  onExtractTasks,
}: {
  activeConversation: Conversation | null;
  messages: Message[];
  onSummarize?: () => void;
  onExtractTasks?: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Hello! I'm your Relay AI assistant. How can I help you today?" },
  ]);

  const handleSummarize = useCallback(() => {
    if (!onSummarize) return;
    setLoading(true);
    onSummarize();
    setTimeout(() => {
      setSummary("Key discussion points: Glassmorphic UI architecture, WebRTC scaling, and Vercel deployment readiness.");
      setTasks(["Review deployment logs on Vercel production dashboard", "Verify cryptographic watermarking on shared media assets"]);
      setLoading(false);
    }, 1200);
  }, [onSummarize]);

  const handleExtractTasks = useCallback(() => {
    if (!onExtractTasks) return;
    setLoading(true);
    onExtractTasks();
    setTimeout(() => {
      setTasks(["Review deployment logs", "Verify cryptographic watermarking", "Update API documentation"]);
      setSummary("Extracted actionable tasks from thread messages.");
      setLoading(false);
    }, 1200);
  }, [onExtractTasks]);

  const handleAiSend = useCallback(() => {
    if (!aiInput.trim()) return;
    setAiMessages((prev) => [...prev, { role: "user", text: aiInput }]);
    setAiInput("");
    setTimeout(() => {
      setAiMessages((prev) => [...prev, { role: "assistant", text: generateAiResponse(aiInput) }]);
    }, 700);
  }, [aiInput]);

  const generateAiResponse = useCallback((input: string): string => {
    const lower = input.toLowerCase().trim();

    if (lower.includes("joke") || lower.includes("funny") || lower.includes("comedy")) {
      const jokes = [
        "Why do developers prefer dark mode? Because light attracts bugs! 🐛",
        "Why did the React component go to therapy? It had too many state issues. ⚛️",
        "Why was the JavaScript developer sad? Because they didn't know how to 'null' their feelings. 😢",
        "A SQL query walks into a bar, walks up to two tables and asks… 'Can I join you?' 🍺",
        "Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25! 🎃🎄",
      ];
      return jokes[Math.floor(Math.random() * jokes.length)];
    }

    if (lower.includes("hello") || lower.includes("hi ") || lower.includes("hey")) {
      return "Hello there! 👋 I'm your Relay AI assistant. Ask me anything about messaging, workspace setup, or just tell me a joke!";
    }

    if (lower.includes("help") || lower.includes("assist")) {
      return "I can help you summarize conversations, extract action items, draft replies, or just chat. What's on your mind?";
    }

    if (lower.includes("relay") || lower.includes("messenger") || lower.includes("workspace")) {
      return "Relay Messenger Pro is a spatial glassmorphic workspace with real-time messaging, voice/video calls, stories, and AI-powered briefs. Built for teams that value privacy and OLED aesthetics. 🌙";
    }

    if (lower.includes("weather")) {
      return "I can't check live weather yet, but I hope it's sunny wherever you are! ☀️ Want me to help with something else?";
    }

    if (lower.includes("thank") || lower.includes("thanks")) {
      return "You're welcome! Happy to help anytime. 🙌";
    }

    if (lower.includes("bye") || lower.includes("goodbye")) {
      return "Goodbye! I'll be here whenever you need me. Take care! 👋";
    }

    // Default smart response
    const defaults = [
      "That's an interesting point! Could you tell me more about it?",
      "I'm not sure I have the answer to that, but I'd love to learn more. What else would you like to discuss?",
      "Great question! Let me think about that... In the meantime, is there anything else I can help with?",
      "I appreciate you sharing that. Would you like me to help summarize or extract action items from this conversation?",
      "Hmm, that's a good one! I don't have a specific answer, but I'm here to chat about anything Relay-related.",
    ];
    return defaults[Math.floor(Math.random() * defaults.length)];
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Header */}
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

      {/* AI Chat History */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {aiMessages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[80%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap break-words",
              msg.role === "user"
                ? "ml-auto bg-cyan-600 text-white rounded-tr-none"
                : "mr-auto bg-white/5 border border-white/10 text-slate-200 rounded-tl-none"
            )}
          >
            {msg.text}
          </div>
        ))}
      </div>

      {/* AI Input */}
      <div className="border-t border-white/10 pt-3 bg-[#0a0a0c]/20 backdrop-blur-sm">
        <div className="flex items-end gap-2 p-2">
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Ask Relay AI anything…"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAiSend();
              }
            }}
          />
          <button
            onClick={handleAiSend}
            disabled={!aiInput.trim()}
            className={cn(
              "p-2 rounded-xl text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed",
              aiInput.trim()
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
                : "bg-white/5 border border-white/10 text-slate-400"
            )}
            aria-label="Send AI message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Brief */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
        <h3 className="font-semibold text-xs text-white mb-2">Active Conversation Brief</h3>
        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-white/10 rounded animate-pulse" />
          </div>
        ) : null}
        {!loading && activeConversation && summary ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1" />
              <div className="text-xs text-slate-300 leading-relaxed">
                <span className="font-medium text-white">Summary:</span> {summary}
              </div>
            </div>
            {tasks.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 mb-1">Action Items:</p>
                <ul className="space-y-1">
                  {tasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-200">
                      <Check className="h-3 w-3 mt-0.5 text-cyan-400 shrink-0" />
                      <span>{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
        {!loading && activeConversation && !summary ? (
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
        ) : null}
        {!loading && !activeConversation ? (
          <div className="text-xs text-slate-500 italic">Select a conversation to see AI-powered insights.</div>
        ) : null}
      </div>

      {/* Quick Actions */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-3">
        <h3 className="font-semibold text-xs text-white mb-2">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSummarize}
            disabled={loading}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-medium transition-all",
              loading ? "bg-white/5 text-slate-400 cursor-not-allowed" : "bg-white/10 border border-white/10 text-cyan-300 hover:bg-white/20 hover:text-white"
            )}
          >
            Summarize thread
          </button>
          <button
            onClick={handleExtractTasks}
            disabled={loading}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-medium transition-all",
              loading ? "bg-white/5 text-slate-400 cursor-not-allowed" : "bg-white/10 border border-white/10 text-cyan-300 hover:bg-white/20 hover:text-white"
            )}
          >
            Extract tasks
          </button>
        </div>
      </div>

      {/* AI Assistant footer */}
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
    </div>
  );
}

function UserSearchModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (user: User) => void;
}) {
  const [query, setQuery] = useState("");

  const users = [
    { id: "usr_2", username: "elena_rostova", displayName: "Elena Rostova", accent: "rose", avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150", online: true, lastSeen: new Date().toISOString() },
    { id: "usr_3", username: "marcus_vance", displayName: "Marcus Vance", accent: "cyan", avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150", online: false, lastSeen: new Date(Date.now() - 3600000).toISOString() },
    { id: "usr_ai", username: "relay_ai", displayName: "Relay AI", accent: "emerald", avatarUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150", online: true, lastSeen: new Date().toISOString() },
  ];

  const filtered = users.filter((u) => u.displayName.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0a0a0c]/90 border border-white/10 rounded-2xl p-6 shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Add Participants</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-all"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No users found</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => { onSelect(u); onClose(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="h-9 w-9 rounded-full overflow-hidden border border-white/10 shrink-0">
                  <img src={u.avatarUrl || "https://ui-avatars.com/api/?name=User&background=06b6d4&color=fff"} alt={u.displayName} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-white truncate">{u.displayName}</h3>
                  <p className="text-xs text-slate-400 truncate">{u.username}</p>
                </div>
                <span className={`h-2 w-2 rounded-full ${u.online ? "bg-emerald-500" : "bg-slate-500"}`} />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MoreOptionsMenu({
  open,
  onClose,
  onClearChat,
  onMute,
  onLeaveGroup,
}: {
  open: boolean;
  onClose: () => void;
  onClearChat?: () => void;
  onMute?: () => void;
  onLeaveGroup?: () => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-[#0a0a0c]/90 border border-white/10 rounded-2xl p-2 shadow-2xl animate-in fade-in zoom-in duration-200">
      {onClearChat && (
        <button
          onClick={() => { onClearChat(); onClose(); }}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-white/5 transition-colors"
        >
          <FileText className="h-4 w-4 text-slate-500 shrink-0" />
          <span>Clear chat history</span>
        </button>
      )}
      {onMute && (
        <button
          onClick={() => { onMute(); onClose(); }}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-white/5 transition-colors"
        >
          <Bell className="h-4 w-4 text-slate-500 shrink-0" />
          <span>Mute notifications</span>
        </button>
      )}
      <button
        onClick={() => { onLeaveGroup?.(); onClose(); }}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
      >
        <Lock className="h-4 w-4 text-slate-500 shrink-0" />
        <span>Leave group</span>
      </button>
      <button
        onClick={onClose}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-white/5 transition-colors"
      >
        <X className="h-4 w-4 text-slate-500 shrink-0" />
        <span>Cancel</span>
      </button>
    </div>
  );
}

function CallOverlay({
  open,
  onClose,
  callType,
  peer,
}: {
  open: boolean;
  onClose: () => void;
  callType: "audio" | "video";
  peer: { name: string; avatarUrl: string } | null;
}) {
  const [connected, setConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  useEffect(() => {
    if (!open) {
      setConnected(false);
      setCallDuration(0);
      setMuted(false);
      setCameraOff(false);
      return;
    }

    // Simulate incoming call connecting after 2 seconds
    const timer = setTimeout(() => {
      setConnected(true);
    }, 2000);

    // Start duration timer once connected
    const durationInterval = setInterval(() => {
      if (connected) setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(durationInterval);
    };
  }, [open, connected]);

  if (!open) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const peerName = peer?.name || "Contact";
  const peerAvatar = peer?.avatarUrl || "https://ui-avatars.com/api/?name=User&background=06b6d4&color=fff";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md h-[70vh] bg-[#0a0a0c]/95 border border-white/10 rounded-3xl shadow-2xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
        {/* Avatar with pulsing ring */}
        <div className="relative mb-6">
          <div
            className={`absolute -inset-1 rounded-full border-2 ${connected ? "border-emerald-500" : "border-cyan-500"} animate-pulse`}
          />
          <div className="relative h-24 w-24 shrink-0">
            <img
              src={peerAvatar}
              alt={peerName}
              className="h-full w-full rounded-full object-cover border-2 border-white/20"
            />
          </div>
        </div>

        {/* Contact name */}
        <h2 className="text-xl font-bold text-white">{peerName}</h2>
        <p className="text-slate-400 text-sm mb-6">{connected ? "Connected" : "Calling…"}</p>

        {/* Duration */}
        {connected && (
          <div className="mb-8 text-[18px] font-mono text-white">
            {formatTime(callDuration)}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4">
          {callType === "video" && (
            <button
              onClick={() => setCameraOff((prev) => !prev)}
              className={cn("p-3 rounded-full bg-white/5 transition-colors", cameraOff ? "text-slate-400" : "text-white")}
              aria-label={cameraOff ? "Enable camera" : "Disable camera"}
            >
              <VideoOff className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => setMuted((prev) => !prev)}
            className={cn("p-3 rounded-full bg-white/5 transition-colors", muted ? "text-slate-400" : "text-white")}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-lg shadow-rose-600/30"
            aria-label="End call"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* End hint */}
        <p className="mt-6 text-xs text-slate-500">Tap to end call</p>
      </div>
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

  // Interaction states
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);
  const [moreOptionsRef, setMoreOptionsRef] = useState<HTMLButtonElement | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; url: string; size: number } | null>(null);

  // Call state
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video">("audio");

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

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showEmojiPicker && !e.target.closest('[data-emoji-picker]')) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // Close more options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMoreOptions && moreOptionsRef.current && !moreOptionsRef.current.contains(e.target as Node)) {
        setShowMoreOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreOptions, moreOptionsRef]);

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

  // -----------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------
  const handleSend = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text && !pendingAttachment) return;

    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId: activeId || "conv_general_community",
      senderId: "usr_me",
      sender: MOCK_USER,
      kind: "text",
      text,
      attachment: pendingAttachment ? { url: pendingAttachment.url, name: pendingAttachment.name, mime: "image/*", size: pendingAttachment.size, kind: "image" } : null,
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
    setPendingAttachment(null);
    setShowEmojiPicker(false);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === (activeId || "conv_general_community")
          ? { ...c, lastMessage: newMessage, unreadCount: 0, updatedAt: new Date().toISOString() }
          : c
      )
    );
  }, [draft, pendingAttachment, activeId]);

  const handleNewChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setDraft("");
    toast("Start a new conversation by entering a username or email", "info");
  }, [toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPendingAttachment({ name: file.name, url, size: file.size });
    toast(`Attached: ${file.name}`, "success");
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setDraft((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  const handleRemoveAttachment = useCallback(() => {
    setPendingAttachment(null);
  }, []);

  const handleStartCall = useCallback((type: "audio" | "video") => {
    setCallType(type);
    setIsCalling(true);
  }, []);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    toast("Chat cleared", "info");
  }, [toast]);

  const handleMute = useCallback(() => {
    toast("Notifications muted", "info");
  }, [toast]);

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
                    {activeConversation.participantCount} members · Active
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
            {activeConversation?.title !== "Relay Assistant" ? (
              <>
                <button
                  ref={moreOptionsRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoreOptions((prev) => !prev);
                  }}
                  className="relative inline-block p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleStartCall("audio")}
                  className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                  aria-label="Start audio call"
                >
                  <Phone className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleStartCall("video")}
                  className="p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                  aria-label="Start video call"
                >
                  <Video className="h-5 w-5" />
                </button>
              </>
            ) : (
              <button
                ref={moreOptionsRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoreOptions((prev) => !prev);
                }}
                className="relative inline-block p-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                aria-label="More options"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            )}
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
            {/* Attachment */}
            <label
              className="p-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
              aria-label="Attach file"
            >
              <Paperclip className="h-5 w-5" />
              <input
                type="file"
                ref={setFileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,application/pdf"
              />
            </label>
            {/* Emoji */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-colors relative"
              aria-label="Emoji picker"
            >
              <Smile className="h-5 w-5" />
              {showEmojiPicker && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 border-2 border-black" />
              )}
            </button>
            {/* Text input */}
            <div className="flex-1 relative">
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
              {/* Emoji picker overlay */}
              {showEmojiPicker && (
                <div className="data-[emoji-picker] absolute bottom-[60px] left-0 w-full bg-[#0a0a0c]/90 border border-white/10 rounded-xl p-2 shadow-2xl animate-in fade-in zoom-in duration-200 z-50">
                  <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiSelect(emoji)}
                        className="h-8 w-8 rounded-lg text-lg hover:bg-white/5 transition-colors flex items-center justify-center"
                        data-emoji-picker
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Pending attachment preview */}
            {pendingAttachment && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 animate-in fade-in zoom-in duration-200">
                <ImageIcon className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="text-xs text-slate-300 truncate max-w-[120px]">{pendingAttachment.name}</span>
                <button
                  onClick={handleRemoveAttachment}
                  className="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-rose-400 transition-colors"
                  aria-label="Remove attachment"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {/* Send */}
            <button
              type="submit"
              disabled={(!draft.trim() && !pendingAttachment) || !activeId}
              className={cn(
                "px-5 py-2.5 rounded-xl text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                (draft.trim() || pendingAttachment) && activeId
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
      <CopilotBriefPanel
        activeConversation={activeConversation}
        messages={visibleMessages}
        onSummarize={() => {}}
        onExtractTasks={() => {}}
      />

      {/* ========================================================
         Call Overlay Modal
         ======================================================== */}
      {isCalling && (
        <CallOverlay
          open={isCalling}
          onClose={() => setIsCalling(false)}
          callType={callType}
          peer={{
            name: activeConversation?.title || "Contact",
            avatarUrl: activeConversation?.other?.avatarUrl || "https://ui-avatars.com/api/?name=Contact&background=06b6d4&color=fff",
          }}
        />
      )}

      {/* ========================================================
         Modals
         ======================================================== */}
      <UserSearchModal
        open={showUserSearch}
        onClose={() => setShowUserSearch(false)}
        onSelect={(u) => {
          toast(`Added ${u.displayName} to conversation`, "success");
          setShowUserSearch(false);
        }}
      />
      <MoreOptionsMenu
        open={showMoreOptions}
        onClose={() => setShowMoreOptions(false)}
        onClearChat={() => {
          setMessages([]);
          toast("Chat cleared", "info");
        }}
        onMute={() => {
          toast("Notifications muted", "info");
        }}
        onLeaveGroup={() => {
          toast("Left the group", "info");
          setActiveId(null);
          setShowMoreOptions(false);
        }}
      />
    </div>
  );
}
