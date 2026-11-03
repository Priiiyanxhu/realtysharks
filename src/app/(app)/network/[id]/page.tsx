"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { PropertyCard } from "@/components/ui/PropertyCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { MapPin, ShieldCheck, Briefcase, MessageSquare } from "lucide-react";

export default function PublicBrokerProfile() {
  const params = useParams();
  const router = useRouter();
  const brokerId = params.id as string;

  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // ?tab=requirements opens the Requirements tab (the Network Feed links here for requirement items).
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'listings' | 'requirements'>(
    searchParams.get('tab') === 'requirements' ? 'requirements' : 'listings'
  );

  useEffect(() => {
    if (!brokerId) return;

    const fetchBrokerData = async () => {
      setLoading(true);

      // Fetch a peer broker's profile from the safe public view (no email/phone).
      const { data: profileData } = await supabase
        .from('profiles_public')
        .select('*')
        .eq('id', brokerId)
        .single();
      
      if (profileData) {
        setProfile(profileData);
        
        // Fetch Active Listings
        const { data: listingsData } = await supabase
          .from('listings')
          .select('*')
          .eq('broker_id', brokerId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
          
        if (listingsData) setListings(listingsData);

        // Fetch Active Requirements
        const { data: reqData } = await supabase
          .from('requirements_feed')
          .select('*')
          .eq('broker_id', brokerId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
          
        if (reqData) setRequirements(reqData);
      }

      setLoading(false);
    };

    fetchBrokerData();
  }, [brokerId]);

  const handleMessage = async () => {
    if (!profile) return;
    router.push(`/messages?brokerId=${profile.auth_id}`);
  };

  if (loading) {
    return (
      <div className="min-h-full p-6 md:p-10 pt-[calc(env(safe-area-inset-top)+2rem)]">
        <div className="max-w-[1200px] mx-auto space-y-6">
          <Skeleton className="h-48 w-full rounded-[2rem]" />
          <Skeleton className="h-[400px] w-full rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h2 className="text-2xl text-white font-light">Broker Not Found</h2>
          <button onClick={() => router.push('/network')} className="text-[#D4AF37] hover:text-[#FACC15] font-bold tracking-wide uppercase text-sm">Return to Network</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-10 pt-[calc(env(safe-area-inset-top)+2rem)] space-y-8">
      <div className="max-w-[1200px] mx-auto space-y-8">
        
        {/* Profile Header */}
        <GlassCard className="p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#D4AF37]/10 to-transparent" />
          
          <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-start gap-8">
            <div className="relative w-32 h-32 rounded-full bg-slate-800 border-4 border-[#0a0f16] shadow-xl overflow-hidden shrink-0">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 text-4xl font-light">
                  {(profile.full_name || "B")[0]}
                </div>
              )}
              {profile.rera_number && (
                <div className="absolute bottom-1 right-1 bg-[#D4AF37] rounded-full p-1.5 border-2 border-[#0a0f16]" title="RERA Verified">
                  <ShieldCheck className="w-4 h-4 text-[#0a0f16]" />
                </div>
              )}
            </div>

            <div className="flex-1 text-center lg:text-left space-y-4">
              <div>
                <h1 className="text-3xl font-black text-white tracking-tighter flex items-center justify-center lg:justify-start gap-2">
                  {profile.full_name}
                  {profile.rera_number && <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />}
                </h1>
                <p className="text-[#D4AF37] font-bold mt-1 flex items-center justify-center lg:justify-start gap-1.5 text-xs uppercase tracking-widest">
                  <Briefcase className="w-4 h-4" /> {profile.agency_name}
                </p>
              </div>

              <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                <span className="text-sm text-white/70 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 uppercase tracking-wide">
                  {profile.role || "Broker"}
                </span>
                {profile.city && (
                  <span className="text-sm text-white/70 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" /> {profile.city}
                  </span>
                )}
                {profile.deals_closed !== undefined && (
                  <span className="text-sm text-white/70 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                    <strong className="text-white">{profile.deals_closed}</strong> Deals Closed
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0">
              <button 
                onClick={handleMessage}
                className="flex items-center gap-2 bg-[#D4AF37] hover:bg-[#FACC15] text-[#0B1120] px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-lg shadow-[#D4AF37]/20"
              >
                <MessageSquare className="w-4 h-4" />
                Message Broker
              </button>
            </div>
          </div>
        </GlassCard>

        {/* Portfolio Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b border-white/10 pb-4">
            <button 
              onClick={() => setActiveTab('listings')}
              className={`text-lg font-medium transition-colors relative ${activeTab === 'listings' ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              Active Listings ({listings.length})
              {activeTab === 'listings' && <div className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-[#D4AF37] rounded-t-full" />}
            </button>
            <button 
              onClick={() => setActiveTab('requirements')}
              className={`text-lg font-medium transition-colors relative ${activeTab === 'requirements' ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              Requirements ({requirements.length})
              {activeTab === 'requirements' && <div className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-[#D4AF37] rounded-t-full" />}
            </button>
          </div>

          {activeTab === 'listings' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.length === 0 ? (
                <div className="col-span-full py-12 text-center text-white/40 border border-dashed border-white/10 rounded-2xl">
                  This broker has no active listings.
                </div>
              ) : (
                listings.map(listing => (
                  <PropertyCard 
                    key={listing.id}
                    id={listing.id}
                    title={listing.title}
                    price={listing.price_inr}
                    location={listing.city}
                    bhk={listing.configuration}
                    imageUrl={listing.images?.[0] || ""}
                    isVerified={!!profile.rera_number}
                    agent={{
                      name: profile.full_name,
                      company: profile.agency_name,
                      avatarUrl: profile.avatar_url
                    }}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {requirements.length === 0 ? (
                <div className="py-12 text-center text-white/40 border border-dashed border-white/10 rounded-2xl">
                  This broker has no active requirements.
                </div>
              ) : (
                requirements.map(req => (
                  <GlassCard key={req.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-[#D4AF37] font-bold bg-[#D4AF37]/10 px-2 py-0.5 rounded uppercase tracking-widest">{req.property_type}</span>
                          <span className="text-xs text-white/50">{req.city}</span>
                        </div>
                        <h3 className="text-xl font-semibold text-white">Looking for {req.configuration}</h3>
                        <p className="text-[#D4AF37] font-medium mt-1">
                          Budget: ₹{((req.budget_min_inr || 0)/10000000).toFixed(1)}Cr - ₹{((req.budget_max_inr || 0)/10000000).toFixed(1)}Cr
                        </p>
                        <p className="text-sm text-white/60 mt-3 line-clamp-2 max-w-3xl">{req.details ?? (req.privacy_level && req.privacy_level !== "Standard" ? "Client details are confidential." : "")}</p>
                      </div>
                      <span className="text-xs text-[#D4AF37] bg-[#D4AF37]/10 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                        Active
                      </span>
                    </div>
                  </GlassCard>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
