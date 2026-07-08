"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

import { useMessages } from "@/hooks/useMessages";
import { useConversations } from "@/hooks/useConversations";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatArea } from "@/components/chat/ChatArea";

function MessagingEngine() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [taggedListing, setTaggedListing] = useState<{ id: string, title: string, price: string, location: string } | null>(null);

  // Initialize Session
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUserId(session.user.id);
    };
    initSession();
  }, []);

  // Use Custom Hooks
  const { allMessages, markMessagesAsRead, sendMessage } = useMessages(userId);
  const urlBrokerId = searchParams.get('brokerId');
  const { conversations, getOrCreateConversation } = useConversations(userId, allMessages, activeChat, urlBrokerId);

  // Derive active messages and mark as read
  const messages = useMemo(() => {
    if (!activeChat || activeChat.startsWith('new-')) return [];
    return allMessages
      .filter(m => m.conversation_id === activeChat)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [allMessages, activeChat]);

  useEffect(() => {
    if (!activeChat || activeChat.startsWith('new-')) return;
    const unreadIds = messages
      .filter(m => m.sender_id !== userId && m.status !== 'read')
      .map(m => m.id)
      .filter(id => !id.startsWith('temp-'));
      
    if (unreadIds.length > 0) {
      markMessagesAsRead(activeChat, unreadIds);
    }
  }, [activeChat, messages, userId, markMessagesAsRead]);

  // URL Params Initialization - Broker
  useEffect(() => {
    const brokerId = searchParams.get('brokerId');
    if (brokerId) {
      const targetChat = conversations.find(c => c.partnerId === brokerId)?.id || `new-${brokerId}`;
      setTimeout(() => {
        setActiveChat(targetChat);
        setIsMobileListVisible(false);
      }, 0);
    }
  }, [searchParams, conversations]);

  // URL Params Initialization - Listing
  useEffect(() => {
    const listingId = searchParams.get('listingId');
    const title = searchParams.get('title');
    const price = searchParams.get('price');
    const location = searchParams.get('location');
    
    if (listingId && title && price && location) {
      setTimeout(() => {
        setTaggedListing({ id: listingId, title, price, location });
      }, 0);
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
    if (!userId || !activeChat || !content.trim() || !activeConversation) return;

    let finalContent = content.trim();

    if (taggedListing) {
      finalContent = `__TAG_LISTING:${taggedListing.id}|${taggedListing.title}|${taggedListing.price}|${taggedListing.location}__\n${finalContent}`;
      setTaggedListing(null);
    }

    let targetConvId = activeChat;
    
    if (activeChat.startsWith('new-')) {
      const newConvId = await getOrCreateConversation(activeConversation.partnerId, userId);
      if (!newConvId) {
        alert("Failed to create conversation");
        return;
      }
      targetConvId = newConvId;
      setActiveChat(targetConvId);
    }

    await sendMessage(targetConvId, finalContent);
  };

  return (
    <div className="flex w-full h-[100dvh] pt-[calc(env(safe-area-inset-top)+1rem)]">
      <ConversationList 
        conversations={conversations} 
        activeChat={activeChat} 
        onSelectChat={handleSelectChat} 
        isVisible={isMobileListVisible} 
      />
      <ChatArea 
        activeConversation={activeConversation}
        messages={messages}
        userId={userId}
        taggedListing={taggedListing}
        onClearTaggedListing={() => setTaggedListing(null)}
        onSendMessage={handleSendMessage}
        onBackToMobileList={() => setIsMobileListVisible(true)}
        isVisible={isMobileListVisible}
      />
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
