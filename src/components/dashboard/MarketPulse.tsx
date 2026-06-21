"use client";

import React, { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { GlassCard } from "@/components/ui/GlassCard";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export function MarketPulse() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);

  useEffect(() => {
    let phi = 0;

    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600, // Reduced rendering resolution to 600x600 for performance
      height: 600,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.05, 0.05, 0.05],
      markerColor: [0.06, 0.72, 0.50], // Emerald Green #10B981 equivalent
      glowColor: [0.1, 0.1, 0.15],
      markers: [
        { location: [28.6139, 77.2090], size: 0.08 }, // Delhi
        { location: [19.0760, 72.8777], size: 0.1 },  // Mumbai
        { location: [12.9716, 77.5946], size: 0.08 }, // Bangalore
        { location: [17.3850, 78.4867], size: 0.06 }, // Hyderabad
        { location: [18.5204, 73.8567], size: 0.05 }, // Pune
        { location: [25.2048, 55.2708], size: 0.06 }, // Dubai
        { location: [1.3521, 103.8198], size: 0.04 }, // Singapore
        { location: [51.5074, -0.1278], size: 0.04 }, // London (NRI)
      ],
      onRender: (state: Record<string, any>) => {
        // Called on every animation frame.
        state.phi = phi + pointerInteractionMovement.current;
        phi += 0.003;
      },
    } as any);

    return () => {
      globe.destroy();
    };
  }, []);

  return (
    <GlassCard 
      className="relative overflow-hidden w-full h-[300px] flex items-center justify-between p-6 cursor-pointer hover:border-emerald-500/50 transition-all duration-500 group"
      onClick={() => router.push('/network')}
    >
      
      {/* Metrics Overlay */}
      <div className="relative z-10 flex flex-col justify-between h-full w-1/2">
        <div className="space-y-1 group-hover:-translate-y-1 transition-transform duration-500">
          <h2 className="text-2xl font-light text-white tracking-tight">Market <span className="font-semibold">Pulse</span></h2>
          <p className="text-sm text-white/50">Live Institutional Network</p>
        </div>
        
        <div className="flex gap-8 group-hover:-translate-y-1 transition-transform duration-500 delay-75">
          <div className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">Active Brokers</span>
            <span className="block text-2xl font-mono font-bold text-emerald-500">
              {isLoading ? "..." : activeBrokers.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-white/40 font-semibold">Off-Market Value</span>
            <span className="block text-2xl font-mono font-bold text-emerald-500">
              {isLoading ? "..." : formatValue(offMarketValue)}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Globe Canvas Container */}
      <div 
        className="absolute right-0 top-1/2 -translate-y-1/2 w-[400px] h-[400px] pointer-events-auto opacity-80 mix-blend-screen"
        onPointerDown={(e) => {
          e.stopPropagation();
          pointerInteracting.current = e.clientX;
          if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          pointerInteracting.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          pointerInteracting.current = null;
          if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current += delta / 200;
            pointerInteracting.current = e.clientX;
          }
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            contain: "layout paint size",
            opacity: 1,
            cursor: "grab",
            transition: "opacity 1s ease",
          }}
        />
      </div>
    </GlassCard>
  );
}
