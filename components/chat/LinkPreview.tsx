'use client';

import { useEffect, useState } from 'react';
import { X, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

interface LinkPreviewProps {
  url: string;
  senderName?: string;
  timestamp?: string;
  onRemove?: () => void;
}

export function LinkPreview({
  url,
  senderName,
  timestamp,
  onRemove,
}: LinkPreviewProps) {
  const [preview, setPreview] = useState<{
    title: string;
    description: string;
    image: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(false);

    // Try Open Graph meta tags first
    fetch(url, { headers: { Accept: 'text/html' } })
      .then((r) => r.text())
      .then((html) => {
        if (!active) return;
        const title = extractMeta(html, 'og:title') || extractTitle(html);
        const description =
          extractMeta(html, 'og:description') ||
          extractMeta(html, 'description') ||
          '';
        const image =
          extractMeta(html, 'og:image') ||
          extractMeta(html, 'twitter:image') ||
          '';
        setPreview({ title, description, image });
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });

    let active = true;
    return () => {
      active = false;
    };
  }, [url]);

  if (error || (loading && !preview)) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-[#27272a]/50 p-3 bg-[#1C1C1E] my-2">
        <LinkIcon size={18} className="shrink-0 text-[#8E8E93]" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-[#FFFFFF] truncate">
            {url}
          </span>
          <p className="text-[10px] text-[#8E8E93] mt-1">
            Could not load preview
          </p>
        </div>
      </div>
    );
  }

  if (!preview || loading) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-[#27272a]/50 p-3 bg-[#1C1C1E] my-2">
        <LinkIcon size={18} className="shrink-0 text-[#8E8E93]" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-[#FFFFFF] truncate">
            {url}
          </span>
          <p className="text-[10px] text-[#8E8E93] mt-1">Loading preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#27272a]/50 p-3 bg-[#1C1C1E] my-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2A2A2C] border border-[#27272a]/30">
        <LinkIcon size={14} className="text-[#8E8E93]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-[11px] font-medium text-[#FFFFFF] truncate">
            {preview.title || url}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-[#27272a] text-[#8E8E93] hover:text-[#FFFFFF] transition-colors"
            aria-label="Remove link"
          >
            <X size={12} />
          </button>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-[10px] text-[#8E8E93] truncate">
            {senderName || 'Unknown'}
          </span>
          <span className="text-[10px] text-[#8E8E93] truncate">
            {timestamp || ''}
          </span>
        </div>
        <p className="text-[11px] text-[#FFFFFF] leading-relaxed mt-1 truncate-line-clamp">
          {preview.description || ''}
        </p>
        {preview.image && (
          <div className="mt-2 h-24 w-48 rounded-lg overflow-hidden border border-[#27272a]/50">
            <img
              src={preview.image}
              alt={preview.title}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function extractMeta(html: string, property: string): string | null {
  const metaRegex = new RegExp(
    `<meta[^>]*?property=["']${property}["'][^>]*?content=["']([^"']*)["']`,
    'i',
  );
  const match = html.match(metaRegex);
  return match ? match[1] : null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}
