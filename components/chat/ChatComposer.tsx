'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Smile,
  Mic,
  Send,
  Image as ImageIcon,
  FileText,
  Camera,
  Headphones,
  Mic as MicIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceRecorder } from './VoiceRecorder';

interface ChatComposerProps {
  draft: string;
  setDraft: (val: string) => void;
  onSend: (e: React.FormEvent) => void;
  onToggleEmoji: () => void;
  emojiOpen: boolean;
  disabled?: boolean;
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Called when a voice recording is complete with a data URL. */
  onVoiceRecorded?: (dataUrl: string, fileName: string, mimeType: string) => void;
  /** Whether a voice recording is currently in progress. */
  isRecordingVoice?: boolean;
}

export function ChatComposer({
  draft,
  setDraft,
  onSend,
  onToggleEmoji,
  emojiOpen,
  disabled = false,
  onFileChange,
  onVoiceRecorded,
  isRecordingVoice,
}: ChatComposerProps) {
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = !draft.trim();

  // Close attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
        setIsAttachOpen(false);
      }
    };
    if (isAttachOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAttachOpen]);

  // Grow the textarea with its content, capped at roughly five lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(e);
    }
  };

  return (
    <form
      onSubmit={onSend}
      className="relative flex items-center gap-2 px-4 py-3 bg-[#0A0A0C] border-t border-[#1C1C1E] select-none"
    >
      {/* Left: Attachment Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsAttachOpen((prev) => !prev);
          }}
          className="p-2.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/60 shrink-0 cursor-pointer"
          title="Attach media"
        >
          <Plus className="w-5 h-5" />
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileChange}
            className="hidden"
            accept="image/*,application/pdf,video/*"
          />
        </button>

        {/* Attachment Menu Popup */}
        {isAttachOpen && (
          <div className="absolute bottom-14 left-0 w-52 bg-[#1C1C1E] border border-zinc-800/80 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
            <button
              type="button"
              onClick={() => {
                setIsAttachOpen(false);
                fileInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center shrink-0">
                <ImageIcon className="w-4 h-4" />
              </div>
              <span>Photos & Videos</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAttachOpen(false);
                fileInputRef.current?.click();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <span>Document</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAttachOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-pink-600/20 text-pink-400 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <span>Camera</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAttachOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800/60 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-amber-600/20 text-amber-400 flex items-center justify-center shrink-0">
                <Headphones className="w-4 h-4" />
              </div>
              <span>Audio</span>
            </button>
          </div>
        )}
      </div>

      {/* Central Input Container Pill */}
      <div className="flex-1 flex items-center bg-[#121214] rounded-full px-4 py-2 border border-zinc-800/80 focus-within:border-[#25D366] transition-all shadow-inner">
        {/* Voice recording in progress */}
        {isRecordingVoice ? (
          <VoiceRecorder
            onVoiceRecorded={onVoiceRecorded}
            disabled={disabled}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Message…"
            rows={1}
            className="w-full max-h-[120px] resize-none overflow-y-auto bg-transparent text-white placeholder-zinc-500 focus:outline-none text-sm py-1"
          />
        )}
        {/* Emoji Picker Trigger */}
        <div className="relative ml-2 shrink-0">
          <button
            type="button"
            onClick={onToggleEmoji}
            className={cn(
              'ml-2 shrink-0 p-1 transition-colors',
              disabled
                ? 'text-[#8E8E93] cursor-not-allowed'
                : 'text-zinc-400 hover:text-white',
            )}
            title="Choose an emoji"
            disabled={disabled}
          >
            <Smile className="w-5 h-5" />
          </button>
          {emojiOpen && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#25D366] border-2 border-black" />
          )}
        </div>
      </div>

      {/* Right Send / Mic Action Button */}
      {!isRecordingVoice && (
        <button
          type="submit"
          disabled={isEmpty || disabled}
          className={cn(
            "p-2.5 rounded-full text-white font-medium transition-all shrink-0 flex items-center justify-center shadow-md",
            isEmpty || disabled
              ? "bg-[#1C1C1E] text-[#8E8E93]"
              : "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600",
          )}
          aria-label={isEmpty ? "Record voice message" : "Send message"}
        >
          {isEmpty ? <MicIcon className="w-5 h-5 text-black" /> : <Send className="w-5 h-5 text-black" />}
        </button>
      )}
    </form>
  );
}