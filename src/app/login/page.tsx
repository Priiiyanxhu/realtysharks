"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { DataInput } from "@/components/ui/DataInput";
import { PremiumButton } from "@/components/ui/PremiumButton";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Login failed. Please check your email for confirmation or credentials.");
      }

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
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during login.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-md p-8 relative overflow-visible">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-emerald-500/20 blur-2xl rounded-full" />
        
        <div className="text-center mb-8 relative z-10">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Realty<span className="text-emerald-500">Sharks</span></h1>
          <p className="text-gray-400 text-sm">Sign in to your Command Center</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6 relative z-10">
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
            <div className="flex items-center justify-between ml-1">
              <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Password</label>
              <Link href="/forgot-password" className="text-xs text-emerald-500 hover:text-emerald-400 font-medium transition-colors">
                Forgot Password?
              </Link>
            </div>
            <DataInput 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <PremiumButton type="submit" disabled={loading} className="w-full py-3.5">
            {loading ? "Authenticating..." : "Sign In"}
          </PremiumButton>
        </form>

        <div className="mt-8 text-center text-sm text-gray-400 relative z-10">
          Not part of the network?{" "}
          <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            Apply for Access
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
