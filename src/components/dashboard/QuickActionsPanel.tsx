"use client";

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export function QuickActionsPanel({ profile }: { profile: { role?: string; full_name?: string; avatar_url?: string; agency_name?: string; activeListingsCount?: number; activeReqsCount?: number } | null }) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="sticky top-[calc(env(safe-area-inset-top)+2rem)] space-y-6">
      <GlassCard className="p-6 space-y-6">
        
        {/* Mini Profile */}
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <div className="relative w-14 h-14 rounded-full bg-slate-800 border-2 border-white/10 overflow-hidden shrink-0">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50 text-xs">No Pic</div>
            )}
            
            {/* Verified Badge Icon overlaid on avatar */}
            <div className="absolute -bottom-1 -right-1 bg-[#10B981] rounded-full p-0.5 border-2 border-[#0a0f16]">
              <ShieldCheck className="w-3 h-3 text-[#0a0f16]" />
            </div>
          </div>
          
          <div className="flex flex-col min-w-0">
            <h3 className="text-white font-semibold truncate">{profile?.full_name || "Broker"}</h3>
            <p className="text-xs text-[#D4AF37] font-medium truncate">{profile?.agency_name || "Independent"}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/50">Active Listings</span>
          <span className="font-mono font-bold text-white">{profile?.activeListingsCount ?? 0}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-white/50">Active Requirements</span>
          <span className="font-mono font-bold text-[#D4AF37]">{profile?.activeReqsCount ?? 0}</span>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <PremiumButton onClick={() => router.push('/post-listing')} className="w-full text-sm py-2.5">
            Post Listing
          </PremiumButton>
          <div className="flex gap-2">
            <button onClick={() => router.push('/post-requirement')} className="w-1/2 py-2.5 rounded-lg border border-white/10 text-white/80 font-medium text-[13px] hover:bg-white/5 hover:text-white transition-all">
              Need Property
            </button>
            <button onClick={() => router.push('/profile')} className="w-1/2 py-2.5 rounded-lg border border-[#D4AF37]/20 text-[#D4AF37] font-medium text-[13px] hover:bg-[#D4AF37]/10 transition-all">
              My Profile
            </button>
          </div>
        </div>

      </GlassCard>

      <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full text-white/40 hover:text-red-400 text-sm transition-colors">
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );
}
