/**
 * Khoros relay — Node port of net/relay.ts (no Bun). A tiny, BLIND WebSocket
 * relay with rooms: message bodies are E2E-encrypted by the clients, so the relay
 * only ever sees a room name + ciphertext. Same wire protocol as the Bun relay,
 * so RoomClient (net/client.ts) talks to it unchanged.
 *
 *   npm install ws && node relay.mjs        # listens on ws://0.0.0.0:8787
 */
import { WebSocketServer } from "ws";

const PORT = Number(process.env.KHOROS_RELAY_PORT ?? 8787);
const rooms = new Map(); // room -> Set<ws>

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("connection", (ws) => {
  ws._rooms = new Set();
  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (m.t === "join" && typeof m.room === "string") {
      if (!rooms.has(m.room)) rooms.set(m.room, new Set());
      rooms.get(m.room).add(ws);
      ws._rooms.add(m.room);
      ws.send(JSON.stringify({ t: "joined", room: m.room }));
    } else if (m.t === "msg" && typeof m.room === "string" && typeof m.body === "string") {
      const set = rooms.get(m.room);
      if (!set) return;
      const out = JSON.stringify({ t: "msg", room: m.room, body: m.body });
      for (const peer of set) {
        if (peer !== ws && peer.readyState === 1) peer.send(out);
      }
    } else if (m.t === "leave" && typeof m.room === "string") {
      rooms.get(m.room)?.delete(ws);
      ws._rooms.delete(m.room);
    }
  });
  ws.on("close", () => {
    for (const r of ws._rooms) {
      const set = rooms.get(r);
      if (set) {
        set.delete(ws);
        if (set.size === 0) rooms.delete(r);
      }
    }
  });
});

console.log(`Khoros relay (node) listening on ws://0.0.0.0:${PORT}`);
