import React from 'react';
import { cn } from '@/lib/utils';

export function GlassCard({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "backdrop-blur-3xl bg-black/30 border border-white/20 rounded-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
