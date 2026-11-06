'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Globe2,
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { errorMessage } from '@/lib/AuthProvider';
import { mediaUrl, uploadAttachment } from '@/lib/api';
import { STORY_BACKGROUND_TOKENS, storyBackgroundClass } from '@/lib/storyBackgrounds';
import { useToast } from '@/lib/ToastProvider';
import { cn } from '@/lib/utils';
import type { Attachment, User } from '@/lib/types';

const MAX_BYTES = 30 * 1024 * 1024;

interface StoryComposerProps {
  open: boolean;
  contacts: User[];
  closeFriends: string[];
  onClose: () => void;
  onCreate: (input: {
    kind: 'text' | 'image';
    text: string;
    background: string;
    attachment: Attachment | null;
    closeFriendsOnly: boolean;
  }) => Promise<void>;
  onSaveCloseFriends: (userIds: string[]) => Promise<string[]>;
}

/**
 * A full-screen story editor that mirrors Instagram's flow: a 9:16 canvas,
 * inline text, gradient swatches, the audience sheet, and a single Share
 * action. No fake tools — every control here does something real.
 */
export function StoryComposer({
  open,
  contacts,
  closeFriends,
  onClose,
  onCreate,
  onSaveCloseFriends,
}: StoryComposerProps) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [background, setBackground] = useState<string>('indigo');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(() => new Set());
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setText('');
    setBackground('indigo');
    setAttachment(null);
    setUploading(false);
    setProgress(0);
    setCloseFriendsOnly(false);
    setSelectedFriends(new Set(closeFriends));
    setAudienceOpen(false);
    setSubmitting(false);
    setError(null);
  }, [closeFriends, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting && !uploading) {
        if (audienceOpen) setAudienceOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [audienceOpen, onClose, open, submitting, uploading]);

  const kind: 'text' | 'image' = attachment ? 'image' : 'text';
  const backgroundClass = useMemo(() => storyBackgroundClass(background), [background]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Stories need an image file.', 'error');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast('Story photos are limited to 30 MB.', 'error');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);
    try {
      const uploaded = await uploadAttachment(file, { filename: file.name }, setProgress);
      setAttachment(uploaded);
    } catch (caught) {
      toast(errorMessage(caught), 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function toggleFriend(userId: string) {
    setSelectedFriends((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function focusText() {
    textRef.current?.focus();
  }

  async function submit() {
    if (submitting || uploading) return;
    if (!attachment && !text.trim()) {
      setError('Add text or a photo to your story.');
      return;
    }
    if (closeFriendsOnly && selectedFriends.size === 0) {
      setError('Pick at least one close friend, or share with everyone.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (closeFriendsOnly) {
        await onSaveCloseFriends([...selectedFriends]);
      }
      await onCreate({
        kind,
        text: text.trim(),
        background,
        attachment: kind === 'image' ? attachment : null,
        closeFriendsOnly,
      });
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const canShare =
    !submitting &&
    !uploading &&
    (!!attachment || text.trim().length > 0) &&
    (!closeFriendsOnly || selectedFriends.size > 0);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Create a story"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void pickPhoto(event.target.files?.[0])}
      />

      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-[30rem] items-center justify-between gap-2 px-4 pb-2 pt-3">
        <button
          type="button"
          onClick={() => {
            if (!submitting && !uploading) onClose();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Close story editor"
          title="Close"
        >
          <X size={20} />
        </button>

        <div className="min-w-0 text-center">
          <p className="truncate text-[13.5px] font-semibold">New story</p>
          <p className="text-[11.5px] text-white/60">Disappears in 24 hours</p>
        </div>

        <button
          type="button"
          onClick={() => setAudienceOpen(true)}
          className={cn(
            'flex h-9 max-w-[8.5rem] items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-semibold transition-colors',
            closeFriendsOnly
              ? 'border-[#1d9f4f]/60 bg-[#1d9f4f]/15 text-[#5ce07f]'
              : 'border-white/25 bg-white/5 text-white hover:bg-white/10',
          )}
          aria-haspopup="dialog"
          aria-expanded={audienceOpen}
          aria-label="Choose who can see this story"
        >
          {closeFriendsOnly ? (
            <Star size={12} className="shrink-0 fill-current" />
          ) : (
            <Globe2 size={12} className="shrink-0" />
          )}
          <span className="truncate">
            {closeFriendsOnly ? 'Close friends' : 'Your story'}
          </span>
          <ChevronDown size={12} className="shrink-0 opacity-70" />
        </button>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[30rem] flex-1 flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {/* Canvas */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-[#121212]">
          {attachment ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(attachment.url)}
                alt={attachment.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/35" />
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
                aria-label="Remove photo"
                title="Remove photo"
              >
                <Trash2 size={15} />
              </button>
            </>
          ) : (
            <div className={cn('absolute inset-0', backgroundClass)} />
          )}

          <textarea
            ref={textRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={700}
            placeholder={attachment ? 'Add a caption…' : 'Add text'}
            aria-label="Story text"
            className={cn(
              'ig-story-text absolute inset-x-0 top-1/2 max-h-full w-full -translate-y-1/2 resize-none overflow-y-auto bg-transparent px-6 text-center font-semibold leading-[1.15] text-white caret-white placeholder:text-white/60 focus:outline-none',
              attachment ? 'text-[18px]' : 'text-[27px]',
            )}
          />

          {uploading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/65 backdrop-blur-sm">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-[12px] font-medium text-white/90">Uploading photo…</p>
              <div className="h-1 w-40 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-200"
                  style={{ width: `${Math.max(4, progress)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Gradient swatches, exactly like Instagram's text backgrounds */}
        {!attachment && (
          <div
            className="scrollbar-none mt-3 flex items-center justify-center gap-2.5 overflow-x-auto px-1"
            role="group"
            aria-label="Story background colour"
          >
            {STORY_BACKGROUND_TOKENS.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => {
                  setBackground(token);
                  focusText();
                }}
                className={cn(
                  'h-[26px] w-[26px] shrink-0 rounded-full transition-transform hover:scale-110',
                  storyBackgroundClass(token),
                  background === token
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-black'
                    : 'ring-1 ring-white/20',
                )}
                aria-label={`Use ${token} background`}
                aria-pressed={background === token}
              />
            ))}
          </div>
        )}

        {/* Tool row */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-50"
            aria-label="Add a photo"
            title="Photo"
          >
            <ImagePlus size={19} />
          </button>

          <button
            type="button"
            onClick={focusText}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
            aria-label="Add text"
            title="Text"
          >
            <span className="text-[15px] font-semibold leading-none">Aa</span>
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canShare}
            className="flex h-10 items-center gap-1.5 rounded-full bg-[#0095f6] px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1877f2] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Share
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-300"
          >
            {error}
          </p>
        )}
      </div>

      {/* Audience sheet */}
      {audienceOpen && (
        <div
          className="absolute inset-0 z-10 flex items-end bg-black/50 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => setAudienceOpen(false)}
        >
          <div
            className="flex max-h-[82%] w-full flex-col rounded-t-2xl bg-[#1c1c1e] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Story audience"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/25" />
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <p className="text-[13.5px] font-semibold">Who can see this story?</p>
              <button
                type="button"
                onClick={() => setAudienceOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close audience picker"
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2">
              <button
                type="button"
                onClick={() => setCloseFriendsOnly(false)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/5"
                aria-pressed={!closeFriendsOnly}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Globe2 size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold">Everyone</span>
                  <span className="block text-[11.5px] text-white/60">
                    Anyone in your workspace can see it
                  </span>
                </span>
                <span
                  className={cn(
                    'flex h-[18px] w-[18px] items-center justify-center rounded-full border',
                    !closeFriendsOnly
                      ? 'border-[#0095f6] bg-[#0095f6] text-white'
                      : 'border-white/30 text-transparent',
                  )}
                >
                  <Check size={11} strokeWidth={3} />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCloseFriendsOnly(true)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/5"
                aria-pressed={closeFriendsOnly}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d9f4f]/20 text-[#5ce07f]">
                  <Star size={17} className="fill-current" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold">Close friends</span>
                  <span className="block text-[11.5px] text-white/60">
                    Only the friends you choose
                  </span>
                </span>
                <span
                  className={cn(
                    'flex h-[18px] w-[18px] items-center justify-center rounded-full border',
                    closeFriendsOnly
                      ? 'border-[#0095f6] bg-[#0095f6] text-white'
                      : 'border-white/30 text-transparent',
                  )}
                >
                  <Check size={11} strokeWidth={3} />
                </span>
              </button>

              {closeFriendsOnly && (
                <div className="mt-1 border-t border-white/10 pt-2">
                  <p className="px-2.5 pb-1.5 text-[11.5px] text-white/55">
                    {selectedFriends.size} selected
                  </p>
                  {contacts.length === 0 ? (
                    <p className="px-2.5 py-4 text-center text-[12px] text-white/55">
                      Start a conversation first, then add people here.
                    </p>
                  ) : (
                    <ul className="space-y-0.5 pb-1">
                      {(contacts || []).map((contact) => {
                        const selected = selectedFriends.has(contact.id);
                        return (
                          <li key={contact.id}>
                            <button
                              type="button"
                              onClick={() => toggleFriend(contact.id)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                              aria-pressed={selected}
                            >
                              <Avatar user={contact} size="sm" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px] font-medium">
                                  {contact.displayName}
                                </span>
                                {contact.username && (
                                  <span className="block truncate text-[11.5px] text-white/55">
                                    @{contact.username}
                                  </span>
                                )}
                              </span>
                              <span
                                className={cn(
                                  'flex h-[18px] w-[18px] items-center justify-center rounded-full border',
                                  selected
                                    ? 'border-[#1d9f4f] bg-[#1d9f4f] text-white'
                                    : 'border-white/30 text-transparent',
                                )}
                              >
                                <Check size={11} strokeWidth={3} />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="px-3 pt-2">
              <button
                type="button"
                onClick={() => setAudienceOpen(false)}
                className="h-10 w-full rounded-lg bg-[#0095f6] text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1877f2]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
