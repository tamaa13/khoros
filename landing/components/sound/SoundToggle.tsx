"use client";

import { useEffect, useRef } from "react";
import { useSound } from "./SoundProvider";

const N = 5;
const IDLE = [0.4, 0.75, 0.5, 0.85, 0.45];

// Navbar control (ported from arca/dashboard): vertical bars that dance to the
// live audio when sound is on, and sit static when off.
export function SoundToggle() {
  const { soundOn, toggle, getLevels } = useSound();
  const refs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!soundOn) {
      refs.current.forEach((el, i) => {
        if (el) el.style.transform = `scaleY(${IDLE[i]})`;
      });
      return;
    }
    let raf = 0;
    const tick = () => {
      const levels = getLevels(N);
      refs.current.forEach((el, i) => {
        if (el) el.style.transform = `scaleY(${Math.max(0.16, levels[i]!)})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [soundOn, getLevels]);

  return (
    <button
      onClick={toggle}
      aria-label={soundOn ? "Mute ambient sound" : "Play ambient sound"}
      className="inline-flex h-8 w-8 items-center justify-center transition-opacity duration-200 hover:opacity-65"
      style={{ padding: 0, background: "transparent", border: "none", color: soundOn ? "var(--color-gold)" : "var(--color-fog-3)" }}
    >
      <span className="flex items-end gap-[2.5px]" style={{ height: 13 }}>
        {Array.from({ length: N }).map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className="w-[2px] rounded-full"
            style={{ height: 13, background: "currentColor", transformOrigin: "bottom", transform: `scaleY(${IDLE[i]})`, transition: "transform 0.08s linear" }}
          />
        ))}
      </span>
    </button>
  );
}
