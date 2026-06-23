"use client";

import React, { useState } from 'react';
import { motion, HTMLMotionProps, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";

export function PremiumButton({ children, className = '', onClick, ...props }: HTMLMotionProps<"button">) {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newRipple = { id: Date.now(), x, y };
    setRipples((prev) => [...prev, newRipple]);

    // Cleanup after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 1000);

    if (onClick) {
      onClick(e);
    }
  };
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
      onClick={handleClick}
      {...props}
    >
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ top: ripple.y, left: ripple.x, width: 0, height: 0, opacity: 0.5 }}
            animate={{ width: 300, height: 300, opacity: 0, top: ripple.y - 150, left: ripple.x - 150 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute rounded-full bg-white pointer-events-none mix-blend-overlay"
          />
        ))}
      </AnimatePresence>
      {/* Specular Highlight (Simulating light passing over glass) */}
      <div className="absolute top-0 -left-1/4 w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 opacity-0 group-hover:opacity-100 transition-all duration-700 ease-in-out group-hover:translate-x-[300%] pointer-events-none" />
      <span className="relative z-10">{children as React.ReactNode}</span>
    </motion.button>
  );
}
