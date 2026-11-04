"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { FilterBar, FilterState } from "@/components/listings/FilterBar";
import { PropertyCard } from "@/components/ui/PropertyCard";
import { RequirementCard } from "@/components/listings/RequirementCard";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SearchX, RefreshCcw } from "lucide-react";
import { isVerifiedBroker } from "@/utils/verification";

type EmbeddedProfile = {
  id: string;
  full_name: string | null;
  agency_name: string | null;
  avatar_url: string | null;
  verified?: boolean | null;
};

type EmbeddedProfileRelation = EmbeddedProfile | EmbeddedProfile[] | null;

type ListingData = {
  id: string;
  broker_id: string;
  title: string | null;
  price_inr: number | null;
  city: string | null;
  locality: string | null;
  configuration: string | null;
  property_type: string | null;
  images: string[] | null;
  is_active: boolean | null;
  created_at: string;
  profiles: EmbeddedProfileRelation;
};

type RequirementData = {
  id: string;
  broker_id: string;
  details: string | null;
  privacy_level: string | null;
  budget_min_inr: number | null;
  budget_max_inr: number | null;
  city: string | null;
  property_type: string | null;
  timeline_to_close: string | null;
  created_at: string;
  profiles: EmbeddedProfileRelation;
};

type ListingFeedItem = {
  itemType: "listing";
  id: string;
  created_at: string;
  data: ListingData;
};

type RequirementFeedItem = {
  itemType: "requirement";
  id: string;
  created_at: string;
  data: RequirementData;
};

type UnifiedFeedItem = ListingFeedItem | RequirementFeedItem;

const DEFAULT_FILTERS: FilterState = {
  query: "",
  location: "",
  propertyType: "",
  feedType: "both",
  budgetMin: "",
  budgetMax: ""
};

const sanitizePostgrestOrValue = (value: string) =>
  (value.split(",").find((segment) => segment.trim()) || "")
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getEmbeddedProfile = (relation: EmbeddedProfileRelation) =>
  Array.isArray(relation) ? relation[0] ?? null : relation;

