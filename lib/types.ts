export type Accent = 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate';

export type MessageKind = 'text' | 'image' | 'audio' | 'video' | 'file';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  accent: Accent;
  avatarUrl?: string | null;
  discoverable?: boolean;
  online: boolean;
  lastSeen: string | null;
  anonymous?: boolean;
}

export interface AuthRequest {
  username: string;
  password: string;
  email?: string | null;
  inviteCode?: string | null;
}

export interface AuthResponseData {
  token: string;
  user: User;
}

export interface RecoveryRequest {
  email: string;
}

export interface RecoveryResponse {
  message: string;
  recoveryId?: string;
}

export interface Attachment {
  url: string;
  name: string;
  mime: string;
  size: number;
  kind?: MessageKind;
  duration?: number;
  width?: number;
  height?: number;
}

/** A compact quote of the message a reply points at. */
export interface ReplyPreview {
  id: string;
  senderId: string | null;
  senderName: string;
  kind: MessageKind;
  text: string;
  attachmentName: string | null;
  anonymous: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string | null;
  sender: User;
  kind: MessageKind;
  text: string;
  attachment: Attachment | null;
  anonymous: boolean;
  ephemeral: boolean;
  viewOnce: boolean;
  viewOnceOpened: boolean;
  reactions: Record<string, string>;
  replyTo?: ReplyPreview | null;
  storyReply?: StoryReplyContext | null;
  editedAt?: string | null;
  forwarded?: boolean;
  starred?: boolean;
  readCount?: number;
  readBy?: string[];
  createdAt: string;
}

export interface Modes {
  anonymity: boolean;
  vanish: boolean;
}

export type ConversationKind = 'direct' | 'group';

export interface Conversation {
  id: string;
  kind: ConversationKind;
  /** Group name; null for direct threads. */
  title: string | null;
  /** Who created the group (and may rename/add/remove); null for direct threads. */
  createdBy: string | null;
  memberCount: number;
  participants: User[];
  other: User | null;
  lastMessage: Message | null;
  pinnedMessage?: Message | null;
  unreadCount: number;
  modes: Modes;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SendMessagePayload {
  text?: string;
  kind?: MessageKind;
  attachment?: Attachment | null;
  viewOnce?: boolean;
  replyToId?: string;
}

/* ------------------------------------------------------------------ *
 * Stories — 24-hour status updates, Instagram/WhatsApp style.
 * ------------------------------------------------------------------ */

export type StoryKind = 'text' | 'image';

/** The compact story snapshot carried by an Instagram-style story reply. */
export interface StoryReplyContext {
  storyId: string;
  authorId: string;
  kind: StoryKind;
  text: string;
  background: string;
  attachmentUrl: string | null;
  reaction: string | null;
}

export interface Story {
  id: string;
  userId: string;
  kind: StoryKind;
  text: string;
  background: string;
  attachment: Attachment | null;
  closeFriendsOnly: boolean;
  viewed: boolean;
  viewerCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface StoryGroup {
  user: User;
  stories: Story[];
  unseenCount: number;
  isMine: boolean;
}

export interface StoryViewerEntry {
  user: User;
  viewedAt: string;
}

/** Vector embedding for semantic search */
export interface VectorEmbedding {
  values: number[];
  model: string;
  createdAt: string;
}

/** Search result for semantic message search */
export interface SearchResult {
  messageId: string;
  conversationId: string;
  preview: string;
  sender: string;
  score: number; // similarity score (0-1)
  highlighted: string; // matched snippet
}

/** Query for semantic message search */
export interface SemanticSearchQuery {
  query: string;
  conversationIds?: string[];
  limit?: number;
  filterUrgency?: 'routine' | 'important' | 'urgent';
}
