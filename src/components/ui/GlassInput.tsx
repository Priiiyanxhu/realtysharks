"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function GlassInput({ className, ...props }: GlassInputProps) {
  return (
    <input
      className={cn(
        "w-full px-4 py-3 bg-white/[0.03] backdrop-blur-md border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-white placeholder-gray-500 outline-none transition-all duration-300 focus:shadow-emerald-glow focus:bg-white/[0.05]",
        className
      )}
      {...props}
    />
  );
}
