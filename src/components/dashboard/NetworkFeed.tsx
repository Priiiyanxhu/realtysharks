"use client";

import React from "react";
import { Activity } from "lucide-react";
import { FeedItem, FeedItemProps } from "./../ui/FeedItem";

const dummyFeedData: FeedItemProps[] = [
  {
    id: "1",
    type: "match",
    title: "AI Synapse Match",
    description: "Your listing for '4 BHK Sky Villa in Worli' matched with a new requirement from a verified broker.",
    timestamp: "2 mins ago",
    isNew: true,
    users: [
      { name: "Rahul S." },
      { name: "Priyanshu", avatar: "https://i.pravatar.cc/150?u=priyanshu" }
    ]
  },
  {
    id: "2",
    type: "chat",
    title: "New Message Received",
    description: "Anjali Desai sent you a message regarding the 'Commercial Office Space in BKC'.",
    timestamp: "1 hour ago",
    users: [
      { name: "Anjali D." }
    ]
  },
  {
    id: "3",
    type: "deal",
    title: "Deal Closed in Network",
    description: "A major commercial lease was successfully closed in your primary operating zone (South Mumbai).",
    timestamp: "3 hours ago"
  }
];

export function NetworkFeed() {
  return (
    <div className="bg-[#121A2F]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden group flex flex-col h-full min-h-[400px]">
      
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
          {dummyFeedData.map((item) => (
            <FeedItem key={item.id} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}
