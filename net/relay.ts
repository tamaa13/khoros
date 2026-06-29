/**
 * Khoros relay — a tiny WebSocket message relay with rooms. It is deliberately
 * BLIND: message bodies are end-to-end encrypted by the clients (see client.ts),
 * so the relay only ever sees a room name and ciphertext. This is the "attn-v2"
 * transport — plumbing, not the QVAC part. Built on Bun's native pub/sub.
 *
 *   bun net/relay.ts            # listens on ws://localhost:8787
 */
const PORT = Number(process.env.KHOROS_RELAY_PORT ?? 8787);

interface SocketData {
  rooms: Set<string>;
}

const server = Bun.serve<SocketData, undefined>({
  port: PORT,
  fetch(req, server) {
    if (server.upgrade(req, { data: { rooms: new Set<string>() } })) return;
    return new Response("Khoros relay — connect over WebSocket.\n");
  },
  websocket: {
    message(ws, raw) {
      let m: any;
      try {
        m = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      } catch {
        return;
      }
      if (m.t === "join" && typeof m.room === "string") {
        ws.subscribe(m.room);
        ws.data.rooms.add(m.room);
        ws.send(JSON.stringify({ t: "joined", room: m.room }));
      } else if (m.t === "msg" && typeof m.room === "string" && typeof m.body === "string") {
        // Blind: `body` is E2E ciphertext. Forward to other room members only;
        // Bun's publish does not echo back to the sender.
        ws.publish(m.room, JSON.stringify({ t: "msg", room: m.room, body: m.body }));
      } else if (m.t === "leave" && typeof m.room === "string") {
        ws.unsubscribe(m.room);
        ws.data.rooms.delete(m.room);
      }
    },
    close(ws) {
      for (const room of ws.data.rooms) ws.unsubscribe(room);
      ws.data.rooms.clear();
    },
  },
});

console.log(`Khoros relay listening on ws://localhost:${server.port}`);
