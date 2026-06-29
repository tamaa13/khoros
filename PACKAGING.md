# Packaging & distribution

Khoros runs **on-device**. The heavy parts — the LLM, the embeddings for memory,
TTS — all run locally via `@qvac/sdk` (Holepunch Bare). That changes what
"shipping" means: there is almost nothing to **deploy** (host on a server), only
something to **distribute** (get onto a user's machine).

## Deploy (hosting)

- **Inference: nothing to host.** It runs on the user's device. That is the QVAC
  point, not a gap.
- **The relay is the only networked piece.** It is a tiny *blind* WebSocket relay
  (it only ever sees ciphertext). Options: localhost for a demo or for judges
  running locally (zero deploy); a small VPS (Fly.io / Railway) for a live
  cross-device room; or drop it entirely for Holepunch P2P (no server at all).

Models download themselves from the QVAC registry on first run (cached under
`~/.qvac/models/`), so a user never sets up models by hand.

## Distribute (getting the app to a user)

| Path | Status | Notes |
| --- | --- | --- |
| **Run from source** | ✅ works now | `bun install` → `bun demo` / `bun demo:lobby`. Fine for the (technical) hackathon judges. |
| **Single binary** (`bun build --compile`) | ❌ not viable | Builds, but won't run — see below. |
| **Electron desktop app** | ✅ supported path | QVAC ships `@qvac/sdk/electron-forge`. Produces a `.app` / `.dmg`. |
| **Mobile** (Expo) | ✅ supported path | QVAC ships Expo iOS/Android link plugins. |
| **Pear** (Holepunch P2P) | ✅ on-brand | Via `@qvac/bare-sdk`; P2P distribution, no server, no app store. |

### Why a single binary doesn't work (tested)

`bun build --compile` was the obvious first try. Empirically:

```bash
bun build --compile --target=bun-darwin-arm64 pkg/smoke.ts --outfile dist/khoros-smoke
./dist/khoros-smoke
# BARE_RUNTIME_BINARY_NOT_FOUND: Could not load the Bare runtime binary for darwin-arm64...
```

The build succeeds (a ~63 MB binary), but it **fails at runtime**. QVAC is built
on Bare and resolves its native runtime (`bare-runtime-darwin-arm64`) and ~76
`.node` prebuilt addons from `node_modules` *at runtime*. `bun --compile` produces
a sealed bundle whose module resolution can't reach those native packages — even
when they are installed and present on disk. So the one-file binary is a dead end
for this native stack. (`pkg/smoke.ts` still runs fine the normal way:
`bun pkg/smoke.ts`.)

### The real desktop path: Electron

QVAC's `@qvac/sdk/electron-forge` plugin exists for exactly this: it bundles the
worker, verifies the native addons, and tree-shakes unused `@qvac/*` addons and
non-target prebuilds into the packaged app. Notes from the plugin itself:

- Build **per architecture** — `darwin-arm64` and `darwin-x64` separately; macOS
  `universal` is not supported (prebuilds are arch-specific).
- The result is a normal double-clickable desktop app; models still download on
  first run.

This is the route to a consumer "download and run" Khoros. It is a separate
project (Electron main/renderer + a UI + Forge config + per-arch builds), so it's
tracked here as the distribution plan rather than built into this CLI repo.

## Recommendation

For the hackathon, **run-from-source is enough** for the judges, and this file is
the honest answer to "how does it reach real users": on-device (no inference to
host), distributed as an Electron app on desktop or an Expo app on mobile, with
Pear as the P2P-native option.
