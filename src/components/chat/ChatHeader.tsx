"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { MoreVertical, Building, User, Flag, Trash2, Ban, UserCheck } from "lucide-react";
import { listingHref } from "@/utils/listingLink";

export function ChatHeader({ 
  agentName, 
  agentCompany, 
  agentAvatar,
  propertyTitle, 
  propertyId,
  isBlocked = false,
  blockPending = false,
  onBlock,
  onUnblock,
  onViewProfile,
  onReport,
  onClearChat,
  canClearChat = true,
}: { 
  agentName: string, 
  agentCompany: string, 
  agentAvatar?: string,
  propertyTitle?: string, 
  propertyId?: string,
  /** True when the signed-in user has blocked this broker. */
  isBlocked?: boolean,
  blockPending?: boolean,
  onBlock?: () => void,
  onUnblock?: () => void,
  onViewProfile?: () => void,
  onReport?: () => void,
  onClearChat?: () => void,
  /** False when there is no conversation yet (nothing to clear). */
  canClearChat?: boolean,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const listingLink = listingHref(propertyId);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The menu item unmounts when the menu closes, so hand focus to the ⋯ button
  // first: the confirm dialog then returns focus there when it closes.
  const closeMenuAndRun = (action?: () => void) => {
    setShowMenu(false);
    triggerRef.current?.focus();
    action?.();
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col border-b border-white/10 bg-black/20 backdrop-blur-3xl p-4 sticky top-0 z-30 shadow-[inset_0_-1px_1px_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full bg-slate-800 overflow-hidden border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
            {agentAvatar ? (
              <Image src={agentAvatar} alt={agentName} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50 text-xl font-light">
                {agentName.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              {agentName}
              {isBlocked && (
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                  Blocked
                </span>
              )}
            </h3>
            <p className="text-sm text-[#D4AF37] flex items-center gap-1">
              <Building className="w-3 h-3" /> {agentCompany}
            </p>
          </div>
        </div>
        
        <div className="relative" ref={menuRef}>
          <button 
            ref={triggerRef}
            onClick={() => setShowMenu(!showMenu)}
            aria-label={`Conversation options for ${agentName}`}
            aria-haspopup="menu"
            aria-expanded={showMenu}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <div role="menu" className="absolute right-0 mt-2 w-56 bg-[#0A0D12] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in duration-200">
              <button 
                role="menuitem"
                disabled={!onViewProfile}
                onClick={() => closeMenuAndRun(onViewProfile)}
                className="w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <User className="w-4 h-4" /> View Profile
              </button>
              {isBlocked ? (
                <button
                  role="menuitem"
                  disabled={blockPending || !onUnblock}
                  onClick={() => closeMenuAndRun(onUnblock)}
                  className="w-full px-4 py-2 text-sm text-left text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <UserCheck className="w-4 h-4" /> Unblock {agentName}
                </button>
              ) : (
                <button
                  role="menuitem"
                  disabled={blockPending || !onBlock}
                  onClick={() => closeMenuAndRun(onBlock)}
                  className="w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Ban className="w-4 h-4" /> Block {agentName}
                </button>
              )}
              <button 
                role="menuitem"
                disabled={!onReport}
                onClick={() => closeMenuAndRun(onReport)}
                className="w-full px-4 py-2 text-sm text-left text-orange-400 hover:bg-orange-500/10 flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Flag className="w-4 h-4" /> Report User
              </button>
              <div className="h-px bg-white/10 my-1"></div>
              <button 
                role="menuitem"
                disabled={!onClearChat || !canClearChat}
                onClick={() => closeMenuAndRun(onClearChat)}
                className="w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Clear Chat
              </button>
            </div>
          )}
        </div>
      </div>
      {propertyTitle && (listingLink ? (
        <Link
          href={listingLink}
          className="mt-4 px-3 py-2 bg-white/5 rounded-xl border border-white/10 text-sm flex items-center justify-between gap-3 hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/60"
        >
          <span className="text-gray-300 min-w-0 line-clamp-1 [overflow-wrap:anywhere]">Discussing: <strong className="text-white">{propertyTitle}</strong></span>
          <span className="shrink-0 text-[#D4AF37] font-medium text-xs uppercase tracking-wider">View Listing &rarr;</span>
        </Link>
      ) : (
        // No valid listing id (e.g. a hand-edited URL): show the context, offer no link.
        <div className="mt-4 px-3 py-2 bg-white/5 rounded-xl border border-white/10 text-sm">
          <span className="text-gray-300 block line-clamp-1 [overflow-wrap:anywhere]">Discussing: <strong className="text-white">{propertyTitle}</strong></span>
        </div>
      ))}
    </div>
  );
}
