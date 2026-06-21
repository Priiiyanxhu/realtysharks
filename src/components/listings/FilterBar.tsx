"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { DataInput } from "@/components/ui/DataInput";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import { cn } from "@/lib/utils";

export function FilterBar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isScrolled } = useScrollPosition();

  return (
    <div className={cn(
      "sticky top-[env(safe-area-inset-top)] z-40 w-full transition-all duration-300",
      isScrolled ? "mb-4 pt-2" : "mb-8 pt-0"
    )}>
      {/* Liquid Glass Container */}
      <div className={cn(
        "bg-black/60 border-b border-white/10 transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
        isScrolled ? "backdrop-blur-3xl py-2 px-6 rounded-[2rem] border mx-4" : "backdrop-blur-xl py-4 px-6"
      )}>
        
        {/* Top Row: Search and Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <DataInput 
              placeholder="Search by keywords or locality..." 
              className="pl-10 h-10 bg-white/5 border-white/10 text-sm focus:bg-white/10" 
            />
          </div>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2.5 rounded-lg border transition-all ${
              isExpanded ? "bg-[#D4AF37]/20 border-[#D4AF37]/30 text-[#D4AF37]" : "bg-white/5 border-white/10 text-white/60 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Expanded Advanced Filters */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
            
            {/* Property Type Dropdown */}
            <div className="relative">
              <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1.5 font-semibold">Property Type</label>
              <div className="relative">
                <select className="w-full appearance-none bg-white/5 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 transition-all">
                  <option value="all" className="bg-[#0f1419]">All Types</option>
                  <option value="commercial" className="bg-[#0f1419]">Commercial</option>
                  <option value="residential" className="bg-[#0f1419]">Residential</option>
                  <option value="land" className="bg-[#0f1419]">Land & Plots</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              </div>
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1.5 font-semibold">Status</label>
              <div className="relative">
                <select className="w-full appearance-none bg-white/5 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 transition-all">
                  <option value="all" className="bg-[#0f1419]">Any Status</option>
                  <option value="off-market" className="bg-[#0f1419]">Off-Market</option>
                  <option value="active" className="bg-[#0f1419]">Active Listings</option>
                  <option value="pocket" className="bg-[#0f1419]">Pocket Listings</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              </div>
            </div>

            {/* Budget Range (Min / Max Inputs for Mobile Optimization) */}
            <div className="lg:col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1.5 font-semibold">Budget Range (INR)</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-mono">₹</span>
                  <DataInput type="number" placeholder="Min" className="pl-8 py-2.5 h-auto bg-white/5 border-white/10 font-mono text-sm" />
                </div>
                <span className="text-white/30 text-xs font-semibold">TO</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-mono">₹</span>
                  <DataInput type="number" placeholder="Max" className="pl-8 py-2.5 h-auto bg-white/5 border-white/10 font-mono text-sm" />
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
