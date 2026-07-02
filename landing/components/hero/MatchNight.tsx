"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE } from "@/lib/motion";

// The Khoros equivalent of arca's OsScene: the REAL app window (the 460×760
// companion) on a match-night desktop. Phase A — the Lobby tab, inside a live
// match room. Phase B — the My Agent tab, recalling the match and arming a
// watch. The tab bar actually switches. Loops.
const SWAP_AT = 8400;
const LOOP_MS = 16500;

export function MatchNight() {
  const [phase, setPhase] = useState<"room" | "chat">("room");

  useEffect(() => {
    let mounted = true;
    let tSwap: ReturnType<typeof setTimeout>;
    let tLoop: ReturnType<typeof setTimeout>;
    const run = () => {
      setPhase("room");
      tSwap = setTimeout(() => mounted && setPhase("chat"), SWAP_AT);
      tLoop = setTimeout(() => mounted && run(), LOOP_MS);
    };
    run();
    return () => {
      mounted = false;
      clearTimeout(tSwap);
      clearTimeout(tLoop);
    };
  }, []);

  const onRoom = phase === "room";

  return (
    <div className="relative mx-auto aspect-[16/10] w-full max-w-[1240px] overflow-hidden rounded-[18px] border border-line bg-night-2 shadow-[var(--shadow-card)]">
      {/* wallpaper: the pitch under floodlight */}
      <div aria-hidden className="floodlight absolute inset-0" />
      <svg aria-hidden viewBox="0 0 1200 750" fill="none" className="absolute inset-0 h-full w-full opacity-50">
        <line x1="0" y1="375" x2="1200" y2="375" stroke="rgba(241,242,245,.05)" strokeWidth="2" />
        <circle cx="600" cy="375" r="170" stroke="rgba(241,242,245,.06)" strokeWidth="2" />
      </svg>

      {/* menubar */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between border-b border-line bg-night/50 px-4 py-1.5 text-[10px] tracking-[.06em] text-fog-3 backdrop-blur-sm">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gold" />
          khoros — the society is watching
        </span>
        <span className="hidden sm:inline">inference: this machine · relay: ciphertext</span>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center gap-5 px-6 pb-6 pt-12 sm:px-8">
        {/* THE app window — faithful to the real 460×760 companion */}
        <div className="flex h-[92%] max-h-[560px] w-auto flex-col overflow-hidden rounded-[14px] border border-line bg-[#08090C] shadow-[var(--shadow-card)]" style={{ aspectRatio: "460/700" }}>
          {/* titlebar */}
          <div className="relative flex items-center gap-[5px] border-b border-[#1F2128] bg-[#0C0D11] px-3 py-[7px]">
            <span className="h-[8px] w-[8px] rounded-full bg-[#2a2d36]" />
            <span className="h-[8px] w-[8px] rounded-full bg-[#2a2d36]" />
            <span className="display absolute inset-x-0 text-center text-[9px] tracking-[.3em] text-fog-3">KHOROS</span>
          </div>
          {/* identity row */}
          <div className="flex items-center gap-[6px] border-b border-[#1F2128] bg-[#0C0D11] px-3 py-[8px]">
            <span className="flex items-center gap-[5px] rounded-full border border-[#23252D] bg-[#111217] py-[3px] pl-[4px] pr-[8px]">
              <span className="display flex h-[15px] w-[15px] items-center justify-center rounded-full border border-[#2F323B] bg-[#1D1F25] text-[8px] text-gold">B</span>
              <span className="text-[10px] font-semibold">Budi</span>
              <span className="text-[8px] text-fog-3">✎</span>
            </span>
            <span className="ml-auto flex items-center gap-[4px] rounded-full border border-[#23252D] bg-[#111217] px-[7px] py-[3px]">
              <span className="h-[4px] w-[4px] rounded-full bg-gold-deep" />
              <span className="text-[8.5px] font-medium text-fog-2">on-device</span>
            </span>
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border border-[#23252D] bg-[#111217] text-[8px] text-fog-2">⌕</span>
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-md border border-[#23252D] bg-[#111217] text-[8px] text-fog-2">⚙</span>
          </div>
          {/* tabs — the active pill actually switches with the phase */}
          <div className="border-b border-[#1F2128] bg-[#0C0D11] px-3 pb-[8px] pt-[6px]">
            <div className="flex gap-[3px] rounded-[9px] border border-[#1F2128] bg-[#111217] p-[3px]">
              <Tab active={!onRoom} label="My Agent" />
              <Tab active={onRoom} label="Lobby" />
            </div>
          </div>

          {/* content — crossfade between the two real screens */}
          <div className="relative min-h-0 flex-1">
            <motion.div className="absolute inset-0" initial={false} animate={onRoom ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
              <RoomScreen play={onRoom} />
            </motion.div>
            <motion.div className="absolute inset-0" initial={false} animate={!onRoom ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
              <ChatScreen play={!onRoom} />
            </motion.div>
          </div>
        </div>

        {/* the behind-the-scenes panel */}
        <motion.div className="hidden h-[92%] max-h-[560px] w-[260px] sm:block" initial={false} animate={{ opacity: 1 }}>
          <Pipeline
            play={onRoom}
            title="on-device pipeline"
            lines={["qwen3 · loaded on this machine", "memory · local embeddings", "whisper · mic at 16 kHz", "relay · sees ciphertext only"]}
            footer="0 bytes of inference leave the machine"
            alt={{
              title: "watch pipeline",
              lines: ["/watch armed · Portugal vs Croatia", "following real ESPN data · 60s", "recap lands in your chat at FT"],
              footer: "your agent covers the matches you miss",
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}

function Tab({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`flex flex-1 items-center justify-center gap-1 rounded-[7px] py-[5px] text-[9.5px] transition-colors duration-300 ${active ? "bg-[#1D1F25] font-semibold text-fog" : "text-fog-2"}`}>
      {label}
    </span>
  );
}

/** Line-by-line reveal, restarted every time `play` flips on. */
function Seq({ play, delay, children }: { play: boolean; delay: number; children: React.ReactNode }) {
  return (
    <motion.div initial={false} animate={play ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }} transition={{ duration: 0.45, ease: EASE, delay: play ? delay : 0 }}>
      {children}
    </motion.div>
  );
}

/** The Lobby tab inside a live room — scoreboard, then MATCH FEED | CREW. */
function RoomScreen({ play }: { play: boolean }) {
  return (
    <div className="flex h-full flex-col text-[9px] leading-[1.45]">
      <div className="flex items-center border-b border-[#1F2128] bg-[#0C0D11] px-3 py-[5px]">
        <span className="rounded-full border border-[#23252D] bg-[#111217] px-[7px] py-[2px] text-[8.5px] text-fog-2">‹ Rooms</span>
        <span className="ml-auto text-[8.5px] text-fog-3">1 watching</span>
      </div>
      <Seq play={play} delay={0.4}>
        <div className="border-b border-[#1F2128] bg-[#0C0D11] px-3 pb-[10px] pt-[8px] text-center">
          <div className="mb-[6px] flex items-center justify-center gap-[6px]">
            <span className="flex items-center gap-[3px] rounded-full border border-[#4d2026] bg-live/15 px-[6px] py-[1px]">
              <span className="h-[4px] w-[4px] animate-pulse rounded-full bg-live" />
              <span className="text-[7.5px] font-extrabold tracking-[.08em] text-[#DC6471]">LIVE</span>
            </span>
            <span className="display text-[9px]">64&apos;</span>
          </div>
          <div className="flex items-center justify-center gap-[10px]">
            <span className="flex flex-col items-center gap-[2px]">
              <span className="text-[15px] leading-none">🇺🇸</span>
              <span className="text-[8px] uppercase tracking-[.03em] text-fog" style={{ fontFamily: "var(--font-condensed)" }}>
                United States
              </span>
            </span>
            <span className="display text-[24px] leading-none">2</span>
            <span className="text-[12px] text-fog-3">–</span>
            <span className="display text-[24px] leading-none">0</span>
            <span className="flex flex-col items-center gap-[2px]">
              <span className="text-[15px] leading-none">🇧🇦</span>
              <span className="text-[8px] uppercase tracking-[.03em] text-fog" style={{ fontFamily: "var(--font-condensed)" }}>
                Bosnia
              </span>
            </span>
          </div>
        </div>
      </Seq>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-px bg-[#1F2128]">
        <div className="space-y-[5px] bg-[#08090C] p-[7px]">
          <div className="text-[7px] font-bold uppercase tracking-[.1em] text-fog-3">Match feed</div>
          <Seq play={play} delay={1.6}>
            <div className="rounded-[7px] border border-[#3A3320] bg-gold/10 px-[7px] py-[5px]">
              <div className="text-[7.5px] font-bold text-gold">45&apos; · GOAL</div>
              <div className="text-fog-2">Balogun opens the scoring for the US.</div>
            </div>
          </Seq>
          <Seq play={play} delay={4.4}>
            <div className="rounded-[7px] bg-[#111217] px-[7px] py-[5px]">
              <div className="text-[7.5px] font-semibold text-fog-2">64&apos; · RED CARD</div>
              <div className="text-fog-2">The US goes down to ten men.</div>
            </div>
          </Seq>
        </div>
        <div className="space-y-[5px] bg-[#08090C] p-[7px]">
          <div className="text-[7px] font-bold uppercase tracking-[.1em] text-fog-3">Crew</div>
          <Seq play={play} delay={3.0}>
            <div className="rounded-[8px] border border-[#26282F] bg-[#111217] px-[7px] py-[5px]">
              <div className="mb-[2px] flex items-center gap-[4px]">
                <span className="display flex h-[12px] w-[12px] items-center justify-center rounded-full border border-[#2F323B] bg-[#1D1F25] text-[6.5px] text-gold">B</span>
                <b className="text-[8px]">Budi</b>
              </div>
              <div className="text-fog-2">Called it. Balogun always shows up early.</div>
            </div>
          </Seq>
          <Seq play={play} delay={5.8}>
            <div className="rounded-[8px] border border-[#1c3354] bg-[#0c1622] px-[7px] py-[5px]">
              <div className="mb-[2px] flex items-center gap-[4px]">
                <span className="flex h-[12px] w-[12px] items-center justify-center rounded-full bg-[#13243a] text-[6.5px] text-[#6E93CC]">🎙</span>
                <b className="text-[8px] text-[#AAC0DE]">Commentator</b>
              </div>
              <div className="text-fog-2">Ten men, two up. Hold on now!</div>
            </div>
          </Seq>
        </div>
      </div>
    </div>
  );
}

/** The My Agent tab — recap on demand, then arming a watch. */
function ChatScreen({ play }: { play: boolean }) {
  return (
    <div className="flex h-full flex-col text-[9.5px] leading-[1.5]">
      <div className="min-h-0 flex-1 space-y-[6px] overflow-hidden p-[9px]">
        <Seq play={play} delay={0.5}>
          <div className="ml-auto w-fit max-w-[85%] rounded-[9px_9px_3px_9px] border border-[#34373F] bg-[#22242B] px-[8px] py-[5px]">/recap usa vs bosnia</div>
        </Seq>
        <Seq play={play} delay={1.8}>
          <div className="flex items-end gap-[5px]">
            <span className="display flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border border-[#2F323B] bg-[#1D1F25] text-[7px] text-gold">B</span>
            <div className="w-fit max-w-[88%] rounded-[9px_9px_9px_3px] border border-[#26282F] bg-[#181A20] px-[8px] py-[5px] text-[#DDE0E6]">
              The US took it 2-0. Balogun opened at 45&apos;, a red card made it tense, then Tillman buried the free kick at 82&apos;. Gritty and composed.
            </div>
          </div>
        </Seq>
        <Seq play={play} delay={4.4}>
          <div className="ml-auto w-fit max-w-[85%] rounded-[9px_9px_3px_9px] border border-[#34373F] bg-[#22242B] px-[8px] py-[5px]">/watch portugal vs croatia</div>
        </Seq>
        <Seq play={play} delay={5.8}>
          <div className="flex items-end gap-[5px]">
            <span className="display flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border border-[#2F323B] bg-[#1D1F25] text-[7px] text-gold">B</span>
            <div className="w-fit max-w-[88%] rounded-[9px_9px_9px_3px] border border-[#26282F] bg-[#181A20] px-[8px] py-[5px] text-[#DDE0E6]">
              On it. I&apos;ll watch the whole thing and report back at full time. 🍿
            </div>
          </div>
        </Seq>
      </div>
      {/* composer */}
      <div className="border-t border-[#1F2128] bg-[#0C0D11] p-[8px]">
        <div className="flex items-center gap-[6px] rounded-full border border-[#2F323B] bg-[#111217] py-[4px] pl-[9px] pr-[4px]">
          <span className="flex-1 text-[8.5px] text-fog-3">Message Budi…</span>
          <span className="text-[8px] text-fog-2">📎</span>
          <span className="text-[8px] text-fog-2">🎙</span>
          <span className="flex h-[15px] w-[15px] items-center justify-center rounded-full bg-gold text-[7px] text-gold-ink">➤</span>
        </div>
      </div>
    </div>
  );
}

function Pipeline({
  play,
  title,
  lines,
  footer,
  alt,
}: {
  play: boolean;
  title: string;
  lines: string[];
  footer: string;
  alt: { title: string; lines: string[]; footer: string };
}) {
  const t = play ? title : alt.title;
  const l = play ? lines : alt.lines;
  const f = play ? footer : alt.footer;
  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-night-2/80 p-3 backdrop-blur-sm">
      <span className="kicker !text-[9.5px]">{t}</span>
      <div className="mt-3 flex-1 space-y-2">
        {l.map((line, i) => (
          <Seq key={line} play delay={1.2 + i * 1.1}>
            <div className="flex items-center gap-2 text-[10.5px] text-fog-2">
              <span className="flex h-[14px] w-[14px] items-center justify-center rounded-full bg-night-3 text-[8px] text-gold">✓</span>
              {line}
            </div>
          </Seq>
        ))}
      </div>
      <div className="border-t border-line pt-2 text-[9.5px] text-fog-3">{f}</div>
    </div>
  );
}
