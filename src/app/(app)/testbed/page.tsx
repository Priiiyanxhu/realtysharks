"use client";

import React from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { DataInput } from "@/components/ui/DataInput";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { PropertyCard } from "@/components/ui/PropertyCard";

export default function ComponentIsolationTestbed() {
  const dummyProperty = {
    title: "Liquid Glass Villa",
    price: "$5,500,000",
    location: "Beverly Hills, CA",
    bhk: "5 BHK",
    imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80",
    isVerified: true
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#0a0f16] to-[#050505] p-6 md:p-12 space-y-16 pb-32 pt-[calc(env(safe-area-inset-top)+2rem)]">
      
      <div className="space-y-2">
        <h1 className="text-3xl font-light text-white tracking-tight">
          Component <span className="font-semibold">Isolation Testbed</span>
        </h1>
        <p className="text-white/50">
          Use your browser dev tools or mobile device to manually verify the iOS 26 Liquid Glass aesthetic and responsive grid behavior.
        </p>
      </div>

      {/* 1. Component Visual Cross-Check */}
      <section className="space-y-6">
        <h2 className="text-xl font-medium text-white border-b border-white/10 pb-2">1. Visual Cross-Check (Liquid Glass & Buttons)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <GlassCard className="p-8 space-y-6">
            <h3 className="text-lg text-white font-semibold">GlassCard Demo</h3>
            <p className="text-sm text-white/60">Notice the heavy backdrop blur, subtle borders, and the hover lift effect with the Emerald border shift when interacting.</p>
            
            <div className="space-y-4 pt-4">
              <DataInput placeholder="Normal Input State" />
              <DataInput placeholder="Error State" error defaultValue="Invalid Entry" />
              <DataInput placeholder="Success State" success defaultValue="Verified Entry" />
            </div>

            <div className="pt-4 flex items-center justify-between">
              <span className="text-white/50 text-sm">Price Formatting:</span>
              <PriceDisplay amount={4500000} />
            </div>

            <PremiumButton className="w-full mt-4">
              Premium Action Button
            </PremiumButton>
          </GlassCard>

          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-tr from-[#D4AF37]/20 to-[#0B1120]/50 p-8 flex items-center justify-center">
            {/* Background texture to make the blur obvious */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1613490908578-f754cb8ceb52?auto=format&fit=crop&w=800&q=80')] opacity-30 bg-cover bg-center mix-blend-overlay"></div>
            
            <GlassCard className="relative z-10 p-6 text-center max-w-sm">
              <p className="text-white font-medium">Drag this or resize to see how beautifully the blur interacts with complex backgrounds in Chrome/Safari.</p>
            </GlassCard>
          </div>

        </div>
      </section>

      {/* 2. Responsive Grid Testing */}
      <section className="space-y-6">
        <h2 className="text-xl font-medium text-white border-b border-white/10 pb-2">2. Responsive Listings Feed Grid</h2>
        <p className="text-sm text-white/50">
          Resize your browser window. This grid should display 4 columns on large desktops, 2 on tablets, and collapse cleanly into 1 column on mobile devices.
        </p>

        {/* 1 col on mobile, 2 cols on md screens, 4 cols on lg screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((item) => (
            <PropertyCard key={item} {...dummyProperty} />
          ))}
        </div>
      </section>

    </div>
  );
}
