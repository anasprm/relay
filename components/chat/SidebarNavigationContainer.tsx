'use client';

import React, { useState } from 'react';
import { MessageSquare, CircleDot, Users, Phone } from 'lucide-react';

// Import the view components below
import { ChatsView } from './views/ChatsView';
import { StatusView } from './views/StatusView';
import { CommunitiesView } from './views/CommunitiesView';
import { CallsView } from './views/CallsView';

export function SidebarNavigationContainer() {
  // 1. Central Tab State ('chats' | 'status' | 'communities' | 'calls')
  const [activeTab, setActiveTab] = useState<'chats' | 'status' | 'communities' | 'calls'>('chats');

  return (
    <aside className="w-full md:w-[380px] h-full flex flex-col bg-[#0A0A0C] border-r border-[#1C1C1E] text-white select-none">
      
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-[#1C1C1E]">
        <div className="flex items-center gap-2 font-bold text-lg text-[#25D366]">
          <span>Relay</span>
        </div>
        
        {/* Top Header Action Icons (Wired to switch tabs or open modals) */}
        <div className="flex items-center gap-1 text-zinc-400">
          <button 
            onClick={() => setActiveTab('status')} 
            className={`p-2 rounded-full hover:bg-zinc-800/60 transition-colors ${activeTab === 'status' ? 'text-[#25D366]' : ''}`}
            title="Status"
          >
            <CircleDot className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('communities')} 
            className={`p-2 rounded-full hover:bg-zinc-800/60 transition-colors ${activeTab === 'communities' ? 'text-[#25D366]' : ''}`}
            title="Communities"
          >
            <Users className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('calls')} 
            className={`p-2 rounded-full hover:bg-zinc-800/60 transition-colors ${activeTab === 'calls' ? 'text-[#25D366]' : ''}`}
            title="Calls"
          >
            <Phone className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Dynamic Content View Area (Switches based on activeTab) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'chats' && <ChatsView />}
        {activeTab === 'status' && <StatusView />}
        {activeTab === 'communities' && <CommunitiesView />}
        {activeTab === 'calls' && <CallsView />}
      </div>

      {/* Bottom WhatsApp-Style Navigation Bar */}
      <nav className="flex items-center justify-around h-14 bg-[#0A0A0C] border-t border-[#1C1C1E] px-2 shrink-0">
        
        {/* Chats Tab */}
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'chats' ? 'text-[#25D366]' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <MessageSquare className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">Chats</span>
        </button>

        {/* Status Tab */}
        <button
          onClick={() => setActiveTab('status')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'status' ? 'text-[#25D366]' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <CircleDot className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">Status</span>
        </button>

        {/* Communities Tab */}
        <button
          onClick={() => setActiveTab('communities')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'communities' ? 'text-[#25D366]' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">Communities</span>
        </button>

        {/* Calls Tab */}
        <button
          onClick={() => setActiveTab('calls')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'calls' ? 'text-[#25D366]' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Phone className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-medium">Calls</span>
        </button>

      </nav>
    </aside>
  );
}
