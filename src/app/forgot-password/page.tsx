"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { DataInput } from "@/components/ui/DataInput";
import { PremiumButton } from "@/components/ui/PremiumButton";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { MailCheck, ArrowLeft } from "lucide-react";

function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkError =
    searchParams.get("error") === "invalid_link"
      ? "That recovery link is invalid or has expired. Please request a new one."
      : null;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // The recovery link lands on /auth/callback, which exchanges the code for
      // a session cookie and then forwards to /update-password.
      const redirectUrl = `${window.location.origin}/auth/callback?next=/update-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError((err instanceof Error ? err.message : String(err)) || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-md p-8 relative overflow-visible">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-32 h-32 bg-[#D4AF37]/10 blur-3xl rounded-full" />
        
        <Link href="/login" className="absolute top-8 left-8 text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="text-center mb-8 mt-6 relative z-10">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Reset Password</h1>
          <p className="text-gray-400 text-sm">We&apos;ll send you a secure recovery link.</p>
        </div>

        {(error ?? linkError) && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center animate-in fade-in slide-in-from-top-2">
            {error ?? linkError}
          </div>
        )}

        {success ? (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="w-16 h-16 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Check your inbox</h2>
              <p className="text-gray-400 text-sm">
                We&apos;ve sent a secure recovery link to <strong>{email}</strong>. 
                Please click the link in the email to set a new password.
              </p>
            </div>
            <PremiumButton onClick={() => router.push("/login")} className="w-full">
              Return to Login
            </PremiumButton>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6 relative z-10 animate-in fade-in">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Account Email</label>
              <DataInput 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="broker@agency.com"
                required
              />
            </div>

            <PremiumButton type="submit" disabled={loading || !email} className="w-full py-3.5">
              {loading ? "Sending Link..." : "Send Recovery Link"}
            </PremiumButton>
          </form>
        )}
      </GlassCard>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
