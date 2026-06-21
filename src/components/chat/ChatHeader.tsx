"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { MoreVertical, Building, User, Flag, Trash2 } from "lucide-react";

export function ChatHeader({ 
  agentName, 
  agentCompany, 
  agentAvatar,
  propertyTitle, 
  propertyId 
}: { 
  agentName: string, 
  agentCompany: string, 
  agentAvatar?: string,
  propertyTitle?: string, 
  propertyId?: string 
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
            <h3 className="font-semibold text-white">{agentName}</h3>
            <p className="text-sm text-emerald-400 flex items-center gap-1">
              <Building className="w-3 h-3" /> {agentCompany}
            </p>
          </div>
        </div>
        
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors focus:outline-none"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-[#0A0D12] border border-white/10 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in zoom-in duration-200">
              <button 
                onClick={() => { alert('View Profile clicked'); setShowMenu(false); }}
                className="w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
              >
                <User className="w-4 h-4" /> View Profile
              </button>
              <button 
                onClick={() => { alert('Report User clicked'); setShowMenu(false); }}
                className="w-full px-4 py-2 text-sm text-left text-orange-400 hover:bg-orange-500/10 flex items-center gap-2 transition-colors"
              >
                <Flag className="w-4 h-4" /> Report User
              </button>
              <div className="h-px bg-white/10 my-1"></div>
              <button 
                onClick={() => { alert('Clear Chat clicked'); setShowMenu(false); }}
                className="w-full px-4 py-2 text-sm text-left text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Clear Chat
              </button>
            </div>
          )}
        </div>
      </div>
      {propertyTitle && (
        <div className="mt-4 px-3 py-2 bg-white/5 rounded-xl border border-white/10 text-sm flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors">
          <span className="text-gray-300">Discussing: <strong className="text-white">{propertyTitle}</strong></span>
          <span className="text-emerald-500 font-medium text-xs uppercase tracking-wider">View Listing &rarr;</span>
        </div>
      )}
    </div>
  );
}
