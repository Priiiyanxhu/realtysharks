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

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-[#0F1419] text-[#F3F4F6] relative select-none">
        {/*
          Root clip. The ambient glows below deliberately hang past the edges
          (and some pages have their own decoration that does too). Without
          clipping, that overhang is scrollable overflow: the page is wider
          than the viewport and focus, scrollIntoView or an anchor jump can
          shift it sideways. `overflow-x: clip` removes the overflow entirely;
          unlike `hidden` it creates no scroll container, so `position: sticky`
          descendants keep working. body's overflow-x: hidden (globals.css)
          stays as the fallback for browsers without `clip` (Safari < 16).
        */}
        <div className="relative flex flex-1 flex-col overflow-x-clip">
          {/*
            Specular Liquid Glass Ambient Background Highlights.
            The glows deliberately overhang the page edges (-10%). In their own
            absolutely positioned layer with overflow hidden, that overhang is
            clipped in BOTH axes: otherwise the bottom glow adds a blank scroll
            tail of exactly 10% of the page height below the content. Safe to
            use `hidden` here (not `clip`): the layer holds only decoration, so
            it being a scroll container affects nothing.
          */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#D4AF37]/5 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FACC15]/5 rounded-full blur-[120px]" />
          </div>

          {/* Grain Overlay */}
          <div className="grain-overlay" />

          {/* Main Content */}
          <main className="flex-grow z-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
