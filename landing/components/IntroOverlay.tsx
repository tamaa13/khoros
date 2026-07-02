"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useState } from "react";
import { EASE } from "@/lib/motion";

const SOFT = [0.16, 1, 0.3, 1] as const; // expressive ease-out for the zoom + settle
const HOLD_MS = 2350; // zoom + sweep, then let the page in

// First-load intro (arca's overlay, minus the consent step — Khoros has no
// cookies to ask about): KHOROS zooms in from full-screen, the progress line
// sweeps, then the whole thing lifts. Once per browser session.
//
// It starts VISIBLE so the overlay is in the very first paint (starting hidden
// let the landing flash before the intro popped over it). A layout effect hides
// it synchronously, before paint, on repeat views.
export function IntroOverlay() {
  const [visible, setVisible] = useState(true);

  useLayoutEffect(() => {
    if (window.sessionStorage.getItem("khoros-intro") === "1") setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      window.sessionStorage.setItem("khoros-intro", "1");
      setVisible(false);
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [visible]);

  // Lock the page while the intro is up (the landing renders behind this fixed
  // overlay — without this, Lenis would scroll the hidden page).
  useEffect(() => {
    if (!visible) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    window.__lenis?.stop();
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      window.__lenis?.start();
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden px-6"
          style={{
            // self-contained wash with a SOLID night base — .floodlight alone is
            // gradient-only (its background shorthand resets the color to
            // transparent), which let the landing show through the intro
            background:
              "radial-gradient(120% 80% at 50% -20%, rgba(244,196,76,.13), transparent 55%)," +
              "radial-gradient(90% 60% at 90% 110%, rgba(61,169,104,.07), transparent 60%)," +
              "radial-gradient(70% 50% at 5% 15%, rgba(110,147,204,.06), transparent 55%)," +
              "#08090C",
          }}
        >
          <div className="relative flex w-full max-w-[460px] flex-col items-center gap-7 text-center">
            <motion.span
              className="display leading-none text-fog"
              initial={{ opacity: 0, scale: 3.3, letterSpacing: "0.62em" }}
              animate={{ opacity: 1, scale: 1, letterSpacing: "0.24em" }}
              transition={{
                opacity: { duration: 0.7, ease: EASE },
                scale: { duration: 1.3, ease: SOFT },
                letterSpacing: { duration: 1.3, ease: SOFT },
              }}
              style={{ fontSize: 64, transformOrigin: "center" }}
            >
              KHOROS
            </motion.span>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3, ease: EASE }} className="flex flex-col items-center gap-4">
              <div className="h-px w-52 overflow-hidden bg-line-strong">
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "0%" }}
                  transition={{ delay: 0.45, duration: 1.45, ease: [0.4, 0, 0.2, 1] }}
                  className="h-full w-full bg-gold"
                />
              </div>
              <span className="kicker !text-[10px] !tracking-[0.26em]">on-device society · built on QVAC</span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
