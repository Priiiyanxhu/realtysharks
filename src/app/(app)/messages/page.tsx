"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, Building } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

function MessagingEngine() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);
  
  // All historical messages across all chats
  const [allMessages, setAllMessages] = useState<any[]>([]);
  // Current active chat messages
  const [messages, setMessages] = useState<any[]>([]);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [taggedListing, setTaggedListing] = useState<{ id: string, title: string, price: string, location: string } | null>(null);

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUserId(session.user.id);
    };
    initSession();
  }, []);

  // Fetch Entire Inbox
  useEffect(() => {
    if (!userId) return;

    const fetchInbox = async () => {
      const { data: dbMessages } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });
        
      if (!dbMessages) return;
      setAllMessages(dbMessages);
    };

    fetchInbox();

    // Supabase Realtime Subscription for INBOX
    const channel = supabase
      .channel('public:messages_inbox')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages' 
        }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new;
            if (newMsg.sender_id === userId || newMsg.receiver_id === userId) {
              setAllMessages((prev) => [newMsg, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new;
            if (updatedMsg.sender_id === userId || updatedMsg.receiver_id === userId) {
              setAllMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Build Conversations List from allMessages
  useEffect(() => {
    if (!userId) return;

    const buildConversations = async () => {
      const partnerIds = new Set<string>();
      const latestMessageByPartner: Record<string, any> = {};
      const unreadCountByPartner: Record<string, number> = {};

      // If activeChat is set, update its read timestamp
      if (activeChat) {
        localStorage.setItem(`read_timestamp_${activeChat}`, Date.now().toString());
      }

      allMessages.forEach(msg => {
        const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        partnerIds.add(partnerId);
        
        if (!latestMessageByPartner[partnerId]) {
          latestMessageByPartner[partnerId] = msg;
        }

        // Calculate unread
        if (msg.receiver_id === userId && activeChat !== partnerId) {
          const lastRead = localStorage.getItem(`read_timestamp_${partnerId}`) || '0';
          if (new Date(msg.created_at).getTime() > Number(lastRead)) {
            unreadCountByPartner[partnerId] = (unreadCountByPartner[partnerId] || 0) + 1;
          }
        }
      });

      // Ensure URL broker is in the list even if no messages exist yet
      const urlBrokerId = searchParams.get('brokerId');
      if (urlBrokerId) partnerIds.add(urlBrokerId);

      if (partnerIds.size === 0) return;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, agency_name, avatar_url')
        .in('id', Array.from(partnerIds));

      if (!profiles) return;

      const inbox = profiles.map(profile => {
        const lastMsg = latestMessageByPartner[profile.id];
        
        let previewContent = "New Conversation";
        let timeStr = "Now";
        let timestamp = Date.now();

        if (lastMsg) {
          previewContent = lastMsg.content.replace(/__TAG_LISTING:.*?__\n?/, '🏙️ Property Inquiry: ');
          const msgDate = new Date(lastMsg.created_at);
          const isToday = msgDate.toDateString() === new Date().toDateString();
          timeStr = isToday ? msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Yesterday";
          timestamp = msgDate.getTime();
        }

        return {
          id: profile.id,
          name: profile.full_name,
          company: profile.agency_name || "Agent",
          avatar: profile.avatar_url, // Removed pravatar
          lastMessage: previewContent,
          time: timeStr,
          unread: unreadCountByPartner[profile.id] || 0,
          timestamp: timestamp
        };
      });

      inbox.sort((a, b) => b.timestamp - a.timestamp);
      setConversations(inbox);
    };

    buildConversations();
  }, [allMessages, userId, activeChat, searchParams]);

  // Update active messages and mark as read
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }
    const filtered = allMessages.filter(m => 
      (m.sender_id === userId && m.receiver_id === activeChat) ||
      (m.sender_id === activeChat && m.receiver_id === userId)
    );
    
    // Sort oldest to newest for the chat window
    const sorted = filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setMessages(sorted);

    // Mark messages as read if we received them
    const unreadMessages = sorted.filter(m => m.receiver_id === userId && m.status !== 'read');
    if (unreadMessages.length > 0) {
      const unreadIds = unreadMessages.map(m => m.id).filter(id => !id.startsWith('temp-'));
      
      if (unreadIds.length > 0) {
        // Optimistically update local state so UI reflects it immediately
        setAllMessages(prev => prev.map(m => 
          unreadIds.includes(m.id) ? { ...m, status: 'read' } : m
        ));

        // Update database
        supabase
          .from('messages')
          .update({ status: 'read' })
          .in('id', unreadIds)
          .then(({ error }) => {
            if (error) console.error("Failed to mark messages as read", error);
          });
      }
    }
  }, [activeChat, allMessages, userId]);

  // URL Params Initialization
  useEffect(() => {
    const brokerId = searchParams.get('brokerId');
    const listingId = searchParams.get('listingId');
    const title = searchParams.get('title');
    const price = searchParams.get('price');
    const location = searchParams.get('location');

    if (brokerId) {
      setActiveChat(brokerId);
      setIsMobileListVisible(false);
    }
    if (listingId && title && price && location) {
      setTaggedListing({ id: listingId, title, price, location });
    }
  }, [searchParams]);

  const handleSelectChat = (id: string) => {
    setActiveChat(id);
    setIsMobileListVisible(false);
    setTaggedListing(null);
    router.replace('/messages', { scroll: false });
  };

  const activeConversation = conversations.find(c => c.id === activeChat);

  const handleSendMessage = async (content: string) => {
    if (!userId || !activeChat || !content.trim()) return;

    let finalContent = content.trim();

    if (taggedListing) {
      finalContent = `__TAG_LISTING:${taggedListing.id}|${taggedListing.title}|${taggedListing.price}|${taggedListing.location}__\n${finalContent}`;
      setTaggedListing(null);
    }

    const { error } = await supabase.from('messages').insert({
      sender_id: userId,
      receiver_id: activeChat,
      content: finalContent,
    });

    if (error) {
      console.error("Message send failed:", error);
      alert(`Message failed to send. Database Error: ${error.message}`);
    }
  };

  return (
    <div className="flex w-full h-[100dvh] pt-[calc(env(safe-area-inset-top)+1rem)]">
      
      {/* Sidebar - Conversation List */}
      <div 
        className={cn(
          "w-full md:w-[320px] lg:w-[380px] flex-shrink-0 flex flex-col border-r border-white/10 bg-[#0A0D12]",
          !isMobileListVisible && "hidden md:flex" 
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
                onClick={() => handleSelectChat(chat.id)}
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

      {/* Main Chat Area */}
      <div 
        className={cn(
          "flex-1 flex flex-col min-w-0 bg-[#050505] relative",
          isMobileListVisible && "hidden md:flex" 
        )}
      >
        {activeConversation ? (
          <>
            <div className="md:hidden absolute top-4 left-2 z-40">
               <button onClick={() => setIsMobileListVisible(true)} className="p-2 bg-black/50 rounded-full backdrop-blur-md text-white border border-white/10">
                 <ChevronLeft className="w-5 h-5" />
               </button>
            </div>
            
            <ChatHeader 
              agentName={activeConversation.name}
              agentCompany={activeConversation.company}
              agentAvatar={activeConversation.avatar}
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
                    content={msg.content}
                    timestamp={new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    isSent={msg.sender_id === userId}
                    status={msg.status || 'sent'}
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
                  <button onClick={() => setTaggedListing(null)} className="text-xs text-gray-400 hover:text-white underline">
                    Remove Tag
                  </button>
                </div>
              )}
              <ChatInput onSend={handleSendMessage} />
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

    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="w-8 h-8 border-2 border-[#D4AF37]/20 border-t-[#D4AF37] rounded-full animate-spin"></div>
      </div>
    }>
      <MessagingEngine />
    </Suspense>
  );
}
