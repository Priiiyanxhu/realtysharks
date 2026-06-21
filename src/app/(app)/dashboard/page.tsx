"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { MarketPulse } from "@/components/dashboard/MarketPulse";
import { AiMatchesGrid } from "@/components/dashboard/AiMatchesGrid";
import { QuickActionsPanel } from "@/components/dashboard/QuickActionsPanel";

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
    <div className="min-h-full p-6 md:p-10 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="max-w-[1400px] mx-auto flex flex-col xl:flex-row gap-10">
        
        {/* Main Content Area (Left, 70%) */}
        <div className="flex-1 space-y-10 min-w-0">
          <MarketPulse />
          <AiMatchesGrid />
        </div>

        {/* Quick Actions Panel (Right, 30%) */}
        <div className="w-full xl:w-[350px] shrink-0">
          <QuickActionsPanel profile={profile} />
        </div>

      </div>
    </div>
  );
}
