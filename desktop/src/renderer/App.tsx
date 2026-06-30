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
  const decided = useRef(false);

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

  return (
    <div className="flex h-full flex-col bg-bg-base text-content">
      <Titlebar />
      {phase === "welcome" && <Welcome onCreate={onCreate} />}
      {phase === "boot" && <Boot name={name} status={bootStatus} progress={bootProgress} />}
      {phase === "app" && (
        <>
          <AppHeader name={name} tab={tab} onTab={setTab} onRename={onRename} voice={voice} onVoiceChange={changeVoice} language={language} />
          <div className="relative min-h-0 flex-1">
            <div className={tab === "agent" ? "h-full" : "hidden h-full"}>
              <ChatPanel name={name} onRename={onRename} voice={voice} onVoiceChange={changeVoice} />
            </div>
            <div className={tab === "lobby" ? "h-full" : "hidden h-full"}>
              <LobbyPanel active={tab === "lobby"} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
