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
  Image as ImageIcon,
  Lock,
  MessageCircle,
  MessageSquarePlus,
  Mic,
  MicOff,
  MoreVertical,
  Paperclip,
  Phone,
  Play,
  Search,
  Send,
  ShieldCheck,
  Smile,
  UserRound,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation, Message, User } from "@/lib/types";

const WA_BG = "#0A0A0C";
const WA_SIDEBAR = "#0F0F11";
const WA_HEADER = "#0A0A0C";
const WA_BORDER = "#2A2A2C";
const WA_TEXT = "#FFFFFF";
const WA_TEXT_MUTED = "#8E8E93";
const WA_ACCENT = "#25D366";
const WA_ACCENT_DARK = "#1E9E52";
const WA_BUBBLE_SENT = "#25D366";
const WA_BUBBLE_RECEIVED = "#1C1C1E";

const MOCK_USER: User = {
  id: "usr_me",
  username: "alexmercer",
  displayName: "Alex Mercer",
  email: "alex@relay.pro",
  accent: "emerald",
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
    text: "Welcome to Relay Messenger Pro! The spatial glassmorphic architecture is fully active.",
    attachment: null,
    anonymous: false,
    ephemeral: false,
    viewOnce: false,
    viewOnceOpened: false,
    reactions: { "🔥": 3 },
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

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "😊", "😇", "🙂", "🙃", "😉",
  "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗",
  "🤭", "🤫", "🤔", "🫡", "😐", "😑", "😶", "🫨", "😏", "😒", "🙄", "😬", "🤥", "😌",
  "😮", "😯", "😲", "🥳", "😵", "🤯", "😇", "🙏", "🫶", "🤝", "👋", "🤚", "🖐", "✋",
];

