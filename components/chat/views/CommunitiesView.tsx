import React from 'react';
import { Users, ChevronRight } from 'lucide-react';

export function CommunitiesView() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-white">Communities</h2>
      
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1C1C1E]/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-800/60 transition-colors">
        <div className="w-12 h-12 rounded-xl bg-[#25D366]/20 text-[#25D366] flex items-center justify-center shrink-0">
          <Users className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white">New Community</h4>
          <p className="text-xs text-zinc-400 truncate">Bring groups together</p>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-500" />
      </div>
    </div>
  );
}
