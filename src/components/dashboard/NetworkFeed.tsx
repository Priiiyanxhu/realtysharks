"use client";

import React from "react";
import { Activity } from "lucide-react";

export function NetworkFeed() {
  return (
    <div className="bg-[#121A2F]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
      
      {/* Decorative Gradient Line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-50" />
      
      <div className="flex items-center justify-between mb-6">
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

      <div className="flex flex-col items-center justify-center py-10 text-center px-4 border border-dashed border-white/10 rounded-2xl bg-black/20">
        <Activity className="w-8 h-8 text-white/20 mb-4" />
        <p className="text-xs text-white/60 font-medium uppercase tracking-wider mb-2">Network Feed is Empty</p>
        <p className="text-[10px] text-white/40 max-w-[200px] leading-relaxed">
          No active properties or requests have been broadcasted to your private network yet.
        </p>
      </div>

    </div>
  );
}
