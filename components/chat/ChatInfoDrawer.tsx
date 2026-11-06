'use client';

import { useState, useMemo } from 'react';
import {
  X,
  Image as ImageIcon,
  FileText,
  Link,
  Star,
  Phone,
  Video,
  Mic,
  Users,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import type { Conversation, Message, User } from '@/lib/types';

interface ChatInfoDrawerProps {
  open: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  messages: Message[];
  currentUserId: string | null;
}

export function ChatInfoDrawer({
  open,
  onClose,
  conversation,
  messages,
  currentUserId,
}: ChatInfoDrawerProps) {
  if (!open) return null;

  const mediaMessages = useMemo(
    () =>
      (messages || []).filter(
        (m) =>
          m.attachment &&
          (m.attachment.kind === 'image' ||
            m.attachment.kind === 'video' ||
            m.attachment.mime.startsWith('image/') ||
            m.attachment.mime.startsWith('video/')),
      ),
    [messages],
  );

  const linkMessages = useMemo(
    () =>
      (messages || []).filter(
        (m) =>
          m.text &&
          /https?:\/\/\S+/.test(m.text) &&
          !m.attachment,
      ),
    [messages],
  );

  const starredMessages = useMemo(
    () => (messages || []).filter((m) => m.starred),
    [messages],
  );

  const participants = useMemo(() => {
    if (!conversation?.other) return [];
    return [conversation.other];
  }, [conversation?.other]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-end"
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[3px]"
        aria-label="Close info drawer"
      />
      {/* Drawer Panel */}
      <div
        className="fixed inset-y-0 right-0 z-[71] w-full max-w-[420px] bg-[#0a0a0c] border-l border-[#27272a]/30 flex flex-col shadow-[0_40px_100px_-30px_rgba(2,6,23,0.65)] animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#27272a]/30 bg-[#0a0a0c] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0">
              {conversation?.other?.avatarUrl ? (
                <img
                  src={conversation.other.avatarUrl}
                  alt={conversation.other.displayName}
                  className="h-full w-full rounded-full object-cover border border-[#27272a]"
                />
              ) : (
                <div className="h-full w-full rounded-full bg-[#1C1C1E] flex items-center justify-center text-[#8E8E93]">
                  <Users className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm text-[#FFFFFF] truncate">
                {conversation?.title || conversation?.other?.displayName || 'Conversation'}
              </h3>
              <p className="text-xs text-[#8E8E93] truncate">
                {conversation?.kind === 'group'
                  ? `${conversation.participantCount} members`
                  : conversation?.other?.online
                    ? 'Online'
                    : 'Offline'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#8E8E93] hover:bg-[#27272a] hover:text-[#FFFFFF] transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content Tabs */}
        <div className="flex h-full overflow-hidden">
          {/* Tab Buttons */}
          <div className="hidden md:flex flex-col w-64 border-r border-[#27272a]/30 bg-[#0F0F11]">
            <TabButton
              label="Info"
              icon={<Users size={16} />}
              active
            />
            <TabButton label="Media" icon={<ImageIcon size={16} />} />
            <TabButton label="Links" icon={<Link size={16} />} />
            <TabButton label="Starred" icon={<Star size={16} />} />
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto bg-[#0A0A0C]">
            {/* Info Tab */}
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full object-cover border border-[#27272a] shrink-0">
                  {conversation?.other?.avatarUrl ? (
                    <img
                      src={conversation.other.avatarUrl}
                      alt={conversation.other.displayName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full rounded-full bg-[#1C1C1E] flex items-center justify-center text-[#8E8E93]">
                      <Users className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-[#FFFFFF] truncate">
                    {conversation?.other?.displayName || 'Unknown'}
                  </h3>
                  <p className="text-xs text-[#8E8E93] truncate">
                    {conversation?.other?.username || ''}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <ActionRow
                  icon={<Phone size={16} />}
                  label="Audio call"
                  subtitle="Start an audio call"
                  onClick={() => {
                    onClose();
                  }}
                />
                <ActionRow
                  icon={<Video size={16} />}
                  label="Video call"
                  subtitle="Start a video call"
                  onClick={() => {
                    onClose();
                  }}
                />
                <ActionRow
                  icon={<Clock size={16} />}
                  label="Disappearing messages"
                  subtitle="Off"
                  onClick={() => {
                    onClose();
                  }}
                />
                <ActionRow
                  icon={<Star size={16} />}
                  label="Starred messages"
                  subtitle={`${starredMessages.length} starred`}
                  onClick={() => {
                    onClose();
                  }}
                />
              </div>
            </div>

            {/* Media Tab */}
            <div className="hidden p-4 space-y-3">
              <h3 className="font-medium text-sm text-[#FFFFFF] mb-3">Media</h3>
              {mediaMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-[#8E8E93]">
                  <ImageIcon size={32} className="mb-2 opacity-30" />
                  <p className="text-xs">No media shared yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaMessages.map((m) => (
                    <div
                      key={m.id}
                      className="aspect-square rounded-lg overflow-hidden border border-[#27272a]/50 bg-[#1C1C1E]"
                    >
                      {m.attachment?.kind === 'image' || m.attachment?.mime.startsWith('image/') ? (
                        <img
                          src={mediaUrl(m.attachment.url)}
                          alt={m.attachment.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-[#121216]">
                          <Video size={24} className="text-[#8E8E93]" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Links Tab */}
            <div className="hidden p-4 space-y-2">
              <h3 className="font-medium text-sm text-[#FFFFFF] mb-3">Links</h3>
              {linkMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-[#8E8E93]">
                  <Link size={32} className="mb-2 opacity-30" />
                  <p className="text-xs">No links shared yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkMessages.map((msg) => {
                    const urls = msg.text.match(/https?:\/\/\S+/g) || [];
                    return (
                      <div
                        key={msg.id}
                        className="flex items-start gap-3 rounded-lg border border-[#27272a]/50 p-3 bg-[#1C1C1E]"
                      >
                        <Link size={20} className="shrink-0 text-[#8E8E93]" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <span className="text-[11px] font-medium text-[#FFFFFF] truncate">
                              {msg.sender?.displayName || 'Unknown'}
                            </span>
                            <span className="text-[10px] text-[#8E8E93] truncate">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8E8E93] truncate mt-1 leading-relaxed">
                            {urls[0]}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Starred Tab */}
            <div className="hidden p-4 space-y-3">
              <h3 className="font-medium text-sm text-[#FFFFFF] mb-3">Starred messages</h3>
              {starredMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-[#8E8E93]">
                  <Star size={32} className="mb-2 opacity-30" />
                  <p className="text-xs">No starred messages</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {starredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-start gap-3 rounded-lg border border-[#27272a]/50 p-3 bg-[#1C1C1E]"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2A2A2C] shrink-0">
                        <Star size={12} className="text-[#25D366]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <span className="text-[11px] font-medium text-[#FFFFFF] truncate">
                            {msg.sender?.displayName || 'Unknown'}
                          </span>
                          <span className="text-[10px] text-[#8E8E93] truncate">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#FFFFFF] leading-relaxed mt-1 truncate-line-clamp">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 text-[12px] transition-colors',
        active
          ? 'bg-accent-soft text-accent'
          : 'text-[#8E8E93] hover:bg-[#27272a] hover:text-[#FFFFFF]',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-[11px]">{label}</span>
    </button>
  );
}

function ActionRow({
  icon,
  label,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#27272a]"
    >
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[12px] font-medium text-[#FFFFFF] truncate">
          {label}
        </span>
        <span className="text-[10px] text-[#8E8E93] truncate">{subtitle}</span>
      </div>
      <ChevronRight size={12} className="text-[#8E8E93]" />
    </button>
  );
}
