"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { DataInput } from "@/components/ui/DataInput";
import { PremiumButton } from "@/components/ui/PremiumButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { Sparkles } from "lucide-react";

export default function PostRequirementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  
  // Form state
  const [propertyType, setPropertyType] = useState("Residential");
  const [location, setLocation] = useState("");
  const [locality, setLocality] = useState("");
  const [bhk, setBhk] = useState("");
  const [price, setPrice] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  
  // Advanced Qualification State
  const [timeline, setTimeline] = useState("1-3 Months");
  const [fundingStatus, setFundingStatus] = useState("Pre-approved Loan");
  const [clientProfile, setClientProfile] = useState("HNI Investor");
  const [purchasePurpose, setPurchasePurpose] = useState("Investment");
  const [expectedYield, setExpectedYield] = useState("");
  const [dealbreakers, setDealbreakers] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState("Standard");
  const [directMandateOnly, setDirectMandateOnly] = useState(false);
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // AI state
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch requirement if editing
  useEffect(() => {
    if (editId) {
      const fetchReq = async () => {
        const { data, error } = await supabase.from('requirements').select('*').eq('id', editId).single();
        if (data) {
          setPropertyType(data.property_type || "Residential");
          setLocation(data.city || "");
          setLocality(data.preferred_localities?.[0] || "");
          setBhk(data.configuration || "");
          setPrice(data.budget_max_inr?.toString() || "");
          setArea(data.min_square_feet?.toString() || "");
          setDescription(data.details || "");
          setPrivacyLevel(data.privacy_level || "Standard");
          setClientProfile(data.client_profile || "HNI Investor");
          setFundingStatus(data.funding_status || "Pre-approved Loan");
          setTimeline(data.timeline_to_close || "1-3 Months");
          setPurchasePurpose(data.purchase_purpose || "Investment");
          setExpectedYield(data.expected_yield || "");
          setDealbreakers(data.required_amenities?.join(', ') || "");
          setDirectMandateOnly(data.direct_mandate_only || false);
          if (data.client_profile || data.funding_status) setShowAdvanced(true);
        }
      };
      fetchReq();
    }
  }, [editId]);

  const generateAiDescription = async () => {
    if (!propertyType || !location || !price) {
      setError("Please fill in Property Type, City, and Budget to generate a description.");
      return;
    }
    
    setIsAiLoading(true);
    setError(null);
    try {
      const prompt = `Write a highly personalized, unique, and professional summary for a real estate buyer requirement. 
      Details strictly provided by the buyer broker:
      - Property Type: ${propertyType}
      - Configuration: ${bhk || "N/A"}
      - City: ${location}
      - Locality: ${locality || "N/A"}
      - Budget Maximum: ${price}
      - Minimum Area: ${area ? area + ' sq.ft' : "N/A"}
      
      Buyer Qualification & Mandate Details (CRITICAL to weave naturally into the summary to make it convincing):
      - Client Profile: ${clientProfile}
      - Funding Status: ${fundingStatus}
      - Timeline to Close: ${timeline}
      - Purpose of Purchase: ${purchasePurpose}
      - Expected ROI/Yield: ${purchasePurpose === 'Investment' && expectedYield ? expectedYield : "N/A"}
      - Must-Haves / Dealbreakers: ${dealbreakers || "N/A"}
      - Privacy/Mandate: ${privacyLevel === "Highly Confidential" ? "Strictly Confidential VIP Client" : "Standard"} ${directMandateOnly ? " - Direct Mandates Only (No chain brokers allowed)" : ""}
      
      Do NOT add extra features, do NOT write anything false, and do NOT use generic placeholders. 
      Be highly specific and accurate to the details provided above. Keep it concise, sophisticated, and targeted at elite institutional brokers.`;
      
      const res = await fetch("/api/ai-autowrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDescription(data.description);
      setIsAiGenerated(true);
    } catch (err: any) {
      setError(err?.message || "Failed to generate AI description");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSubmitStatus("Checking authentication...");

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error("You must be logged in to post a requirement.");

      setSubmitStatus("Saving to database...");
      const numericalPrice = parseInt(price.replace(/[^0-9]/g, ''), 10) || 0;
      const numericalArea = parseInt(area.replace(/[^0-9]/g, ''), 10) || 0;

      const payload = {
        broker_id: session.user.id,
        property_type: propertyType,
        city: location,
        preferred_localities: locality ? [locality] : [],
        configuration: bhk,
        budget_min_inr: 0,
        budget_max_inr: numericalPrice,
        min_square_feet: numericalArea,
        details: description,
        privacy_level: privacyLevel,
        required_amenities: dealbreakers ? dealbreakers.split(',').map(item => item.trim()).filter(Boolean) : [],
        client_profile: clientProfile,
        funding_status: fundingStatus,
        timeline_to_close: timeline,
        purchase_purpose: purchasePurpose,
        expected_yield: expectedYield,
        direct_mandate_only: directMandateOnly,
        is_active: true
      };

      let dbError;
      if (editId) {
        const { error } = await supabase.from('requirements').update(payload).eq('id', editId);
        dbError = error;
      } else {
        const { error } = await supabase.from('requirements').insert(payload);
        dbError = error;
      }

      if (dbError) throw dbError;

      setSubmitStatus("Redirecting...");
      router.push("/profile");
    } catch (err: any) {
      const errorMsg = err?.message || err?.error_description || (typeof err === 'string' ? err : "Unknown error occurred.");
      setError(errorMsg);
      setIsSubmitting(false);
      setSubmitStatus("");
    }
  };

  return (
    <div className="min-h-full py-10 px-4 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {editId ? "Edit" : "Post"} <span className="text-emerald-500">Requirement</span>
          </h1>
          <p className="text-gray-400 mt-2">
            {editId ? "Update your active requirement." : "Broadcast your buyer's needs to elite brokers."}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <GlassCard className="p-6 md:p-8 space-y-6">
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/10 pb-4">Client Requirements</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Property Type</label>
                <select 
                  value={propertyType} 
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-gray-700/50 text-white rounded-full px-4 py-3 outline-none focus:border-emerald-500/50 transition-all appearance-none"
                >
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Land">Land</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">City</label>
                <DataInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mumbai" required />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Locality</label>
                <DataInput value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="e.g. Bandra West" />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Configuration (BHK)</label>
                <DataInput value={bhk} onChange={(e) => setBhk(e.target.value)} placeholder="e.g. 4 BHK" />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Maximum Budget</label>
                <DataInput value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 125000000" type="number" formatType="currency" required />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Min Area (sq.ft)</label>
                <DataInput value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. 2500" type="number" formatType="area" />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 md:p-8 space-y-6">
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/10 pb-4">Buyer Qualification & Mandate</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Client Profile</label>
                <select value={clientProfile} onChange={(e) => setClientProfile(e.target.value)} className="w-full bg-[#1A1A1A] border border-gray-700/50 text-white rounded-full px-4 py-3 outline-none focus:border-emerald-500/50 transition-all appearance-none">
                  <option value="HNI Investor">HNI Investor</option>
                  <option value="Corporate Relocation">Corporate Relocation</option>
                  <option value="End-User Family">End-User Family</option>
                  <option value="Institutional Fund">Institutional Fund</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Funding Status</label>
                <select value={fundingStatus} onChange={(e) => setFundingStatus(e.target.value)} className="w-full bg-[#1A1A1A] border border-gray-700/50 text-white rounded-full px-4 py-3 outline-none focus:border-emerald-500/50 transition-all appearance-none">
                  <option value="Pre-approved Loan">Pre-approved Loan</option>
                  <option value="Cash Buyer / Liquid Funds">Cash Buyer / Liquid Funds</option>
                  <option value="Selling existing property">Selling existing property</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Timeline to Close</label>
                <select value={timeline} onChange={(e) => setTimeline(e.target.value)} className="w-full bg-[#1A1A1A] border border-gray-700/50 text-white rounded-full px-4 py-3 outline-none focus:border-emerald-500/50 transition-all appearance-none">
                  <option value="Immediate (0-15 Days)">Immediate (0-15 Days)</option>
                  <option value="1-3 Months">1-3 Months</option>
                  <option value="3-6 Months">3-6 Months</option>
                  <option value="Just Browsing">Just Browsing</option>
                </select>
              </div>
            </div>

            {/* Advanced Toggle */}
            <div className="pt-2">
              <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-emerald-400 text-sm font-medium hover:text-emerald-300 transition-colors flex items-center gap-1"
              >
                {showAdvanced ? "- Hide Advanced Options" : "+ Show Advanced Options (Purpose, Yield, Dealbreakers)"}
              </button>
            </div>

            {showAdvanced && (
              <div className="pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Purpose of Purchase</label>
                  <select value={purchasePurpose} onChange={(e) => setPurchasePurpose(e.target.value)} className="w-full bg-[#1A1A1A] border border-gray-700/50 text-white rounded-full px-4 py-3 outline-none focus:border-emerald-500/50 transition-all appearance-none">
                    <option value="Investment">Investment (Yield/Appreciation)</option>
                    <option value="End-Use">End-Use (Self Occupancy)</option>
                    <option value="Flipping">Flipping / Renovation</option>
                  </select>
                </div>

                {purchasePurpose === "Investment" && (
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Expected ROI / Yield</label>
                    <DataInput value={expectedYield} onChange={(e) => setExpectedYield(e.target.value)} placeholder="e.g. Min 6% Rental Yield" />
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Must-Haves (Dealbreakers)</label>
                  <DataInput value={dealbreakers} onChange={(e) => setDealbreakers(e.target.value)} placeholder="e.g. Strictly East-facing, Minimum 3 Car Parks, No Ground Floor" />
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-white/10">
              <h3 className="text-sm font-semibold text-white mb-4">Mandate & Privacy</h3>
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1 space-y-2">
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Privacy Level</label>
                  <select value={privacyLevel} onChange={(e) => setPrivacyLevel(e.target.value)} className="w-full bg-[#1A1A1A] border border-gray-700/50 text-white rounded-full px-4 py-3 outline-none focus:border-emerald-500/50 transition-all appearance-none">
                    <option value="Standard">Standard</option>
                    <option value="Highly Confidential">Highly Confidential (VIP Client)</option>
                  </select>
                </div>
                
                <div className="flex-1 flex items-center pt-6">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={directMandateOnly}
                        onChange={(e) => setDirectMandateOnly(e.target.checked)}
                        className="peer appearance-none w-5 h-5 border border-gray-600 rounded bg-[#1A1A1A] checked:bg-emerald-500 checked:border-emerald-500 transition-all cursor-pointer"
                      />
                      <svg className="absolute w-3 h-3 text-[#050505] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Direct Mandates Only (No chain brokers)</span>
                  </label>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 md:p-8 space-y-6">
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-white/10 pb-4">Property Description</h2>
            
            <div className="space-y-4">
              <div className="flex justify-end">
                <button 
                  type="button" 
                  onClick={generateAiDescription}
                  disabled={isAiLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/30 rounded-full text-sm font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAiLoading ? "Generating..." : "Generate AI Summary"}
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold ml-1">Requirement Details</label>
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (isAiGenerated) setIsAiGenerated(false);
                  }}
                  placeholder="Enter details or use AI Auto-write..."
                  rows={6}
                  className="w-full bg-[#1A1A1A] border border-gray-700/50 text-white placeholder:text-gray-500 rounded-3xl px-5 py-4 outline-none focus:border-emerald-500/50 transition-all resize-none"
                  required
                />
                {isAiGenerated && (
                  <p className="text-[10px] text-emerald-500/80 px-2 mt-1">
                    * This is an AI-written description. AI can make mistakes, kindly review the description carefully.
                  </p>
                )}
              </div>
            </div>
          </GlassCard>

          <div className="flex justify-end pt-4">
            <PremiumButton 
              type="submit" 
              className="w-full"
              disabled={isSubmitting || isAiLoading}
            >
              {isSubmitting ? submitStatus || "Saving..." : editId ? "Update Requirement" : "Publish Requirement"}
            </PremiumButton>
          </div>
        </form>

      </div>
    </div>
  );
}
