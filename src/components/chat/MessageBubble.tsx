"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { parseListingTag, type ListingTag } from "@/utils/listingTag";

import { MapPin, Building, Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  content: string;
  timestamp: string;
  isSent: boolean;
  status?: string; // 'sent', 'delivered', 'read'
}

/**
 * The "Inquiry Context" card. A link to the listing when `href` is set (it is
 * only ever built by listingHref(), because the id comes from the sender's
 * message text); otherwise plain context with no link affordance. Every field
 * is the sender's text, so long or unbroken values wrap inside the bubble
 * instead of stretching the page.
 */
function ListingCard({ listing, href, isSent }: { listing: ListingTag; href: string | null; isSent: boolean }) {
  const className = cn(
    "block p-3 rounded-xl mb-1 border shadow-sm",
    isSent ? "bg-[#FACC15]/50 border-[#D4AF37]/30" : "bg-black/30 border-white/10",
    href && "hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60"
  );
  const body = (
    <>
      <div className="flex items-center gap-2 mb-1.5">
        <Building className="w-3.5 h-3.5 shrink-0 text-[#D4AF37]" />
        <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">Inquiry Context</span>
        {href && <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">View &rarr;</span>}
      </div>
      <h4 className="font-semibold text-sm leading-tight mb-1 [overflow-wrap:anywhere]">{listing.title}</h4>
      <div className="flex items-center justify-between gap-3 mt-2">
        <div className="flex min-w-0 items-center gap-1 opacity-70">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="min-w-0 text-[11px] font-medium [overflow-wrap:anywhere]">{listing.location}</span>
        </div>
        <span className="min-w-0 text-right text-[11px] font-bold [overflow-wrap:anywhere]">₹ {listing.price}</span>
      </div>
    </>
  );
  return href ? <Link href={href} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}

export function MessageBubble({ content, timestamp, isSent, status = 'sent' }: MessageBubbleProps) {
  const { listing: taggedListing, href: listingLink, text: displayContent } = parseListingTag(content);

  return (
    <div className={cn("flex w-full mb-4", isSent ? "justify-end" : "justify-start")}>
      <div 
        className={cn(
          "max-w-[85%] md:max-w-[70%] px-4 py-3 rounded-3xl relative shadow-sm flex flex-col gap-2",
          isSent 
            ? "bg-[#FACC15] text-white rounded-br-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" 
            : "bg-white/10 backdrop-blur-3xl text-white rounded-bl-md border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
        )}
      >
        
        {taggedListing && <ListingCard listing={taggedListing} href={listingLink} isSent={isSent} />}

        {displayContent && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{displayContent}</p>
        )}
        
        <div className={cn(
          "flex items-center gap-1 mt-1 justify-end",
          isSent ? "text-[#FACC15]/80" : "text-gray-400/80"
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
