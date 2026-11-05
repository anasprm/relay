'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Loader2,
  MoreHorizontal,
  Send,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { api, mediaUrl } from '@/lib/api';
import { storyBackgroundClass } from '@/lib/storyBackgrounds';
import { cn } from '@/lib/utils';
import type { Story, StoryGroup, StoryViewerEntry } from '@/lib/types';

/** Instagram's "5h" style timestamp. */
function storyTime(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface StoryViewerProps {
  open: boolean;
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
  onViewed: (storyId: string) => void;
  onDelete: (storyId: string) => Promise<void>;
  onReply: (story: Story, text: string) => Promise<boolean>;
  onReact: (story: Story, emoji: string) => Promise<boolean>;
}

export function StoryViewer({
  open,
  groups,
  initialGroupIndex,
  onClose,
  onViewed,
  onDelete,
  onReply,
  onReact,
}: StoryViewerProps) {
  const [groupIndex, setGroupIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [heartBurst, setHeartBurst] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerEntry[] | null>(null);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openKeyRef = useRef<string | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());
  const touchStartRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const holdActiveRef = useRef(false);
  const suppressTapRef = useRef(false);
  const elapsedRef = useRef(0);

  const group = groups[groupIndex] || null;
  const story = group?.stories[storyIndex] || null;
  const storyId = story?.id || null;
  const isMine = !!group?.isMine;

  /* A new story starts with a clean reply bar, viewer sheet, and progress. */
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setViewers(null);
    setViewersOpen(false);
    setReplyText('');
    setMenuOpen(false);
    setReplyFocused(false);
  }, [storyId]);

  /* If the last story disappears while the viewer is open, close it. */
  useEffect(() => {
    if (open && groups.length === 0) onClose();
  }, [groups.length, onClose, open]);

  /* Opening starts at the requested group, on its first unseen story. */
  useEffect(() => {
    if (!open) {
      openKeyRef.current = null;
      viewedRef.current.clear();
      return;
    }
    const key = String(initialGroupIndex);
    if (openKeyRef.current === key) return;
    const target = groups[initialGroupIndex];
    if (!target) return;
    openKeyRef.current = key;
    const firstUnseen = target.stories.findIndex((entry) => !entry.viewed);
    setGroupIndex(initialGroupIndex);
    setStoryIndex(firstUnseen >= 0 ? firstUnseen : 0);
    setProgress(0);
    setPaused(false);
  }, [groups, initialGroupIndex, open]);

  /* Keep indices valid when a story is deleted or expires. */
  useEffect(() => {
    if (!open || groups.length === 0) return;
    if (groupIndex > groups.length - 1) {
      setGroupIndex(groups.length - 1);
      setStoryIndex(0);
      return;
    }
    const current = groups[groupIndex];
    if (current && storyIndex > current.stories.length - 1) {
      setStoryIndex(Math.max(0, current.stories.length - 1));
    }
  }, [groupIndex, groups, open, storyIndex]);

  const beginHold = useCallback(() => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      holdActiveRef.current = true;
      setPaused(true);
    }, 180);
  }, []);

  const endHold = useCallback(() => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdActiveRef.current) {
      holdActiveRef.current = false;
      setPaused(false);
      // A long press must not also count as a tap that advances the story.
      suppressTapRef.current = true;
      window.setTimeout(() => {
        suppressTapRef.current = false;
      }, 80);
    }
  }, []);

  useEffect(
    () => () => {
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    },
    [],
  );

  const goNext = useCallback(() => {
    if (suppressTapRef.current) return;
    elapsedRef.current = 0;
    setProgress(0);
    if (!group) {
      onClose();
      return;
    }
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
      return;
    }
    if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
      return;
    }
    onClose();
  }, [group, groupIndex, groups.length, onClose, storyIndex]);

  const goPrevious = useCallback(() => {
    if (suppressTapRef.current) return;
    elapsedRef.current = 0;
    setProgress(0);
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      return;
    }
    if (groupIndex > 0) {
      const previous = groups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      setStoryIndex(Math.max(0, previous.stories.length - 1));
      return;
    }
    setProgress(0);
  }, [groupIndex, groups, storyIndex]);

  /* Instagram advances every story after five seconds. */
  useEffect(() => {
    if (!open || !storyId || paused || viewersOpen || menuOpen || confirmDelete || replyFocused) {
      return;
    }
    const duration = 5000;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      elapsedRef.current += now - last;
      last = now;
      const percent = Math.min(100, (elapsedRef.current / duration) * 100);
      setProgress(percent);
      if (percent >= 100) {
        window.clearInterval(timer);
        goNext();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [confirmDelete, goNext, menuOpen, open, paused, replyFocused, storyId, viewersOpen]);

  /* Mark the story seen once it is on screen. */
  useEffect(() => {
    if (!open || !storyId || isMine) return;
    if (viewedRef.current.has(storyId)) return;
    viewedRef.current.add(storyId);
    onViewed(storyId);
  }, [isMine, onViewed, open, storyId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (viewersOpen) setViewersOpen(false);
        else if (menuOpen) setMenuOpen(false);
        else onClose();
      }
      if (event.key === 'ArrowRight') goNext();
      if (event.key === 'ArrowLeft') goPrevious();
      if (event.key === ' ' && !replyFocused) {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrevious, menuOpen, onClose, open, replyFocused, viewersOpen]);

  async function openViewers() {
    if (!story) return;
    setViewersOpen(true);
    setMenuOpen(false);
    if (viewers) return;
    setViewersLoading(true);
    try {
      const response = await api.get<{ viewers: StoryViewerEntry[] }>(
        `/api/stories/${story.id}/viewers`,
      );
      setViewers(response.viewers || []);
    } catch {
      setViewers([]);
    } finally {
      setViewersLoading(false);
    }
  }

  async function sendReply() {
    const value = replyText.trim();
    if (!story || !value || sendingReply) return;
    setSendingReply(true);
    try {
      const ok = await onReply(story, value);
      if (ok) {
        setReplyText('');
        setReplyFocused(false);
      }
    } finally {
      setSendingReply(false);
    }
  }

  async function sendHeart() {
    if (!story || sendingReply) return;
    setHeartBurst(Date.now());
    setSendingReply(true);
    try {
      await onReact(story, '❤️');
    } finally {
      setSendingReply(false);
    }
  }

  async function confirmRemove() {
    if (!story || deleting) return;
    setDeleting(true);
    try {
      await onDelete(story.id);
      setConfirmDelete(false);
      setViewers(null);
      goNext();
    } finally {
      setDeleting(false);
    }
  }

  const backgroundClass = useMemo(
    () => storyBackgroundClass(story?.background),
    [story?.background],
  );

  if (!open || !group || !story) return null;

  const firstName = group.user.displayName.split(' ')[0];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 p-0 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Story by ${group.user.displayName}`}
    >
      <div
        className="relative flex h-dvh w-full max-w-[26rem] flex-col overflow-hidden bg-[#121212] text-white animate-story-fade sm:h-[min(92dvh,50rem)] sm:rounded-xl sm:shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
        onTouchStart={(event) => {
          touchStartRef.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartRef.current;
          const end = event.changedTouches[0]?.clientY ?? null;
          touchStartRef.current = null;
          if (start !== null && end !== null && end - start > 90) onClose();
        }}
      >
        {/* Segmented progress bars */}
        <div className="absolute inset-x-0 top-0 z-30 flex gap-1 px-2 pt-2">
          {group.stories.map((entry, index) => (
            <span key={entry.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
                style={{
                  width:
                    index < storyIndex ? '100%' : index === storyIndex ? `${progress}%` : '0%',
                }}
              />
            </span>
          ))}
        </div>

        {/* Header */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2.5 bg-gradient-to-b from-black/70 via-black/25 to-transparent px-3 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <Avatar user={group.user} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold">
              {group.user.username || group.user.displayName}
              {story.closeFriendsOnly && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-[#1d9f4f] px-1.5 py-[1px] text-[10px] font-medium"
                  title="Close friends"
                >
                  <Star size={9} className="fill-current" />
                  Close friends
                </span>
              )}
            </p>
            <p className="text-[11.5px] text-white/75">{storyTime(story.createdAt)}</p>
          </div>

          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            aria-label={paused ? 'Resume story' : 'Pause story'}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? (
              <span className="text-[12px] font-semibold">▶</span>
            ) : (
              <span className="text-[12px] font-semibold">❚❚</span>
            )}
          </button>

          {isMine && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="Story options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={17} />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-xl bg-[#262626] p-1 shadow-2xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] text-red-400 transition-colors hover:bg-white/10"
                  >
                    <Trash2 size={16} />
                    Delete story
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="Close story"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Story content */}
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
          onPointerDown={beginHold}
          onPointerUp={endHold}
          onPointerCancel={endHold}
          onPointerLeave={endHold}
        >
          {story.kind === 'image' && story.attachment ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(story.attachment.url)}
                alt={story.attachment.name}
                className="h-full w-full object-cover"
              />
              {story.text && (
                <p className="ig-story-text absolute inset-x-0 bottom-0 whitespace-pre-wrap break-words bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pb-28 pt-16 text-center text-[15px] font-medium leading-snug">
                  {story.text}
                </p>
              )}
            </>
          ) : (
            <div
              className={cn(
                'flex h-full w-full items-center justify-center px-7 text-center',
                backgroundClass,
              )}
            >
              <p className="ig-story-text max-h-full overflow-y-auto whitespace-pre-wrap break-words text-[27px] font-semibold leading-tight">
                {story.text}
              </p>
            </div>
          )}

          {/* Tap zones: left goes back, right advances — just like Instagram. */}
          <button
            type="button"
            onClick={goPrevious}
            className="absolute inset-y-0 left-0 z-10 w-[32%]"
            aria-label="Previous story"
          />
          <button
            type="button"
            onClick={goNext}
            className="absolute inset-y-0 right-0 z-10 w-[68%]"
            aria-label="Next story"
          />
          <span className="pointer-events-none absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/30 p-1 text-white/70 sm:block">
            <ChevronLeft size={16} />
          </span>
          <span className="pointer-events-none absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/30 p-1 text-white/70 sm:block">
            <ChevronRight size={16} />
          </span>

          {heartBurst > 0 && (
            <span
              key={heartBurst}
              className="pointer-events-none absolute left-1/2 top-1/2 z-30 animate-heart-pop text-[64px] leading-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
              aria-hidden="true"
            >
              ❤️
            </span>
          )}
        </div>

        {/* Bottom bar */}
        {isMine ? (
          <div className="relative z-20 shrink-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-4 pt-10">
            <button
              type="button"
              onClick={() => void openViewers()}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/20"
            >
              <Eye size={14} />
              Seen by {story.viewerCount}
            </button>
          </div>
        ) : (
          <div className="relative z-20 shrink-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-12">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/50 px-3.5 py-2.5">
                <input
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  onFocus={() => setReplyFocused(true)}
                  onBlur={() => setReplyFocused(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void sendReply();
                    }
                  }}
                  maxLength={1000}
                  placeholder={`Reply to ${firstName}…`}
                  aria-label={`Reply to ${group.user.displayName}`}
                  className="min-w-0 flex-1 bg-transparent text-[12.5px] text-white placeholder:text-white/70 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => void sendHeart()}
                disabled={sendingReply}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-transform active:scale-90 disabled:opacity-60"
                aria-label="React with a heart"
                title="Send a heart"
              >
                <Heart size={25} />
              </button>

              {replyText.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={sendingReply}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0095f6] text-white transition-transform active:scale-95 disabled:opacity-60"
                  aria-label="Send story reply"
                  title="Send"
                >
                  {sendingReply ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Send size={17} />
                  )}
                </button>
              )}
            </div>
            {sendingReply && (
              <p className="mt-1.5 px-2 text-[11.5px] text-white/60">Sending…</p>
            )}
          </div>
        )}

        {/* Seen-by sheet, Instagram style */}
        {viewersOpen && (
          <div
            className="absolute inset-0 z-40 flex items-end bg-black/45"
            onClick={() => setViewersOpen(false)}
            role="presentation"
          >
            <div
              className="flex max-h-[72%] w-full flex-col rounded-t-2xl bg-[#1c1c1e] pb-3"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-label="Story viewers"
            >
              <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/30" />
              <div className="flex items-center justify-between px-4 py-2.5">
                <p className="text-[13px] font-semibold">Seen by {story.viewerCount}</p>
                <button
                  type="button"
                  onClick={() => setViewersOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  aria-label="Close viewers"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-2">
                {viewersLoading ? (
                  <p className="px-3 py-6 text-center text-[11.5px] text-white/60">
                    Loading viewers…
                  </p>
                ) : viewers && viewers.length > 0 ? (
                  <ul className="space-y-0.5 pb-2">
                    {viewers.map((entry) => (
                      <li
                        key={entry.user.id}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                      >
                        <Avatar user={entry.user} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                          {entry.user.username || entry.user.displayName}
                        </span>
                        <span className="shrink-0 text-[11.5px] text-white/45">
                          {storyTime(entry.viewedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-8 text-center text-[11.5px] text-white/60">
                    No views yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this story?"
        description="It disappears immediately for everyone who could see it. This cannot be undone."
        confirmLabel="Delete story"
        destructive
        busy={deleting}
        onCancel={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        onConfirm={() => void confirmRemove()}
      />
    </div>
  );
}
