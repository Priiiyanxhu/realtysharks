"use client";

import React, { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { MarketSphere } from "@/components/ui/MarketSphere";

export function MarketPulse() {
  const router = useRouter();
  const [activeBrokers, setActiveBrokers] = useState<number>(0);
  const [offMarketValue, setOffMarketValue] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch broker count
        const { count, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        
        if (!countError && count !== null) setActiveBrokers(count);

        // Fetch sum of all listings
        const { data: listings, error: listingsError } = await supabase
          .from('listings')
          .select('price');
        
        if (!listingsError && listings) {
          const total = listings.reduce((sum, listing) => sum + (Number(listing.price) || 0), 0);
          setOffMarketValue(total);
        }
      } catch (err) {
        console.error("Failed to fetch market pulse", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Subscribe to realtime changes
    const profilesChannel = supabase.channel('market_profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchData)
      .subscribe();
      
    const listingsChannel = supabase.channel('market_listings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(listingsChannel);
    };
  }, []);

  // Format currency dynamically (Crores for INR)
  const formatValue = (val: number) => {
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(1)} Cr`;
    } else if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)} L`;
    }
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };



  return (
    <div 
      className="relative overflow-hidden w-full h-[400px] flex flex-col justify-between p-8 cursor-pointer border border-white/5 hover:border-[#D4AF37]/50 bg-[#0B1120] rounded-3xl transition-all duration-500 group shadow-2xl"
      onClick={() => router.push('/network')}
    >
      {/* Decorative scanning line */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity" />

      {/* Top Header */}
      <div className="relative z-10 flex justify-between items-start w-full">
        <div>
          <p className="text-[10px] text-[#D4AF37] font-bold tracking-[0.2em] uppercase mb-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
            Synapse Engine Active
          </p>
          <h2 className="text-2xl font-black text-white tracking-tighter uppercase">RealtySharks Sphere</h2>
        </div>
      </div>
      
      {/* Metrics Overlay (Bottom) */}
      <div className="relative z-10 flex gap-8 group-hover:-translate-y-1 transition-transform duration-500 delay-75 mt-auto pb-4">
        <div className="space-y-1 bg-black/40 backdrop-blur-md p-3 rounded-lg border border-white/5">
          <span className="block text-[9px] uppercase tracking-[0.1em] text-white/40 font-bold">Active Relays</span>
          <span className="block text-xl font-mono font-bold text-[#D4AF37]">
            {isLoading ? "..." : activeBrokers.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="space-y-1 bg-black/40 backdrop-blur-md p-3 rounded-lg border border-white/5">
          <span className="block text-[9px] uppercase tracking-[0.1em] text-white/40 font-bold">Grid Value</span>
          <span className="block text-xl font-mono font-bold text-[#D4AF37]">
            {isLoading ? "..." : formatValue(offMarketValue)}
          </span>
        </div>
      </div>

      {/* Interactive Globe Canvas Container - Pointer events disabled on mobile to prevent scroll hijack.
          Its right edge sits 20% past the card, so it must be at least 120% of the card wide to reach the
          card's left edge (w-[120%]); min-w keeps the original 600px on narrow cards. */}
      <div className="absolute right-[-20%] top-1/2 -translate-y-1/2 w-[120%] min-w-[600px] h-[600px] pointer-events-none md:pointer-events-auto mix-blend-screen overflow-hidden">
        <MarketSphere />
      </div>
    </div>
  );
}
