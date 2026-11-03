"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Home, Building, Users, MessageSquare, User, Loader2, Bell, Sparkles } from "lucide-react";

export function GlobalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userProfile, setUserProfile] = useState<{ full_name: string; role?: string; avatar_url?: string; agency_name?: string } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        // Verify profile exists and is complete (routing guard)
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_id", session.user.id)
          .single();

        if (!profile || !profile.agency_name) {
          router.replace("/onboarding");
          return;
        }

        setUserProfile(profile);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Auth Guard Error:", error);
        router.replace("/login");
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router, pathname]);

  if (isChecking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#0B1120]">
        <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Listings", href: "/listings", icon: Building },
    { name: "Network", href: "/network", icon: Users },
    { name: "Messages", href: "/messages", icon: MessageSquare },
    { name: "Profile", href: "/profile", icon: User },
    { name: "Upgrade", href: "/upgrade", icon: Sparkles },
  ];

  return (
    <div className="flex min-h-[100dvh] w-full bg-[#0B1120] text-white overflow-x-clip font-sans relative">
      
      {/* Noise Grain Texture (GOAT Evolution 4) */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Desktop Persistent Sidebar (Full Height) */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-72 bg-[#0B1120] border-r border-white/5 z-50">
        <div className="p-8 pb-6 flex flex-col items-start border-b border-white/5">
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#D4AF37] uppercase mb-4">B2B Real Estate OS</span>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[#D4AF37] text-[#0B1120] font-black flex items-center justify-center text-lg leading-none transform -skew-x-12">
              E
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-white">
            REALTY<span className="text-[#D4AF37]">SHARKS</span><span className="text-[10px] align-top text-white/50 ml-0.5">TM</span>
          </h1>
        </div>

        {/* Agent Identity Card */}
        <div className="px-6 py-6 border-b border-white/5">
          <div className="bg-[#121A2F] rounded-2xl p-4 flex items-center gap-3 border border-white/5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]" />
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 overflow-hidden shrink-0">
              {userProfile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userProfile.avatar_url} alt="Agent" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 font-bold">
                  {(userProfile?.full_name || "A").charAt(0)}
                </div>
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-[9px] uppercase tracking-widest text-[#D4AF37] font-bold mb-0.5">Agent Identity</p>
              <h3 className="text-sm font-semibold text-white truncate">{userProfile?.full_name}</h3>
              <p className="text-xs text-white/50 truncate uppercase">{userProfile?.role || 'Broker'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-6">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 group ${
                  isActive 
                    ? "bg-[#D4AF37]/10 text-[#D4AF37]" 
                    : "text-white/40 hover:text-white hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? "text-[#D4AF37]" : "group-hover:text-white"}`} />
                  <span className={`font-semibold tracking-wide ${isActive ? "text-white" : ""}`}>{item.name.toUpperCase()}</span>
                </div>
                <span className="text-[10px] font-mono opacity-30">0{index + 1}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6">
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-semibold tracking-wide uppercase"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-72 relative pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>

      {/* Mobile Persistent Bottom Tab Bar (Floating Pill) */}
      <nav className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 right-4 rounded-full border border-white/20 bg-black/40 backdrop-blur-3xl z-50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${
                  isActive ? "bg-white/15 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" : "text-white/50 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>
      </nav>
      
    </div>
  );
}
