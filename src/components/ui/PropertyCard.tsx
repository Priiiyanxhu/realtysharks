"use client";

import { motion } from "framer-motion";
import { MapPin, ShieldCheck, Bed } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";

interface Agent {
  id?: string;
  name: string;
  avatarUrl?: string;
  company?: string;
}

interface PropertyCardProps {
  id?: string | number;
  title: string;
  price: string | number;
  location: string;
  bhk: string;
  type?: string;
  area?: string | number;
  imageUrl: string;
  isVerified?: boolean;
  directMandate?: boolean;
  agent?: Agent;
  onEdit?: () => void;
  onDelete?: () => void;
  matchScore?: number;
}

export function PropertyCard({
  id,
  title,
  price,
  location,
  bhk,
  imageUrl,
  isVerified = true,
  directMandate = false,
  agent,
  onEdit,
  onDelete,
  matchScore,
}: PropertyCardProps) {
  // Extract numerical value from price string for PriceDisplay if it's passed as a string (e.g. "$12,500,000")
  // For robustness, if it's already a number, use it. If it's a string, strip non-digits.
  const numericalPrice = typeof price === 'number' 
    ? price 
    : parseInt(price.replace(/[^0-9]/g, ''), 10) || 0;

  const router = useRouter();
  const orientation = useDeviceOrientation();

  const handleClick = () => {
    if (id) {
      router.push(`/listings/${id}`);
    }
  };

  // Map device orientation to X/Y offsets for the glare
  // Gamma (left/right tilt): -45 to 45 degrees -> -50px to 50px
  // Beta (front/back tilt): 0 to 90 degrees (holding phone) -> -50px to 50px
  const glareX = orientation.gamma ? Math.max(-50, Math.min(50, orientation.gamma * 1.5)) : 0;
  const glareY = orientation.beta ? Math.max(-50, Math.min(50, (orientation.beta - 45) * 1.5)) : 0;

  return (
    <motion.div
      whileHover="hover"
      initial="initial"
      variants={{
        initial: { scale: 1 },
        hover: { scale: 1.02 },
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={handleClick}
      className={`relative overflow-hidden rounded-[2rem] w-full group bg-black/30 backdrop-blur-3xl border border-white/20 hover:border-[#D4AF37]/50 flex flex-col shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] ${id ? 'cursor-pointer' : ''}`}
    >
      {/* Specular Highlight: Light hitting glass at top-left, moves with gyro */}
      <motion.div 
        animate={{ x: glareX, y: glareY }}
        transition={{ type: "spring", stiffness: 50, damping: 20 }}
        className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-white/[0.15] to-transparent rounded-full pointer-events-none z-10 mix-blend-overlay blur-xl" 
      />

      {/* Property Image Container */}
      <div className="relative w-full h-48 bg-[#1a2028] overflow-hidden shrink-0 rounded-t-[2rem]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
            <MapPin className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-xs uppercase tracking-widest font-mono">No Image</span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
          {directMandate && (
            <span className="px-3 py-1 bg-rose-500/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg border border-rose-400/50 flex items-center gap-1.5 w-fit">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Direct Mandate
            </span>
          )}
          {matchScore !== undefined && (
            <span className="px-3 py-1 bg-indigo-500/90 backdrop-blur-md text-white text-[10px] font-bold tracking-widest rounded-full shadow-lg border border-indigo-400/50 flex items-center gap-1.5 w-fit">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              {Math.round(matchScore)}% Match
            </span>
          )}
        </div>
        
        {/* Subtle dark gradient overlay at the bottom of the image so agent text pops */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#050505] to-transparent z-10" />

        {/* Verified Badge or Action Buttons */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
          {id && (
            <button 
              onClick={async (e) => { 
                e.stopPropagation(); 
                try {
                  const { generatePdfFlyer } = await import('@/utils/pdfGenerator');
                  const btn = e.currentTarget;
                  const originalHtml = btn.innerHTML;
                  btn.innerHTML = '<svg class="animate-spin w-3 h-3 text-[#D4AF37]" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
                  await generatePdfFlyer(id);
                  btn.innerHTML = originalHtml;
                } catch(err) {
                  console.error(err);
                  alert("Failed to generate PDF");
                }
              }}
              className="bg-black/50 backdrop-blur-md border border-white/20 p-2 rounded-full hover:bg-[#D4AF37]/20 hover:border-[#D4AF37]/30 transition-colors shadow-lg"
              title="Download PDF Flyer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white hover:text-[#D4AF37]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>
          )}
          {onEdit && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="bg-black/50 backdrop-blur-md border border-white/20 p-2 rounded-full hover:bg-[#D4AF37]/20 hover:border-[#D4AF37]/30 transition-colors shadow-lg"
              title="Edit Listing"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white hover:text-[#D4AF37]"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="bg-black/50 backdrop-blur-md border border-white/20 p-2 rounded-full hover:bg-red-500/20 hover:border-red-500/30 transition-colors shadow-lg"
              title="Delete Listing"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white hover:text-red-400"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>
          )}
          {isVerified && !onEdit && !onDelete && (
            <div className="bg-[#D4AF37]/20 backdrop-blur-md border border-[#D4AF37]/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="text-[#D4AF37] text-[10px] font-bold uppercase tracking-wider">
                Verified
              </span>
            </div>
          )}
        </div>

        {/* Agent Avatar Overlaid on Image Bottom */}
        {agent && (
          <div 
            className={`absolute bottom-3 left-4 flex items-center gap-2 z-[60] ${agent.id ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={(e) => {
              if (agent.id) {
                e.stopPropagation();
                router.push(`/network/${agent.id}`);
              }
            }}
            title={agent.id ? "View Broker Profile" : ""}
          >
            <div className="w-8 h-8 rounded-full border border-white/20 bg-slate-800 overflow-hidden shrink-0 shadow-lg">
              {agent.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-white/50">{agent.name.charAt(0)}</div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-white shadow-sm leading-tight">{agent.name}</span>
              <span className="text-[10px] text-[#D4AF37] font-semibold shadow-sm leading-tight">{agent.company || 'Broker'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-5 space-y-3 relative z-10 flex-1 flex flex-col justify-between">
        
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white/90 tracking-tight line-clamp-1">
            {title}
          </h3>
          <PriceDisplay amount={numericalPrice} className="text-xl" />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
          <div className="flex items-center gap-1.5 text-white/50">
            <MapPin className="w-3.5 h-3.5" />
            <span className="text-xs font-medium truncate max-w-[120px]">{location}</span>
          </div>
          <div className="flex items-center gap-1.5 text-white/50 shrink-0">
            <Bed className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{bhk}</span>
          </div>
        </div>
      </div>
      
      {/* Guaranteed Click Overlay */}
      {id && (
        <div 
          className="absolute inset-0 z-50 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/listings/${id}`);
          }}
        />
      )}
    </motion.div>
  );
}
