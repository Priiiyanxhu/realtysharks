import React from 'react';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Conversation } from '@/hooks/useConversations';

interface ConversationListProps {
  conversations: Conversation[];
  activeChat: string | null;
  onSelectChat: (id: string) => void;
  isVisible: boolean;
}

export function ConversationList({ conversations, activeChat, onSelectChat, isVisible }: ConversationListProps) {
  return (
    <div 
      className={cn(
        "w-full md:w-[320px] lg:w-[380px] flex-shrink-0 flex flex-col border-r border-white/10 bg-[#0A0D12]",
        !isVisible && "hidden md:flex" 
      )}
    >
      <div className="p-4 border-b border-white/10">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-4">Messages</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search brokers..." 
            className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#D4AF37]/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-20 md:pb-0">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No conversations yet. Inquire about a listing to start chatting!
          </div>
        ) : (
          conversations.map((chat) => (
            <div 
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              className={cn(
                "p-4 flex items-center gap-3 cursor-pointer transition-colors border-b border-white/5 relative",
                activeChat === chat.id ? "bg-white/10" : "hover:bg-white/5"
              )}
            >
              <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-slate-800 flex items-center justify-center">
                {chat.avatar ? (
                  <Image src={chat.avatar} alt={chat.name} fill className="object-cover" unoptimized />
                ) : (
                  <span className="text-white/50 text-xl font-light">{chat.name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <h4 className="font-semibold text-white truncate pr-2">{chat.name}</h4>
                  <span className={cn("text-xs flex-shrink-0", chat.unread > 0 ? "text-[#D4AF37] font-medium" : "text-gray-500")}>
                    {chat.time}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={cn("text-sm truncate pr-4", chat.unread > 0 ? "text-white font-medium" : "text-gray-400")}>
                    {chat.lastMessage}
                  </p>
                  {chat.unread > 0 && (
                    <div className="w-5 h-5 bg-[#D4AF37] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-black">{chat.unread}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
