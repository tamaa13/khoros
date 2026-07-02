import { useMemo } from "react";
import { Brain, Calendar, CircleHelp, Dna, Ear, Eye, Globe, History, Languages, Loader2, Mic, Paperclip, Pencil, ScanText, Search, Send, Sparkles, Trash2, Users, Volume2 } from "lucide-react";
import type { MicStatus } from "../../hooks/useMic";

interface Cmd {
  name: string;
  desc: string;
  icon: React.ReactNode;
}
const COMMANDS: Cmd[] = [
  { name: "/imagine", desc: "generate an image", icon: <Sparkles /> },
  { name: "/voice", desc: "agent speaks replies", icon: <Volume2 /> },
  { name: "/translate", desc: "translate a message", icon: <Languages /> },
  { name: "/watch", desc: "agent watches a match for you", icon: <Eye /> },
  { name: "/recap", desc: "recap a finished match", icon: <History /> },
  { name: "/listen", desc: "transcribe live audio", icon: <Ear /> },
  { name: "/read", desc: "read text from a photo (OCR)", icon: <ScanText /> },
  { name: "/evolve", desc: "fine-tune on your takes", icon: <Dna /> },
  { name: "/memories", desc: "what it remembers", icon: <Brain /> },
  { name: "/recall", desc: "search memory", icon: <Search /> },
  { name: "/schedule", desc: "fixtures & results", icon: <Calendar /> },
  { name: "/name", desc: "rename your agent", icon: <Pencil /> },
  { name: "/language", desc: "reply language", icon: <Globe /> },
  { name: "/lobby", desc: "open the lobby", icon: <Users /> },
  { name: "/help", desc: "all commands", icon: <CircleHelp /> },
  { name: "/clear", desc: "clear this chat", icon: <Trash2 /> },
];

const Bars = () => (
  <div className="flex h-[22px] items-center gap-[3px]">
    {[60, 100, 45, 80, 55, 90].map((h, i) => (
      <span key={i} className="w-[3px] rounded-full bg-gold animate-wave" style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }} />
    ))}
  </div>
);

export function Composer({
  value,
  onChange,
  onSubmit,
  onPick,
  mic,
  onMic,
  onAttach,
  disabled,
  name,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onPick: (cmd: string) => void;
  mic: MicStatus;
  onMic: () => void;
  onAttach: () => void;
  disabled: boolean;
  name: string;
}) {
  const slash = value.startsWith("/") && !value.includes(" ");
  const matches = useMemo(() => (slash ? COMMANDS.filter((c) => c.name.startsWith(value.toLowerCase())) : []), [slash, value]);
  const recording = mic === "listening";
  const transcribing = mic === "transcribing";

  return (
    <div className="relative flex-shrink-0 border-t border-[rgb(var(--c1f2128))] bg-[rgb(var(--c0c0d11))] px-[14px] pb-4 pt-3">
      {/* slash command popover */}
      {slash && matches.length > 0 && (
        <div className="absolute bottom-[74px] left-[14px] right-[14px] overflow-hidden rounded-[16px] border border-border bg-surface-1 shadow-pop animate-rise">
          <div className="border-b border-[rgb(var(--c1f2128))] px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-[.1em] text-content-faint">Commands</div>
          <div className="kh-scroll max-h-[230px] overflow-y-auto">
            {matches.map((c, i) => (
              <button
                key={c.name}
                onClick={() => onPick(c.name + " ")}
                className={`flex w-full items-center gap-3 px-[14px] py-[10px] text-left transition-colors ${i === 0 ? "border-l-2 border-gold bg-gold/[.08]" : "hover:bg-surface-2"}`}
              >
                <span className={i === 0 ? "text-gold" : "text-content-muted"}>{wrapIcon(c.icon)}</span>
                <span className="flex-1 text-[13px]">
                  <span className={`font-mono ${i === 0 ? "text-content" : "text-[rgb(var(--cc9cdd6))]"}`}>{c.name}</span> <span className="text-[12.5px] text-content-faint">— {c.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* input row */}
      <div
        className={`flex items-center gap-[9px] rounded-[18px] border bg-[rgb(var(--c111217))] py-[7px] pl-[14px] pr-[8px] transition-shadow ${
          recording || transcribing ? "border-gold" : slash ? "border-gold shadow-[0_0_0_3px_rgba(244,196,76,.1)]" : "border-border focus-within:border-border-strong"
        }`}
      >
        {recording ? (
          <>
            <span className="relative flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center">
              <span className="absolute -inset-1 rounded-full border-[1.5px] border-gold animate-ring" />
              <Mic className="h-[17px] w-[17px] text-gold" strokeWidth={1.75} />
            </span>
            <Bars />
            <span className="flex-1 text-[12.5px] text-[rgb(var(--cc9cdd6))]">Listening…</span>
          </>
        ) : transcribing ? (
          <>
            <Loader2 className="h-[18px] w-[18px] flex-shrink-0 animate-spin text-gold" strokeWidth={2} />
            <span className="flex-1 text-[12.5px] text-[rgb(var(--cc9cdd6))]">Transcribing your voice… (on-device)</span>
          </>
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmit();
              }
            }}
            disabled={disabled}
            placeholder={`Message ${name}…`}
            className={`min-w-0 flex-1 bg-transparent py-2 text-[14px] outline-none placeholder:text-content-faint ${value.startsWith("/") ? "font-mono text-gold-bright" : "text-content"}`}
          />
        )}
        <button
          onClick={onAttach}
          disabled={disabled}
          className="flex h-[34px] w-[32px] flex-shrink-0 items-center justify-center rounded-[9px] text-content-muted transition-colors hover:text-content disabled:opacity-50"
          aria-label="Share a photo"
        >
          <Paperclip className="h-[17px] w-[17px]" strokeWidth={1.75} />
        </button>
        <button
          onClick={onMic}
          disabled={transcribing}
          className={`flex h-[34px] w-[32px] flex-shrink-0 items-center justify-center rounded-[9px] transition-colors ${recording ? "bg-gold text-gold-fg" : transcribing ? "text-gold" : "text-content-muted hover:text-content"}`}
          aria-label="Voice input"
        >
          {transcribing ? <Loader2 className="h-[17px] w-[17px] animate-spin" strokeWidth={2} /> : <Mic className="h-[17px] w-[17px]" strokeWidth={1.75} />}
        </button>
        <button onClick={onSubmit} disabled={disabled} className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[11px] bg-gold text-gold-fg transition-transform hover:-translate-y-px active:translate-y-px disabled:opacity-50" aria-label="Send">
          <Send className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function wrapIcon(node: React.ReactNode) {
  return <span className="[&>svg]:h-[17px] [&>svg]:w-[17px]">{node}</span>;
}
