"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { DataInput } from "@/components/ui/DataInput";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import { cn } from "@/lib/utils";

export type FeedType = "listings" | "requirements" | "both";

export type FilterState = {
  query: string;
  location: string;
  propertyType: string;
  feedType: FeedType;
  budgetMin: string;
  budgetMax: string;
};

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  isLoading?: boolean;
}

export function FilterBar({ filters, onFiltersChange, onClearFilters, isLoading }: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isScrolled } = useScrollPosition();

  const handleChange = (field: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [field]: value });
  };

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
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <DataInput 
              placeholder="Search by keywords..." 
              className="pl-10 h-10 bg-white/5 border-white/10 text-sm focus:bg-white/10" 
              value={filters.query}
              onChange={(e) => handleChange("query", e.target.value)}
              aria-label="Search keywords"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <select 
                value={filters.feedType}
                onChange={(e) => handleChange("feedType", e.target.value as FeedType)}
                aria-label="Feed Type"
                className="appearance-none bg-[#111] border border-white/10 text-white text-sm rounded-lg pl-4 pr-10 py-2.5 outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 transition-all h-10"
              >
                <option value="both">Both</option>
                <option value="listings">Listings Only</option>
                <option value="requirements">Requirements Only</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
            </div>

            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label="Toggle Advanced Filters"
              className={`p-2.5 h-10 rounded-lg border transition-all shrink-0 ${
                isExpanded ? "bg-[#D4AF37]/20 border-[#D4AF37]/30 text-[#D4AF37]" : "bg-white/5 border-white/10 text-white/60 hover:text-white"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded Advanced Filters */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-200 relative">
            
            <div className="relative">
              <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1.5 font-semibold">Location</label>
              <DataInput 
                placeholder="City or locality..." 
                className="bg-white/5 border-white/10 text-sm focus:bg-white/10 py-2.5" 
                value={filters.location}
                onChange={(e) => handleChange("location", e.target.value)}
                aria-label="Location"
              />
            </div>

            <div className="relative">
              <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1.5 font-semibold">Property Type</label>
              <div className="relative">
                <select 
                  value={filters.propertyType}
                  onChange={(e) => handleChange("propertyType", e.target.value)}
                  aria-label="Property Type"
                  className="w-full appearance-none bg-white/5 border border-white/10 text-white text-sm rounded-lg px-4 py-2.5 outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 transition-all"
                >
                  <option value="" className="bg-[#0f1419]">All Types</option>
                  <option value="Commercial" className="bg-[#0f1419]">Commercial</option>
                  <option value="Residential" className="bg-[#0f1419]">Residential</option>
                  <option value="Land" className="bg-[#0f1419]">Land & Plots</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              </div>
            </div>

            {/* Budget Range */}
            <div
              className={
                filters.feedType === "requirements"
                  ? "lg:col-span-2"
                  : "lg:col-span-1"
              }
            >
              <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1.5 font-semibold flex items-center justify-between">
                <span>Budget Range (INR)</span>
                {isLoading && <span className="text-[#D4AF37] text-[10px] uppercase animate-pulse">Loading...</span>}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-mono">₹</span>
                  <DataInput 
                    type="number" 
                    placeholder="Min" 
                    className="pl-8 py-2.5 h-auto bg-white/5 border-white/10 font-mono text-sm" 
                    value={filters.budgetMin}
                    onChange={(e) => handleChange("budgetMin", e.target.value)}
                    aria-label="Minimum Budget"
                  />
                </div>
                <span className="text-white/30 text-xs font-semibold">TO</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-mono">₹</span>
                  <DataInput 
                    type="number" 
                    placeholder="Max" 
                    className="pl-8 py-2.5 h-auto bg-white/5 border-white/10 font-mono text-sm" 
                    value={filters.budgetMax}
                    onChange={(e) => handleChange("budgetMax", e.target.value)}
                    aria-label="Maximum Budget"
                  />
                </div>
              </div>
            </div>

            {/* Clear Filters CTA */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 flex justify-end pt-2">
               <button 
                 onClick={onClearFilters}
                 className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors py-1 px-2 rounded hover:bg-white/5"
               >
                 <X className="w-3 h-3" />
                 Clear Filters
               </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
