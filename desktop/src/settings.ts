/**
 * User settings, persisted to settings.json in the OS app-data dir. Holds the
 * agent's name (identity), preferred reply language, and voice toggle.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface Settings {
  agentName?: string;
  language?: string; // undefined = English (the persona default)
  voice?: boolean;
  // matches the agent is watching for the user — re-armed on boot
  watches?: { id: string; home: string; away: string }[];
}

export function loadSettings(file: string): Settings {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    /* corrupt or unreadable — start fresh */
  }
  return {};
}

export function saveSettings(file: string, s: Settings): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(s, null, 2));
}
