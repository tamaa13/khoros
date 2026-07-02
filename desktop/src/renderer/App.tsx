import { useCallback, useEffect, useRef, useState } from "react";
import { khoros } from "./khoros";
import { Titlebar } from "./components/Titlebar";
import { Welcome } from "./components/onboarding/Welcome";
import { Boot } from "./components/onboarding/Boot";
import { AppHeader, type Tab } from "./components/AppHeader";
import { ChatPanel } from "./components/chat/ChatPanel";
import { LobbyPanel } from "./components/lobby/LobbyPanel";

type Phase = "welcome" | "boot" | "app";

export function App() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [name, setName] = useState("your agent");
  const [modelsReady, setModelsReady] = useState(false);
  const [bootStatus, setBootStatus] = useState("Waking your agent…");
  const [bootProgress, setBootProgress] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("agent");
  const [voice, setVoice] = useState(false);
  const [language, setLanguage] = useState("English");
  const [theme, setTheme] = useState<"dark" | "light">(() => (typeof localStorage !== "undefined" && localStorage.getItem("khoros.theme") === "light" ? "light" : "dark"));
  const [searchOpen, setSearchOpen] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    try {
      localStorage.setItem("khoros.theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    // IPC handlers register only after the (slow) agent init, so the first
    // getSettings may race-fail — onReady (sent post-init) is the real signal.
    const decide = (needsName: boolean) => {
      if (decided.current) return;
      decided.current = true;
      setPhase(needsName ? "welcome" : "app");
    };
    khoros.onReady((ctx) => {
      setModelsReady(true);
      if (ctx.name) setName(ctx.name);
      decide(ctx.needsName);
    });
    khoros.onStatus((s) => setBootStatus(s));
    khoros.onProgress((p) => {
      const pct = typeof p === "number" ? p : (p as { pct?: number; percentage?: number })?.pct ?? (p as { percentage?: number })?.percentage;
      if (typeof pct === "number") setBootProgress(pct);
    });
    khoros
      .getSettings()
      .then((s) => {
        if (s.agentName) setName(s.agentName);
        setVoice(!!s.voice);
        if (s.language) setLanguage(s.language);
        decide(!s.agentName);
      })
      .catch(() => {
        /* handlers not up yet — onReady will decide */
      });
  }, []);

  const onCreate = useCallback(
    async (newName: string, lang: string) => {
      const english = /^en/i.test(lang);
      await khoros.setSettings({ agentName: newName, language: english ? "" : lang });
      setName(newName);
      setPhase(modelsReady ? "app" : "boot");
    },
    [modelsReady],
  );

  const onRename = useCallback(async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await khoros.setSettings({ agentName: trimmed });
    setName(trimmed);
  }, []);

  const changeVoice = useCallback((v: boolean) => {
    setVoice(v);
    void khoros.setSettings({ voice: v });
  }, []);

  // Flip the theme under a brief global color transition (see .theme-fade).
  const changeTheme = useCallback((t: "dark" | "light") => {
    const el = document.documentElement;
    el.classList.add("theme-fade");
    window.setTimeout(() => el.classList.remove("theme-fade"), 400);
    setTheme(t);
  }, []);

  const changeLanguage = useCallback((l: string) => {
    setLanguage(l);
    void khoros.setSettings({ language: /^english$/i.test(l) ? "" : l });
  }, []);

  return (
    <div className="app-backdrop flex h-full flex-col text-content">
      <Titlebar />
      {phase === "welcome" && <Welcome onCreate={onCreate} />}
      {phase === "boot" && <Boot name={name} status={bootStatus} progress={bootProgress} />}
      {phase === "app" && (
        <>
          <AppHeader name={name} tab={tab} onTab={setTab} onRename={onRename} voice={voice} onVoiceChange={changeVoice} language={language} onLanguageChange={changeLanguage} theme={theme} onThemeChange={changeTheme} searchOpen={searchOpen} onToggleSearch={() => setSearchOpen((s) => !s)} />
          <div className="relative min-h-0 flex-1">
            {/* display:none → block restarts the CSS animation, so each tab
                switch gets the same soft fade-slide entrance */}
            <div className={tab === "agent" ? "h-full animate-tab-in" : "hidden h-full"}>
              <ChatPanel name={name} onRename={onRename} voice={voice} onVoiceChange={changeVoice} searchOpen={searchOpen} onCloseSearch={() => setSearchOpen(false)} />
            </div>
            <div className={tab === "lobby" ? "h-full animate-tab-in" : "hidden h-full"}>
              <LobbyPanel active={tab === "lobby"} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
