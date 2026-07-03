import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  status: string;
  created_at: string;
};

export function useMessages(userId: string | null) {
  const [allMessages, setAllMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!userId) return;

    const fetchInbox = async () => {
      const { data: convParts } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

      if (!convParts || convParts.length === 0) return;
      const convIds = convParts.map(cp => cp.conversation_id);

      const { data: dbMessages } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });
        
      if (dbMessages) setAllMessages(dbMessages as Message[]);
    };

    fetchInbox();

    const channel = supabase
      .channel('public:messages_inbox')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages' 
        }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message;
            setAllMessages((prev) => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [newMsg, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message;
            setAllMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markMessagesAsRead = useCallback(async (unreadIds: string[]) => {
    if (unreadIds.length === 0) return;
    
    // Optimistic update
    setAllMessages(prev => prev.map(m => 
      unreadIds.includes(m.id) ? { ...m, status: 'read' } : m
    ));

    // Database update
    await supabase
      .from('messages')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .in('id', unreadIds);
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
      status: 'sending'
    };

    setAllMessages(prev => [optimisticMessage, ...prev]);

    const { error } = await supabase.from('messages').insert({
      conversation_id: targetConvId,
      sender_id: userId,
      body: content,
    });

    if (error) {
      console.error("Message send failed:", error);
      setAllMessages(prev => prev.filter(m => m.id !== tempId));
      return { success: false, error: error.message };
    } else {
      setAllMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      return { success: true };
    }
  }, [userId]);

  return { allMessages, markMessagesAsRead, sendMessage };
}
