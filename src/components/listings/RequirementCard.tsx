"use client";

import { motion } from "framer-motion";
import { MapPin, Target, Clock, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Agent {
  id?: string;
  name: string;
  avatarUrl?: string;
  company?: string;
}

interface RequirementCardProps {
  id: string;
  title: string; // From 'details'
  budgetMin: number;
  budgetMax: number;
  location: string;
  propertyType: string;
  urgency?: string; // From timeline_to_close
  agent?: Agent;
}

export function RequirementCard({
  id,
  title,
  budgetMin,
  budgetMax,
  location,
  propertyType,
  urgency,
  agent,
}: RequirementCardProps) {
  const router = useRouter();

  const formatBudget = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
    return `₹${val.toLocaleString()}`;
  };

  const handleClick = () => {
    router.push(`/network/${id}`);
  };

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
      className="relative overflow-hidden rounded-[2rem] w-full group bg-black/40 backdrop-blur-3xl border border-indigo-500/20 hover:border-indigo-400/50 flex flex-col shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] cursor-pointer"
    >
      {/* Top Section */}
      <div className="p-5 flex-1 flex flex-col gap-4 relative z-10">
        <div className="flex justify-between items-start gap-4">
          <span className="px-3 py-1 bg-indigo-500/20 backdrop-blur-md text-indigo-300 text-[10px] font-bold uppercase tracking-widest rounded-full border border-indigo-400/30 flex items-center gap-1.5 w-fit shrink-0">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
            BUYER DEMAND
          </span>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-[#D4AF37]">
              {formatBudget(budgetMin)} - {formatBudget(budgetMax)}
            </p>
            <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">Budget</p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white/90 tracking-tight line-clamp-2 leading-tight">
            {title || `${propertyType} in ${location}`}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-auto">
          <div className="flex items-center gap-2 text-white/60">
            <MapPin className="w-4 h-4 shrink-0 text-white/40" />
            <span className="text-xs font-medium truncate">{location || "Any Location"}</span>
          </div>
          <div className="flex items-center gap-2 text-white/60">
            <Target className="w-4 h-4 shrink-0 text-white/40" />
            <span className="text-xs font-medium truncate">{propertyType || "Any Type"}</span>
          </div>
          {urgency && (
            <div className="flex items-center gap-2 text-white/60 col-span-2">
              <Clock className="w-4 h-4 shrink-0 text-white/40" />
              <span className="text-xs font-medium truncate">Closes in {urgency}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Agent & CTA */}
      <div className="bg-[#0f1419]/80 border-t border-white/5 p-4 flex items-center justify-between gap-4 relative z-10">
        {agent && (
          <div 
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            onClick={(e) => {
              if (agent.id) {
                e.stopPropagation();
                router.push(`/network/${agent.id}`);
              }
            }}
          >
            <div className="w-8 h-8 rounded-full border border-white/10 bg-slate-800 overflow-hidden shrink-0">
              {agent.avatarUrl ? (
                <Image src={agent.avatarUrl} alt={agent.name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-white/50">{agent.name.charAt(0)}</div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-white truncate">{agent.name}</span>
              <span className="text-[10px] text-indigo-300 truncate">{agent.company || 'Broker'}</span>
            </div>
          </div>
        )}
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (agent?.id) {
              router.push(`/messages?brokerId=${agent.id}`);
            }
          }}
          className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors flex items-center gap-2"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          I Have a Match
        </button>
      </div>
      
    </motion.div>
  );
}
