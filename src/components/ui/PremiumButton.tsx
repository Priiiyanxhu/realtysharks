"use client";

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from "@/lib/utils";

export function PremiumButton({ children, className = '', ...props }: HTMLMotionProps<"button">) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={cn(
        "relative overflow-hidden font-semibold transition-all duration-300 px-6 py-3",
        "bg-gradient-to-r from-[#D4AF37] to-[#FACC15] text-[#0B1120] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]",
        "hover:from-[#FACC15] hover:to-[#D4AF37] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_0_20px_rgba(212,175,55,0.6)] hover:-translate-y-0.5",
        "active:scale-95 active:translate-y-0",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0",
        className
      )}
      {...props}
    >
      {/* Specular Highlight (Simulating light passing over glass) */}
      <div className="absolute top-0 -left-1/4 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 opacity-0 group-hover:opacity-100 transition-all duration-700 ease-in-out group-hover:translate-x-[300%] pointer-events-none" />
      <span className="relative z-10">{children as React.ReactNode}</span>
    </motion.button>
  );
}
