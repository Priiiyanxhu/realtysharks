import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  status: string;
  created_at: string;
  read_at: string | null;
};

const messageColumns = 'id, conversation_id, sender_id, body, status, created_at, read_at';

function upsertMessage(messages: Message[], message: Message, tempId?: string) {
  return [
    message,
    ...messages.filter((existing) => existing.id !== message.id && existing.id !== tempId),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function useMessages(userId: string | null, activeConversationId: string | null) {
  const [allMessages, setAllMessages] = useState<Message[]>([]);

  useEffect(() => {
    let cancelled = false;

    setAllMessages([]);
    if (!userId) return () => { cancelled = true; };

    const fetchInbox = async () => {
      const { data: convParts } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

      if (cancelled || !convParts || convParts.length === 0) return;
      const convIds = convParts.map(cp => cp.conversation_id);

      const { data: dbMessages } = await supabase
        .from('messages')
        .select(messageColumns)
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });

      if (!cancelled && dbMessages) {
        setAllMessages((current) => {
          const messagesById = new Map<string, Message>();
          (dbMessages as Message[]).forEach((message) => messagesById.set(message.id, message));
          current.forEach((message) => messagesById.set(message.id, message));
          return Array.from(messagesById.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      }
    };

    fetchInbox();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !activeConversationId || activeConversationId.startsWith('new-')) return;

    let active = true;

    const channel = supabase
      .channel(`messages:${activeConversationId}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        }, 
        (payload) => {
          if (!active) return;

          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            setAllMessages((prev) => upsertMessage(prev, newMsg));
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setAllMessages((prev) => upsertMessage(prev, updatedMsg));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, userId]);

  const markMessagesAsRead = useCallback(async (conversationId: string, unreadIds: string[]) => {
    if (unreadIds.length === 0) return;

    // Optimistic update
    setAllMessages(prev => prev.map(m =>
      unreadIds.includes(m.id) ? { ...m, status: 'read', read_at: new Date().toISOString() } : m
    ));

    // Read receipts touch the OTHER user's messages, which the owner-only
    // messages UPDATE policy forbids. Go through the controlled RPC, which
    // marks only received messages in this conversation as read.
    await supabase.rpc('mark_conversation_messages_read', {
      p_conversation_id: conversationId,
    });
  }, []);

  const sendMessage = useCallback(async (targetConvId: string, content: string) => {
    if (!userId) return null;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: targetConvId,
      sender_id: userId,
      body: content,
      created_at: new Date().toISOString(),
      status: 'sending',
      read_at: null,
    };

    setAllMessages(prev => [optimisticMessage, ...prev]);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: targetConvId,
        sender_id: userId,
        body: content,
      })
      .select(messageColumns)
      .single();

    if (error) {
      console.error("Message send failed:", error);
      setAllMessages(prev => prev.filter(m => m.id !== tempId));
      return { success: false, error: error.message };
    }

    const persistedMessage = data as Message;
    setAllMessages(prev => upsertMessage(prev, persistedMessage, tempId));
    return { success: true };
  }, [userId]);

  return { allMessages, markMessagesAsRead, sendMessage };
}
