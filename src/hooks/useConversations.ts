import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Message } from './useMessages';
import { describeStartChatError, type ChatErrorInfo } from '@/utils/chatErrors';
import { describeClearError, isVisibleAfterClear } from '@/utils/conversationClear';

export type ProfileInfo = {
  id: string;
  full_name: string;
  agency_name: string;
  avatar_url: string;
};

export type Conversation = {
  id: string;
  partnerId: string;
  name: string;
  company: string;
  avatar: string | null;
  lastMessage: string;
  time: string;
  unread: number;
  timestamp: number;
};

export type GetOrCreateConversationResult =
  | { conversationId: string; error: null }
  | { conversationId: null; error: ChatErrorInfo };

export function useConversations(userId: string | null, allMessages: Message[], activeChat: string | null, urlBrokerId: string | null) {
  const [conversationPartners, setConversationPartners] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  // conversation id -> ISO time the user cleared it ("Clear Chat" hides older messages for them only)
  const [clearedAt, setClearedAt] = useState<Record<string, string>>({});

  // 0. Load the user's own clear markers. Tolerant on purpose: if the table does
  // not exist yet (code deployed before the migration) nothing is treated as cleared.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const loadClears = async () => {
      const { data, error } = await supabase
        .from('conversation_clears')
        .select('conversation_id, cleared_at')
        .eq('user_id', userId);
      if (cancelled) return;
      if (error || !data) {
        if (error) console.warn('Could not load cleared chats.', { code: error.code });
        return;
      }
      setClearedAt(Object.fromEntries(data.map((row) => [row.conversation_id as string, row.cleared_at as string])));
    };
    loadClears();
    return () => { cancelled = true; };
  }, [userId]);

  // 1. Fetch conversation partners
  useEffect(() => {
    if (!userId) return;
    const fetchPartners = async () => {
      const { data: convParts } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);

      if (!convParts || convParts.length === 0) return;
      const convIds = convParts.map(cp => cp.conversation_id);

      const { data: allParts } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds)
        .neq('user_id', userId);

      if (allParts) {
        const partnersByConversation: Record<string, string[]> = {};
        allParts.forEach((participant) => {
          const partners = partnersByConversation[participant.conversation_id] || [];
          partners.push(participant.user_id);
          partnersByConversation[participant.conversation_id] = partners;
        });

        const partnersMap: Record<string, string> = {};
        Object.entries(partnersByConversation).forEach(([conversationId, partnerIds]) => {
          // Realtysharks supports direct chat only. Do not represent anomalous
          // conversations with multiple other participants as one-to-one chats.
          if (partnerIds.length === 1) {
            partnersMap[conversationId] = partnerIds[0];
          }
        });
        setConversationPartners(partnersMap);
      }
    };
    fetchPartners();
  }, [userId]);

  // 2. Fetch missing profiles based on partners + urlBrokerId
  useEffect(() => {
    const requiredProfileIds = new Set<string>();
    Object.values(conversationPartners).forEach(id => requiredProfileIds.add(id));
    if (urlBrokerId) requiredProfileIds.add(urlBrokerId);
    
    // Only fetch if there are IDs we don't have yet
    const missingIds = Array.from(requiredProfileIds).filter(id => !profiles[id]);
    if (missingIds.length === 0) return;

    const fetchMissingProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, agency_name, avatar_url')
        .in('id', missingIds);

      if (data) {
        setProfiles(prev => {
          const updated = { ...prev };
          data.forEach(p => { updated[p.id] = p; });
          return updated;
        });
      }
    };

    fetchMissingProfiles();
  }, [conversationPartners, urlBrokerId, profiles]);

  // 3. Mark read timestamp on active chat
  useEffect(() => {
    if (activeChat && !activeChat.startsWith('new-')) {
      localStorage.setItem(`read_timestamp_conv_${activeChat}`, Date.now().toString());
    }
  }, [activeChat, allMessages]); // Update read timestamp whenever messages change and we are focused

  // 4. Derive conversations using useMemo
  const conversations = useMemo(() => {
    if (!userId) return [];

    const latestMessageByConv: Record<string, Message> = {};
    const unreadCountByConv: Record<string, number> = {};

    allMessages.forEach(msg => {
      const convId = msg.conversation_id;
      // Messages the user cleared are hidden from previews and unread counts too.
      if (!isVisibleAfterClear(msg, clearedAt[convId])) return;
      
      if (!latestMessageByConv[convId]) {
        latestMessageByConv[convId] = msg;
      }

      if (msg.sender_id !== userId && activeChat !== convId) {
        const lastRead = localStorage.getItem(`read_timestamp_conv_${convId}`) || '0';
        if (new Date(msg.created_at).getTime() > Number(lastRead)) {
          unreadCountByConv[convId] = (unreadCountByConv[convId] || 0) + 1;
        }
      }
    });

    const inbox = Object.keys(conversationPartners).map(convId => {
      const partnerId = conversationPartners[convId];
      const profile = profiles[partnerId];
      if (!profile) return null;

      const lastMsg = latestMessageByConv[convId];
      
      let previewContent = "New Conversation";
      let timeStr = "Now";
      let timestamp = 0;

      if (!lastMsg && clearedAt[convId]) {
        const clearedDate = new Date(clearedAt[convId]);
        if (!Number.isNaN(clearedDate.getTime())) {
          previewContent = "Chat cleared";
          timeStr = clearedDate.toDateString() === new Date().toDateString()
            ? clearedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : "Yesterday";
          timestamp = clearedDate.getTime();
        }
      }

      if (lastMsg) {
        previewContent = lastMsg.body?.replace(/__TAG_LISTING:.*?__\n?/, '🏙️ Property Inquiry: ') || '';
        const msgDate = new Date(lastMsg.created_at);
        const isToday = msgDate.toDateString() === new Date().toDateString();
        timeStr = isToday ? msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Yesterday";
        timestamp = msgDate.getTime();
      }

      return {
        id: convId,
        partnerId: partnerId,
        name: profile.full_name,
        company: profile.agency_name || "Agent",
        avatar: profile.avatar_url,
        lastMessage: previewContent,
        time: timeStr,
        unread: unreadCountByConv[convId] || 0,
        timestamp: timestamp
      };
    }).filter(Boolean) as Conversation[];

    if (urlBrokerId && !Object.values(conversationPartners).includes(urlBrokerId)) {
      const newProfile = profiles[urlBrokerId];
      if (newProfile) {
        inbox.push({
          id: `new-${urlBrokerId}`,
          partnerId: urlBrokerId,
          name: newProfile.full_name,
          company: newProfile.agency_name || "Agent",
          avatar: newProfile.avatar_url,
          lastMessage: "Start a conversation",
          time: "Now",
          unread: 0,
          timestamp: Number.MAX_SAFE_INTEGER
        });
      }
    }

    inbox.sort((a, b) => b.timestamp - a.timestamp);
    return inbox;
  }, [allMessages, conversationPartners, profiles, activeChat, userId, urlBrokerId, clearedAt]);

  const getOrCreateConversation = useCallback(async (partnerId: string): Promise<GetOrCreateConversationResult> => {
    const { data: conversationId, error } = await supabase.rpc(
      'get_or_create_direct_conversation',
      { p_partner_id: partnerId }
    );

    if (error) {
      console.error('Failed to get or create direct conversation.', { code: error.code });
      return { conversationId: null, error: describeStartChatError(error) };
    }

    if (typeof conversationId !== 'string') {
      console.error('Direct conversation RPC returned an invalid response.');
      return { conversationId: null, error: describeStartChatError(null) };
    }

    setConversationPartners(prev => ({ ...prev, [conversationId]: partnerId }));
    return { conversationId, error: null };
  }, []);

  const clearConversation = useCallback(async (conversationId: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { data, error } = await supabase.rpc('clear_conversation_history', {
      p_conversation_id: conversationId,
    });

    if (error) {
      console.error('Failed to clear conversation.', { code: error.code });
      return { ok: false, error: describeClearError(error) };
    }

    // The server returns its own timestamp; use it so the hide-line matches message times.
    const markedAt = typeof data === 'string' ? data : null;
    if (!markedAt) return { ok: false, error: describeClearError(null) };

    setClearedAt(prev => ({ ...prev, [conversationId]: markedAt }));
    return { ok: true };
  }, []);

  return { conversations, conversationPartners, getOrCreateConversation, clearedAt, clearConversation };
}