function Avatar({ user, size = 38 }: { user: User; size?: number }) {
  return (
    <div className={`relative h-${size / 4} w-${size / 4} shrink-0`}>
      <img
        src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=25D366&color=fff`}
        alt={user.displayName}
        className="h-full w-full rounded-full object-cover border border-white/10"
      />
      <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-black bg-[#25D366]" />
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
        <div className="h-7 w-7 rounded-full bg-white/5 flex items-center justify-center text-[9px] text-[#8E8E93] border border-white/10 overflow-hidden shrink-0">
          {message.sender.displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div
        className={cn(
          "rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words relative",
          isMe
            ? `bg-[#25D366] text-[#FFFFFF] rounded-tr-none`
            : `bg-[#1C1C1E] border border-[#2A2A2C] text-[#FFFFFF] rounded-tl-none`
        )}
      >
        {message.text}
        {message.attachment && (
          <div className="mt-2 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-[#8E8E93]" />
            <span className="text-[10px] text-[#8E8E93]">{message.attachment.name}</span>
          </div>
        )}
        <div className={`text-[10px] mt-1 text-right flex items-end gap-1 ${isMe ? "text-[#8E8E93]" : "text-[#8E8E93]"}`}>
          {time}
          <Check className={`h-3 w-3 mt-[2px] ${isMe && message.readBy?.includes("usr_me") ? "text-[#25D366]" : "text-[#8E8E93]"}`} />
        </div>
      </div>
      {isMe && (
        <div className="h-7 w-7 rounded-full bg-white/5 flex items-center justify-center text-[9px] text-[#8E8E93] border border-white/10 overflow-hidden shrink-0">
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

  const handleAiSend = useCallback(async () => {
    if (!aiInput.trim()) return;
    setAiMessages((prev) => [...prev, { role: "user", text: aiInput }]);
    setAiInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: aiInput }),
      });
      const data = await res.json();
      const aiText = data.response || "I'm having trouble responding right now. Please try again.";
      setAiMessages((prev) => [...prev, { role: "assistant", text: aiText }]);
    } catch {
      setAiMessages((prev) => [...prev, { role: "assistant", text: "I'm having trouble connecting. Please check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  }, [aiInput]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex h-16 shrink-0 items-center justify-between bg-[#0A0A0C]/30 border-b border-[#2A2A2C] px-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-r from-[#25D366] to-[#1E9E52] flex items-center justify-center text-white text-[10px] font-bold">
            AI
          </div>
          <span className="font-semibold text-sm text-white">Relay AI</span>
        </div>
        <button className="p-1.5 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {aiMessages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[80%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap break-words",
              msg.role === "user"
                ? "ml-auto bg-[#25D366] text-[#FFFFFF] rounded-tr-none"
                : "mr-auto bg-[#1C1C1E] border border-[#2A2A2C] text-[#FFFFFF] rounded-tl-none"
            )}
          >
            {msg.text}
          </div>
        ))}
      </div>
      <div className="border-t border-[#2A2A2C] pt-3 bg-[#0A0A0C]/20 backdrop-blur-sm">
        <div className="flex items-end gap-2 p-2">
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Ask Relay AI anything…"
            className="flex-1 bg-[#1C1C1E] border border-[#2A2A2C] rounded-xl px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#8E8E93] focus:outline-none focus:border-[#25D366] transition-all"
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
              "p-2 rounded-xl text-[#FFFFFF] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed",
              aiInput.trim()
                ? "bg-[#25D366] hover:bg-[#1E9E52]"
                : "bg-[#1C1C1E] border border-[#2A2A2C] text-[#8E8E93]"
            )}
            aria-label="Send AI message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="bg-[#1C1C1E] border border-[#2A2A2C] rounded-xl p-3">
        <h3 className="font-semibold text-xs text-[#FFFFFF] mb-2">Active Conversation Brief</h3>
        {loading ? (
          <div className="flex flex-col gap-2">
            <div className="h-3 w-1/2 bg-[#2A2A2C] rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-[#2A2A2C] rounded animate-pulse" />
          </div>
        ) : null}
        {!loading && activeConversation && summary ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 rounded-full bg-[#25D366] mt-1" />
              <div className="text-xs text-[#8E8E93] leading-relaxed">
                <span className="font-medium text-[#FFFFFF]">Summary:</span> {summary}
              </div>
            </div>
            {tasks.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-[#8E8E93] mb-1">Action Items:</p>
                <ul className="space-y-1">
                  {tasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#FFFFFF]">
                      <Check className="h-3 w-3 mt-[2px] text-[#25D366] shrink-0" />
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
              <div className="h-2 w-2 rounded-full bg-[#25D366] mt-1" />
              <div className="text-xs text-[#8E8E93] leading-relaxed">
                <span className="font-medium text-[#FFFFFF]">Summary:</span> Active discussion on Relay glassmorphic architecture and WebRTC scaling.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 rounded-full bg-[#25D366] mt-1" />
              <div className="text-xs text-[#8E8E93] leading-relaxed">
                <span className="font-medium text-[#FFFFFF]">Action Items:</span> Review deployment logs on Vercel production dashboard.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 rounded-full bg-[#25D366] mt-1" />
              <div className="text-xs text-[#8E8E93] leading-relaxed">
                <span className="font-medium text-[#FFFFFF]">Urgency:</span> Medium — respond within 24 hours.
              </div>
            </div>
          </div>
        ) : null}
        {!loading && !activeConversation ? (
          <div className="text-xs text-[#8E8E93] italic">Select a conversation to see AI-powered insights.</div>
        ) : null}
      </div>
      <div className="bg-[#1C1C1E] border border-[#2A2A2C] rounded-xl p-3">
        <h3 className="font-semibold text-xs text-[#FFFFFF] mb-2">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSummarize}
            disabled={loading}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-medium transition-all",
              loading ? "bg-[#1C1C1E] text-[#8E8E93] cursor-not-allowed" : "bg-[#2A2A2C] border border-[#2A2A2C] text-[#25D366] hover:bg-[#2A2A2C]/50"
            )}
          >
            Summarize thread
          </button>
          <button
            onClick={handleExtractTasks}
            disabled={loading}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-medium transition-all",
              loading ? "bg-[#1C1C1E] text-[#8E8E93] cursor-not-allowed" : "bg-[#2A2A2C] border border-[#2A2A2C] text-[#25D366] hover:bg-[#2A2A2C]/50"
            )}
          >
            Extract tasks
          </button>
        </div>
      </div>
      <div className="p-4 border-t border-[#2A2A2C]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366] text-xs font-bold">
            A
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-[#FFFFFF]">Relay AI</h3>
            <p className="text-xs text-[#8E8E93]">Online · Ready to help</p>
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
      <div className="bg-[#0A0A0C] border border-[#2A2A2C] rounded-2xl p-6 shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#FFFFFF]">Add Participants</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E8E93]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users…"
            className="w-full pl-10 pr-4 py-2 bg-[#1C1C1E] border border-[#2A2A2C] rounded-xl text-sm text-[#FFFFFF] placeholder-[#8E8E93] focus:outline-none focus:border-[#25D366] transition-all"
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-[#8E8E93] text-center py-4">No users found</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => { onSelect(u); onClose(); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#2A2A2C] transition-colors"
              >
                <div className="h-9 w-9 rounded-full overflow-hidden border border-[#2A2A2C] shrink-0">
                  <img src={u.avatarUrl || "https://ui-avatars.com/api/?name=User&background=25D366&color=fff"} alt={u.displayName} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-[#FFFFFF] truncate">{u.displayName}</h3>
                  <p className="text-xs text-[#8E8E93] truncate">{u.username}</p>
                </div>
                <span className={`h-2 w-2 rounded-full ${u.online ? "bg-[#25D366]" : "bg-[#8E8E93]"}`} />
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
    <div className="absolute right-2 top-12 w-48 z-50 bg-[#0A0A0C] border border-[#2A2A2C] rounded-xl shadow-2xl py-1 text-sm text-[#FFFFFF] animate-in fade-in zoom-in duration-200">
      {onClearChat && (
        <button
          onClick={() => { onClearChat(); onClose(); }}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs text-[#FFFFFF] hover:bg-[#2A2A2C] transition-colors"
        >
          <FileText className="h-4 w-4 text-[#8E8E93] shrink-0" />
          <span>Clear chat history</span>
        </button>
      )}
      {onMute && (
        <button
          onClick={() => { onMute(); onClose(); }}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs text-[#FFFFFF] hover:bg-[#2A2A2C] transition-colors"
        >
          <Bell className="h-4 w-4 text-[#8E8E93] shrink-0" />
          <span>Mute notifications</span>
        </button>
      )}
      <button
        onClick={() => { onLeaveGroup?.(); onClose(); }}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors"
      >
        <Lock className="h-4 w-4 text-[#8E8E93] shrink-0" />
        <span>Leave group</span>
      </button>
      <button
        onClick={onClose}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs text-[#FFFFFF] hover:bg-[#2A2A2C] transition-colors"
      >
        <X className="h-4 w-4 text-[#8E8E93] shrink-0" />
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

    const timer = setTimeout(() => {
      setConnected(true);
    }, 2000);

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
  const peerAvatar = peer?.avatarUrl || "https://ui-avatars.com/api/?name=User&background=25D366&color=fff";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md h-[70vh] bg-[#0A0A0C]/95 border border-[#2A2A2C] rounded-3xl shadow-2xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
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
        <h2 className="text-xl font-bold text-white">{peerName}</h2>
        <p className="text-slate-400 text-sm mb-6">{connected ? "Connected" : "Calling…"}</p>
        {connected && (
          <div className="mb-10 text-[18px] font-mono text-white">
            {formatTime(callDuration)}
          </div>
        )}
        <div className="flex items-center gap-4">
          {callType === "video" && (
            <button
              onClick={() => setCameraOff((prev) => !prev)}
              className={cn("p-3 rounded-full bg-[#1C1C1E] transition-colors", cameraOff ? "text-[#8E8E93]" : "text-white")}
              aria-label={cameraOff ? "Enable camera" : "Disable camera"}
            >
              <VideoOff className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => setMuted((prev) => !prev)}
            className={cn("p-3 rounded-full bg-[#1C1C1E] transition-colors", muted ? "text-[#8E8E93]" : "text-white")}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-3 rounded-full bg-[#FF3B30] hover:bg-[#E03425] text-[#FFFFFF] transition-colors shadow-lg shadow-[#FF3B30]/30"
            aria-label="End call"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-6 text-xs text-[#8E8E93]">Tap to end call</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, token, loading } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "favorites" | "groups">("all");
  const [activeMobileView, setActiveMobileView] = useState<"LIST" | "CHAT" | "COPILOT">("LIST");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null);
  const [moreOptionsRef, setMoreOptionsRef] = useState<HTMLButtonElement | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ name: string; url: string; size: number } | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video">("audio");

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    setTimeout(() => {
      if (conversations.length === 0) {
        setConversations(MOCK_CONVERSATIONS);
        setActiveId(MOCK_CONVERSATIONS[0].id);
        setMessages(MOCK_MESSAGES);
      }
    }, 100);
  }, [loading, user, token, router, conversations.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showEmojiPicker && !e.target.closest('[data-emoji-picker]')) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showMoreOptions && moreOptionsRef.current && !moreOptionsRef.current.contains(e.target as Node)) {
        setShowMoreOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreOptions, moreOptionsRef]);

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

  const openChat = () => {
    setActiveMobileView("CHAT");
  };

  const openCopilot = () => {
    setActiveMobileView("COPILOT");
  };

  const openList = () => {
    setActiveMobileView("LIST");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-[#8E8E93] border-t-[#25D366] rounded-full animate-spin" />
          <p className="text-xs text-[#8E8E93]">Loading Relay…</p>
        </div>
      </div>
    );
  }

  if (!user || !token) {
    return null;
  }

  return (
    <div className="h-screen bg-[#0A0A0C] text-[#FFFFFF] overflow-hidden">
      <div className="md:hidden flex h-screen flex-col">
        {activeMobileView === "LIST" && (
          <>
            <header className="flex h-16 shrink-0 items-center justify-between bg-[#0A0A0C] border-b border-[#2A2A2C] px-4 z-20">
              <div className="flex items-center gap-2">
                <Logo className="h-8 w-8 text-[#25D366]" compact />
                <span className="font-medium text-sm text-[#FFFFFF] tracking-tight">Relay</span>
              </div>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-[#8E8E93]" />
                <button className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="Camera">
                  <Play className="h-5 w-5" />
                </button>
                <button
                  ref={moreOptionsRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoreOptions((prev) => !prev);
                  }}
                  className="relative inline-block p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors"
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
                {showMoreOptions && (
                  <MoreOptionsMenu
                    open={true}
                    onClose={() => setShowMoreOptions(false)}
                    onClearChat={handleClearChat}
                    onMute={handleMute}
                    onLeaveGroup={() => {
                      toast("Left the group", "info");
                      setActiveId(null);
                      setShowMoreOptions(false);
                    }}
                  />
                )}
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-[#8E8E93]">
                  <MessageSquarePlus className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">No conversations yet</p>
                  <button
                    onClick={handleNewChat}
                    className="mt-3 text-xs text-[#25D366] underline hover:text-[#1E9E52]"
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
                        setActiveMobileView("CHAT");
                      }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200",
                        isActive
                          ? "bg-[#25D366]/10 border border-[#25D366] shadow-[0_0_15px_rgba(37,211,102,0.15)]"
                          : "hover:bg-[#2A2A2C] border border-transparent"
                      )}
                    >
                      <div className="relative h-10 w-10 shrink-0">
                        <img
                          src={conv.other?.avatarUrl || "https://ui-avatars.com/api/?name=Group&background=25D366&color=fff"}
                          alt={conv.title || "Conversation"}
                          className="h-full w-full rounded-full object-cover border border-[#2A2A2C]"
                        />
                        {unread && (
                          <div className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm text-[#FFFFFF] truncate">
                            {conv.title || conv.other?.displayName || "Unknown"}
                          </h3>
                          <span className="text-[10px] text-[#8E8E93]">
                            {new Date(conv.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-xs text-[#8E8E93] truncate">{conv.lastMessage?.text || "No messages yet"}</p>
                          {unread && (
                            <span className="h-5 w-5 rounded-full bg-[#25D366] flex items-center justify-center text-[10px] font-bold text-[#000000]">
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
          </>
        )}
        {activeMobileView === "CHAT" && (
          <>
            <header className="flex h-16 shrink-0 items-center justify-between bg-[#0A0A0C] border-b border-[#2A2A2C] px-4 z-20">
              <button
                onClick={openList}
                className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="Back"
              >
                <ArrowRight className="h-5 w-5 rotate-180" />
              </button>
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0">
                  <img
                    src={activeConversation?.other?.avatarUrl || "https://ui-avatars.com/api/?name=Group&background=25D366&color=fff"}
                    alt={activeConversation?.title || "Conversation"}
                    className="h-full w-full rounded-full object-cover border border-[#2A2A2C]"
                  />
                  <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
                </div>
                <div>
                  <h2 className="font-medium text-sm text-[#FFFFFF]">{activeConversation?.title || "Conversation"}</h2>
                  <p className="text-xs text-[#8E8E93]">{activeConversation?.participantCount} members · Active</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveMobileView("COPILOT")} className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="AI Copilot">
                  <ShieldCheck className="h-5 w-5" />
                </button>
                <button className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="Call">
                  <Phone className="h-5 w-5" />
                </button>
                <button className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="Video">
                  <Video className="h-5 w-5" />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {visibleMessages.length > 0 ? (
                visibleMessages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} isMe={msg.senderId === "usr_me"} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-[#8E8E93] pt-20">
                  <p className="text-sm mb-2">No messages yet</p>
                  <p className="text-xs">Start the conversation by sending a message below.</p>
                </div>
              )}
            </div>
            <form onSubmit={handleSend} className="p-4 border-t border-[#2A2A2C] bg-[#0A0A0C]/40 backdrop-blur-xl">
              <div className="flex items-end gap-2">
                <label
                  className="p-2.5 rounded-xl text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors cursor-pointer"
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
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className="p-2.5 rounded-xl text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors relative"
                  aria-label="Emoji picker"
                >
                  <Smile className="h-5 w-5" />
                  {showEmojiPicker && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
                  )}
                </button>
                <div className="flex-1 relative">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message…"
                    rows={1}
                    maxRows={4}
                    className="w-full bg-transparent text-sm text-[#FFFFFF] placeholder-[#8E8E93] resize-none focus:outline-none scrollbar-hide"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend(e);
                      }
                    }}
                  />
                  {showEmojiPicker && (
                    <div className="data-[emoji-picker] absolute bottom-[60px] left-0 w-full bg-[#0A0A0C] border border-[#2A2A2C] rounded-xl p-2 shadow-2xl animate-in fade-in zoom-in duration-200 z-50">
                      <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleEmojiSelect(emoji)}
                            className="h-8 w-8 rounded-lg text-lg hover:bg-[#2A2A2C] transition-colors flex items-center justify-center"
                            data-emoji-picker
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {pendingAttachment && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2A2A2C] border border-[#2A2A2C] animate-in fade-in zoom-in duration-200">
                    <ImageIcon className="h-4 w-4 text-[#25D366] shrink-0" />
                    <span className="text-xs text-[#8E8E93] truncate max-w-[120px]">{pendingAttachment.name}</span>
                    <button
                      onClick={handleRemoveAttachment}
                      className="p-1 rounded hover:bg-[#2A2A2C] text-[#8E8E93] hover:text-[#FF3B30] transition-colors"
                      aria-label="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={(!draft.trim() && !pendingAttachment) || !activeId}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-[#FFFFFF] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                    (draft.trim() || pendingAttachment) && activeId
                      ? "bg-[#25D366] hover:bg-[#1E9E52] shadow-[0_0_15px_rgba(37,211,102,0.4)]"
                      : "bg-[#1C1C1E] border border-[#2A2A2C] text-[#8E8E93]"
                  )}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </form>
          </>
        )}
        {activeMobileView === "COPILOT" && (
          <CopilotBriefPanel
            activeConversation={activeConversation}
            messages={visibleMessages}
            onSummarize={() => {}}
            onExtractTasks={() => {}}
          />
        )}
        {activeMobileView === "LIST" && (
          <div className="h-16 border-t border-[#2A2A2C] bg-[#0A0A0C] px-4 flex items-center justify-around z-20">
            <button
              onClick={() => {}}
              className="flex flex-col items-center gap-1 text-[#25D366]"
              aria-label="Chats"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-[10px]">Chats</span>
            </button>
            <button
              onClick={() => {}}
              className="flex flex-col items-center gap-1 text-[#8E8E93] hover:text-[#FFFFFF] transition-colors"
              aria-label="Status"
            >
              <Play className="h-5 w-5" />
              <span className="text-[10px]">Status</span>
            </button>
            <button
              onClick={() => {}}
              className="flex flex-col items-center gap-1 text-[#8E8E93] hover:text-[#FFFFFF] transition-colors"
              aria-label="Communities"
            >
              <Users className="h-5 w-5" />
              <span className="text-[10px]">Communities</span>
            </button>
            <button
              onClick={() => setActiveMobileView("CHAT")}
              className="flex flex-col items-center gap-1 text-[#8E8E93] hover:text-[#FFFFFF] transition-colors"
              aria-label="Calls"
            >
              <Phone className="h-5 w-5" />
              <span className="text-[10px]">Calls</span>
            </button>
          </div>
        )}
      </div>

      <div className="md:flex hidden h-screen">
        <aside className="flex flex-col w-80 bg-[#0F0F11] border-r border-[#2A2A2C] transition-all duration-300" aria-label="Conversations sidebar">
          <div className="flex h-16 shrink-0 items-center justify-between bg-[#0A0A0C] border-b border-[#2A2A2C] px-4">
            <div className="flex items-center gap-2">
              <Logo className="h-8 w-8 text-[#25D366]" compact />
              <span className="font-medium text-sm text-[#FFFFFF] tracking-tight">Relay</span>
            </div>
            <button
              onClick={handleNewChat}
              className="relative group flex h-8 w-8 items-center justify-center rounded-full bg-[#2A2A2C] border border-[#2A2A2C] hover:bg-[#3A3A3C] hover:text-[#25D366] transition-all text-[#25D366]" aria-label="New conversation"
            >
              <MessageSquarePlus className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] group-hover:bg-[#1E9E52] border-2 border-black" />
            </button>
          </div>
          <div className="p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E8E93]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-10 pr-4 py-2 bg-[#1C1C1E] border border-[#2A2A2C] rounded-xl text-sm text-[#FFFFFF] placeholder-[#8E8E93] focus:outline-none focus:border-[#25D366] transition-all"
              />
            </div>
            <div className="flex gap-1">
              {["all", "unread", "favorites", "groups"].map((f) => (
                <button key={f} onClick={() => setFilter(f as typeof filter)} className={cn(
                  "flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all",
                  filter === f ? "bg-[#25D366] border border-[#25D366] text-[#FFFFFF]" : "bg-transparent text-[#8E8E93] hover:text-[#FFFFFF] hover:bg-[#2A2A2C]"
                )}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-[#8E8E93]">
                <MessageSquarePlus className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No conversations yet</p>
                <button onClick={handleNewChat} className="mt-3 text-xs text-[#25D366] underline hover:text-[#1E9E52]">Start a new chat</button>
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
                      setMessages(conv.id === "conv_general_community" ? MOCK_MESSAGES : []);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-[#25D366]/10 border border-[#25D366] shadow-[0_0_15px_rgba(37,211,102,0.15)]"
                        : "hover:bg-[#2A2A2C] border border-transparent"
                    )}
                  >
                    <div className="relative h-10 w-10 shrink-0">
                      <img src={conv.other?.avatarUrl || "https://ui-avatars.com/api/?name=Group&background=25D366&color=fff"} alt={conv.title || "Conversation"} className="h-full w-full rounded-full object-cover border border-[#2A2A2C]" />
                      {unread && (
                        <div className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm text-[#FFFFFF] truncate">
                          {conv.title || conv.other?.displayName || "Unknown"}
                        </h3>
                        <span className="text-[10px] text-[#8E8E93]">
                          {new Date(conv.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-xs text-[#8E8E93] truncate">{conv.lastMessage?.text || "No messages yet"}</p>
                        {unread && (
                          <span className="h-5 w-5 rounded-full bg-[#25D366] flex items-center justify-center text-[10px] font-bold text-[#000000]">
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
          <div className="p-3 border-t border-[#2A2A2C]">
            <div className="flex items-center gap-3 cursor-pointer hover:bg-[#2A2A2C] rounded-xl p-2 transition-colors">
              <Avatar user={user} size={32} />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm text-[#FFFFFF] truncate">{user.displayName}</h3>
                <p className="text-xs text-[#8E8E93] truncate">{user.username}</p>
              </div>
              <MoreVertical className="h-4 w-4 text-[#8E8E93]" />
            </div>
          </div>
        </aside>
        <main className="flex-1 flex flex-col min-w-0 bg-[#0A0A0C]">
          <header className="flex h-16 shrink-0 items-center justify-between bg-[#0A0A0C] border-b border-[#2A2A2C] px-6">
            <div className="flex items-center gap-3">
              {activeConversation ? (
                <>
                  <div className="relative h-10 w-10 shrink-0">
                    <img
                      src={activeConversation.other?.avatarUrl || "https://ui-avatars.com/api/?name=Group&background=25D366&color=fff"}
                      alt={activeConversation.title || "Conversation"}
                      className="h-full w-full rounded-full object-cover border border-[#2A2A2C]"
                    />
                    <span className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
                  </div>
                  <div>
                    <h2 className="font-medium text-sm text-[#FFFFFF]">{activeConversation.title || "Conversation"}</h2>
                    <p className="text-xs text-[#8E8E93]">{activeConversation.participantCount} members · Active</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-[#1C1C1E] flex items-center justify-center text-[#8E8E93]">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-medium text-sm text-[#FFFFFF]">Select a conversation</h2>
                    <p className="text-xs text-[#8E8E93]">Start a new chat or pick one from the sidebar</p>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeConversation?.title !== "Relay Assistant" ? (
                <>
                  <button ref={moreOptionsRef} onClick={(e) => { e.stopPropagation(); setShowMoreOptions((prev) => !prev); }} className="relative inline-block p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="More options">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  <button onClick={() => handleStartCall("audio")} className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="Start audio call"><Phone className="h-5 w-5" /></button>
                  <button onClick={() => handleStartCall("video")} className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="Start video call"><Video className="h-5 w-5" /></button>
                </>
              ) : (
                <button ref={moreOptionsRef} onClick={(e) => { e.stopPropagation(); setShowMoreOptions((prev) => !prev); }} className="relative inline-block p-2 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors" aria-label="More options">
                  <MoreVertical className="h-5 w-5" />
                </button>
              )}
              {showMoreOptions && (
                <MoreOptionsMenu open={true} onClose={() => setShowMoreOptions(false)} onClearChat={handleClearChat} onMute={handleMute} onLeaveGroup={() => { toast("Left the group", "info"); setActiveId(null); setShowMoreOptions(false); }} />
              )}
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeConversation ? (
              <>
                {visibleMessages.length > 0 ? (
                  visibleMessages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} isMe={msg.senderId === "usr_me"} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-[#8E8E93] pt-20">
                    <p className="text-sm mb-2">No messages yet</p>
                    <p className="text-xs">Start the conversation by sending a message below.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-[#8E8E93] pt-20">
                <MessageSquarePlus className="h-12 w-12 mb-3 opacity-30" />
                <h3 className="font-medium text-sm text-[#8E8E93]">Select a conversation to start messaging</h3>
                <p className="text-xs text-[#8E8E93] mt-1">Pick a thread from the sidebar or create a new one.</p>
              </div>
            )}
          </div>
          <form onSubmit={handleSend} className="p-4 border-t border-[#2A2A2C] bg-[#0A0A0C]">
            <div className="flex items-end gap-2">
              <label
                className="p-2.5 rounded-xl text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors cursor-pointer"
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
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="p-2.5 rounded-xl text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors relative"
                aria-label="Emoji picker"
              >
                <Smile className="h-5 w-5" />
                {showEmojiPicker && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
                )}
              </button>
              <div className="flex-1 relative">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  rows={1}
                  maxRows={4}
                  className="w-full bg-transparent text-sm text-[#FFFFFF] placeholder-[#8E8E93] resize-none focus:outline-none scrollbar-hide"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                />
                {showEmojiPicker && (
                  <div className="data-[emoji-picker] absolute bottom-[60px] left-0 w-full bg-[#0A0A0C] border border-[#2A2A2C] rounded-xl p-2 shadow-2xl animate-in fade-in zoom-in duration-200 z-50">
                    <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleEmojiSelect(emoji)}
                          className="h-8 w-8 rounded-lg text-lg hover:bg-[#2A2A2C] transition-colors flex items-center justify-center"
                          data-emoji-picker
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {pendingAttachment && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2A2A2C] border border-[#2A2A2C] animate-in fade-in zoom-in duration-200">
                  <ImageIcon className="h-4 w-4 text-[#25D366] shrink-0" />
                  <span className="text-xs text-[#8E8E93] truncate max-w-[120px]">{pendingAttachment.name}</span>
                  <button
                    onClick={handleRemoveAttachment}
                    className="p-1 rounded hover:bg-[#2A2A2C] text-[#8E8E93] hover:text-[#FF3B30] transition-colors"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <button
                type="submit"
                disabled={(!draft.trim() && !pendingAttachment) || !activeId}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[#FFFFFF] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                  (draft.trim() || pendingAttachment) && activeId
                    ? "bg-[#25D366] hover:bg-[#1E9E52] shadow-[0_0_15px_rgba(37,211,102,0.4)]"
                    : "bg-[#1C1C1E] border border-[#2A2A2C] text-[#8E8E93]"
                )}
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </form>
        </main>
        <CopilotBriefPanel activeConversation={activeConversation} messages={visibleMessages} onSummarize={() => {}} onExtractTasks={() => {}} />
        {isCalling && (
          <CallOverlay open={isCalling} onClose={() => setIsCalling(false)} callType={callType} peer={{ name: activeConversation?.title || "Contact", avatarUrl: activeConversation?.other?.avatarUrl || "https://ui-avatars.com/api/?name=Contact&background=25D366&color=fff" }} />
        )}
      </div>
      <UserSearchModal open={showUserSearch} onClose={() => setShowUserSearch(false)} onSelect={(u) => { toast(`Added ${u.displayName} to conversation`, "success"); setShowUserSearch(false); }} />
    </div>
  );
}
