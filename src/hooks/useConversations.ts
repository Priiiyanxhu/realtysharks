import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Message } from './useMessages';

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

export function useConversations(userId: string | null, allMessages: Message[], activeChat: string | null, urlBrokerId: string | null) {
  const [conversationPartners, setConversationPartners] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});

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
        const partnersMap: Record<string, string> = {};
        allParts.forEach(p => {
          partnersMap[p.conversation_id] = p.user_id;
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
  }, [allMessages, conversationPartners, profiles, activeChat, userId, urlBrokerId]);

  const getOrCreateConversation = useCallback(async (partnerId: string, currentUserId: string): Promise<string | null> => {
    // Attempt to find existing
    const existingConvId = Object.keys(conversationPartners).find(key => conversationPartners[key] === partnerId);
    if (existingConvId) return existingConvId;

    // Create new
    const { data: convData, error: convErr } = await supabase
      .from('conversations')
      .insert({ created_by: currentUserId })
      .select()
      .single();
      
    if (convErr || !convData) return null;
    
    await supabase.from('conversation_participants').insert([
      { conversation_id: convData.id, user_id: currentUserId },
      { conversation_id: convData.id, user_id: partnerId }
    ]);

    setConversationPartners(prev => ({ ...prev, [convData.id]: partnerId }));
    return convData.id;
  }, [conversationPartners]);

  return { conversations, conversationPartners, getOrCreateConversation };
}
