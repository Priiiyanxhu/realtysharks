import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Sparkles, Handshake, LucideIcon } from 'lucide-react';
import { GlassCard } from './GlassCard';

export type FeedEventType = 'match' | 'chat' | 'deal';

export interface FeedItemProps {
  id: string;
  type: FeedEventType;
  title: string;
  description: string;
  timestamp: string;
  users?: { name: string; avatar?: string }[];
  isNew?: boolean;
}

const typeConfig: Record<FeedEventType, { icon: LucideIcon; color: string; bgColor: string }> = {
  match: {
    icon: Sparkles,
    color: 'text-[#D4AF37]',
    bgColor: 'bg-[#D4AF37]/20 border-[#D4AF37]/30',
  },
  chat: {
    icon: MessageSquare,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20 border-indigo-400/30',
  },
  deal: {
    icon: Handshake,
    color: 'text-white', 
    bgColor: 'bg-white/10 border-white/20',
  }
};

export function FeedItem({ type, title, description, timestamp, users, isNew }: FeedItemProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative pl-8 pb-8 last:pb-0"
    >
      {/* Timeline Line */}
      <div className="absolute top-0 left-3.5 bottom-0 w-px bg-gradient-to-b from-white/20 to-transparent" />
      
      {/* Timeline Node */}
      <div className={`absolute top-0 left-0 w-7 h-7 rounded-full flex items-center justify-center border backdrop-blur-md z-10 ${config.bgColor}`}>
        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
        {isNew && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[#0B1120] animate-pulse" />
        )}
      </div>

      <GlassCard className={`p-4 md:p-5 transition-colors duration-300 ${isNew ? 'border-[#D4AF37]/30 shadow-[0_0_15px_rgba(212,175,55,0.05)]' : 'border-white/5 hover:border-white/10'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <h4 className="text-white font-medium text-sm sm:text-base leading-tight">{title}</h4>
          <span className="text-[10px] uppercase tracking-widest font-mono text-white/40 shrink-0">{timestamp}</span>
        </div>
        
        <p className="text-sm text-white/60 leading-relaxed mb-4">
          {description}
        </p>

        {users && users.length > 0 && (
          <div className="flex items-center gap-2 pt-3 border-t border-white/5">
            <div className="flex -space-x-2 overflow-hidden">
              {users.map((user, i) => (
                <div key={i} className="inline-block h-6 w-6 rounded-full border border-[#0B1120] bg-slate-800 shrink-0">
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt={user.name} className="h-full w-full object-cover rounded-full" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[8px] font-bold text-white/50">
                      {user.name.charAt(0)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-white/40 uppercase tracking-widest ml-1">
              {users.map(u => u.name.split(' ')[0]).join(', ')} involved
            </span>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
