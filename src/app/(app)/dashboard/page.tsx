"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { MarketPulse } from "@/components/dashboard/MarketPulse";
import { AiMatchesGrid } from "@/components/dashboard/AiMatchesGrid";
import { NetworkFeed } from "@/components/dashboard/NetworkFeed";

export default function CommandCenterDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_id", session.user.id)
        .single();

      if (profileData) {
        // Fetch active listings count
        const { count: activeListingsCount } = await supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("broker_id", profileData.id)
          .eq("is_active", true);

        // Fetch active requirements count
        const { count: activeReqsCount } = await supabase
          .from("requirements")
          .select("*", { count: "exact", head: true })
          .eq("broker_id", profileData.id)
          .eq("is_active", true);

        setProfile({
          ...profileData,
          activeListingsCount: activeListingsCount || 0,
          activeReqsCount: activeReqsCount || 0
        });
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="min-h-full p-6 md:p-8 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* Top Header Row: Stats & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-[#121A2F]/50 backdrop-blur-md border border-white/5 p-6 rounded-2xl">
          
          <div className="flex items-center gap-8 md:gap-12">
            <div>
              <p className="text-[10px] text-white/50 tracking-widest font-mono mb-1 uppercase">Active Listings</p>
              <h2 className="text-3xl font-black text-white flex items-end gap-2 leading-none">
                {profile?.activeListingsCount ?? 0} <span className="text-sm font-bold text-[#D4AF37] tracking-wider mb-1">LIVE</span>
              </h2>
            </div>
            <div className="w-px h-12 bg-white/10 hidden md:block"></div>
            <div>
              <p className="text-[10px] text-white/50 tracking-widest font-mono mb-1 uppercase">Your Req. Cards</p>
              <h2 className="text-3xl font-black text-white leading-none">
                {profile?.activeReqsCount ?? 0}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={() => router.push('/post-requirement')}
              className="flex-1 md:flex-none px-6 py-3.5 bg-[#0B1120] border border-white/10 hover:border-white/30 text-white font-bold text-xs tracking-wider uppercase rounded-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] transform hover:-translate-y-0.5"
            >
              Post Requirement
            </button>
            <button 
              onClick={() => router.push('/post-listing')}
              className="flex-1 md:flex-none px-6 py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#FACC15] text-[#0B1120] font-black text-xs tracking-wider uppercase rounded-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.3)] transform hover:-translate-y-0.5"
            >
              Post New Listing +
            </button>
          </div>

        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: AI Matches (66%) */}
          <div className="lg:col-span-2 flex flex-col min-w-0">
            <AiMatchesGrid />
          </div>

          {/* Right Column: Synapse Engine & Network Feed (33%) */}
          <div className="flex flex-col gap-8 shrink-0">
            <MarketPulse />
            <NetworkFeed />
          </div>

        </div>
      </div>
    </div>
  );
}
