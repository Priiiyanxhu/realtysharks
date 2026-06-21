import Link from "next/link";
import { ArrowRight, Building, Key, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Mobile-Optimized Header */}
      <header className="w-full bg-white border-b border-slate-200">
        <div className="w-full px-4">
          <div className="flex justify-center items-center h-16">
            {/* Centered Logo for Mobile */}
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                Realty<span className="text-brand-accent">sharks</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col items-center justify-center px-6 py-8 text-center overflow-y-auto">
        <div className="w-full max-w-sm space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-brand-accent text-xs font-semibold uppercase tracking-wide">
            <Building className="w-3.5 h-3.5" />
            Institutional Network
          </div>
          
          {/* Headline & Tagline */}
          <div className="space-y-4">
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              The elite network for <br/>
              <span className="text-brand-accent">top-tier brokers.</span>
            </h1>
            <p className="text-base text-slate-500 font-light leading-relaxed px-2">
              Connect, collaborate, and close deals faster on our verified platform.
            </p>
          </div>

          {/* Primary Actions (Mobile Full Width) */}
          <div className="flex flex-col gap-3 pt-6 w-full">
            <Link 
              href="/register"
              className="w-full bg-brand-accent active:bg-[#FACC15] text-white text-lg font-medium h-14 rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors"
            >
              Sign Up Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="/login"
              className="w-full bg-white border border-slate-200 active:bg-slate-50 text-slate-700 text-lg font-medium h-14 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <Key className="w-5 h-5 text-slate-400" />
              Login to Portal
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="pt-10 pb-4 border-t border-slate-200 mt-10">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">
              Trusted by leading brokerages
            </p>
            <div className="flex justify-center gap-6 opacity-50 grayscale">
              <div className="flex flex-col items-center gap-1">
                <Building className="w-6 h-6 text-slate-700"/>
                <span className="text-[10px] font-bold text-slate-700">CBRE</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Users className="w-6 h-6 text-slate-700"/>
                <span className="text-[10px] font-bold text-slate-700">JLL</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Building className="w-6 h-6 text-slate-700"/>
                <span className="text-[10px] font-bold text-slate-700">C&W</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
