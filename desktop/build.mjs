/**
 * Build the Electron main process. The agent core (../agent, ../config, ../tools)
 * is Node-portable TS, so esbuild bundles it into one CJS file; @qvac/sdk stays
 * external (its native Bare runtime is required from node_modules at runtime, and
 * the Forge plugin packages it). The preload + renderer are copied as-is.
 */
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync(".build", { recursive: true, force: true });
mkdirSync(".build", { recursive: true });

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  // ESM, so the bundle can import the ESM-only @qvac/sdk (CJS require() can't).
  format: "esm",
  target: "node20",
  outfile: ".build/main.mjs",
  // electron is provided by the runtime; @qvac/sdk must stay unbundled (native).
  external: ["electron", "@qvac/sdk"],
  logLevel: "info",
});

cpSync("src/preload.cjs", ".build/preload.cjs");
cpSync("src/renderer", ".build/renderer", { recursive: true });
console.log("✓ built .build/main.mjs (+ preload, renderer)");
