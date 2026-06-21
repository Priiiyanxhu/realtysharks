"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "relative overflow-hidden w-full rounded-[2rem] bg-[#0A0D12]/50 backdrop-blur-3xl border border-white/10",
        "shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
        className
      )}
    >
      {/* Shimmer Effect */}
      <div 
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent z-10"
        style={{ animation: 'shimmer 2s infinite' }}
      />

      {/* Image Placeholder */}
      <div className="w-full h-48 bg-white/5" />

      {/* Content Placeholders */}
      <div className="p-5 space-y-4">
        {/* Title & Price */}
        <div className="space-y-3">
          <div className="h-6 w-3/4 bg-white/10 rounded-md" />
          <div className="h-8 w-1/2 bg-emerald-500/10 rounded-md" />
        </div>

        {/* Location & Meta */}
        <div className="flex gap-4 pt-2">
          <div className="h-4 w-20 bg-white/5 rounded-md" />
          <div className="h-4 w-16 bg-white/5 rounded-md" />
        </div>

        {/* Agent Info */}
        <div className="flex items-center gap-3 pt-5 mt-2 border-t border-white/5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 bg-white/10 rounded-md" />
            <div className="h-2 w-16 bg-white/5 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
