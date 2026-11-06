import { Plus, Mic, Send, Smile } from 'lucide-react';

export function ChatInputBar() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-[#0A0A0C] border-t border-[#1C1C1E]">
      {/* Left: Attachment Button */}
      <button
        type="button"
        className="p-2.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800/60 shrink-0"
        title="Attach media"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Central Input Container Pill */}
      <div className="flex-1 flex items-center bg-[#121214] rounded-full px-4 py-2 border border-zinc-800/80 focus-within:border-zinc-600 transition-colors">
        <input
          type="text"
          placeholder="Message…"
          className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none text-sm py-1"
        />

        {/* Emoji Picker Trigger */}
        <button
          type="button"
          className="ml-2 shrink-0 text-zinc-400 hover:text-white transition-colors p-1"
          title="Choose an emoji"
        >
          <Smile className="w-5 h-5" />
        </button>
      </div>

      {/* Right Send / Mic Action Button */}
      <button
        type="button"
        className="p-2.5 rounded-full text-white font-medium transition-all shrink-0 flex items-center justify-center shadow-md"
        className="bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600"
      >
        <Mic className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}