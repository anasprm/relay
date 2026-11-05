'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface GroupRenameDialogProps {
  open: boolean;
  currentName: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

/** Creator-only rename for a group chat. */
export function GroupRenameDialog({
  open,
  currentName,
  busy,
  error,
  onClose,
  onSubmit,
}: GroupRenameDialogProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(currentName);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open, currentName]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    onSubmit(name.trim());
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rename group"
      description="Everyone in the group sees the new name immediately."
      className="max-w-sm"
    >
      <form onSubmit={submit} className="p-5">
        <label htmlFor="group-rename" className="sr-only">
          Group name
        </label>
        <input
          id="group-rename"
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, 40))}
          placeholder="Group name"
          maxLength={40}
          className="h-11 w-full rounded-lg border border-transparent bg-panel-2 px-3 text-[14px] text-ink placeholder:text-faint transition-colors focus:border-accent focus:bg-panel focus:outline-none"
        />

        {error && (
          <p role="alert" className="mt-2 text-[12px] text-danger">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-10 rounded-lg px-3.5 text-[13.5px] text-muted transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || name.trim().length < 2}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[13.5px] text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
