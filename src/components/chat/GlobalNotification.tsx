"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { MessageSquare, X } from "lucide-react";

interface NotificationData {
  id: string;
  senderId: string;
  title: string;
  avatar: string;
  body: string;
}

export function NotificationEngine() {
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setUserId(session.user.id);
    };
    initSession();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('global_notifications')
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages' 
        }, 
        async (payload) => {
          const newMsg = payload.new;
          
          // Only notify if we are the receiver
          if (newMsg.receiver_id === userId) {
            
            // Check if we are currently looking at this chat
            const isMessagesPage = pathname === '/messages';
            const currentActiveBroker = searchParams?.get('brokerId'); // if using URL
            // In our current implementation, activeChat is internal state in /messages/page.tsx
            // But if we are on /messages, we might be looking at it.
            // Let's assume if we are on /messages, we rely on the inbox counter, UNLESS we want to be safe.
            // Let's just show it if we are NOT on /messages, OR we are on /messages but it's a different person.
            // Actually, for simplicity and guaranteed visibility, show it always unless we know for sure.
            
            // Mark as delivered in the database since it reached our device!
            if (newMsg.status === 'sent' || !newMsg.status) {
              supabase.from('messages').update({ status: 'delivered' }).eq('id', newMsg.id).then();
            }

            // Fetch sender details
            const { data: sender } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .single();

            if (sender) {
              const preview = newMsg.content.replace(/__TAG_LISTING:.*?__\n?/, '🏙️ Property Inquiry: ');
              
              setNotification({
                id: newMsg.id,
                senderId: sender.id,
                title: sender.full_name,
                avatar: sender.avatar_url || `https://i.pravatar.cc/150?u=${sender.id}`,
                body: preview
              });

              // Play a sound
              try {
                const audio = new Audio('/notification.mp3'); // We'll assume they have a sound or it fails silently
                audio.play().catch(() => {});
              } catch(e) {}

              // Auto dismiss
              setTimeout(() => {
                setNotification((prev: NotificationData | null) => prev?.id === newMsg.id ? null : prev);
              }, 5000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, pathname, searchParams]);

  if (!notification) return null;

  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none animate-in slide-in-from-top-10 fade-in duration-300">
      <div 
        onClick={() => {
          setNotification(null);
          router.push(`/messages?brokerId=${notification.senderId}`);
        }}
        className="w-full max-w-sm bg-[#1A1D21] border border-white/10 rounded-2xl shadow-2xl p-4 flex items-start gap-4 cursor-pointer pointer-events-auto hover:bg-[#22262A] transition-colors"
      >
        <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-slate-800 border border-white/10">
          <Image src={notification.avatar} alt="Sender" fill className="object-cover" unoptimized />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-white text-sm truncate">{notification.title}</h4>
            <span className="text-[10px] text-[#D4AF37] font-bold bg-[#D4AF37]/10 px-1.5 py-0.5 rounded uppercase tracking-wider">New</span>
          </div>
          <p className="text-gray-400 text-sm truncate">{notification.body}</p>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setNotification(null);
          }}
          className="p-1 text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function GlobalNotification() {
  return (
    <React.Suspense fallback={null}>
      <NotificationEngine />
    </React.Suspense>
  );
}
