"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Bed, Maximize, ShieldCheck, Sparkles, MessageSquare, Clock, ArrowLeft, X } from "lucide-react";
import Image from "next/image";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { GlassCard } from "@/components/ui/GlassCard";

export default function ListingDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    async function fetchListing() {
      try {
        const { data, error: fetchError } = await supabase
          .from('listings')
          .select(`
            *,
            profiles!listings_broker_id_fkey (id, full_name, agency_name, avatar_url)
          `)
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        setListing(data);
      } catch (err: any) {
        setError("Could not load listing details.");
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchListing();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-[calc(env(safe-area-inset-top)+2rem)]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-[#D4AF37]/20 border-t-[#D4AF37] rounded-full animate-spin mb-4"></div>
          <p className="text-[#D4AF37]/50 font-mono text-sm tracking-widest uppercase">Loading Luxury</p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl text-red-400 mb-4">{error}</h1>
        <PremiumButton onClick={() => router.back()}>Go Back</PremiumButton>
      </div>
    );
  }

  const broker = Array.isArray(listing.profiles) ? listing.profiles[0] : listing.profiles;
  const images = Array.isArray(listing.images) && listing.images.length > 0 ? listing.images : ["/placeholder.jpg"];
  const coverImage = images[0];

  // Calculate intelligent metrics
  const pricePerSqFt = listing.price_inr && listing.square_feet 
    ? Math.round(listing.price_inr / listing.square_feet).toLocaleString() 
    : "N/A";
    
  const daysOnMarket = listing.created_at 
    ? Math.max(1, Math.floor((new Date().getTime() - new Date(listing.created_at).getTime()) / (1000 * 3600 * 24)))
    : 1;

  const handleStartChat = () => {
    // Navigate to messages with context for WhatsApp-style tagging
    const query = new URLSearchParams({
      brokerId: broker?.id || '',
      listingId: listing.id,
      title: listing.title,
      price: (listing.price_inr / 10000000).toFixed(2) + ' Cr',
      location: listing.city
    }).toString();
    router.push(`/messages?${query}`);
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Edge-to-Edge Hero Cover Carousel */}
      <div className="relative w-full h-[60vh] md:h-[75vh] bg-[#0B1120] overflow-hidden group">
        <div 
          className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
          onScroll={(e) => {
            const el = e.currentTarget;
            const index = Math.round(el.scrollLeft / el.clientWidth);
            if (!lightboxOpen) setLightboxIndex(index);
          }}
        >
          {images.map((img: string, idx: number) => (
            <div 
              key={idx} 
              className="relative w-full h-full flex-shrink-0 snap-center cursor-pointer"
              onClick={() => {
                setLightboxIndex(idx);
                setLightboxOpen(true);
              }}
            >
              <Image 
                src={img}
                alt={`${listing.title} - Image ${idx + 1}`}
                fill
                className="object-cover opacity-60 hover:opacity-80 transition-opacity duration-500"
                unoptimized
              />
            </div>
          ))}
        </div>
        
        {/* Navigation Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+12rem)] md:bottom-12 right-6 flex gap-2 z-30 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            {images.map((_: any, idx: number) => (
              <div 
                key={idx} 
                className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === lightboxIndex ? 'bg-white' : 'bg-white/30'}`} 
              />
            ))}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-[#0B1120]/40 to-transparent pointer-events-none" />
        
        {/* Top Nav Overlay */}
        <div className="absolute top-[calc(env(safe-area-inset-top)+2rem)] left-4 md:left-10 z-50">
          <button 
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 z-20">
          <div className="max-w-7xl mx-auto">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-3 mb-4"
            >
              <div className="bg-[#D4AF37]/20 backdrop-blur-md border border-[#D4AF37]/30 px-3 py-1.5 rounded-full flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest">Verified Premium</span>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
                <Clock className="w-4 h-4 text-white/70" />
                <span className="text-white/70 text-xs font-bold uppercase tracking-widest">{daysOnMarket} DOM</span>
              </div>
            </motion.div>

            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl font-light text-white tracking-tight mb-4"
            >
              {listing.title}
            </motion.h1>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap items-center gap-6 text-white/70"
            >
              <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-[#D4AF37]" /> {listing.city} {listing.locality ? `• ${listing.locality}` : ''}</div>
              <div className="flex items-center gap-2"><Bed className="w-5 h-5 text-[#D4AF37]" /> {listing.configuration}</div>
              <div className="flex items-center gap-2"><Maximize className="w-5 h-5 text-[#D4AF37]" /> {listing.square_feet?.toLocaleString()} sq.ft</div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 md:px-10 -mt-8 relative z-30 flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Details */}
        <div className="flex-1 space-y-8">
          
          {/* Quick Stats Strip */}
          <GlassCard className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-white/10">
            <div className="px-4 first:px-0">
              <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Asking Price</p>
              <p className="text-2xl font-light text-[#D4AF37]">₹ {(listing.price_inr / 10000000).toFixed(2)} Cr</p>
            </div>
            <div className="px-4">
              <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Price per Sq.Ft</p>
              <p className="text-xl font-light text-white">₹ {pricePerSqFt}</p>
            </div>
            <div className="px-4">
              <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Property Type</p>
              <p className="text-xl font-light text-white">{listing.property_type}</p>
            </div>
            <div className="px-4">
              <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Status</p>
              <p className="text-xl font-light text-white">Available</p>
            </div>
          </GlassCard>

          {/* AI Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="text-2xl font-light text-white">Executive Summary</h2>
            </div>
            <div className="prose prose-invert max-w-none text-white/80 leading-relaxed font-light text-lg">
              {listing.description?.split('\n').map((paragraph: string, i: number) => (
                <p key={i} className="mb-4">{paragraph}</p>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Floating Broker Card */}
        <div className="w-full lg:w-[400px]">
          <div className="sticky top-[calc(env(safe-area-inset-top)+2rem)]">
            <GlassCard className="p-8 flex flex-col items-center text-center relative overflow-hidden">
              {/* Specular Highlight */}
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
              
              <div className="relative w-24 h-24 rounded-full border-2 border-white/10 bg-slate-800 overflow-hidden mb-4 shadow-2xl">
                {broker?.avatar_url ? (
                  <Image src={broker.avatar_url} alt="Broker" fill className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/50 text-2xl font-light">
                    {broker?.full_name?.charAt(0) || "B"}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 bg-[#D4AF37] rounded-full p-1 border-2 border-[#0B1120]">
                  <ShieldCheck className="w-3 h-3 text-[#0B1120]" />
                </div>
              </div>

              <h3 className="text-xl font-semibold text-white mb-1">{broker?.full_name || "Listing Broker"}</h3>
              <p className="text-[#D4AF37] font-bold text-[10px] tracking-widest uppercase mb-6">{broker?.agency_name || "Independent Consultant"}</p>

              <div className="w-full space-y-4">
                <button 
                  onClick={handleStartChat}
                  className="w-full flex items-center justify-center gap-3 bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                >
                  <MessageSquare className="w-5 h-5" />
                  Request Direct Mandate
                </button>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-4">
                  Strictly Confidential • In-App Messaging Only
                </p>
              </div>
            </GlassCard>
          </div>
        </div>

      </div>

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col"
          >
            <div className="flex items-center justify-between p-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
              <p className="text-white/50 font-mono text-sm">{lightboxIndex + 1} / {images.length}</p>
              <button 
                onClick={() => setLightboxOpen(false)}
                className="p-2 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 relative w-full flex items-center justify-center overflow-hidden pb-10">
              <div className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
                   ref={(el) => {
                     if (el) {
                       el.scrollTo({ left: el.clientWidth * lightboxIndex, behavior: 'instant' });
                     }
                   }}
                   onScroll={(e) => {
                     const el = e.currentTarget;
                     const index = Math.round(el.scrollLeft / el.clientWidth);
                     if (index !== lightboxIndex) setLightboxIndex(index);
                   }}
              >
                {images.map((img: string, idx: number) => (
                  <div key={idx} className="relative w-full h-full flex-shrink-0 snap-center p-2 md:p-8">
                    <Image 
                      src={img}
                      alt={`Fullscreen Image ${idx + 1}`}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
