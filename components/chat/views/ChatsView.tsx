import React from 'react';
import { Search } from 'lucide-react';

export function ChatsView() {
  return (
    <div className="p-3 space-y-3">
      {/* Search Bar */}
      <div className="flex items-center bg-[#1C1C1E] rounded-xl px-3 py-2 border border-zinc-800/80">
        <Search className="w-4 h-4 text-zinc-500 mr-2" />
        <input 
          type="text" 
          placeholder="Search chats..." 
          className="bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none w-full"
        />
      </div>

      {/* Chat List Items */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-colors">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-semibold">RA</div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-white truncate">Relay Assistant</h4>
              <span className="text-[10px] text-zinc-500">07:50 PM</span>
            </div>
            <p className="text-xs text-zinc-400 truncate">Hi Alex! How can I help you today?</p>
          </div>
        </div>
      </div>
    </div>
  );
}
