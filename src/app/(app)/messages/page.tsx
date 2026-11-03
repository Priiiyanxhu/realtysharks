"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

import { useMessages } from "@/hooks/useMessages";
import { useConversations } from "@/hooks/useConversations";
import { useBlocks } from "@/hooks/useBlocks";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatArea } from "@/components/chat/ChatArea";

function MessagingEngine() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [taggedListing, setTaggedListing] = useState<{ id: string, title: string, price: string, location: string } | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [blockDialog, setBlockDialog] = useState<{ partnerId: string; name: string } | null>(null);
  const [blockDialogError, setBlockDialogError] = useState<string | null>(null);

  // Initialize Session
  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUserId(session.user.id);
    };
    initSession();
  }, []);

  // Use Custom Hooks
  const { allMessages, markMessagesAsRead, sendMessage } = useMessages(userId, activeChat);
  const urlBrokerId = searchParams.get('brokerId');
  const { conversations, getOrCreateConversation } = useConversations(userId, allMessages, activeChat, urlBrokerId);
  const { blockedIds, pendingIds, block, unblock } = useBlocks(userId);

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
    setChatError(null);
    router.replace('/messages', { scroll: false });
  };

  const activeConversation = conversations.find(c => c.id === activeChat);
  const activePartnerId = activeConversation?.partnerId ?? null;
  const isPartnerBlocked = activePartnerId ? blockedIds.has(activePartnerId) : false;
  const isBlockPending = activePartnerId ? pendingIds.has(activePartnerId) : false;

  const handleRequestBlock = () => {
    if (!activeConversation) return;
    setBlockDialogError(null);
    setBlockDialog({ partnerId: activeConversation.partnerId, name: activeConversation.name });
  };

  const handleConfirmBlock = async () => {
    if (!blockDialog) return;
    const result = await block(blockDialog.partnerId);
    if (result.ok) {
      setBlockDialog(null);
      setChatError(null);
    } else {
      setBlockDialogError(result.error);
    }
  };

  const handleUnblock = async () => {
    if (!activePartnerId) return;
    const result = await unblock(activePartnerId);
    if (!result.ok) setChatError(result.error);
  };

  // Resolves true when the message was sent, false when it was not, so the
  // input can hand the text back to the user instead of losing it.
  const handleSendMessage = async (content: string): Promise<boolean> => {
    if (!userId || !activeChat || !content.trim() || !activeConversation) return false;

    setChatError(null);
    const tagToRestore = taggedListing;
    let finalContent = content.trim();

    if (taggedListing) {
      finalContent = `__TAG_LISTING:${taggedListing.id}|${taggedListing.title}|${taggedListing.price}|${taggedListing.location}__\n${finalContent}`;
      setTaggedListing(null);
    }

    let targetConvId = activeChat;
    
    if (activeChat.startsWith('new-')) {
      const { conversationId, error } = await getOrCreateConversation(activeConversation.partnerId);
      if (error) {
        setChatError(error.message);
        setTaggedListing(tagToRestore);
        return false;
      }
      targetConvId = conversationId;
      setActiveChat(targetConvId);
    }

    const result = await sendMessage(targetConvId, finalContent);
    if (!result?.success) {
      setChatError(result?.error ?? "Your message couldn't be sent. Please try again.");
      setTaggedListing(tagToRestore);
      return false;
    }
    return true;
  };

  // On phones the fixed tab bar sits over the bottom of the screen and GlobalLayout's
  // <main> reserves 100px + safe area for it, so this full-height screen ends above it
  // (otherwise the composer is covered). From md up the tab bar is a sidebar.
  return (
    <div className="flex w-full h-[calc(100dvh_-_100px_-_env(safe-area-inset-bottom))] md:h-[100dvh] pt-[calc(env(safe-area-inset-top)+1rem)]">
      <ConversationList 
        conversations={conversations} 
        activeChat={activeChat} 
        onSelectChat={handleSelectChat} 
        isVisible={isMobileListVisible} 
        blockedPartnerIds={blockedIds}
      />
      <ChatArea 
        activeConversation={activeConversation}
        messages={messages}
        userId={userId}
        taggedListing={taggedListing}
        onClearTaggedListing={() => setTaggedListing(null)}
        onSendMessage={handleSendMessage}
        errorMessage={chatError}
        onDismissError={() => setChatError(null)}
        isPartnerBlocked={isPartnerBlocked}
        blockPending={isBlockPending}
        onRequestBlock={handleRequestBlock}
        onUnblock={handleUnblock}
        onBackToMobileList={() => setIsMobileListVisible(true)}
        isVisible={isMobileListVisible}
      />
      <ConfirmDialog
        open={blockDialog !== null}
        tone="danger"
        title={blockDialog ? `Block ${blockDialog.name}?` : "Block this broker?"}
        description={
          <>
            <p>
              Neither of you will be able to send new messages, and they won&apos;t be able to start a new
              conversation with you. Your existing messages stay visible.
            </p>
            <p className="mt-2">They won&apos;t be told you blocked them. You can unblock them any time.</p>
          </>
        }
        confirmLabel="Block"
        busy={blockDialog ? pendingIds.has(blockDialog.partnerId) : false}
        errorMessage={blockDialogError}
        onConfirm={handleConfirmBlock}
        onCancel={() => setBlockDialog(null)}
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
