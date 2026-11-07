'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon,
  FileText,
  Headphones,
  Link,
  ExternalLink,
  Download,
  Play,
  Pause,
  X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { getConversationMediaVault, type VaultItem } from '@/lib/mediaVault';

type VaultTab = 'media' | 'docs' | 'audio' | 'links';

interface MediaVaultDrawerProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  /** Fired when a user selects an item, to jump back to the source message. */
  onSelect: (messageId: string) => void;
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function MediaVaultDrawer({ open, onClose, conversationId, onSelect }: MediaVaultDrawerProps) {
  const [tabs, setTabs] = useState<{
    media: VaultItem[];
    docs: VaultItem[];
    audio: VaultItem[];
    links: VaultItem[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<VaultTab>('media');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const data = await getConversationMediaVault(conversationId);
        if (active) setTabs(data);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [open, conversationId]);

  const items = tabs?.[activeTab] ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Shared media" hideClose>
      <div className="flex flex-col gap-3 p-4">
        {/* Tab bar */}
        <div className="flex gap-1 rounded-lg bg-[#121214] border border-[#2A2A2C] p-0.5">
          {[
            { id: 'media' as VaultTab, label: 'Media', icon: <ImageIcon size={14} /> },
            { id: 'docs' as VaultTab, label: 'Docs', icon: <FileText size={14} /> },
            { id: 'audio' as VaultTab, label: 'Audio', icon: <Headphones size={14} /> },
            { id: 'links' as VaultTab, label: 'Links', icon: <Link size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] transition-colors',
                activeTab === tab.id
                  ? 'bg-[#2A2A2C] text-[#25D366] shadow-sm'
                  : 'text-[#8E8E93] hover:bg-[#2A2A2C]/50 hover:text-[#FFFFFF]',
              )}
            >
              {tab.icon}
              <span className="font-medium">{tab.label}</span>
              <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold text-[#8E8E93]">
                {tabs?.[tab.id]?.length ?? 0}
              </span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-[12px] text-faint">Loading vault…</span>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <X size={20} className="text-faint" />
            <span className="text-[12.5px] text-faint">No {activeTab} found in this conversation</span>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-2">
            {activeTab === 'media' && (
              <div className="grid grid-cols-3 gap-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.messageId);
                      onClose();
                    }}
                    className="aspect-square rounded-lg bg-panel-2 overflow-hidden"
                  >
                    <img
                      src={item.url}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'audio' && (
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.messageId);
                      onClose();
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-panel-2"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                      <Play size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5 text-[12.5px]">
                        <span className="font-medium text-ink truncate">{item.name}</span>
                        <span className="text-[11px] text-faint">{formatTime(item.createdAt)}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted">
                        {formatBytes(item.size)} · {item.mimeType}
                      </div>
                    </div>
                    <audio
                      src={item.url}
                      className="w-[120px]"
                      controls
                      preload="metadata"
                    />
                  </button>
                ))}
              </div>
            )}

            {(activeTab === 'docs' || activeTab === 'links') && (
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (activeTab === 'links') {
                        window.open(item.url, '_blank');
                      } else {
                        onSelect(item.messageId);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-panel-2"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel-2 text-muted">
                      {activeTab === 'links' ? (
                        <ExternalLink size={13} />
                      ) : (
                        <FileText size={13} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5 text-[12.5px]">
                        <span className="font-medium text-ink truncate">{item.name}</span>
                        <span className="text-[11px] text-faint">{formatTime(item.createdAt)}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted">
                        {activeTab === 'docs' ? formatBytes(item.size) : item.url}
                      </div>
                    </div>
                    {activeTab === 'docs' && (
                      <Download size={12} className="shrink-0 text-[#25D366]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
