"use client";

import React, { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { supabase } from "@/utils/supabase/client";
import { Search, MapPin, ShieldCheck, Briefcase } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NetworkPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  useEffect(() => {
    const fetchNetwork = async () => {
      setLoading(true);
      // Read cross-user broker data from the safe public view (no email/phone).
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setProfiles(data);
      }
      setLoading(false);
    };

    fetchNetwork();
  }, []);

  // Compute unique cities for the dropdown
  const cities = Array.from(new Set(profiles.map(p => p.city).filter(Boolean)));

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = (p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           p.agency_name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCity = cityFilter ? p.city === cityFilter : true;
    return matchesSearch && matchesCity;
  });

  return (
    <div className="min-h-full p-6 md:p-10 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-light text-white tracking-tight">Broker <span className="font-semibold">Network</span></h1>
            <p className="text-white/50 mt-2">Connect with verified institutional brokers across India.</p>
          </div>
          
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input 
                type="text"
                placeholder="Search name or agency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1A202C] text-white rounded-full pl-11 pr-4 py-3 border border-gray-700 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 transition-all outline-none"
              />
            </div>
            
            <select 
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-[#1A202C] text-white rounded-full px-6 py-3 border border-gray-700 focus:border-[#D4AF37] outline-none appearance-none cursor-pointer"
            >
              <option value="">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Directory Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} className="h-[200px] w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProfiles.map(profile => (
              <GlassCard 
                key={profile.id} 
                onClick={() => router.push(`/network/${profile.id}`)}
                className="p-6 flex flex-col items-center text-center hover:border-[#D4AF37]/30 transition-colors group cursor-pointer"
              >
                <div className="relative w-20 h-20 rounded-full bg-slate-800 border-2 border-white/10 overflow-hidden mb-4 group-hover:scale-105 transition-transform">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50 text-xl font-light">
                      {(profile.full_name || "B")[0]}
                    </div>
                  )}
                  {profile.rera_number && (
                    <div className="absolute -bottom-1 -right-1 bg-[#D4AF37] rounded-full p-1 border-2 border-[#0a0f16]" title="RERA Verified">
                      <ShieldCheck className="w-3 h-3 text-[#0a0f16]" />
                    </div>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-white">{profile.full_name}</h3>
                <p className="text-[#D4AF37] text-sm font-medium mt-1 flex items-center gap-1.5">
                  <Briefcase className="w-3 h-3" /> {profile.agency_name}
                </p>
                
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-md border border-white/10 uppercase">
                    {profile.role || "Broker"}
                  </span>
                  {profile.city && (
                    <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded-md border border-white/10 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {profile.city}
                    </span>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
        
        {!loading && filteredProfiles.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-white/10 rounded-3xl">
            <p className="text-white/50">No brokers found matching your criteria.</p>
          </div>
        )}

      </div>
    </div>
  );
}
