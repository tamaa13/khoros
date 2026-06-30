/**
 * Build the Electron app:
 *  1. main process  — Node ESM bundle (agent core inlined; @qvac/sdk + ws external).
 *  2. preload       — copied as-is.
 *  3. renderer      — React + TypeScript bundled with esbuild (browser target).
 *  4. styles        — Tailwind compiled from the design tokens.
 */
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

rmSync(".build", { recursive: true, force: true });
mkdirSync(".build/renderer", { recursive: true });

// 1. Electron main (Node, ESM so it can import the ESM-only @qvac/sdk).
await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: ".build/main.mjs",
  external: ["electron", "@qvac/sdk", "ws"],
  nodePaths: [join(here, "node_modules")],
  logLevel: "info",
});

cpSync("src/preload.cjs", ".build/preload.cjs");

// 2. React renderer (browser-targeted bundle; React/Framer/Lucide inlined).
await build({
  entryPoints: ["src/renderer/main.tsx"],
  bundle: true,
  format: "esm",
  target: ["chrome120"],
  outfile: ".build/renderer/renderer.js",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});

// 3. Tailwind CSS from the design tokens.
execSync("npx tailwindcss -i src/renderer/index.css -o .build/renderer/styles.css --minify", {
  stdio: "inherit",
  cwd: here,
});

// 4. HTML shell.
cpSync("src/renderer/index.html", ".build/renderer/index.html");

console.log("✓ built main.mjs + preload + React renderer + Tailwind styles");
