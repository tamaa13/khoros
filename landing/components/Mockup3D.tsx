"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

// Cinematic mockup (ported from arca/dashboard): the live scene floats in 3D and
// rotates with scroll — tilted as it enters, near-flat (readable) when centered,
// tilting away as it leaves. Soft DoF blur on the far edges + a floor shadow.
// rAF-driven so it tracks Lenis smooth-scroll.
export function Mockup3D({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useMotionValue(0); // -1 (entering, below center) .. 0 (centered) .. 1 (leaving)
  const sp = useSpring(pos, { stiffness: 70, damping: 20, mass: 0.7 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      pos.set(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const center = rect.top + rect.height / 2;
        pos.set((center - vh / 2) / (vh / 2 + rect.height / 2));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pos]);

  const rotateX = useTransform(sp, [-1, 0, 1], [11, 0, -7]);
  const rotateY = useTransform(sp, [-1, 0, 1], [-10, -2.5, 4]);
  const scale = useTransform(sp, [-1, 0, 1], [0.93, 1, 0.97]);

  return (
    <div ref={ref} style={{ perspective: 1700 }} className="relative">
      <motion.div style={{ rotateX, rotateY, scale, transformStyle: "preserve-3d" }} className="relative origin-center">
        {children}

        {/* depth-of-field: soft blurred strips on the top/bottom edges (tilt-shift) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[12%] backdrop-blur-[2px]"
          style={{ maskImage: "linear-gradient(to bottom, black, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[14%] backdrop-blur-[2px]"
          style={{ maskImage: "linear-gradient(to top, black, transparent)", WebkitMaskImage: "linear-gradient(to top, black, transparent)" }}
        />
        {/* subtle cinematic vignette */}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[18px]" style={{ boxShadow: "inset 0 0 120px -40px rgba(0,0,0,0.55)" }} />
      </motion.div>

      {/* floating-screen floor shadow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-[8%] -bottom-8 h-16 rounded-[50%] blur-2xl" style={{ background: "rgba(0,0,0,0.5)" }} />
    </div>
  );
}
