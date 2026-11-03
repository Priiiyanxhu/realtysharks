import React from 'react';
import { Search, ChevronLeft, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { Conversation } from '@/hooks/useConversations';
import { Message } from '@/hooks/useMessages';

interface ChatAreaProps {
  activeConversation?: Conversation;
  messages: Message[];
  userId: string | null;
  taggedListing: { id: string; title: string; price: string; location: string } | null;
  onClearTaggedListing: () => void;
  onSendMessage: (content: string) => Promise<boolean | void> | boolean | void;
  errorMessage?: string | null;
  onDismissError?: () => void;
  onBackToMobileList: () => void;
  isVisible: boolean;
}

export function ChatArea({
  activeConversation,
  messages,
  userId,
  taggedListing,
  onClearTaggedListing,
  onSendMessage,
  errorMessage,
  onDismissError,
  onBackToMobileList,
  isVisible
}: ChatAreaProps) {
  return (
    <div 
      className={cn(
        "flex-1 flex flex-col min-w-0 bg-[#050505] relative",
        isVisible && "hidden md:flex" 
      )}
    >
      {activeConversation ? (
        <>
          <div className="md:hidden absolute top-4 left-2 z-40">
             <button onClick={onBackToMobileList} className="p-2 bg-black/50 rounded-full backdrop-blur-md text-white border border-white/10">
               <ChevronLeft className="w-5 h-5" />
             </button>
          </div>
          
          <ChatHeader 
            agentName={activeConversation.name}
            agentCompany={activeConversation.company}
            agentAvatar={activeConversation.avatar || undefined}
            propertyTitle={taggedListing?.title} 
          />
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mb-4 border border-[#D4AF37]/20">
                  <Building className="w-8 h-8 text-[#D4AF37]" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Secure Direct Mandate</h3>
                <p className="text-gray-500 text-sm max-w-sm">
                  This is an end-to-end encrypted channel. Send your inquiry below to initiate the mandate process.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble 
                  key={msg.id}
                  content={msg.body}
                  timestamp={new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  isSent={msg.sender_id === userId}
                  status={msg.status}
                />
              ))
            )}
          </div>
          
          <div className="bg-[#0A0D12] border-t border-white/10">
            {taggedListing && (
              <div className="px-4 py-3 bg-[#D4AF37]/5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#D4AF37]/20 rounded-md flex items-center justify-center border border-[#D4AF37]/30">
                    <Building className="w-4 h-4 text-[#D4AF37]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#D4AF37] uppercase tracking-widest mb-0.5">Tagging Property</p>
                    <p className="text-sm font-medium text-white leading-none">{taggedListing.title} <span className="text-gray-500 font-normal ml-2">₹ {taggedListing.price}</span></p>
                  </div>
                </div>
                <button onClick={onClearTaggedListing} className="text-xs text-gray-400 hover:text-white underline">
                  Remove Tag
                </button>
              </div>
            )}
            {errorMessage && (
              <div
                role="alert"
                className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex items-start justify-between gap-3"
              >
                <p className="text-sm text-red-300">{errorMessage}</p>
                {onDismissError && (
                  <button
                    onClick={onDismissError}
                    className="text-xs text-red-300/80 hover:text-red-200 underline shrink-0"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}
            <ChatInput onSend={onSendMessage} />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-gray-600" />
          </div>
          <p>Select a conversation to start messaging</p>
        </div>
      )}
    </div>
  );
}
