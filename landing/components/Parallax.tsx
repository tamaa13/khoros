"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

// Scroll parallax that works under Lenis (Lenis swallows native scroll events, so
// framer's useScroll won't fire — we read layout position each frame instead).
// `speed` is the peak vertical travel in px as the element crosses the viewport.
export function Parallax({ children, speed = 40, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const raw = useMotionValue(0);
  const y = useSpring(raw, { stiffness: 120, damping: 30, mass: 0.4 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const center = rect.top + rect.height / 2;
        const p = (center - vh / 2) / (vh / 2 + rect.height / 2);
        raw.set(-p * speed);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [raw, speed]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}