export default function GlobalListingsPage() {
  const [feedItems, setFeedItems] = useState<UnifiedFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [retryVersion, setRetryVersion] = useState(0);

  // Debounced specific fields to prevent excessive API calls
  const debouncedQuery = useDebouncedValue(filters.query, 400);
  const debouncedLocation = useDebouncedValue(filters.location, 400);
  const debouncedBudgetMin = useDebouncedValue(filters.budgetMin, 400);
  const debouncedBudgetMax = useDebouncedValue(filters.budgetMax, 400);

  // Request counter to avoid race conditions
  const requestCounter = useRef(0);

  useEffect(() => {
    let isMounted = true;
    const currentRequest = ++requestCounter.current;

    async function fetchFeed() {
      setIsLoading(true);
      setError(null);
      
      try {
        const fetchListings = async () => {
          let query = supabase
            .from('listings')
            .select(`
              id,
              broker_id,
              title,
              price_inr,
              city,
              locality,
              configuration,
              property_type,
              images,
              is_active,
              created_at,
              profiles!listings_broker_id_fkey (id, full_name, agency_name, avatar_url, verified)
            `)
            .eq("is_active", true)
            .order('created_at', { ascending: false })
            .limit(30);

          if (debouncedQuery) {
            query = query.ilike('title', `%${debouncedQuery}%`);
          }
          if (debouncedLocation) {
            const searchLocation = sanitizePostgrestOrValue(debouncedLocation);
            if (searchLocation) {
              query = query.or(
                `city.ilike.%${searchLocation}%,locality.ilike.%${searchLocation}%`
              );
            }
          }
          if (filters.propertyType) {
            query = query.ilike('property_type', `%${filters.propertyType}%`);
          }
          if (debouncedBudgetMin) {
            query = query.gte('price_inr', parseFloat(debouncedBudgetMin));
          }
          if (debouncedBudgetMax) {
            query = query.lte('price_inr', parseFloat(debouncedBudgetMax));
          }

          const { data, error } = await query;
          if (error) throw error;
          
          return (data || []).map(item => {
            const listing = item as ListingData;

            return {
              itemType: "listing" as const,
              id: listing.id,
              created_at: listing.created_at,
              data: listing
            };
          });
        };

        const fetchRequirements = async () => {
          let query = supabase
            .from('requirements_feed')
            .select(`
              id,
              broker_id,
              details,
              privacy_level,
              budget_min_inr,
              budget_max_inr,
              city,
              property_type,
              timeline_to_close,
              created_at,
              profiles!requirements_broker_id_fkey (full_name, agency_name, avatar_url)
            `)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(30);

          if (debouncedQuery) {
            query = query.ilike('details', `%${debouncedQuery}%`);
          }
          if (debouncedLocation) {
            query = query.ilike('city', `%${debouncedLocation}%`);
          }
          if (filters.propertyType) {
            query = query.ilike('property_type', `%${filters.propertyType}%`);
          }
          if (debouncedBudgetMin) {
            query = query.gte('budget_max_inr', parseFloat(debouncedBudgetMin)); 
          }
          if (debouncedBudgetMax) {
            query = query.lte('budget_min_inr', parseFloat(debouncedBudgetMax));
          }

          const { data, error } = await query;
          if (error) throw error;

          return (data || []).map(item => {
            const requirement = item as RequirementData;

            return {
              itemType: "requirement" as const,
              id: requirement.id,
              created_at: requirement.created_at,
              data: requirement
            };
          });
        };

        let merged: UnifiedFeedItem[] = [];

        if (filters.feedType === 'listings' || filters.feedType === 'both') {
          const lData = await fetchListings();
          merged = [...merged, ...lData];
        }

        if (filters.feedType === 'requirements' || filters.feedType === 'both') {
          const rData = await fetchRequirements();
          merged = [...merged, ...rData];
        }

        // Sort combined feed by created_at descending
        merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (isMounted && currentRequest === requestCounter.current) {
          setFeedItems(merged);
        }
      } catch (err: unknown) {
        console.error("Feed fetch error:", err);
        if (isMounted && currentRequest === requestCounter.current) {
          setError((err as Error).message || "Failed to load feed");
        }
      } finally {
        if (isMounted && currentRequest === requestCounter.current) {
          setIsLoading(false);
        }
      }
    }

    fetchFeed();

    return () => {
      isMounted = false;
    };
  }, [
    debouncedQuery,
    debouncedLocation,
    debouncedBudgetMin,
    debouncedBudgetMax,
    filters.propertyType,
    filters.feedType,
    retryVersion
  ]);

  const handleClearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <div className="min-h-full flex flex-col pt-[calc(env(safe-area-inset-top)+1rem)] relative">
      
      {/* Sticky Header / Filter Bar */}
      <div className="sticky top-0 z-40 px-4 md:px-8 py-4">
        <FilterBar 
          filters={filters} 
          onFiltersChange={setFilters} 
          onClearFilters={handleClearFilters}
          isLoading={isLoading}
        />
      </div>

      {/* Feed Grid */}
      <div className="flex-1 px-4 md:px-8 pb-10">
        {error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center bg-red-500/10 border border-red-500/20 rounded-2xl mx-auto max-w-lg mt-8">
            <RefreshCcw className="w-10 h-10 text-red-400 mb-4" />
            <h3 className="text-white font-semibold text-lg mb-2">Something went wrong</h3>
            <p className="text-red-200/70 text-sm mb-6">{error}</p>
            <button 
              onClick={() => setRetryVersion((current) => current + 1)}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : feedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center border border-white/5 bg-white/5 backdrop-blur-sm rounded-3xl mx-auto max-w-xl mt-8">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
              <SearchX className="w-10 h-10 text-white/30" />
            </div>
            <h3 className="text-white font-bold text-xl mb-3">No matching opportunities</h3>
            <p className="text-white/50 text-sm max-w-sm mb-8">
              Try changing your location, budget, or property type to find what you&apos;re looking for.
            </p>
            <button 
              onClick={handleClearFilters}
              className="bg-[#D4AF37] hover:bg-[#FACC15] text-black px-8 py-3 rounded-xl transition-colors font-semibold"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {feedItems.map((item) => {
              if (item.itemType === 'listing') {
                const property = item.data;
                const profile = getEmbeddedProfile(property.profiles);
                return (
                  <PropertyCard
                    key={`listing-${item.id}`}
                    id={property.id}
                    title={property.title || "Untitled listing"}
                    price={property.price_inr ?? 0}
                    location={
                      [property.locality, property.city].filter(Boolean).join(", ")
                      || "Location not specified"
                    }
                    type={property.property_type || undefined}
                    bhk={property.configuration || "Configuration not specified"}
                    imageUrl={property.images?.[0] || ""}
                    isVerified={isVerifiedBroker(profile)}
                    agent={{
                      id: profile?.id,
                      name: profile?.full_name || "Unknown Broker",
                      company: profile?.agency_name || "Independent",
                      avatarUrl: profile?.avatar_url || undefined
                    }}
                  />
                );
              } else {
                const req = item.data;
                const profile = getEmbeddedProfile(req.profiles);
                return (
                  <RequirementCard
                    key={`req-${item.id}`}
                    id={req.id}
                    title={req.details || (req.privacy_level && req.privacy_level !== "Standard" ? "Confidential requirement" : "Buyer requirement")}
                    budgetMin={req.budget_min_inr ?? 0}
                    budgetMax={req.budget_max_inr ?? 0}
                    location={req.city || "Location not specified"}
                    propertyType={req.property_type || "Property type not specified"}
                    urgency={req.timeline_to_close || undefined}
                    agent={{
                      id: req.broker_id,
                      name: profile?.full_name || "Unknown Broker",
                      company: profile?.agency_name || "Independent",
                      avatarUrl: profile?.avatar_url || undefined
                    }}
                  />
                );
              }
            })}
          </div>
        )}
      </div>

    </div>
  );
}
