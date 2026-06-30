/** @type {import('tailwindcss').Config} */
// Tokens straight from the Khoros design system (Khoros.dc.html § Design tokens).
// Keyframes/animations mirror the design's <style> block so components animate
// via utility classes (e.g. animate-pulse-dot) instead of inline magic.
module.exports = {
  darkMode: "class",
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        // Theme-aware tokens (resolve to CSS vars defined in index.css; swap on .light).
        bg: { base: "rgb(var(--bg) / <alpha-value>)" },
        surface: { 0: "rgb(var(--s0) / <alpha-value>)", 1: "rgb(var(--s1) / <alpha-value>)", 2: "rgb(var(--s2) / <alpha-value>)", 3: "rgb(var(--s3) / <alpha-value>)" },
        border: { subtle: "rgb(var(--line) / <alpha-value>)", DEFAULT: "rgb(var(--line2) / <alpha-value>)", strong: "rgb(var(--line3) / <alpha-value>)" },
        gold: { DEFAULT: "rgb(var(--gold) / <alpha-value>)", bright: "rgb(var(--goldbright) / <alpha-value>)", deep: "rgb(var(--golddeep) / <alpha-value>)", fg: "rgb(var(--goldfg) / <alpha-value>)" },
        content: { DEFAULT: "rgb(var(--text) / <alpha-value>)", muted: "rgb(var(--textmuted) / <alpha-value>)", faint: "rgb(var(--textfaint) / <alpha-value>)" },
        // Fixed accents (read fine on both themes).
        host: { mex: "#3DA968", can: "#D14150", usa: "#6E93CC" },
        live: { DEFAULT: "#D14150", bright: "#DC6471" },
        cast: "#6E93CC",
        warn: "#D9A047",
        error: "#CF4C5A",
      },
      fontFamily: {
        display: ["Archivo", "sans-serif"],
        condensed: ["Anton", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "monospace"],
      },
      fontSize: {
        display: ["64px", { lineHeight: ".9", letterSpacing: "-.035em" }],
        h1: ["32px", { lineHeight: "1.05" }],
        h2: ["24px"],
        h3: ["19px"],
        body: ["15px", { lineHeight: "1.55" }],
        sm: ["13px"],
        caption: ["11px"],
      },
      borderRadius: { md: "8px", lg: "14px", xl: "18px", "2xl": "24px", app: "26px" },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.4)",
        pop: "0 12px 28px -10px rgba(0,0,0,.7)",
        glow: "0 0 22px -2px rgba(244,196,76,.45)",
        gold: "0 0 26px -2px rgba(244,196,76,.5)",
      },
      transitionTimingFunction: { enter: "cubic-bezier(.16,1,.3,1)" },
      transitionDuration: { fast: "120ms", base: "200ms", slow: "320ms" },
      keyframes: {
        pulseDot: { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: ".5", transform: "scale(.78)" } },
        ring: { "0%": { transform: "scale(.6)", opacity: ".7" }, "70%,100%": { transform: "scale(2.6)", opacity: "0" } },
        breathe: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".45" } },
        bounceDot: { "0%,70%,100%": { transform: "translateY(0)", opacity: ".45" }, "35%": { transform: "translateY(-5px)", opacity: "1" } },
        shimmer: { "0%": { backgroundPosition: "-180% 0" }, "100%": { backgroundPosition: "180% 0" } },
        shine: { "0%": { transform: "translateX(-130%) skewX(-18deg)" }, "55%,100%": { transform: "translateX(260%) skewX(-18deg)" } },
        goalGlow: { "0%,100%": { boxShadow: "0 0 0 0 rgba(244,196,76,0)" }, "40%": { boxShadow: "0 0 36px 3px rgba(244,196,76,.5)" } },
        confetti: { "0%": { transform: "translateY(-12px) rotate(0)", opacity: "0" }, "12%": { opacity: "1" }, "100%": { transform: "translateY(150px) rotate(460deg)", opacity: "0" } },
        wave: { "0%,100%": { transform: "scaleY(.3)" }, "50%": { transform: "scaleY(1)" } },
        rise: { "0%": { opacity: "0", transform: "translateY(9px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-5px)" } },
        sweep: { "0%": { opacity: "0" }, "50%": { opacity: ".6" }, "100%": { opacity: "0" } },
      },
      animation: {
        "pulse-dot": "pulseDot 2.4s ease-in-out infinite",
        ring: "ring 2.4s ease-out infinite",
        breathe: "breathe 2.6s ease-in-out infinite",
        "bounce-dot": "bounceDot 1.3s ease-in-out infinite",
        shimmer: "shimmer 1.5s linear infinite",
        shine: "shine 2.6s ease-in-out infinite",
        "goal-glow": "goalGlow 1.5s ease-out",
        confetti: "confetti 1.4s ease-in forwards",
        wave: "wave 1s ease-in-out infinite",
        spin: "spin 1s linear infinite",
        rise: "rise .32s cubic-bezier(.16,1,.3,1) both",
        float: "float 3.5s ease-in-out infinite",
        sweep: "sweep 1.5s ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
