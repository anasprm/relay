import React from 'react';
import { Plus } from 'lucide-react';

export function StatusView() {
  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-bold text-white">Status</h2>
      
      {/* My Status Row */}
      <div className="flex items-center gap-3 cursor-pointer">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-semibold">ME</div>
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#25D366] rounded-full flex items-center justify-center text-black border-2 border-black">
            <Plus className="w-3 h-3 font-bold" />
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white">My Status</h4>
          <p className="text-xs text-zinc-400">Click to add status update</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Recent Updates</p>
        <p className="text-xs text-zinc-500 italic">No recent updates from contacts</p>
      </div>
    </div>
  );
}
