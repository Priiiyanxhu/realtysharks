"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { PropertyCard } from "@/components/ui/PropertyCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { User, Building, Phone, Save, Plus, BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";

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
    rera_number: ""
  });
  const [reraError, setReraError] = useState("");

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
        setFormData({
          full_name: profileData.full_name || "",
          agency_name: profileData.agency_name || "",
          phone_number: profileData.phone_number || "",
          rera_number: profileData.rera_number || ""
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
    
    // RERA Validation (Optional, but strict if provided)
    let isVerified = false;
    setReraError("");
    
    if (formData.rera_number.trim()) {
      // Common Indian RERA Regex pattern (e.g. PRM123456789 or MAH123456)
      const reraRegex = /^[A-Z]{2,5}[0-9]{5,15}$/i;
      if (!reraRegex.test(formData.rera_number.trim())) {
        setReraError("Invalid RERA format. Example: PRM12345678");
        return;
      }
      isVerified = true;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.full_name,
        agency_name: formData.agency_name,
        phone_number: formData.phone_number,
        rera_number: formData.rera_number.trim().toUpperCase(),
        verified: isVerified,
        updated_at: new Date().toISOString()
      })
      .eq("id", profile.id);
      
    setIsSaving(false);
    if (error) {
      alert("Failed to update profile: " + error.message);
    } else {
      alert("Profile updated successfully!");
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (error) {
      console.error(error);
      alert("Failed to delete listing: " + error.message);
    } else {
      setListings(listings.filter(l => l.id !== id));
    }
  };

  const handleDeleteRequirement = async (id: string) => {
    if (!confirm("Are you sure you want to delete this requirement?")) return;
    const { error } = await supabase.from('requirements').delete().eq('id', id);
    if (error) {
      console.error(error);
      alert("Failed to delete requirement: " + error.message);
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
              
              {/* Avatar Mockup */}
              <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <div className="w-20 h-20 rounded-full bg-slate-800 overflow-hidden border border-white/10 shrink-0">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50 text-2xl font-light">
                      {formData.full_name.charAt(0) || "U"}
                    </div>
                  )}
                </div>
                <div>
                  <button type="button" className="text-xs text-emerald-500 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors">
                    Change Picture
                  </button>
                  <p className="text-[10px] text-white/40 mt-2 max-w-[150px]">JPG or PNG. Max size of 5MB.</p>
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
                      className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
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
                      className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
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
                      className="w-full bg-black/20 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs text-white/50 font-medium uppercase tracking-wider">RERA Number</label>
                    <span className="text-[10px] text-emerald-500/80 bg-emerald-500/10 px-2 py-0.5 rounded">Optional</span>
                  </div>
                  <div className="relative">
                    <BadgeCheck className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${formData.rera_number && !reraError ? 'text-emerald-500' : 'text-white/30'}`} />
                    <input 
                      type="text" 
                      value={formData.rera_number}
                      onChange={(e) => {
                        setFormData({...formData, rera_number: e.target.value});
                        if (reraError) setReraError("");
                      }}
                      placeholder="e.g. PRM12345678"
                      className={`w-full bg-black/20 border ${reraError ? 'border-red-500/50' : 'border-white/10'} rounded-lg py-2.5 pl-10 pr-4 text-sm text-white uppercase focus:border-emerald-500/50 focus:outline-none transition-colors`}
                    />
                  </div>
                  {reraError ? (
                    <p className="text-xs text-red-400 mt-1.5">{reraError}</p>
                  ) : (
                    <p className="text-xs text-white/30 mt-1.5">Enter to unlock the "Verified Broker" badge.</p>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving..." : (
                  <>
                    <Save className="w-4 h-4" /> Save Changes
                  </>
                )}
              </button>
            </form>
          </GlassCard>
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
                  <span className="text-white/50 text-sm">You haven't posted any listings yet.</span>
                  <button onClick={() => router.push('/post-listing')} className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium">
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
                      isVerified={true}
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
                  <span className="text-white/50 text-sm">You haven't posted any requirements yet.</span>
                  <button onClick={() => router.push('/post-requirement')} className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium">
                    <Plus className="w-4 h-4" /> Post Requirement
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {requirements.map(req => (
                    <GlassCard key={req.id} className="p-5 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded uppercase">{req.property_type}</span>
                          <span className="text-xs text-white/50">{req.city}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-white">Looking for {req.configuration}</h3>
                        <p className="text-sm text-emerald-500 font-medium mt-1">
                          Budget: ₹{((req.budget_min_inr || 0)/10000000).toFixed(1)}Cr - ₹{((req.budget_max_inr || 0)/10000000).toFixed(1)}Cr
                        </p>
                        <p className="text-xs text-white/40 mt-2 line-clamp-2 max-w-xl">{req.details}</p>
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                         <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded mb-2">Active</span>
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
