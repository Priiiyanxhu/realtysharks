import { useState, useEffect, useCallback, useRef } from 'react';
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
  const messagesRef = useRef<Message[]>([]);
  const failedReadMessageIdsRef = useRef(new Set<string>());

  useEffect(() => {
    messagesRef.current = allMessages;
  }, [allMessages]);

  useEffect(() => {
    failedReadMessageIdsRef.current.clear();
  }, [activeConversationId]);

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
      .subscribe((status) => {
        if (!active) return;

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime message subscription failed.', { status });
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, userId]);

  const markMessagesAsRead = useCallback(async (conversationId: string, unreadIds: string[]) => {
    if (unreadIds.length === 0) return { success: true } as const;

    const affectedIds = unreadIds.filter(
      (id) => !failedReadMessageIdsRef.current.has(id)
    );

    if (affectedIds.length === 0) {
      return { success: false, error: 'read_receipt_retry_suppressed' } as const;
    }

    const previousValues = new Map(
      messagesRef.current
        .filter((message) => affectedIds.includes(message.id))
        .map((message) => [
          message.id,
          { status: message.status, read_at: message.read_at },
        ])
    );

    // Optimistic update
    setAllMessages(prev => prev.map(m =>
      affectedIds.includes(m.id) ? { ...m, status: 'read', read_at: new Date().toISOString() } : m
    ));

    // Read receipts touch the OTHER user's messages, which the owner-only
    // messages UPDATE policy forbids. Go through the controlled RPC, which
    // marks only received messages in this conversation as read.
    const { error } = await supabase.rpc('mark_conversation_messages_read', {
      p_conversation_id: conversationId,
    });

    if (error) {
      affectedIds.forEach((id) => failedReadMessageIdsRef.current.add(id));
      console.error('Failed to mark conversation messages as read.', { code: error.code });

      setAllMessages((current) => current.map((message) => {
        const previous = previousValues.get(message.id);
        return previous ? { ...message, ...previous } : message;
      }));

      return { success: false, error: 'read_receipt_failed' } as const;
    }

    affectedIds.forEach((id) => failedReadMessageIdsRef.current.delete(id));
    return { success: true } as const;
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
