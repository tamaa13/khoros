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
npm run make       # -> out/make/… an installer for the OS you run this on
```

What you get per OS (run `npm run make` **on that OS**):

| Build host | Output | Requirement to run |
|---|---|---|
| **macOS** (Apple Silicon / Intel) | `.dmg` + `.zip` | — |
| **Windows** (x64) | `Khoros-Setup.exe` (Squirrel) + `.zip` | Vulkan-capable GPU |
| **Linux** (x64) | `.deb` + `.zip` | Vulkan-capable GPU |

**You must build on each OS.** QVAC's native addons are per-OS/per-arch and the
Forge plugin keeps only the build host's binaries — they can't cross-compile, and
a macOS universal build isn't supported. (Tether ships its own Workbench the same
way: separate `.dmg` / `.msix` / `.AppImage`.) So: make the Mac build on a Mac,
the Windows build on a Windows machine, the Linux build on Linux — or use a CI
matrix (GitHub Actions `runs-on: macos-latest / windows-latest / ubuntu-latest`)
to produce all three from one push.

On Windows/Linux QVAC needs a **Vulkan-capable GPU** (CPU fallback works but is
slow); macOS uses Metal. The model still downloads once on first run on every OS.

Unsigned builds will warn on first open (macOS Gatekeeper / Windows SmartScreen) —
right-click → Open (mac) or "More info → Run anyway" (Windows). Code-signing +
notarization removes that but needs paid developer certs; not required for sharing
with technical users. See [../PACKAGING.md](../PACKAGING.md) for the full picture.
