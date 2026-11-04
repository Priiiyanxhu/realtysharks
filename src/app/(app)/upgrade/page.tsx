"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { Check, Sparkles, ShieldCheck, Zap, Diamond, ArrowLeft } from "lucide-react";

export default function UpgradePage() {
  const router = useRouter();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleUpgrade = async (tier: string) => {
    setLoadingTier(tier);
    // In a real app, this would trigger Razorpay or Stripe checkout.
    // For now, we simulate a loading state and alert.
    setTimeout(() => {
      alert(`Redirecting to payment gateway for the ${tier} plan...`);
      setLoadingTier(null);
    }, 1500);
  };

  const benefits = [
    "Unlimited Listing & Requirement Posts",
    "Dedicated Relationship Manager",
    "Unlimited Premium Leads",
    "Expert Negotiation Assistance",
    "Instant AI Property Matching",
    "Exclusive Off-Market Project Reach"
  ];

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#D4AF37]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#D4AF37]/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 md:px-10 pt-[calc(env(safe-area-inset-top)+2rem)] relative z-10">
        
        {/* Header */}
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-4 py-1.5 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-widest">RealtySharks Premium</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight mb-4">
            Dominate the <span className="font-bold">Market</span>
          </h1>
          <p className="text-lg text-white/60 font-light">
            Unlock the ultimate institutional broker toolkit. Get unlimited access to deals, exclusive off-market projects, and AI-driven matching.
          </p>
        </div>

        {/* Pricing Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          
          {/* Monthly */}
          <GlassCard className="p-8 flex flex-col relative group hover:border-white/20 transition-colors">
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-2">Monthly</h3>
              <p className="text-sm text-white/50">Perfect for scaling up your deal flow.</p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-light text-white">₹499</span>
              <span className="text-white/40 text-sm"> /mo</span>
            </div>
            <div className="flex-1 space-y-4 mb-8">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#D4AF37] shrink-0" />
                  <span className="text-sm text-white/80">{b}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => handleUpgrade('Monthly')}
              disabled={loadingTier !== null}
              className="w-full py-4 rounded-xl font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            >
              {loadingTier === 'Monthly' ? "Processing..." : "Select Monthly"}
            </button>
          </GlassCard>

          {/* Half Yearly (Most Popular) */}
          <GlassCard className="p-8 flex flex-col relative border-[#D4AF37]/30 transform md:-translate-y-4 shadow-[0_0_40px_rgba(212,175,55,0.15)]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#D4AF37] text-[#0B1120] px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1">
              <Diamond className="w-3 h-3" /> Most Popular
            </div>
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-[#D4AF37] mb-2">Half Yearly</h3>
              <p className="text-sm text-white/50">Save ₹495 over 6 months.</p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-bold text-white">₹2,499</span>
              <span className="text-white/40 text-sm"> /6mo</span>
            </div>
            <div className="flex-1 space-y-4 mb-8">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#D4AF37] shrink-0" />
                  <span className="text-sm text-white/80">{b}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => handleUpgrade('Half Yearly')}
              disabled={loadingTier !== null}
              className="w-full py-4 rounded-xl font-bold bg-[#D4AF37] hover:bg-[#FACC15] text-[#0B1120] transition-colors shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              {loadingTier === 'Half Yearly' ? "Processing..." : "Select Half Yearly"}
            </button>
          </GlassCard>

          {/* Yearly */}
          <GlassCard className="p-8 flex flex-col relative group hover:border-white/20 transition-colors">
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-2">Yearly</h3>
              <p className="text-sm text-white/50">Maximum value for elite brokers. Save ₹1,488.</p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-light text-white">₹4,500</span>
              <span className="text-white/40 text-sm"> /yr</span>
            </div>
            <div className="flex-1 space-y-4 mb-8">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#D4AF37] shrink-0" />
                  <span className="text-sm text-white/80">{b}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => handleUpgrade('Yearly')}
              disabled={loadingTier !== null}
              className="w-full py-4 rounded-xl font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            >
              {loadingTier === 'Yearly' ? "Processing..." : "Select Yearly"}
            </button>
          </GlassCard>

        </div>

        {/* Founder Note */}
        <div className="mt-16 text-center max-w-xl mx-auto">
          <ShieldCheck className="w-8 h-8 text-[#D4AF37]/50 mx-auto mb-4" />
          <p className="text-xs text-white/40 leading-relaxed">
            RealtySharks is a closed, invite-only network. All subscriptions are subject to KYC verification. If your KYC is rejected, your subscription fee will be fully refunded within 5-7 business days. 
          </p>
        </div>

      </div>
    </div>
  );
}
