"use client";

import React, { useEffect, useState } from "react";
import { PropertyCard } from "@/components/ui/PropertyCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface MatchProperty {
  id: string;
  title: string;
  price_inr: number;
  locality: string;
  city: string;
  configuration: string;
  images: string[];
  profiles: { agency_name: string; full_name: string };
}

export function AiMatchesGrid() {
  const [matches, setMatches] = useState<MatchProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRequirements, setHasRequirements] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const userId = session.user.id;

        // 1. Fetch user's active requirements
        const { data: reqs } = await supabase
          .from("requirements")
          .select("*")
          .eq("broker_id", userId)
          .eq("is_active", true);

        if (!reqs || reqs.length === 0) {
          setHasRequirements(false);
          setLoading(false);
          return;
        }

        setHasRequirements(true);

        // 2. Fetch all other active listings
        const { data: listings } = await supabase
          .from("listings")
          .select(`
            *,
            profiles!listings_broker_id_fkey (id, full_name, agency_name, avatar_url)
          `)
          .eq("is_active", true)
          .neq("broker_id", userId); // Don't match own listings

        if (!listings || listings.length === 0) {
          setMatches([]);
          setLoading(false);
          return;
        }

        // 3. Mathematical Matching Algorithm
        const matchedListings = new Map(); // Use map to avoid duplicates if a listing matches multiple reqs

        listings.forEach(listing => {
          for (const req of reqs) {
            // Hard Filter 1: Exact Location (City)
            if (listing.city?.trim().toLowerCase() !== req.city?.trim().toLowerCase()) {
              continue; // Fails exact location
            }

            // Hard Filter 2: Price within +/- 20% negotiation buffer
            const minPrice = (req.budget_min_inr || 0) * 0.8;
            const maxPrice = (req.budget_max_inr || 999999999999) * 1.2;
            const price = listing.price_inr || 0;

            if (price < minPrice || price > maxPrice) {
              continue; // Fails price buffer
            }

            // Soft Filters: Score other attributes
            let score = 0;
            let totalPossible = 0;

            if (req.property_type) {
              totalPossible += 100;
              if (listing.property_type === req.property_type) score += 100;
            }
            if (req.configuration) {
              totalPossible += 100;
              if (listing.configuration === req.configuration) score += 100;
            }

            // Calculate similarity percentage (if no soft filters, it's a 100% match)
            const similarity = totalPossible === 0 ? 100 : (score / totalPossible) * 100;

            if (similarity >= 70) {
              matchedListings.set(listing.id, { ...listing, matchScore: similarity });
              break; // Matches this requirement, no need to check others for this listing
            }
          }
        });

        // Convert Map to Array and sort by newest
        const finalMatches = Array.from(matchedListings.values()).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setMatches(finalMatches);

      } catch (err) {
        console.error("AI Match Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-light text-white tracking-tight">AI <span className="font-semibold">Matches</span></h2>
          <span className="text-xs text-emerald-500 font-mono bg-emerald-500/10 px-2 py-1 rounded animate-pulse">Computing...</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Skeleton className="h-[280px] w-full rounded-[2rem]" />
          <Skeleton className="h-[280px] w-full rounded-[2rem] hidden sm:block" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-light text-white tracking-tight">AI <span className="font-semibold">Matches</span></h2>
        {hasRequirements && matches.length > 0 && (
          <span className="text-xs text-emerald-500 font-mono bg-emerald-500/10 px-2 py-1 rounded">Real-Time</span>
        )}
      </div>

      {!hasRequirements ? (
        <div className="h-48 flex flex-col items-center justify-center border border-emerald-500/10 bg-emerald-500/5 rounded-2xl gap-4">
          <span className="text-emerald-400/80 text-sm font-medium">Post a Requirement to unlock AI Matching</span>
          <button 
            onClick={() => router.push('/post-requirement')}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Post Requirement
          </button>
        </div>
      ) : matches.length === 0 ? (
        <div className="h-48 flex items-center justify-center border border-white/5 bg-white/5 rounded-2xl">
          <span className="text-white/50 text-sm">No exact matches currently. We'll notify you when one hits the market.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {matches.map((match) => (
            <PropertyCard 
              key={match.id} 
              id={match.id}
              title={match.title}
              price={match.price_inr}
              location={match.city}
              bhk={match.configuration}
              imageUrl={Array.isArray(match.images) && match.images.length > 0 ? match.images[0] : ""}
              isVerified={true} // High match score acts as verified
              agent={{
                id: Array.isArray(match.profiles) ? match.profiles[0]?.id : match.profiles?.id,
                name: Array.isArray(match.profiles) ? match.profiles[0]?.full_name : match.profiles?.full_name || "Unknown Broker",
                company: Array.isArray(match.profiles) ? match.profiles[0]?.agency_name : match.profiles?.agency_name || "Independent",
                avatarUrl: Array.isArray(match.profiles) ? match.profiles[0]?.avatar_url : match.profiles?.avatar_url
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
