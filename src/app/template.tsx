"use client";

import { motion } from "framer-motion";

/**
 * Entrance fade for every top-level route change.
 *
 * Animate OPACITY ONLY. This template wraps the (app) layout, whose sidebar and
 * mobile tab bar are `position: fixed`. A `transform` (the old y: 10 rise) or a
 * `filter` (the old blur) on ANY ancestor, including `filter: blur(0px)` left
 * behind after the animation, makes that ancestor the containing block for
 * fixed descendants. The "fixed" nav was then anchored to the page instead of
 * the viewport: the sidebar scrolled away, and on a phone the tab bar sat at
 * the bottom of the whole document, off-screen on tall pages. `opacity` does
 * not create a containing block, so fixed elements stay fixed at every frame.
 *
 * To bring back a rise/blur entrance, apply it inside GlobalLayout's <main>
 * (for example from a template in the (app) route group), never on this wrapper.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
