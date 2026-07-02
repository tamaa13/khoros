import { useEffect, useRef, useState } from "react";
import { MessageCircle, Pencil, Search, Settings, Users } from "lucide-react";
import { AgentGlyph } from "./Logo";
import { SettingsMenu } from "./SettingsMenu";

export type Tab = "agent" | "lobby";

export function AppHeader({ name, tab, onTab, onRename, voice, onVoiceChange, language, onLanguageChange, theme, onThemeChange, searchOpen, onToggleSearch }: { name: string; tab: Tab; onTab: (t: Tab) => void; onRename: (n: string) => void; voice: boolean; onVoiceChange: (v: boolean) => void; language: string; onLanguageChange: (l: string) => void; theme: "dark" | "light"; onThemeChange: (t: "dark" | "light") => void; searchOpen: boolean; onToggleSearch: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(name);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, name]);

  const commit = () => {
    if (draft.trim()) onRename(draft.trim());
    setEditing(false);
  };

  return (
    <div className="relative flex-shrink-0 bg-[rgb(var(--c0c0d11))] px-4 pt-[14px]">
      {settingsOpen && <SettingsMenu voice={voice} onVoiceChange={onVoiceChange} language={language} onLanguageChange={onLanguageChange} theme={theme} onThemeChange={onThemeChange} onClose={() => setSettingsOpen(false)} />}
      {/* identity row — the agent chip leads (the titlebar already carries the
          KHOROS wordmark; repeating it here was a wasted row) */}
      <div className="mb-[12px] flex items-center gap-[8px]">
        {editing ? (
          <div className="flex w-fit items-center gap-[8px] rounded-full border border-gold bg-[rgb(var(--c111217))] py-[6px] pl-[7px] pr-3">
            <AgentGlyph size={22} />
            <input
              ref={inputRef}
              value={draft}
              maxLength={24}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" ? commit() : e.key === "Escape" ? setEditing(false) : null)}
              onBlur={commit}
              className="w-[120px] bg-transparent text-[13px] font-semibold text-content outline-none"
            />
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-[8px] rounded-full border border-border-subtle bg-[rgb(var(--c111217))] py-[6px] pl-[7px] pr-[8px] text-content transition-colors hover:border-border" title="Rename your agent">
            <AgentGlyph size={22} />
            <span className="text-[13px] font-semibold">{name}</span>
            <Pencil className="h-[13px] w-[13px] text-content-faint" strokeWidth={1.75} />
          </button>
        )}
        <span className="ml-auto flex items-center gap-[7px] rounded-full border border-[rgb(var(--c3d3621))] bg-gold/[.07] py-[5px] pl-[9px] pr-[10px]">
          <span className="relative h-[7px] w-[7px]">
            <span className="absolute inset-0 rounded-full bg-gold animate-pulse-dot" />
          </span>
          <span className="text-[10.5px] font-semibold text-gold-bright">on-device</span>
        </span>
        {tab === "agent" && (
          <button onClick={onToggleSearch} className={`flex h-[32px] w-[32px] items-center justify-center rounded-md border transition-colors ${searchOpen ? "border-gold-deep bg-gold/[.08] text-gold" : "border-border-subtle bg-[rgb(var(--c111217))] text-content-muted hover:text-content"}`} aria-label="Search this chat">
            <Search className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
        <button onClick={() => setSettingsOpen((s) => !s)} className={`flex h-[32px] w-[32px] items-center justify-center rounded-md border transition-colors ${settingsOpen ? "border-gold-deep bg-gold/[.08] text-gold" : "border-border-subtle bg-[rgb(var(--c111217))] text-content-muted hover:text-content"}`} aria-label="Settings">
          <Settings className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* tabs */}
      <div className="flex gap-[4px] rounded-[13px] border border-[rgb(var(--c1f2128))] bg-[rgb(var(--c111217))] p-[4px]">
        <TabButton active={tab === "agent"} onClick={() => onTab("agent")} icon={<MessageCircle className="h-[15px] w-[15px]" strokeWidth={1.75} />} label="My Agent" />
        <TabButton active={tab === "lobby"} onClick={() => onTab("lobby")} icon={<Users className="h-[15px] w-[15px]" strokeWidth={1.75} />} label="Lobby" />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-[7px] rounded-[9px] py-[9px] text-[13px] transition-colors duration-fast ${
        active ? "bg-surface-2 font-semibold text-content shadow-card" : "font-medium text-content-muted hover:text-content"
      }`}
    >
      <span className={active ? "text-gold" : ""}>{icon}</span>
      {label}
    </button>
  );
}
