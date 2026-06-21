import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Realtysharks | Elite B2B Real Estate Network",
  description: "Exclusive B2B real estate intelligence and broker-to-broker matching network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-[#0F1419] text-[#F3F4F6] relative select-none">
        {/* Specular Liquid Glass Ambient Background Highlights */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#D4AF37]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FACC15]/5 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Grain Overlay */}
        <div className="grain-overlay" />
        
        {/* Main Content */}
        <main className="flex-grow z-10">{children}</main>
      </body>
    </html>
  );
}
