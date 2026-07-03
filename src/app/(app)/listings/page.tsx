"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { FilterBar, FilterState } from "@/components/listings/FilterBar";
import { PropertyCard } from "@/components/ui/PropertyCard";
import { RequirementCard } from "@/components/listings/RequirementCard";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SearchX, RefreshCcw } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ListingData = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequirementData = any;

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
  status: "",
  budgetMin: "",
  budgetMax: ""
};

export default function GlobalListingsPage() {
  const [feedItems, setFeedItems] = useState<UnifiedFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

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
              *,
              profiles!listings_broker_id_fkey (full_name, agency_name, avatar_url)
            `)
            .eq('status', filters.status || 'active')
            .order('created_at', { ascending: false })
            .limit(30);

          if (debouncedQuery) {
            query = query.ilike('title', `%${debouncedQuery}%`);
          }
          if (debouncedLocation) {
            query = query.ilike('location', `%${debouncedLocation}%`);
          }
          if (filters.propertyType) {
            query = query.ilike('property_type', `%${filters.propertyType}%`);
          }
          if (debouncedBudgetMin) {
            query = query.gte('price', parseFloat(debouncedBudgetMin));
          }
          if (debouncedBudgetMax) {
            query = query.lte('price', parseFloat(debouncedBudgetMax));
          }

          const { data, error } = await query;
          if (error) throw error;
          
          return (data || []).map(item => ({
            itemType: "listing" as const,
            id: item.id,
            created_at: item.created_at,
            data: item
          }));
        };

        const fetchRequirements = async () => {
          let query = supabase
            .from('requirements')
            .select(`
              *,
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

          return (data || []).map(item => ({
            itemType: "requirement" as const,
            id: item.id,
            created_at: item.created_at,
            data: item
          }));
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
    filters.status
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
              onClick={() => setFilters({...filters})}
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
                return (
                  <PropertyCard
                    key={`listing-${item.id}`}
                    id={property.id}
                    title={property.title}
                    price={property.price}
                    location={property.location}
                    type={property.property_type}
                    bhk={property.bhk}
                    imageUrl={property.image_url}
                    agent={{
                      name: Array.isArray(property.profiles) ? property.profiles[0]?.full_name : property.profiles?.full_name || "Unknown Broker",
                      company: Array.isArray(property.profiles) ? property.profiles[0]?.agency_name : property.profiles?.agency_name || "Independent",
                      avatarUrl: Array.isArray(property.profiles) ? property.profiles[0]?.avatar_url : property.profiles?.avatar_url
                    }}
                  />
                );
              } else {
                const req = item.data;
                return (
                  <RequirementCard
                    key={`req-${item.id}`}
                    id={req.id}
                    title={req.details}
                    budgetMin={req.budget_min_inr}
                    budgetMax={req.budget_max_inr}
                    location={req.city}
                    propertyType={req.property_type}
                    urgency={req.timeline_to_close}
                    agent={{
                      id: req.broker_id,
                      name: Array.isArray(req.profiles) ? req.profiles[0]?.full_name : req.profiles?.full_name || "Unknown Broker",
                      company: Array.isArray(req.profiles) ? req.profiles[0]?.agency_name : req.profiles?.agency_name || "Independent",
                      avatarUrl: Array.isArray(req.profiles) ? req.profiles[0]?.avatar_url : req.profiles?.avatar_url
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
