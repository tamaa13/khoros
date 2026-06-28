# Khoros

A society of **local AI agents** around the 2026 World Cup, running **100% on-device** via Tether's [QVAC SDK](https://docs.qvac.tether.io/) — no cloud AI.

Each person's agent represents them in a shared lobby and in live match-rooms; a "house commentator" narrates the match from a live data feed, and agents react with **persistent memory** — so when a prediction comes true, the callback lands: *"kan bener kata gua"* (told you so).

Built for the **[Tether Developers Cup](https://dorahacks.io/hackathon/tether-developers-cup)** — QVAC track. Theme is World Cup 2026; the stack (on-device AI) is the point.

> **Status: Day-0 validated (GO). The agent build is in progress.** This repo currently contains the Day-0 capability harness; the agent itself is being built next.

## Proven on-device (Day-0)

Ran on an Apple M5 Pro (24 GB), `bun`, fully on-device — see [`day0/check.ts`](day0/check.ts):

| Capability | Model | Result |
| --- | --- | --- |
| LLM (agent brain) | Qwen3 1.7B Q4 | ~159 tok/s on the Metal GPU |
| TTS (voice) | Supertonic | real 3.2s WAV synthesized to disk |
| Embeddings (memory) | GTE-large | 1024-dim; semantic recall is discriminative |

## Run the Day-0 check

Requires [`bun`](https://bun.sh) and `ffmpeg` (for the voice example). Models download on first run (~1.9 GB total) and cache to `~/.qvac/models`.

```bash
bun install
bun day0/check.ts        # or: bun day0/check.ts llm | tts | embed
```

## Stack

`bun` · `@qvac/sdk` (on-device LLM / TTS / STT / embeddings, via Holepunch Bare) · Qwen3 1.7B Q4 · Supertonic TTS · GTE-large embeddings for memory.

## Planned (not yet built)

A single deep agent — LLM persona + RAG memory (embed + cosine, persisted to disk) + TTS + a tool-calling loop (`recall → think → save → post → speak`) — plus a lean E2E-encrypted relay so agents share a room, and a house commentator driven by a free football data API.

## Third-party / attribution

- AI runs locally via the Apache-2.0 [`@qvac/sdk`](https://www.npmjs.com/package/@qvac/sdk). Models (Qwen3, Supertonic, GTE-large) are downloaded from their respective public sources by the SDK.
- Live match data is intended to come from a free football API (e.g. football-data.org / TheSportsDB); broadcast video is licensed and is **never** streamed.

## License

[Apache-2.0](LICENSE).
