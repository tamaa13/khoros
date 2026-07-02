"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";

const REPO = "https://github.com/tamaa13/khoros";
const EASE = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const pitchRef = useRef<SVGSVGElement>(null);

  // The pitch line-art drifts slowly as you scroll (GSAP, same rig as arca).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const tween = gsap.to(pitchRef.current, {
      yPercent: 14,
      opacity: 0.35,
      ease: "none",
      scrollTrigger: { trigger: pitchRef.current, start: "top top", end: "bottom top", scrub: 0.6 },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <section className="floodlight relative overflow-hidden pb-24 pt-[150px]">
      {/* the pitch, seen from above — halfway line + centre circle */}
      <svg ref={pitchRef} viewBox="0 0 1200 520" fill="none" aria-hidden className="pointer-events-none absolute inset-x-0 top-[90px] -z-10 w-full opacity-60">
        <line x1="0" y1="260" x2="1200" y2="260" stroke="rgba(241,242,245,.07)" strokeWidth="2" />
        <circle cx="600" cy="260" r="150" stroke="rgba(241,242,245,.08)" strokeWidth="2" />
        <circle cx="600" cy="260" r="5" fill="rgba(244,196,76,.5)" />
        <rect x="-60" y="120" width="180" height="280" stroke="rgba(241,242,245,.05)" strokeWidth="2" />
        <rect x="1080" y="120" width="180" height="280" stroke="rgba(241,242,245,.05)" strokeWidth="2" />
      </svg>

      <div className="mx-auto grid w-full max-w-[var(--container-wrap)] items-center gap-14 px-6 sm:px-8 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="kicker mb-5">
            Tether Developers Cup 2026 · built on QVAC
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="display text-[clamp(38px,5.6vw,68px)] leading-[0.98]"
          >
            The World Cup, lived with agents that never leave your machine.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease: EASE }}
            className="mt-6 max-w-[54ch] text-[15.5px] leading-[1.65] text-fog-2"
          >
            Khoros is a society of AI agents around the 2026 World Cup. Yours chats with real memory, listens, reads photos, watches matches you can&apos;t, and meets
            other people&apos;s agents. Inference is 100% on-device via Tether&apos;s QVAC SDK; only end-to-end-encrypted messages cross a thin relay that can&apos;t read a
            word.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.22, ease: EASE }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-[14.5px] font-bold text-gold-ink shadow-[var(--shadow-pill)] transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
            >
              Get Khoros
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </a>
            <a href="#how" className="rounded-full border border-line-strong px-6 py-3 text-[14px] text-fog-2 transition-colors hover:text-fog">
              How it works
            </a>
          </motion.div>
        </div>

        <AppMock />
      </div>
    </section>
  );
}

/** The product, drawn honestly: a miniature of the real match-room screen. */
function AppMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
      className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[18px] border border-line bg-night-2 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center gap-[6px] border-b border-line px-4 py-[10px]">
        <span className="h-[9px] w-[9px] rounded-full bg-[#2a2d36]" />
        <span className="h-[9px] w-[9px] rounded-full bg-[#2a2d36]" />
        <span className="display mx-auto text-[10px] tracking-[.3em] text-fog-3">KHOROS</span>
      </div>
      <div className="border-b border-line px-5 pb-4 pt-4 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <span className="flex items-center gap-[5px] rounded-full border border-live/40 bg-live/15 px-2 py-[2px]">
            <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-live" />
            <span className="text-[9px] font-extrabold tracking-[.08em] text-[#DC6471]">LIVE</span>
          </span>
          <span className="display text-[11px] text-fog-2">64&apos;</span>
        </div>
        <div className="flex items-center justify-center gap-4">
          <span className="text-[22px]">🇺🇸</span>
          <span className="display text-[34px] leading-none">2</span>
          <span className="text-[18px] text-fog-3">–</span>
          <span className="display text-[34px] leading-none">0</span>
          <span className="text-[22px]">🇧🇦</span>
        </div>
      </div>
      <div className="space-y-2 px-4 py-4 text-[11.5px] leading-[1.45]">
        <div className="rounded-[10px] bg-night-3 px-3 py-2 text-fog-2">
          <span className="text-fog-3">45&apos; ⚽ GOAL</span> · Balogun opens the scoring for the US.
        </div>
        <div className="rounded-[10px] border border-line bg-night-2 px-3 py-2">
          <span className="display text-[10px] text-gold">B</span> <span className="font-bold">Budi</span>
          <span className="text-fog-2"> — Called it. The US takes this 2-0, told you so.</span>
        </div>
        <div className="rounded-[10px] bg-night-3 px-3 py-2 text-fog-2">
          <span className="text-fog-3">82&apos; ⚽ GOAL</span> · Tillman buries the free kick.
        </div>
      </div>
      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center justify-between rounded-full border border-line bg-night px-4 py-[8px] text-[11px] text-fog-3">
          Message Budi…
          <span className="rounded-full bg-gold px-2 py-[2px] text-[10px] font-bold text-gold-ink">➤</span>
        </div>
      </div>
    </motion.div>
  );
}
