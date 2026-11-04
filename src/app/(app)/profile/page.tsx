"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { PropertyCard } from "@/components/ui/PropertyCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { User, Building, Phone, Save, Plus, BadgeCheck, UploadCloud, Image as ImageIcon, Briefcase, FileText, ShieldAlert, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { BlockedBrokersPanel } from "@/components/profile/BlockedBrokersPanel";
import { isVerifiedBroker } from "@/utils/verification";
import {
  uploadProfileImage,
  removeSupersededProfileImages,
  type UploadedProfileImage,
} from "@/utils/profileImages";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'listings' | 'requirements'>('listings');

  // Form State
  const [formData, setFormData] = useState({
    full_name: "",
    agency_name: "",
    phone_number: "",
    rera_number: "",
    core_expertise: "",
    full_name_aadhar: "",
    aadhar_no: ""
  });
  const [reraError, setReraError] = useState("");
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      // Fetch Profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_id", userId)
        .single();

      if (profileData) {
        setProfile(profileData);

        // Contact + Aadhaar PII lives in the owner-only profiles_private table.
        const { data: privateData } = await supabase
          .from("profiles_private")
          .select("aadhar_no, full_name_aadhar, phone_number")
          .eq("auth_id", userId)
          .maybeSingle();

        setFormData({
          full_name: profileData.full_name || "",
          agency_name: profileData.agency_name || "",
          phone_number: privateData?.phone_number || "",
          rera_number: profileData.rera_number || "",
          core_expertise: profileData.core_expertise ? profileData.core_expertise.join(", ") : "",
          full_name_aadhar: privateData?.full_name_aadhar || "",
          aadhar_no: privateData?.aadhar_no || ""
        });

        // Fetch User's Listings
        const { data: listingsData } = await supabase
          .from("listings")
          .select("*")
          .eq("broker_id", profileData.id)
          .order("created_at", { ascending: false });
        
        if (listingsData) setListings(listingsData);

        // Fetch User's Requirements
        const { data: reqData } = await supabase
          .from("requirements")
          .select("*")
          .eq("broker_id", profileData.id)
          .order("created_at", { ascending: false });
        
        if (reqData) setRequirements(reqData);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    // RERA Validation (Optional, but strict if provided).
    // NOTE: passing RERA format validation does NOT grant verification.
    // `verified` is only ever set true by a real admin review (not yet built),
    // so we never self-verify here.
    setReraError("");

    if (formData.rera_number.trim()) {
      // Common Indian RERA Regex pattern (e.g. PRM123456789 or MAH123456)
      const reraRegex = /^[A-Z]{2,5}[0-9]{5,15}$/i;
      if (!reraRegex.test(formData.rera_number.trim())) {
        setReraError("Invalid RERA format. Example: PRM12345678");
        return;
      }
    }

    setIsSaving(true);
    try {
      let avatarUrl = profile.avatar_url;
      let coverUrl = profile.cover_url;
      let kycStatus = profile.kyc_status;

      const uploadedImages: UploadedProfileImage[] = [];

      // Upload Avatar
      if (avatarFile) {
        const { image } = await uploadProfileImage(supabase, profile.id, "avatar", avatarFile);
        if (image) {
          avatarUrl = image.publicUrl;
          uploadedImages.push(image);
        }
      }

      // Upload Cover
      if (coverFile) {
        const { image } = await uploadProfileImage(supabase, profile.id, "cover", coverFile);
        if (image) {
          coverUrl = image.publicUrl;
          uploadedImages.push(image);
        }
      }

      // Upload KYC
      if (kycFile) {
        const fileExt = kycFile.name.split('.').pop();
        const filePath = `${profile.id}/kyc_document.${fileExt}`;
        const { error: kycError } = await supabase.storage.from('kyc-documents').upload(filePath, kycFile, { upsert: true });
        if (!kycError) {
          kycStatus = 'pending'; // Reset to pending if they re-upload
        }
      }

      // Format Expertise Array
      const expertiseArray = formData.core_expertise
        .split(',')
        .map(e => e.trim())
        .filter(e => e.length > 0);

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          agency_name: formData.agency_name,
          rera_number: formData.rera_number.trim().toUpperCase(),
          core_expertise: expertiseArray,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          kyc_status: kycStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id);

      if (error) throw error;

      // The profile row now references the new images, so older avatar.* /
      // cover.* files (left behind when the file type changed) can go.
      await Promise.all(
        uploadedImages.map((image) =>
          removeSupersededProfileImages(supabase, profile.id, image.kind, image.path)
        )
      );

      // Contact + Aadhaar PII is stored in the owner-only profiles_private
      // table, never in the authenticated-readable profiles table.
      if (
        formData.phone_number.trim() ||
        formData.aadhar_no.trim() ||
        formData.full_name_aadhar.trim()
      ) {
        const { error: privateError } = await supabase
          .from("profiles_private")
          .upsert({
            auth_id: profile.auth_id,
            phone_number: formData.phone_number,
            aadhar_no: formData.aadhar_no,
            full_name_aadhar: formData.full_name_aadhar,
            updated_at: new Date().toISOString()
          }, { onConflict: "auth_id" });

        if (privateError) throw privateError;
      }
      
      // Update local state
      setProfile({...profile, avatar_url: avatarUrl, cover_url: coverUrl, kyc_status: kycStatus});
      alert("Profile updated successfully!");
    } catch (err) {
      alert("Failed to update profile: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (error) {
      console.error(error);
      alert("Failed to delete listing: " + (error instanceof Error ? error.message : String(error)));
    } else {
      setListings(listings.filter(l => l.id !== id));
    }
  };

  const handleDeleteRequirement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this requirement?")) return;
    const { error } = await supabase.from('requirements').delete().eq('id', id);
    if (error) {
      console.error(error);
      alert("Failed to delete requirement: " + (error instanceof Error ? error.message : String(error)));
    } else {
      setRequirements(requirements.filter(r => r.id !== id));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-full p-6 md:p-10 pt-[calc(env(safe-area-inset-top)+2rem)]">
        <div className="max-w-[1200px] mx-auto flex flex-col xl:flex-row gap-10">
          <div className="w-full xl:w-[400px] shrink-0 space-y-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-[500px] w-full" />
          </div>
          <div className="flex-1 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-10 w-[250px]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-[280px] w-full rounded-[2rem]" />
              <Skeleton className="h-[280px] w-full rounded-[2rem]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-10 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="max-w-[1200px] mx-auto flex flex-col xl:flex-row gap-10">
        
        {/* Left Side: Profile Edit Form */}
        <div className="w-full xl:w-[400px] shrink-0 space-y-6">
          <div>
            <h1 className="text-2xl font-light text-white tracking-tight">My <span className="font-semibold">Profile</span></h1>
            <p className="text-sm text-white/50 mt-1">Manage your identity and agency details.</p>
          </div>

          <GlassCard className="p-6">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              
              {/* Cover & Avatar Mockup */}
              <div className="relative mb-8 pb-8 border-b border-white/5">
                {/* Cover Image */}
                <div className="w-full h-32 bg-slate-800 rounded-xl overflow-hidden relative group">
                  {profile?.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover opacity-60" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <span className="text-xs text-white font-medium bg-black/50 px-3 py-1 rounded-full">Change Cover</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
                  </label>
                </div>

                {/* Avatar Image */}
                <div className="absolute -bottom-6 left-6 flex items-end gap-4">
                  <div className="w-20 h-20 rounded-full bg-slate-900 border-4 border-[#0F1419] overflow-hidden relative group">
                    {profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/50 text-2xl font-light">
                        {formData.full_name.charAt(0) || "U"}
                      </div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <UploadCloud className="w-5 h-5 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <div className="pb-2">
                    <p className="text-[10px] text-white/40 max-w-[150px]">{(avatarFile || coverFile) ? "Images staged for upload. Click Save." : "JPG or PNG. Max size 5MB."}</p>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 font-medium mb-1.5 block uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/50 font-medium mb-1.5 block uppercase tracking-wider">Agency Name</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={formData.agency_name}
                      onChange={(e) => setFormData({...formData, agency_name: e.target.value})}
                      className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/50 font-medium mb-1.5 block uppercase tracking-wider">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="tel" 
                      value={formData.phone_number}
                      onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                      className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs text-white/50 font-medium uppercase tracking-wider">RERA Number</label>
                    <span className="text-[10px] text-[#D4AF37]/80 bg-[#D4AF37]/10 px-2 py-0.5 rounded">Optional</span>
                  </div>
                  <div className="relative">
                    <BadgeCheck className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${formData.rera_number && !reraError ? 'text-[#D4AF37]' : 'text-white/30'}`} />
                    <input 
                      type="text" 
                      value={formData.rera_number}
                      onChange={(e) => {
                        setFormData({...formData, rera_number: e.target.value});
                        if (reraError) setReraError("");
                      }}
                      placeholder="e.g. PRM12345678"
                      className={`w-full bg-black/20 border ${reraError ? 'border-red-500/50' : 'border-white/10'} rounded-lg py-2.5 pl-10 pr-4 text-sm text-white uppercase focus:border-[#D4AF37]/50 focus:outline-none transition-colors`}
                    />
                  </div>
                  {reraError ? (
                    <p className="text-xs text-red-400 mt-1.5">{reraError}</p>
                  ) : (
                    <p className="text-xs text-white/30 mt-1.5">Entering a RERA number does not make you a verified broker; verification is a separate KYC review.</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-white/50 font-medium mb-1.5 block uppercase tracking-wider">Core Expertise</label>
                  <div className="relative">
                    <Star className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={formData.core_expertise}
                      onChange={(e) => setFormData({...formData, core_expertise: e.target.value})}
                      placeholder="e.g. Luxury Assets, Commercial, Institutional"
                      className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:border-[#D4AF37]/50 focus:outline-none transition-colors"
                    />
                  </div>
                  <p className="text-xs text-white/30 mt-1.5">Comma-separated skills to display on your public profile.</p>
                </div>
              </div>

              {/* KYC Section */}
              <div className="p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className={`w-5 h-5 ${profile?.kyc_status === 'verified' ? 'text-[#D4AF37]' : 'text-amber-400'}`} />
                  <h3 className="text-sm font-semibold text-white">KYC Verification</h3>
                  <span className="ml-auto text-[10px] uppercase tracking-widest bg-black/40 px-2 py-1 rounded text-white/70">
                    {profile?.kyc_status || 'Pending'}
                  </span>
                </div>
                
                {profile?.kyc_status !== 'verified' && (
                  <>
                    <p className="text-xs text-white/60">Complete your KYC to ensure fairness and trust in the RealtySharks network.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Name on Aadhar</label>
                        <input 
                          type="text" 
                          value={formData.full_name_aadhar}
                          onChange={(e) => setFormData({...formData, full_name_aadhar: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded py-2 px-3 text-xs text-white focus:border-[#D4AF37]/50 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Aadhar Number</label>
                        <input 
                          type="text" 
                          value={formData.aadhar_no}
                          onChange={(e) => setFormData({...formData, aadhar_no: e.target.value})}
                          placeholder="XXXX-XXXX-XXXX"
                          className="w-full bg-black/40 border border-white/10 rounded py-2 px-3 text-xs text-white focus:border-[#D4AF37]/50 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Upload Aadhar / PAN / Business Card</label>
                      <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-white/20 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                        <div className="flex flex-col items-center">
                          <FileText className="w-5 h-5 text-white/40 mb-1" />
                          <span className="text-xs text-white/40">{kycFile ? kycFile.name : "Tap to upload secure PDF/Image"}</span>
                        </div>
                        <input type="file" className="hidden" onChange={(e) => setKycFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </>
                )}
              </div>

              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#FACC15] text-[#0B1120] font-bold py-3 rounded-xl transition-colors disabled:opacity-50 uppercase tracking-widest text-xs shadow-lg shadow-[#D4AF37]/20"
              >
                {isSaving ? "Saving..." : (
                  <>
                    <Save className="w-4 h-4" /> Save Changes
                  </>
                )}
              </button>
            </form>
          </GlassCard>

          <BlockedBrokersPanel userId={profile?.id ?? null} />
        </div>

        {/* Right Side: Portfolio Management */}
        <div className="flex-1 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-light text-white tracking-tight">My <span className="font-semibold">Portfolio</span></h2>
              <p className="text-sm text-white/50 mt-1">Manage your active listings and requirements.</p>
            </div>
            
            <div className="flex bg-black/40 border border-white/5 rounded-lg p-1">
              <button 
                onClick={() => setActiveTab('listings')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'listings' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
              >
                Listings ({listings.length})
              </button>
              <button 
                onClick={() => setActiveTab('requirements')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'requirements' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
              >
                Requirements ({requirements.length})
              </button>
            </div>
          </div>

          {activeTab === 'listings' ? (
            <div className="space-y-4">
              {listings.length === 0 ? (
                <div className="h-48 border border-white/5 bg-white/5 rounded-2xl flex flex-col items-center justify-center gap-4">
                  <span className="text-white/50 text-sm">You haven&apos;t posted any listings yet.</span>
                  <button onClick={() => router.push('/post-listing')} className="flex items-center gap-2 text-[#D4AF37] hover:text-[#FACC15] text-sm font-bold uppercase tracking-widest">
                    <Plus className="w-4 h-4" /> Create Listing
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {listings.map(listing => (
                    <PropertyCard 
                      key={listing.id}
                      id={listing.id}
                      title={listing.title}
                      price={listing.price_inr}
                      location={listing.city}
                      bhk={listing.configuration}
                      imageUrl={listing.images?.[0] || ""}
                      isVerified={isVerifiedBroker(profile)}
                      agent={{
                        name: profile.full_name,
                        company: profile.agency_name,
                        avatarUrl: profile.avatar_url
                      }}
                      onEdit={() => router.push(`/post-listing?edit=${listing.id}`)}
                      onDelete={() => handleDeleteListing(listing.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {requirements.length === 0 ? (
                <div className="h-48 border border-white/5 bg-white/5 rounded-2xl flex flex-col items-center justify-center gap-4">
                  <span className="text-white/50 text-sm">You haven&apos;t posted any requirements yet.</span>
                  <button onClick={() => router.push('/post-requirement')} className="flex items-center gap-2 text-[#D4AF37] hover:text-[#FACC15] text-sm font-bold uppercase tracking-widest">
                    <Plus className="w-4 h-4" /> Post Requirement
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {requirements.map(req => (
                    <GlassCard key={req.id} className="p-5 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-[#D4AF37] font-bold bg-[#D4AF37]/10 px-2 py-0.5 rounded uppercase tracking-widest">{req.property_type}</span>
                          <span className="text-xs text-white/50">{req.city}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">Looking for {req.configuration}</h3>
                        <p className="text-sm text-[#D4AF37] font-medium mt-1">
                          Budget: ₹{((req.budget_min_inr || 0)/10000000).toFixed(1)}Cr - ₹{((req.budget_max_inr || 0)/10000000).toFixed(1)}Cr
                        </p>
                        <p className="text-xs text-white/40 mt-2 line-clamp-2 max-w-xl">{req.details}</p>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                         <span className="text-xs text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-1 rounded mb-2 font-bold uppercase tracking-widest">Active</span>
                         <div className="flex items-center gap-2">
                           <button 
                             onClick={() => router.push(`/post-requirement?edit=${req.id}`)}
                             className="text-xs text-white/70 hover:text-white hover:bg-white/10 px-2 py-1 rounded transition-colors"
                           >
                             Edit
                           </button>
                           <button 
                             onClick={() => handleDeleteRequirement(req.id)}
                             className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2 py-1 rounded transition-colors"
                           >
                             Delete
                           </button>
                         </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
