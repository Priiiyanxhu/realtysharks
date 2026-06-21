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
        "bg-gradient-to-r from-emerald-400 to-emerald-600 text-white rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]",
        "hover:from-emerald-300 hover:to-emerald-500 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_0_20px_rgba(16,185,129,0.4)] hover:-translate-y-0.5",
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
