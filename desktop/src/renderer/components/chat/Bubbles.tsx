import { Undo2 } from "lucide-react";
import { AgentGlyph } from "../Logo";

export interface ChatMsg {
  id: number;
  role: "agent" | "user" | "system";
  text: string;
  told?: boolean;
  tools?: string[];
  image?: string;
  caption?: string;
}

export function AgentBubble({ text, tools }: { text: string; tools?: string[] }) {
  return (
    <div className="flex items-end gap-[10px] animate-rise">
      <AgentGlyph size={28} />
      <div className="max-w-[78%]">
        <div className="rounded-[16px_16px_16px_5px] border border-surface-3 bg-[rgb(var(--c181a20))] px-[14px] py-[11px] text-[14px] leading-[1.5] text-[rgb(var(--cdde0e6))]">{text}</div>
        {tools && tools.length > 0 && (
          <div className="mt-[5px] inline-flex items-center gap-1 rounded-full border border-border-subtle bg-[rgb(var(--c111217))] px-2 py-[2px] text-[10.5px] font-medium text-content-muted">
            🔧 {tools.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end animate-rise">
      <div className="max-w-[78%] rounded-[16px_16px_5px_16px] border border-[rgb(var(--c34373f))] bg-[rgb(var(--c22242b))] px-[14px] py-[11px] text-[14px] leading-[1.5] text-content">{text}</div>
    </div>
  );
}

export function ToldYouSo({ text }: { text: string }) {
  return (
    <div className="relative mt-1 overflow-hidden rounded-[16px] border border-[rgb(var(--c3a3320))] bg-[rgb(var(--c100f0a))] px-[15px] py-[13px] animate-rise">
      <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-gold/20 to-transparent animate-shine" />
      <div className="mb-[9px] flex items-center gap-[7px]">
        <Undo2 className="h-[15px] w-[15px] text-gold" strokeWidth={2} />
        <span className="font-condensed text-[13px] uppercase tracking-[.06em] text-gold">Told you so</span>
      </div>
      <div className="text-[14px] leading-[1.5] text-[rgb(var(--cdde0e6))]">{text}</div>
    </div>
  );
}

export function Typing() {
  return (
    <div className="flex items-end gap-[10px]">
      <AgentGlyph size={28} />
      <div className="flex gap-[5px] rounded-[16px_16px_16px_5px] border border-surface-3 bg-[rgb(var(--c181a20))] px-4 py-[13px]">
        <span className="h-[7px] w-[7px] rounded-full bg-content-faint animate-bounce-dot" />
        <span className="h-[7px] w-[7px] rounded-full bg-content-faint animate-bounce-dot [animation-delay:.18s]" />
        <span className="h-[7px] w-[7px] rounded-full bg-content-faint animate-bounce-dot [animation-delay:.36s]" />
      </div>
    </div>
  );
}

export function ImageBubble({ src, caption, onOpen }: { src: string; caption?: string; onOpen: (src: string) => void }) {
  const url = `data:image/png;base64,${src}`;
  return (
    <div className="flex items-end gap-[10px] animate-rise">
      <AgentGlyph size={28} />
      <div className="max-w-[78%]">
        <button onClick={() => onOpen(url)} className="block overflow-hidden rounded-[16px_16px_16px_5px] border border-surface-3">
          <img src={url} alt={caption || "generated"} className="block w-full" />
        </button>
        {caption && <div className="mt-[5px] px-1 text-[11px] text-content-faint">{caption}</div>}
      </div>
    </div>
  );
}

export function SystemLine({ text }: { text: string }) {
  return <div className="whitespace-pre-line px-2 text-center text-[11.5px] leading-[1.5] text-content-faint">{text}</div>;
}
