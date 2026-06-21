"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { FilterBar } from "@/components/listings/FilterBar";
import { PropertyCard } from "@/components/ui/PropertyCard";
import { SkeletonCard } from "@/components/ui/SkeletonCard";

// Mock data to ensure visual population before DB is full
const mockListings = [
  {
    id: "1",
    title: "Premium 4 BHK Penthouse",
    price: 125000000, // 12.5 Cr
    location: "Bandra West, Mumbai",
    type: "Residential",
    bhk: 4,
    area_sqft: 3500,
    status: "Available",
    agent_name: "Rahul Desai",
    agent_company: "LuxuryEstates",
    agent_avatar: "https://i.pravatar.cc/150?u=a042581f4e29026024d",
    image_url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=2070",
  },
  {
    id: "2",
    title: "Sea-Facing 3 BHK Apartment",
    price: 85000000, // 8.5 Cr
    location: "Worli, Mumbai",
    type: "Residential",
    bhk: 3,
    area_sqft: 2100,
    status: "Available",
    agent_name: "Sneha Patel",
    agent_company: "Skyline Realty",
    agent_avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
    image_url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=2075",
  },
  {
    id: "3",
    title: "Commercial Office Space",
    price: 45000000, // 4.5 Cr
    location: "BKC, Mumbai",
    type: "Commercial",
    bhk: null,
    area_sqft: 1500,
    status: "Available",
    agent_name: "Vikram Singh",
    agent_company: "Corporate Spaces",
    agent_avatar: "https://i.pravatar.cc/150?u=a04258114e29026702d",
    image_url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=2069",
  },
  {
    id: "4",
    title: "Luxury Villa with Pool",
    price: 250000000, // 25 Cr
    location: "Alibaug",
    type: "Residential",
    bhk: 5,
    area_sqft: 6000,
    status: "Available",
    agent_name: "Amit Kumar",
    agent_company: "Elite Homes",
    agent_avatar: "https://i.pravatar.cc/150?u=a04258a2462d826712d",
    image_url: "https://images.unsplash.com/photo-1613490908653-b0ee6b3f7435?auto=format&fit=crop&q=80&w=2070",
  },
  {
    id: "5",
    title: "Boutique 2 BHK",
    price: 35000000, // 3.5 Cr
    location: "Andheri West, Mumbai",
    type: "Residential",
    bhk: 2,
    area_sqft: 950,
    status: "Available",
    agent_name: "Priya Sharma",
    agent_company: "Urban Nest",
    agent_avatar: "https://i.pravatar.cc/150?u=a048581f4e29026701d",
    image_url: "https://images.unsplash.com/photo-1502672260266-1c1e5252b415?auto=format&fit=crop&q=80&w=1973",
  }
];

export default function GlobalListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchListings() {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          profiles!listings_broker_id_fkey (full_name, agency_name, avatar_url)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setListings(data);
      }
      setIsLoading(false);
    }
    fetchListings();
  }, []);

  return (
    <div className="min-h-full flex flex-col pt-[calc(env(safe-area-inset-top)+1rem)] relative">
      
      {/* Sticky Header / Filter Bar */}
      <div className="sticky top-0 z-40 px-4 md:px-8 py-4">
        <FilterBar />
      </div>

      {/* Listings Grid */}
      <div className="flex-1 px-4 md:px-8 pb-10">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listings.map((property) => (
              <PropertyCard
                key={property.id}
                id={property.id}
                title={property.title}
                price={property.price_inr}
                location={property.city}
                type={property.property_type}
                bhk={property.configuration}
                area={property.square_feet}
                imageUrl={Array.isArray(property.images) && property.images.length > 0 ? property.images[0] : ""}
                agent={{
                  name: Array.isArray(property.profiles) ? property.profiles[0]?.full_name : property.profiles?.full_name || "Unknown Broker",
                  company: Array.isArray(property.profiles) ? property.profiles[0]?.agency_name : property.profiles?.agency_name || "Independent",
                  avatarUrl: Array.isArray(property.profiles) ? property.profiles[0]?.avatar_url : property.profiles?.avatar_url
                }}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
