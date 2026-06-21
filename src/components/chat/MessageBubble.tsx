"use client";

import React from "react";
import { cn } from "@/lib/utils";

import { MapPin, Building, Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isSent: boolean;
  status?: string; // 'sent', 'delivered', 'read'
}

export function MessageBubble({ content, timestamp, isSent, status = 'sent' }: MessageBubbleProps) {
  let displayContent = content;
  let taggedListing: { id: string, title: string, price: string, location: string } | null = null;

  // Parse the custom listing tag format: __TAG_LISTING:id|title|price|location__
  const tagMatch = content.match(/__TAG_LISTING:([^|]+)\|([^|]+)\|([^|]+)\|([^_\n]+)__/);
  if (tagMatch) {
    taggedListing = {
      id: tagMatch[1],
      title: tagMatch[2],
      price: tagMatch[3],
      location: tagMatch[4]
    };
    displayContent = content.replace(tagMatch[0], '').trim();
  }

  return (
    <div className={cn("flex w-full mb-4", isSent ? "justify-end" : "justify-start")}>
      <div 
        className={cn(
          "max-w-[85%] md:max-w-[70%] px-4 py-3 rounded-3xl relative shadow-sm flex flex-col gap-2",
          isSent 
            ? "bg-emerald-600 text-white rounded-br-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" 
            : "bg-white/10 backdrop-blur-3xl text-white rounded-bl-md border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
        )}
      >
        
        {/* Render Tagged Listing Card inside the bubble */}
        {taggedListing && (
          <div className={cn(
            "p-3 rounded-xl mb-1 border shadow-sm cursor-pointer hover:opacity-90 transition-opacity",
            isSent 
              ? "bg-emerald-700/50 border-emerald-500/30" 
              : "bg-black/30 border-white/10"
          )}>
            <div className="flex items-center gap-2 mb-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Inquiry Context</span>
            </div>
            <h4 className="font-semibold text-sm leading-tight mb-1">{taggedListing.title}</h4>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1 opacity-70">
                <MapPin className="w-3 h-3" />
                <span className="text-[11px] font-medium">{taggedListing.location}</span>
              </div>
              <span className="text-[11px] font-bold">₹ {taggedListing.price}</span>
            </div>
          </div>
        )}

        {displayContent && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayContent}</p>
        )}
        
        <div className={cn(
          "flex items-center gap-1 mt-1 justify-end",
          isSent ? "text-emerald-100/80" : "text-gray-400/80"
        )}>
          <span className="text-[10px] font-medium">{timestamp}</span>
          {isSent && (
            <span className="flex-shrink-0 ml-0.5">
              {status === 'sent' && <Check className="w-3.5 h-3.5 text-white/90" />}
              {status === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-white/90" />}
              {status === 'read' && <CheckCheck className="w-3.5 h-3.5 text-[#40C4FF] drop-shadow-sm opacity-100" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
