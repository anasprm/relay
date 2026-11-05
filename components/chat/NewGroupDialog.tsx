'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Search, Users, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/AuthProvider';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';

interface NewGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, usernames: string[]) => Promise<void>;
}

/**
 * Creates a family group: a name plus at least two members picked from the
 * private directory. Only the private workspace exposes this dialog.
 */
export function NewGroupDialog({ open, onClose, onCreate }: NewGroupDialogProps) {
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setQuery('');
    setSelected([]);
    setError(null);
    const timer = window.setTimeout(() => titleRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(
      async () => {
        setSearching(true);
        try {
          const response = await api.get<{ users: User[] }>(
            `/api/users/search?q=${encodeURIComponent(query.trim())}`,
          );
          if (active) setUsers(response.users);
        } catch (caught) {
          if (active) setError(errorMessage(caught));
        } finally {
          if (active) setSearching(false);
        }
      },
      query.trim() ? 220 : 0,
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  function toggle(user: User) {
    setError(null);
    setSelected((previous) =>
      previous.some((member) => member.id === user.id)
        ? previous.filter((member) => member.id !== user.id)
        : [...previous, user],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const name = title.trim();
    if (busy) return;
    if (name.length < 2) {
      setError('Give the group a name of at least 2 characters.');
      return;
    }
    if (selected.length < 2) {
      setError('Pick at least two people for the group.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onCreate(name, selected.map((member) => member.username));
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New group chat"
      description="Name the group and pick the family members who should join it."
      className="max-w-md"
    >
      <form onSubmit={(event) => void submit(event)} className="p-5">
        <label htmlFor="group-title" className="sr-only">
          Group name
        </label>
        <div className="relative">
          <Users
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            id="group-title"
            ref={titleRef}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value.slice(0, 40));
              setError(null);
            }}
            placeholder="Group name"
            maxLength={40}
            className="h-11 w-full rounded-lg border border-transparent bg-panel-2 pl-10 pr-3 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-panel focus:outline-none"
          />
        </div>

        {selected.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {selected.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent-strong"
              >
                {member.displayName}
                <button
                  type="button"
                  onClick={() => toggle(member)}
                  className="rounded-full p-0.5 transition-colors hover:bg-accent/15"
                  aria-label={`Remove ${member.displayName}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="relative mt-3">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setError(null);
            }}
            placeholder="Search family members"
            autoCapitalize="none"
            spellCheck={false}
            className="h-11 w-full rounded-lg border border-transparent bg-panel-2 pl-10 pr-9 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-panel focus:outline-none"
          />
          {searching && (
            <Loader2
              size={14}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-accent"
            />
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-[18px] text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <p className="mb-2 mt-4 text-[12px] text-muted">
          {query.trim() ? 'Matching people' : 'Family directory'}
        </p>

        <div className="scrollbar-thin -mx-1 max-h-[260px] overflow-y-auto px-1">
          {users.length === 0 && !searching ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Users size={20} className="text-faint" />
              <p className="text-[12.5px] text-muted">
                {query.trim() ? `No directory match for “${query.trim()}”` : 'No other accounts yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {users.map((user) => {
                const picked = selected.some((member) => member.id === user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggle(user)}
                    aria-pressed={picked}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                      picked ? 'bg-accent-soft' : 'hover:bg-panel-2',
                    )}
                  >
                    <Avatar user={user} size="md" online={user.online} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-ink">
                        {user.displayName}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted">
                        @{user.username}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                        picked
                          ? 'border-accent bg-accent text-accent-ink'
                          : 'border-line-strong text-transparent',
                      )}
                      aria-hidden="true"
                    >
                      <Check size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[14px] text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
          Create group{selected.length > 0 ? ` · ${selected.length + 1} members` : ''}
        </button>
      </form>
    </Modal>
  );
}
