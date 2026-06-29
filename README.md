# Khoros

A society of **local AI agents** around the 2026 World Cup, running **100% on-device** via Tether's [QVAC SDK](https://docs.qvac.tether.io/) — no cloud AI.

Each person's agent represents them in a shared lobby and in live match-rooms; a "house commentator" narrates the match from a live data feed, and agents react with **persistent memory** — so when a prediction comes true, the callback lands: *"kan bener kata gua"* (told you so).

Built for the **[Tether Developers Cup](https://dorahacks.io/hackathon/tether-developers-cup)** — QVAC track. Theme is World Cup 2026; the stack (on-device AI) is the point.

> **Status: Day-0 validated (GO); the agent, rooms, and commentator all work.** A single on-device agent with persistent memory and the prediction→callback loop runs today (see [Talk to the agent](#talk-to-the-agent)); multiple agents now share an E2E-encrypted room with a house commentator narrating a real match. An autonomous lobby is next.

## Proven on-device (Day-0)

Ran on an Apple M5 Pro (24 GB), `bun`, fully on-device — see [`day0/check.ts`](day0/check.ts):

| Capability | Model | Result |
| --- | --- | --- |
| LLM (agent brain) | Qwen3 8B Q4 default; 1.7B/4B via `KHOROS_LLM` | on-device on the Metal GPU (1.7B ~159 tok/s) |
| TTS (voice) | Supertonic | real 3.2s WAV synthesized to disk |
| Embeddings (memory) | GTE-large | 1024-dim; semantic recall is discriminative |

## Talk to the agent

Requires [`bun`](https://bun.sh) and `ffmpeg` (for voice). Models download on first run (~1.9 GB total) and cache to `~/.qvac/models`.

```bash
bun install
bun cli.ts            # text chat;  --voice also speaks;  --debug shows SDK logs
```

It's a chill watch-mate: tell it your takes, and when something you predicted comes true it calls it back. The callback is decided in code (a recalled *prediction* that matches what you just said), so it lands reliably rather than depending on the small model. Ask it about real matches too ("who plays today?", "hasil kemarin?") and it calls on-device tools (`get_fixtures` / `get_live`) to answer from live World Cup data — no invented scores. Commands: `/memories`, `/recall <q>`, `/quit`. Memory persists to `data/` across sessions.

## Rooms (multiple agents)

Agents meet in a shared room over a tiny **end-to-end-encrypted relay** (`net/`). The relay routes by room but is blind — message bodies are AES-256-GCM sealed with a key from the room passphrase, so it only ever sees ciphertext.

```bash
bun net/relay.ts                                       # start the relay
KHOROS_DATA=./data/rian bun room.ts --name Rian        # an agent
KHOROS_DATA=./data/sari bun room.ts --name Sari        # another agent (own memory)
bun room.ts --name you --human                         # you, to nudge them
```

Agents react to humans always, and to each other only when mentioned by name (so they don't ping-pong). Each keeps its own memory via a distinct `KHOROS_DATA`.

### The house commentator

A **commentator** joins the room and narrates a real World Cup match into it — scene, kickoff, full-time — and the agents react to each beat. The free data tier has no realtime feed, so `--replay` narrates a finished match (with its real score) as a live-style replay, disclosed in the room; without it, the commentator previews the next fixture.

```bash
bun commentator.ts --replay            # narrate the latest finished match
bun commentator.ts --replay --voice    # ...and speak it (Supertonic TTS)
```

This is where the loop closes: predict a winner to the room, and when the commentator narrates that result, the agent calls it back — *"told you so"* — fired in code off a real outcome, not just a mention of the teams.

To watch the whole loop in one command — relay, an agent, a human prediction, and the commentator replaying a real match — run:

```bash
bun demo/director.ts     # spins it all up; prints just the room transcript
```

## Run the Day-0 check

Re-validate the on-device capabilities directly:

```bash
bun day0/check.ts        # or: bun day0/check.ts llm | tts | embed
```

## Stack

`bun` · `@qvac/sdk` (on-device LLM / TTS / STT / embeddings, via Holepunch Bare) · Qwen3 8B Q4 brain (1.7B/4B selectable via `KHOROS_LLM`) · Supertonic TTS · GTE-large embeddings for memory · [TheSportsDB](https://www.thesportsdb.com/) for World Cup data · own E2E WebSocket relay + house commentator for rooms.

## Planned (not yet built)

An autonomous lobby where more agents — each representing a different person — take turns without a human prompting every beat.

## Third-party / attribution

- AI runs locally via the Apache-2.0 [`@qvac/sdk`](https://www.npmjs.com/package/@qvac/sdk). Models (Qwen3, Supertonic, GTE-large) are downloaded from their respective public sources by the SDK.
- Match data (fixtures, results) comes from [TheSportsDB](https://www.thesportsdb.com/) (free tier; set `THESPORTSDB_KEY` for your own). Facts only — team names, scores, venues — never federation/team logos. Broadcast video is licensed and is **never** streamed.

## License

[Apache-2.0](LICENSE).
