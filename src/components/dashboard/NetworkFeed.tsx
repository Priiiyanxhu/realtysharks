"use client";

import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { FeedItem, FeedItemProps } from "./../ui/FeedItem";
import { supabase } from "@/utils/supabase/client";
import { formatDistanceToNow } from "date-fns";

export function NetworkFeed() {
  const [feedData, setFeedData] = useState<FeedItemProps[]>([]);
  const [ticker, setTicker] = useState(0);

  // Force re-render every minute to keep `formatDistanceToNow` live
  useEffect(() => {
    const interval = setInterval(() => setTicker(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // 1. Initial Load of recent items
    const fetchRecent = async () => {
      try {
        const { data: recentListings } = await supabase
          .from('listings')
          .select('id, title, city, created_at, profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(5);

        const { data: recentReqs } = await supabase
          .from('requirements')
          .select('id, property_type, min_budget, max_budget, city, created_at, profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(5);

        const merged: FeedItemProps[] = [];

        if (recentListings) {
          recentListings.forEach(l => {
            merged.push({
              id: `listing-${l.id}`,
              type: 'deal', // We use deal/listing as white
              title: 'New Property Listed',
              description: `${(l.profiles as any)?.full_name || 'A broker'} just listed a ${l.title} in ${l.city || 'their network'}.`,
              timestamp: l.created_at, // store ISO string for live formatting below
              created_at: new Date(l.created_at).getTime(),
              isNew: false,
              href: `/listings/${l.id}`
            } as any);
          });
        }

        if (recentReqs) {
          recentReqs.forEach(r => {
            const formatBudget = (val: number) => {
              if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`;
              return `₹${(val / 100000).toFixed(1)} L`;
            };
            merged.push({
              id: `req-${r.id}`,
              type: 'chat',
              title: 'New Buyer Requirement',
              description: `${(r.profiles as any)?.full_name || 'A broker'} is looking for ${r.property_type || 'property'} in ${r.city || 'India'} (${formatBudget(r.min_budget)} - ${formatBudget(r.max_budget)}).`,
              timestamp: r.created_at, // store ISO string
              created_at: new Date(r.created_at).getTime(),
              isNew: false,
              href: `/network/${r.id}` // Link to the public requirement details
            } as any);
          });
        }

        // Sort by newest first
        merged.sort((a: any, b: any) => b.created_at - a.created_at);
        setFeedData(merged.slice(0, 15)); // Keep last 15
      } catch (err) {
        console.error("Failed to load feed", err);
      }
    };

    fetchRecent();

    // 2. Setup Realtime Subscriptions
    const listingsSub = supabase.channel('feed-listings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'listings' }, (payload) => {
        const newDoc = payload.new as any;
        setFeedData(prev => {
          const newItem: any = {
            id: `rt-listing-${newDoc.id}`,
            type: 'match', // Highlight as new match/action
            title: 'Live Network Activity',
            description: `A new ${newDoc.title || 'property'} was just listed in ${newDoc.city || 'the network'}.`,
            timestamp: new Date().toISOString(),
            isNew: true,
            href: `/listings/${newDoc.id}`,
            created_at: Date.now()
          };
          return [newItem, ...prev].slice(0, 15);
        });
      })
      .subscribe();

    const reqsSub = supabase.channel('feed-requirements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requirements' }, (payload) => {
        const newDoc = payload.new as any;
        setFeedData(prev => {
          const newItem: any = {
            id: `rt-req-${newDoc.id}`,
            type: 'chat',
            title: 'Live Requirement Posted',
            description: `A broker is actively seeking ${newDoc.property_type || 'property'} in ${newDoc.city || 'India'}.`,
            timestamp: new Date().toISOString(),
            isNew: true,
            href: `/network/${newDoc.id}`,
            created_at: Date.now()
          };
          return [newItem, ...prev].slice(0, 15);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(listingsSub);
      supabase.removeChannel(reqsSub);
    };
  }, []);

  return (
    <div className="bg-[#121A2F]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden group flex flex-col h-full min-h-[400px] max-h-[600px]">
      
      {/* Decorative Gradient Line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-50" />
      
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h3 className="text-sm font-bold tracking-widest text-white uppercase flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#D4AF37]" />
          Network Feed
        </h3>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
          </span>
          <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-mono">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 no-scrollbar">
        <div className="space-y-0">
          {feedData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4 border border-dashed border-white/10 rounded-2xl bg-black/20">
              <Activity className="w-8 h-8 text-white/20 mb-4" />
              <p className="text-xs text-white/60 font-medium uppercase tracking-wider mb-2">Connecting to Synapse...</p>
            </div>
          ) : (
            feedData.map((item: any) => (
              <FeedItem 
                key={item.id} 
                {...item} 
                // Re-calculate timestamp dynamically using the ticker
                timestamp={formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })} 
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
