"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { DataInput } from "@/components/ui/DataInput";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { Sparkles, Image as ImageIcon, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PostListingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  
  // Form state
  const [title, setTitle] = useState("");
  const [propertyType, setPropertyType] = useState("Residential");
  const [location, setLocation] = useState("");
  const [locality, setLocality] = useState("");
  const [bhk, setBhk] = useState("");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [keywords, setKeywords] = useState("");
  const [description, setDescription] = useState("");
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  
  // AI state
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // File state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  
  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Shown right under the AI button: the form-level `error` sits far above/below it on a long form,
  // so a rate-limit or generation failure would otherwise look like a button that did nothing.
  const [aiError, setAiError] = useState<string | null>(null);

  // Fetch listing if editing
  useEffect(() => {
    if (editId) {
      const fetchListing = async () => {
        const { data, error } = await supabase.from('listings').select('*').eq('id', editId).single();
        if (data) {
          setTitle(data.title || "");
          setPropertyType(data.property_type || "Residential");
          setLocation(data.city || "");
          setLocality(data.locality || "");
          setBhk(data.configuration || "");
          setPrice(data.price_inr?.toString() || "");
          setArea(data.square_feet?.toString() || "");
          setDescription(data.description || "");
          if (data.images && Array.isArray(data.images)) {
            setExistingImages(data.images);
          }
        }
      };
      fetchListing();
    }
  }, [editId]);

  const generateAiDescription = async () => {
    if (!propertyType || !location || !price) {
      setAiError("Please fill out Property Type, Location, and Price before generating AI text.");
      return;
    }
    
    setIsAiLoading(true);
    setError(null);
    setAiError(null);
    try {
      const prompt = `Write a highly specific, unique, and professional description for a property LISTING.
      Details provided by the broker:
      - Title: ${title || "N/A"}
      - Property Type: ${propertyType}
      - Configuration: ${bhk}
      - City/Location: ${location}
      - Locality: ${locality || "N/A"}
      - Price/Budget: ${price}
      - Area: ${area ? area + ' sq.ft' : "N/A"}
      - Additional Keywords/Features: ${keywords || "N/A"}`;

      const res = await fetch("/api/ai-autowrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDescription(data.description);
      setIsAiGenerated(true);
    } catch (err) {
      setAiError((err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err)) || "Failed to generate AI description");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      setSubmitStatus("Checking authentication...");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error("Not authenticated");

      let imageUrls: string[] = [...existingImages];

      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          setSubmitStatus(`Uploading image ${i + 1} of ${imageFiles.length}...`);
          const file = imageFiles[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${session.user.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage.from('listing-images').upload(filePath, file, { upsert: true });
          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(filePath);
          imageUrls.push(publicUrl);
        }
      }

      setSubmitStatus("Saving to database...");
      const numericalPrice = parseInt(price.replace(/[^0-9]/g, ''), 10) || 0;
      const numericalArea = parseInt(area.replace(/[^0-9]/g, ''), 10) || 0;

      const payload = {
        broker_id: session.user.id,
        title,
        property_type: propertyType,
        city: location,
        locality: locality || location, // fallback to city if empty
        configuration: bhk,
        price_inr: numericalPrice,
        square_feet: numericalArea,
        description,
        images: imageUrls,
        is_active: true
      };

      let dbError;
      if (editId) {
        const { error } = await supabase.from('listings').update(payload).eq('id', editId);
        dbError = error;
      } else {
        const { error } = await supabase.from('listings').insert(payload);
        dbError = error;
      }

      if (dbError) throw dbError;

      setSubmitStatus("Redirecting...");
      router.refresh();
      setTimeout(() => {
        router.push("/profile");
      }, 500);
    } catch (err) {
      console.error(err);
      setError((err instanceof Error ? err.message : String(err)) || "An unexpected error occurred.");
      setSubmitStatus("Submit Listing");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full py-10 px-4 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {editId ? "Edit" : "Post New"} <span className="text-[#D4AF37]">Listing</span>
          </h1>
          <p className="text-gray-400 mt-2">
            {editId ? "Update your property details on the network." : "Publish your inventory to the global B2B network."}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <GlassCard className="p-6 md:p-8 space-y-6">
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/10 pb-4">Property Images</h2>
            <div className="space-y-2">
              <div className="border-2 border-dashed border-white/20 rounded-3xl p-8 flex flex-col items-center justify-center text-center bg-white/5 hover:bg-white/10 transition-colors relative cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length + imageFiles.length + existingImages.length > 8) {
                      setError("You can only upload up to 8 images total.");
                      return;
                    }
                    setImageFiles(prev => [...prev, ...files].slice(0, 8));
                    setError(null);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
                />
                <ImageIcon className="w-8 h-8 text-[#D4AF37] mb-3 relative z-10 pointer-events-none" />
                <h3 className="text-sm font-semibold text-white mb-1 relative z-10 pointer-events-none">Upload High-Res Photos (Max 8)</h3>
                
                {(imageFiles.length > 0 || existingImages.length > 0) && (
                  <div className="mt-4 flex flex-wrap gap-2 justify-center relative z-20">
                    {existingImages.map((url, idx) => (
                      <div key={`exist-${idx}`} className="px-3 py-1 bg-white/10 text-white/70 rounded-full text-xs font-medium border border-white/20 flex items-center gap-1.5 pointer-events-auto">
                        <Check className="w-3 h-3" /> Existing Image {idx + 1}
                        <button 
                          type="button" 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExistingImages(prev => prev.filter((_, i) => i !== idx)); }} 
                          className="hover:text-red-400 p-0.5 ml-1 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {imageFiles.map((file, idx) => (
                      <div key={`new-${idx}`} className="px-3 py-1 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-xs font-medium border border-[#D4AF37]/30 flex items-center gap-1.5 pointer-events-auto">
                        <Check className="w-3 h-3" /> {file.name.slice(0, 12)}...
                        <button 
                          type="button" 
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImageFiles(prev => prev.filter((_, i) => i !== idx)); }} 
                          className="hover:text-red-400 p-0.5 ml-1 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 md:p-8 space-y-6">
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/10 pb-4">Basic Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Listing Title</label>
                <DataInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Premium 4 BHK Penthouse" required />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Property Type</label>
                <select 
                  value={propertyType} 
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-gray-700/50 text-white rounded-full px-4 py-3 outline-none focus:border-[#D4AF37]/50 transition-all appearance-none"
                >
                  {[
                    "Apartment / Flat",
                    "Independent House / Villa",
                    "Builder Floor",
                    "Studio Apartment",
                    "Service Apartment",
                    "Penthouse",
                    "Residential Plot",
                    "Commercial Office Space",
                    "Commercial Shop",
                    "Co-working Space",
                    "Industrial Land / Plot",
                    "Agricultural Land",
                    "Farm House",
                    "Warehouse / Godown"
                  ].map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">City</label>
                <DataInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mumbai" required />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Locality</label>
                <DataInput value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="e.g. Bandra West" required />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Configuration (BHK)</label>
                <DataInput value={bhk} onChange={(e) => setBhk(e.target.value)} placeholder="e.g. 4 BHK" />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Price (INR)</label>
                <DataInput value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 125000000" type="number" formatType="currency" required />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Area (Sq.Ft)</label>
                <DataInput value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. 3500" type="number" />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 md:p-8 space-y-6">
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/10 pb-4">AI Auto-Write & Assets</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Keywords for AI (Optional)</label>
                <DataInput value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. Sea view, modern amenities, private pool" />
              </div>

              <div className="flex justify-end">
                <button 
                  type="button" 
                  onClick={generateAiDescription}
                  disabled={isAiLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20 transition-colors border border-[#D4AF37]/30 rounded-full text-sm font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAiLoading ? "Generating..." : "Generate AI Description"}
                </button>
              </div>
              {aiError && (
                <p role="alert" className="text-right text-sm text-red-400">
                  {aiError}
                </p>
              )}

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Property Description</label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (isAiGenerated) setIsAiGenerated(false);
                  }}
                  placeholder="Enter description or use AI Auto-write..."
                  rows={6}
                  className="w-full bg-[#1A1A1A] border border-gray-700/50 text-white placeholder:text-gray-500 rounded-3xl px-5 py-4 outline-none focus:border-[#D4AF37]/50 transition-all resize-none"
                  required
                />
                {isAiGenerated && (
                  <p className="text-[10px] text-[#D4AF37]/80 px-2 mt-1">
                    * This is an AI-written description. AI can make mistakes, kindly review the description carefully.
                  </p>
                )}
              </div>
            </div>


          </GlassCard>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl mt-6">
              <p className="text-red-500 text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <PremiumButton 
              type="submit" 
              className="w-full"
              disabled={isSubmitting || isAiLoading}
            >
              {isSubmitting ? submitStatus || "Saving..." : editId ? "Update Listing" : "Publish Listing"}
            </PremiumButton>
          </div>
        </form>

      </div>
    </div>
  );
}
