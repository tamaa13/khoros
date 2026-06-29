# Khoros desktop

The on-device World Cup agent as a double-clickable desktop app — so a user
**installs and just uses it**, no `bun`, no repo, no model setup. The LLM, the
memory embeddings, and the football tools all run locally; the model downloads
itself once on first run.

It's an Electron shell around the same agent core the CLI uses (`../agent`,
`../config`, `../tools` — all Node-portable). `build.mjs` bundles the main process
with esbuild (keeping `@qvac/sdk` external/native); the QVAC Electron Forge plugin
packages the native runtime.

## Run it (dev)

```bash
cd desktop
npm install        # electron + forge + @qvac/sdk (first run pulls Electron)
npm start          # builds the main process, then launches the app
```

A window opens, shows "loading the on-device model…", and once ready you can chat
with your agent — persistent memory, the prediction→callback "told you so", and
real World Cup data via on-device tool-calling, all local.

Pick the brain with `KHOROS_LLM` (`8b` default, `4b`/`1.7b` for less RAM):

```bash
KHOROS_LLM=4b npm start
```

## Package a distributable

```bash
npm run make       # -> out/make/… a .dmg / .zip for the current arch
```

Build per architecture (`darwin-arm64` and `darwin-x64` separately) — QVAC's
native prebuilds are arch-specific, so a macOS universal build isn't supported.
See [../PACKAGING.md](../PACKAGING.md) for the full distribution picture.
