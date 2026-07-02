"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE } from "@/lib/motion";

const SOFT = [0.16, 1, 0.3, 1] as const; // expressive ease-out for the zoom + settle
const HOLD_MS = 2350; // zoom + sweep, then let the page in

// First-load intro (arca's overlay, minus the consent step — Khoros has no
// cookies to ask about): KHOROS zooms in from full-screen, the progress line
// sweeps, then the whole thing lifts. Once per browser session.
export function IntroOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onLanding = window.location.pathname === "/" || window.location.pathname === "/index.html";
    const seen = window.sessionStorage.getItem("khoros-intro") === "1";
    if (!onLanding || seen) return;
    setVisible(true);
    const t = setTimeout(() => {
      window.sessionStorage.setItem("khoros-intro", "1");
      setVisible(false);
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, []);

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
          className="floodlight fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-night px-6"
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
