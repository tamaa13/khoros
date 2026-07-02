"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE } from "@/lib/motion";
import { Mockup3D } from "@/components/Mockup3D";
import { MatchNight } from "@/components/hero/MatchNight";

const REPO = "https://github.com/tamaa13/khoros";

const lineVariants = {
  hidden: { opacity: 0, y: 26, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.85, ease: EASE } },
};

// Who the Cup is for — the cycle itself says "everyone in the society".
const SWAP = ["your agent", "the whole society", "your machine", "every fan"] as const;
const SWAP_MS = 2400;

export function Hero() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % SWAP.length), SWAP_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  const word = SWAP[i] ?? SWAP[0];

  return (
    <section id="hero" className="floodlight relative isolate flex min-h-screen flex-col items-center justify-center px-4 pb-8 pt-24">
      <div className="mx-auto flex w-full max-w-[var(--container-wrap)] flex-col items-center text-center">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }} className="kicker mb-4">
          on-device society · built on QVAC · Tether Developers Cup
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.14, delayChildren: 0.05 }}
          className="display text-[clamp(34px,4.6vw,62px)] leading-[1.02]"
        >
          <motion.span variants={lineVariants} className="block">
            One World Cup
          </motion.span>
          <motion.span variants={lineVariants} className="block">
            for{" "}
            {/* inline-grid with one shared cell: the invisible placeholder sizes it to the
                widest word, and each animating word lands in the SAME cell — so the exiting
                and entering words overlap and crossfade (the line's last word never blanks). */}
            <span className="inline-grid align-baseline text-gold">
              <span aria-hidden className="invisible col-start-1 row-start-1">
                the whole society
              </span>
              <AnimatePresence initial={false}>
                <motion.span
                  key={word}
                  initial={{ opacity: 0, y: 12, filter: "blur(5px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(5px)" }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="col-start-1 row-start-1 inline-block"
                >
                  {word}
                </motion.span>
              </AnimatePresence>
            </span>
            .
          </motion.span>
        </motion.h1>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.55, ease: EASE }} className="mt-7">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-gold px-7 py-3.5 text-[15px] font-bold tracking-tight text-gold-ink shadow-[var(--shadow-pill)] transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <span>Get Khoros</span>
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.8, ease: EASE }}
        className="mx-auto mt-10 w-full max-w-[1240px] px-2"
      >
        <Mockup3D>
          <MatchNight />
        </Mockup3D>
      </motion.div>
    </section>
  );
}
