"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { DataInput } from "@/components/ui/DataInput";
import { PremiumButton } from "@/components/ui/PremiumButton";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // Check if onboarding is complete by fetching profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("onboarded")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!profile || !profile.onboarded) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      } else {
        throw new Error("Failed to create account.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during registration.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-md p-8 relative overflow-visible">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#D4AF37]/10 blur-3xl rounded-full" />
        
        <div className="text-center mb-8 relative z-10">
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#D4AF37] uppercase mb-4 block">B2B Real Estate OS</span>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-2">Apply for <span className="text-[#D4AF37]">Access</span></h1>
          <p className="text-gray-400 text-sm tracking-wide">Join the exclusive broker network.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Work Email</label>
            <DataInput 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="broker@agency.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Secure Password</label>
            <DataInput 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <PremiumButton type="submit" disabled={loading} className="w-full py-3.5">
            {loading ? "Creating Account..." : "Continue to KYC"}
          </PremiumButton>
        </form>

        <div className="mt-8 text-center text-sm text-gray-400 relative z-10 font-medium tracking-wide">
          Already part of the network?{" "}
          <Link href="/login" className="text-[#D4AF37] hover:text-[#FACC15] font-bold transition-colors">
            Sign In
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
