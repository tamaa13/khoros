"use client";

import { useEffect, useState } from "react";

// Direct downloads — the release-asset URLs serve the file straight away, so
// the user never lands on a GitHub page. One explicit button per platform
// (all three are real builds on the v0.1.0 release); the visitor's own OS
// gets the solid gold treatment.
const RELEASE = "https://github.com/tamaa13/khoros/releases/download/v0.1.0";

type Os = "mac" | "win" | "linux";
const TARGETS: { os: Os; name: string; sub: string; url: string }[] = [
  { os: "mac", name: "macOS", sub: ".dmg · Apple Silicon · 230 MB", url: `${RELEASE}/Khoros.dmg` },
  { os: "win", name: "Windows", sub: ".exe · x64 · 440 MB", url: `${RELEASE}/Khoros-Setup.exe` },
  { os: "linux", name: "Linux", sub: ".deb · x64 · 320 MB", url: `${RELEASE}/khoros_0.1.0_amd64.deb` },
];

function detect(): Os {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "win";
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "mac";
}

/** Per-platform download buttons. `nav` = one compact pill for the visitor's OS. */
export function DownloadButton({ nav = false }: { nav?: boolean }) {
  const [os, setOs] = useState<Os>("mac"); // SSR default; corrected on mount
  useEffect(() => setOs(detect()), []);

  if (nav) {
    const t = TARGETS.find((x) => x.os === os)!;
    return (
      <a href={t.url} className="rounded-full bg-gold px-[18px] py-[9px] text-[13px] font-bold text-gold-ink transition-transform hover:-translate-y-0.5" title={t.sub}>
        Download · {t.name}
      </a>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-stretch justify-center gap-3">
        {TARGETS.map((t) => {
          const mine = t.os === os;
          return (
            <a
              key={t.os}
              href={t.url}
              className={`group flex min-w-[190px] flex-col items-center gap-0.5 rounded-[16px] px-6 py-3 transition-transform hover:-translate-y-0.5 active:scale-[0.99] ${
                mine ? "bg-gold shadow-[var(--shadow-pill)]" : "border border-line-strong bg-night-2 hover:border-fog-3"
              }`}
            >
              <span className={`inline-flex items-center gap-2 text-[14.5px] font-bold tracking-tight ${mine ? "text-gold-ink" : "text-fog"}`}>
                Download for {t.name}
                <span aria-hidden className="transition-transform group-hover:translate-y-0.5">
                  ↓
                </span>
              </span>
              <span className={`text-[10.5px] font-medium ${mine ? "text-gold-ink/70" : "text-fog-3"}`}>{t.sub}</span>
            </a>
          );
        })}
      </div>
      <span className="text-[12px] text-fog-3">
        v0.1.0 · or{" "}
        <a href="/docs" className="text-fog-2 underline-offset-2 transition-colors hover:text-fog hover:underline">
          build from source
        </a>
      </span>
    </div>
  );
}
