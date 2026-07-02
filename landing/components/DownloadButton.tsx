"use client";

import { useEffect, useState } from "react";

// Direct downloads — the release-asset URLs serve the file straight away, so
// the user never lands on a GitHub page.
const RELEASE = "https://github.com/tamaa13/khoros/releases/download/v0.1.0";

type Os = "mac" | "win" | "linux";
const TARGETS: Record<Os, { label: string; sub: string; url: string }> = {
  mac: { label: "Download for macOS", sub: "Apple Silicon · .dmg · ~230 MB", url: `${RELEASE}/Khoros.dmg` },
  win: { label: "Download for Windows", sub: "x64 installer · ~460 MB", url: `${RELEASE}/Khoros-Setup.exe` },
  linux: { label: "Download for Linux", sub: "x64 · .deb · ~330 MB", url: `${RELEASE}/khoros_0.1.0_amd64.deb` },
};
const OTHERS: Record<Os, Os[]> = { mac: ["win", "linux"], win: ["mac", "linux"], linux: ["mac", "win"] };
const SHORT: Record<Os, string> = { mac: "macOS", win: "Windows", linux: "Linux" };

function detect(): Os {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "win";
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "mac";
}

/** OS-aware download CTA. `nav` = compact pill for the navbar; default = the
 *  hero/CTA size with the other platforms offered underneath. */
export function DownloadButton({ nav = false }: { nav?: boolean }) {
  const [os, setOs] = useState<Os>("mac"); // SSR default; corrected on mount
  useEffect(() => setOs(detect()), []);
  const t = TARGETS[os];

  if (nav) {
    return (
      <a href={t.url} className="rounded-full bg-gold px-[18px] py-[9px] text-[13px] font-bold text-gold-ink transition-transform hover:-translate-y-0.5" title={t.sub}>
        {t.label.replace("Download for", "Get Khoros ·")}
      </a>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={t.url}
        className="group inline-flex flex-col items-center gap-0.5 rounded-full bg-gold px-8 py-3.5 shadow-[var(--shadow-pill)] transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
      >
        <span className="inline-flex items-center gap-2 text-[15px] font-bold tracking-tight text-gold-ink">
          {t.label}
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            ↓
          </span>
        </span>
        <span className="text-[10.5px] font-medium text-gold-ink/70">{t.sub}</span>
      </a>
      <span className="text-[12px] text-fog-3">
        v0.1.0 · also for{" "}
        {OTHERS[os].map((o, i) => (
          <span key={o}>
            <a href={TARGETS[o].url} className="text-fog-2 underline-offset-2 transition-colors hover:text-fog hover:underline">
              {SHORT[o]}
            </a>
            {i === 0 ? " and " : ""}
          </span>
        ))}{" "}
        · or{" "}
        <a href="/docs" className="text-fog-2 underline-offset-2 transition-colors hover:text-fog hover:underline">
          build from source
        </a>
      </span>
    </div>
  );
}
