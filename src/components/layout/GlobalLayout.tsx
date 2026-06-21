"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Home, Building, Users, MessageSquare, User, Loader2, Bell } from "lucide-react";

export function GlobalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

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
          .select("agency_name")
          .eq("auth_id", session.user.id)
          .single();

        if (!profile || !profile.agency_name) {
          router.replace("/onboarding");
          return;
        }

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
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#050505]">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
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
  ];

  return (
    <div className="flex min-h-[100dvh] w-full bg-[#050505] text-white overflow-x-hidden">
      
      {/* Desktop Persistent Sidebar (Floating Pill) */}
      <aside className="hidden md:flex flex-col fixed left-6 top-6 bottom-6 w-64 rounded-[2rem] border border-white/20 bg-black/30 backdrop-blur-3xl z-50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
        <div className="p-8 pb-4 flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight text-white">RealtySharks</h1>
          <button className="relative p-2 text-white/50 hover:text-white transition-colors" title="Notifications">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#0a0f16]"></span>
          </button>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 ${
                  isActive 
                    ? "bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" 
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-[19rem] relative pb-[calc(100px+env(safe-area-inset-bottom))] md:pb-0">
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
