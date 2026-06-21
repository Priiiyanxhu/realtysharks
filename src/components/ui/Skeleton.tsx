"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/[0.05]",
        className
      )}
    >
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
        animate={{
          translateX: ["100%"],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "linear",
        }}
      />
    </div>
  );
}
