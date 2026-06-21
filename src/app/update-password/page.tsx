"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { DataInput } from "@/components/ui/DataInput";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { LockKeyhole } from "lucide-react";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When a user clicks the recovery link in their email, Supabase automatically 
  // establishes a session securely via the URL fragment hash. 
  // We can immediately check if we have a valid session to allow them to update the password.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // If there's no session, the link might be expired or invalid.
        setError("Invalid or expired recovery link. Please request a new one.");
      }
    });
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      // Password successfully updated! Send them to the dashboard.
      router.push("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-md p-8 relative overflow-visible">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#D4AF37]/10 blur-3xl rounded-full" />
        
        <div className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <LockKeyhole className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter mb-2">Create new password</h1>
          <p className="text-gray-400 text-sm">Please secure your account with a strong password.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center animate-in fade-in slide-in-from-top-2">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">New Password</label>
            <DataInput 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Confirm New Password</label>
            <DataInput 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <PremiumButton type="submit" disabled={loading || !password || !confirmPassword || !!(error && error.includes('Invalid'))} className="w-full py-3.5">
            {loading ? "Updating Security..." : "Secure Account & Enter"}
          </PremiumButton>
        </form>
      </GlassCard>
    </div>
  );
}
