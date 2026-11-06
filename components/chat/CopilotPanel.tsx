'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Copy,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/lib/types';
import { ChatInputBar } from './ChatInputBar';

const SYSTEM_WELCOME =
  "Hello! I'm your Relay AI assistant. How can I help you today?";

interface CopilotPanelProps {
  activeConversation: Conversation | null;
  messages: Message[];
  onSummarize?: () => void;
  onExtractTasks?: () => void;
  open: boolean;
  onClose: () => void;
  onToggle?: () => void;
}

interface AIMessage {
  role: 'user' | 'assistant';
  text: string;
  streaming?: boolean;
}

/** Mini markdown renderer: headings, bullets, fenced code blocks, inline code, bold. */
function renderAiText(text: string, keyPrefix: string) {
  const blocks = text.split(/```/);
  return (
    <>
      {blocks.map((block, i) => {
        if (i % 2 === 1) {
          const firstNewline = block.indexOf('\n');
          const lang = firstNewline >= 0 ? block.slice(0, firstNewline) : '';
          const code =
            firstNewline >= 0 ? block.slice(firstNewline + 1) : block;
          return (
            <div
              key={i}
              className="my-1 overflow-x-auto rounded-lg border border-white/10 bg-black/50 p-2"
            >
              <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-t-lg bg-black/30 text-[10px] text-muted border-b border-white/10">
                <span className="font-mono">{lang || 'text'}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(code.replace(/\n$/, ''));
                  }}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  title="Copy code"
                  aria-label="Copy code"
                >
                  <Copy size={12} />
                </button>
              </div>
              <pre
                className="overflow-x-auto p-2 text-[11px] leading-relaxed text-[#E5E5E7] font-mono whitespace-pre break-words"
              >
                <code>{code.replace(/\n$/, '')}</code>
              </pre>
            </div>
          );
        }
        return (
          <React.Fragment key={i}>
            {block.split('\n').map((line, li) => {
              const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
              if (heading) {
                const level = heading[1].length;
                return (
                  <div
                    key={li}
                    className={cn(
                      'mt-2 mb-1 font-semibold uppercase tracking-wide',
                      level === 1
                        ? 'text-[#25D366] text-[12px]'
                        : 'text-[#a78bfa] text-[11px]',
                    )}
                  >
                    {heading[2].replace(/\*\*/g, '')}
                  </div>
                );
              }
              const bullet = line.match(/^\s*[-*]\s+(.*)$/);
              if (bullet) {
                return (
                  <div key={li} className="flex gap-1.5">
                    <span className="text-[#25D366]">•</span>
                    <span className="min-w-0">
                      {renderInline(bullet[1], `${keyPrefix}-${li}`)}
                    </span>
                  </div>
                );
              }
              return (
                <div key={li} className="min-w-0">
                  {renderInline(line, `${keyPrefix}-${li}`)}
                </div>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`\n]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-[#FFFFFF]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} className="rounded bg-black/50 px-1 py-0.5 text-[11px] text-[#E5E5E7]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

export function CopilotPanel({
  activeConversation,
  messages,
  onSummarize,
  onExtractTasks,
  open,
  onClose,
  onToggle,
}: CopilotPanelProps) {
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([
    { role: 'assistant', text: SYSTEM_WELCOME },
  ]);
  const [loading, setLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [tasks, setTasks] = useState<string[]>([]);

  // Auto-scroll to bottom during streaming unless user scrolls up.
  const isAtBottomRef = useRef(true);
  const handleScroll = useCallback(() => {
    const el = aiScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAtBottomRef.current = nearBottom;
  }, []);

  useEffect(() => {
    const el = aiScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const el = aiScrollRef.current;
    if (el && isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [aiMessages, loading]);

  const handleSummarize = useCallback(() => {
    if (!onSummarize) return;
    setLoading(true);
    onSummarize();
    setTimeout(() => {
      setSummary(
        'Key discussion points: Glassmorphic UI architecture, WebRTC scaling, and Vercel deployment readiness.',
      );
      setTasks([
        'Review deployment logs on Vercel production dashboard',
        'Verify cryptographic watermarking on shared media assets',
      ]);
      setLoading(false);
    }, 1000);
  }, [onSummarize]);

  const handleExtractTasks = useCallback(() => {
    if (!onExtractTasks) return;
    setLoading(true);
    onExtractTasks();
    setTimeout(() => {
      setTasks([
        'Review deployment logs',
        'Verify cryptographic watermarking',
        'Update API documentation',
      ]);
      setSummary('Extracted actionable tasks from thread messages.');
      setLoading(false);
    }, 1000);
  }, [onExtractTasks]);

  const handleAiSend = useCallback(async () => {
    const text = aiInput.trim();
    if (!text) return;
    setAiMessages((prev) => [...prev, { role: 'user', text }]);
    setAiInput('');
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => null)) ?? {};
      const aiText =
        data?.response ||
        data?.error ||
        "I'm having trouble responding right now. Please try again.";
      setAiMessages((prev) => [...prev, { role: 'assistant', text: aiText }]);
    } catch (error) {
      const timedOut =
        error instanceof DOMException && error.name === 'AbortError';
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: timedOut
            ? 'That took longer than expected. Please try again.'
            : "I can't reach the AI service right now.",
        },
      ]);
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [aiInput]);

  const canToggle = onToggle ? 'md:hidden' : 'hidden';

  if (!open) return null;

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden bg-[#0A0A0C]',
        canToggle,
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#2A2A2C] bg-[#0A0A0C]/30 px-4 z-10">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-r from-[#25D366] to-[#1E9E52] flex items-center justify-center text-white text-[10px] font-bold">
            AI
          </div>
          <span className="font-semibold text-sm text-[#FFFFFF]">Relay AI</span>
        </div>
        <div className="flex items-center gap-1">
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors"
              aria-label="Collapse AI panel"
              title="Collapse"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {!onToggle && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8E8E93] hover:bg-[#2A2A2C] hover:text-[#FFFFFF] transition-colors"
              aria-label="Close AI copilot"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={aiScrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3 relay-will-change-scroll relay-anti-smear"
        onScroll={handleScroll}
      >
        {aiMessages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[82%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap break-words',
              msg.role === 'user'
                ? 'ml-auto bg-[#25D366] text-[#FFFFFF] rounded-tr-none'
                : 'mr-auto bg-[#1C1C1E] border border-[#2A2A2C] text-[#FFFFFF] rounded-tl-none',
            )}
          >
            {msg.role === 'assistant' ? (
              <div>
                {renderAiText(msg.text, `ai-${i}`)}
              </div>
            ) : (
              msg.text
            )}
          </div>
        ))}
        {loading && (
          <div className="mr-auto flex items-center gap-1.5 rounded-xl rounded-tl-none border border-[#2A2A2C] bg-[#1C1C1E] px-3 py-2">
            <span className="h-1.5 w-1.5 relay-animate-typing-bounce rounded-full bg-[#25D366] [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 relay-animate-typing-bounce rounded-full bg-[#25D366] [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 relay-animate-typing-bounce rounded-full bg-[#25D366]" />
            <span className="ml-1 text-[10px] text-[#8E8E93]">
              Relay AI is thinking…
            </span>
          </div>
        )}
      </div>

      {/* Active Conversation Brief */}
      <div className="shrink-0 border-t border-[#2A2A2C] bg-[#0F0F11] p-3 overflow-y-auto max-h-[38%]">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#FFFFFF]">
            Active Conversation Brief
          </h3>
        </div>
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
                <span className="font-medium text-[#FFFFFF]">Summary:</span>{' '}
                {summary}
              </div>
            </div>
            {tasks.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-[#8E8E93] mb-1">
                  Action Items:
                </p>
                <ul className="space-y-1">
                  {tasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#FFFFFF]">
                      <span className="h-3 w-3 shrink-0">
                        <CheckMark size={12} />
                      </span>
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
                <span className="font-medium text-[#FFFFFF]">Summary:</span>{' '}
                Active discussion on Relay glassmorphic architecture and
                WebRTC scaling.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 rounded-full bg-[#25D366] mt-1" />
              <div className="text-xs text-[#8E8E93] leading-relaxed">
                <span className="font-medium text-[#FFFFFF]">Action Items:</span>{' '}
                Review deployment logs on Vercel production dashboard.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="h-2 w-2 rounded-full bg-[#25D366] mt-1" />
              <div className="text-xs text-[#8E8E93] leading-relaxed">
                <span className="font-medium text-[#FFFFFF]">Urgency:</span>{' '}
                Medium — respond within 24 hours.
              </div>
            </div>
          </div>
        ) : null}
        {!loading && !activeConversation ? (
          <div className="text-xs text-[#8E8E93] italic">
            Select a conversation to see AI-powered insights.
          </div>
        ) : null}
      </div>

      {/* Quick actions: Summarize / Extract tasks */}
      <div className="flex shrink-0 gap-1 border-t border-[#2A2A2C] bg-[#0F0F11] px-3 py-2">
        <button
          onClick={handleSummarize}
          disabled={loading}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all',
            loading
              ? 'cursor-not-allowed bg-[#1C1C1E] text-[#8E8E93]'
              : 'bg-[#2A2A2C]/70 text-[#25D366] hover:bg-[#2A2A2C]',
          )}
        >
          Summarize
        </button>
        <button
          onClick={handleExtractTasks}
          disabled={loading}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all',
            loading
              ? 'cursor-not-allowed bg-[#1C1C1E] text-[#8E8E93]'
              : 'bg-[#2A2A2C]/70 text-[#25D366] hover:bg-[#2A2A2C]',
          )}
        >
          Extract tasks
        </button>
      </div>

      {/* Composer — pinned at bottom with safe area */}
      <div className="shrink-0 border-t border-[#2A2A2C] bg-[#0A0A0C] p-2 relay-pb-safe">
        <ChatInputBar />
      </div>

      <div className="shrink-0 px-4 py-2">
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

function CheckMark({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
