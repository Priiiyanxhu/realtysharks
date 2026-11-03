"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

import { useMessages } from "@/hooks/useMessages";
import { useConversations } from "@/hooks/useConversations";
import { useBlocks } from "@/hooks/useBlocks";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReportUserDialog } from "@/components/chat/ReportUserDialog";
import { reportUser, type ReportOutcome } from "@/utils/userReports";
import { filterClearedMessages } from "@/utils/conversationClear";
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
  const [reportTarget, setReportTarget] = useState<{ partnerId: string; name: string; conversationId: string | null } | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearDialogError, setClearDialogError] = useState<string | null>(null);
  const [clearPending, setClearPending] = useState(false);

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
  const { conversations, getOrCreateConversation, clearedAt, clearConversation } = useConversations(userId, allMessages, activeChat, urlBrokerId);
  const { blockedIds, pendingIds, block, unblock } = useBlocks(userId);

  // Derive active messages and mark as read
  const messages = useMemo(() => {
    if (!activeChat || activeChat.startsWith('new-')) return [];
    // "Clear Chat" hides the messages from before the clear, for this user only.
    return filterClearedMessages(
      allMessages.filter(m => m.conversation_id === activeChat),
      clearedAt[activeChat]
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [allMessages, activeChat, clearedAt]);

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

  const hasSavedConversation = !!activeChat && !activeChat.startsWith('new-');

  const handleViewProfile = () => {
    if (activePartnerId) router.push(`/network/${activePartnerId}`);
  };

  const handleRequestReport = () => {
    if (!activeConversation) return;
    setReportTarget({
      partnerId: activeConversation.partnerId,
      name: activeConversation.name,
      conversationId: hasSavedConversation ? activeChat : null,
    });
  };

  const handleSubmitReport = async (values: { reason: string; details: string; alsoBlock: boolean }): Promise<ReportOutcome & { extraNote?: string }> => {
    if (!reportTarget) return { kind: 'error', message: "We couldn't send your report. Please try again." };
    const outcome = await reportUser(supabase, {
      reportedId: reportTarget.partnerId,
      reason: values.reason,
      details: values.details,
      conversationId: reportTarget.conversationId,
    });
    if ((outcome.kind === 'created' || outcome.kind === 'duplicate') && values.alsoBlock) {
      const blocked = await block(reportTarget.partnerId);
      return {
        ...outcome,
        extraNote: blocked.ok
          ? `${reportTarget.name} has also been blocked.`
          : `We couldn't block ${reportTarget.name} just now. You can block them from the chat menu.`,
      };
    }
    return outcome;
  };

  const handleRequestClear = () => {
    if (!hasSavedConversation) return;
    setClearDialogError(null);
    setClearDialogOpen(true);
  };

  const handleConfirmClear = async () => {
    if (!activeChat || !hasSavedConversation) return;
    setClearPending(true);
    const result = await clearConversation(activeChat);
    setClearPending(false);
    if (result.ok) setClearDialogOpen(false);
    else setClearDialogError(result.error);
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
  //
  // `w-0 min-w-full` rather than `w-full`: GlobalLayout's <main> is a flex item whose
  // minimum width is its content's, so a long message preview (the list truncates with
  // nowrap) or an unbroken message body would stretch <main> past the screen and push
  // the menu, Send button and time stamps off it. A zero-width box that is at least
  // 100% wide contributes nothing to that minimum yet still fills the screen.
  return (
    <div className="flex w-0 min-w-full h-[calc(100dvh_-_100px_-_env(safe-area-inset-bottom))] md:h-[100dvh] pt-[calc(env(safe-area-inset-top)+1rem)]">
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
        onViewProfile={handleViewProfile}
        onReport={handleRequestReport}
        onClearChat={handleRequestClear}
        canClearChat={hasSavedConversation}
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
      <ConfirmDialog
        open={clearDialogOpen}
        tone="danger"
        title="Clear this chat?"
        description={
          <>
            <p>
              This hides the current messages from <strong>your</strong> view only.{" "}
              {activeConversation?.name ?? "The other broker"} still sees them, and new messages appear as usual.
            </p>
          </>
        }
        confirmLabel="Clear chat"
        busy={clearPending}
        errorMessage={clearDialogError}
        onConfirm={handleConfirmClear}
        onCancel={() => setClearDialogOpen(false)}
      />
      <ReportUserDialog
        open={reportTarget !== null}
        partnerName={reportTarget?.name ?? ""}
        hasConversation={!!reportTarget?.conversationId}
        canOfferBlock={!!reportTarget && !blockedIds.has(reportTarget.partnerId)}
        onSubmit={handleSubmitReport}
        onClose={() => setReportTarget(null)}
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
