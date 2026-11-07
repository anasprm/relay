import React from 'react';
import { PhoneIncoming, Video } from 'lucide-react';

export function CallsView() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-white">Calls</h2>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-semibold">GC</div>
            <div>
              <h4 className="text-sm font-medium text-white">Glassmorphic UI Systems</h4>
              <div className="flex items-center gap-1 text-xs text-zinc-400">
                <PhoneIncoming className="w-3 h-3 text-[#25D366]" />
                <span>Today, 4:15 PM</span>
              </div>
            </div>
          </div>
          <Video className="w-5 h-5 text-[#25D366]" />
        </div>
      </div>
    </div>
  );
}
