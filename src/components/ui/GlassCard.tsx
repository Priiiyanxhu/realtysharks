"use client";

import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function GlassCard({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePosition({ x, y });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative overflow-hidden backdrop-blur-3xl bg-black/30 border border-white/20 rounded-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/50 group/glass",
        className
      )}
      {...props}
    >
      {/* Specular Highlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300 group-hover/glass:opacity-100"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(212, 175, 55, 0.1), transparent 40%)`,
        }}
      />
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </div>
  );
}
