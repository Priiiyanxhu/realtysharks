"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { DataInput } from "@/components/ui/DataInput";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { Check, UploadCloud, User, Building, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  uploadProfileImage,
  removeSupersededProfileImages,
  type UploadedProfileImage,
} from "@/utils/profileImages";

const ROLES = ["SalesMate", "Broker", "Dealer", "Consultant", "Channel Partner", "Developer", "Builder Sales", "Project Co-ordinator", "Marketing Agency"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Form State
  const [role, setRole] = useState("Broker");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [rera, setRera] = useState("");
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
      }
    };
    checkSession();
  }, [router]);

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    try {
      let avatarUrl = null;
      let uploadedAvatar: UploadedProfileImage | null = null;
      
      // Upload Avatar
      if (avatarFile) {
        const { image, error: avatarError } = await uploadProfileImage(supabase, userId, "avatar", avatarFile);
        if (avatarError) throw avatarError;

        uploadedAvatar = image;
        avatarUrl = image.publicUrl;
      }

      // Upload KYC to private bucket
      if (kycFile) {
        const fileExt = kycFile.name.split('.').pop();
        const filePath = `${userId}/kyc_document.${fileExt}`;
        const { error: kycError } = await supabase.storage.from('kyc-documents').upload(filePath, kycFile, { upsert: true });
        if (kycError) throw kycError;
      }

      // Ensure we have the user email from session
      const { data: { session } } = await supabase.auth.getSession();
      const currentEmail = session?.user?.email;

      if (!currentEmail) {
        throw new Error("Could not retrieve user email from session.");
      }

      // Upsert Profile (public, non-sensitive columns only).
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        auth_id: userId,
        full_name: name,
        role: role,
        agency_name: company,
        rera_number: rera.trim() === "" ? null : rera,
        avatar_url: avatarUrl,
        onboarded: true,
        // Uploading a KYC document only submits it for review; it never
        // self-verifies. Verification requires a real admin review (not built).
        kyc_status: 'pending',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      if (profileError) throw profileError;

      // The profile now references the new avatar, so any older avatar.* file
      // (e.g. avatar.png after switching to avatar.jpg) is safe to delete.
      if (uploadedAvatar) {
        await removeSupersededProfileImages(supabase, userId, "avatar", uploadedAvatar.path);
      }

      // Email is contact PII -> owner-only profiles_private, not public profiles.
      if (currentEmail) {
        const { error: privateError } = await supabase.from('profiles_private').upsert({
          auth_id: userId,
          email: currentEmail,
          updated_at: new Date().toISOString()
        }, { onConflict: 'auth_id' });

        if (privateError) throw privateError;
      }

      router.push("/profile");
    } catch (err) {
      setError((err instanceof Error ? err.message : String(err)) || "Failed to complete onboarding");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-2xl p-8 relative overflow-visible">
        
        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-8 relative z-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors",
                step >= i ? "bg-[#D4AF37] text-[#0B1120]" : "bg-white/10 text-white/40 border border-white/10"
              )}>
                {step > i ? <Check className="w-4 h-4" /> : i}
              </div>
              {i < 3 && (
                <div className={cn(
                  "w-20 md:w-32 h-1 mx-2 rounded-full transition-colors",
                  step > i ? "bg-[#D4AF37]" : "bg-white/10"
                )} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="relative z-10 min-h-[300px]">
          {/* Step 1: Role */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Select Your Role</h2>
                <p className="text-gray-400 text-sm">Define your identity in the network.</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {ROLES.map((r) => (
                  <div 
                    key={r}
                    onClick={() => setRole(r)}
                    className={cn(
                      "p-4 rounded-2xl border cursor-pointer transition-all flex flex-col items-center justify-center gap-2 text-center",
                      role === r 
                        ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37] shadow-[inset_0_1px_1px_rgba(212,175,55,0.4)]" 
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <User className="w-6 h-6" />
                    <span className="text-sm font-medium">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Professional Details</h2>
                <p className="text-gray-400 text-sm">Let the network know who you are.</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Full Name</label>
                  <DataInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Rahul Desai" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Agency / Company Name</label>
                  <DataInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="LuxuryEstates" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">RERA Number</label>
                  <DataInput value={rera} onChange={(e) => setRera(e.target.value)} placeholder="A5190000XXXX" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1 mb-2 block">Profile Avatar</label>
                  <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#D4AF37]/20 file:text-[#D4AF37] hover:file:bg-[#D4AF37]/30 transition-all" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: KYC */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Identity Verification</h2>
                <p className="text-gray-400 text-sm">Upload Aadhar, PAN, or Business Card for the Private KYC Vault.</p>
              </div>

              <div className="border-2 border-dashed border-white/20 rounded-3xl p-10 flex flex-col items-center justify-center text-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <ShieldCheck className="w-12 h-12 text-[#D4AF37] mb-4" />
                <h3 className="text-lg font-semibold text-white mb-1">Upload KYC Document</h3>
                <p className="text-sm text-gray-400">PDF, JPG, PNG up to 10MB</p>
                {kycFile && (
                  <div className="mt-4 px-4 py-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-sm font-medium border border-[#D4AF37]/30 flex items-center gap-2">
                    <Check className="w-4 h-4" /> {kycFile.name}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-8 flex justify-between pt-6 border-t border-white/10 relative z-10">
          <button 
            onClick={handleBack} 
            disabled={step === 1 || loading}
            className="px-6 py-3 text-white/50 hover:text-white font-medium transition-colors disabled:opacity-0"
          >
            Back
          </button>

          {step < 3 ? (
            <PremiumButton onClick={handleNext} disabled={step === 2 && (!name || !company)}>
              Continue
            </PremiumButton>
          ) : (
            <PremiumButton onClick={handleSubmit} disabled={loading}>
              {loading ? "Verifying..." : (kycFile ? "Complete Setup" : "Skip & Complete")}
            </PremiumButton>
          )}
        </div>

      </GlassCard>
    </div>
  );
}
