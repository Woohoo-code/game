/**
 * Minimal LAN WebRTC signaling: rooms keyed by a 6-character join code.
 * Run: `npm run coop-server` (default port 8765, override with COOP_PORT).
 */
import { WebSocketServer } from "ws";

const PORT = Number(process.env.COOP_PORT || 8765);

/** @typedef {{ host: import('ws').WebSocket; guest: import('ws').WebSocket | null }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map();

function closeRoom(code) {
  rooms.delete(code);
}

/**
 * @param {import('ws').WebSocket} socket
 * @param {string | null} code
 */
function detachFromRoom(socket, code) {
  if (!code) return;
  const r = rooms.get(code);
  if (!r) return;
  if (r.host === socket) {
    try {
      r.guest?.close();
    } catch {
      /* ignore */
    }
    closeRoom(code);
    return;
  }
  if (r.guest === socket) {
    r.guest = null;
    try {
      r.host.send(JSON.stringify({ type: "peer-left" }));
    } catch {
      /* ignore */
    }
  }
}

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("listening", () => {
  console.log(`[coop-signaling] listening on ws://0.0.0.0:${PORT}`);
});

wss.on("connection", (socket) => {
  /** @type {string | null} */
  let roomCode = null;

  socket.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }
    if (msg.type === "hello") {
      const code = String(msg.code || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
      if (!code) {
        socket.send(JSON.stringify({ type: "error", message: "Invalid join code." }));
        return;
      }
      if (msg.role === "host") {
        if (rooms.has(code)) {
          socket.send(JSON.stringify({ type: "error", message: "Code already in use." }));
          return;
        }
        roomCode = code;
        rooms.set(code, { host: socket, guest: null });
        socket.send(JSON.stringify({ type: "hello-ok", code }));
        return;
      }
      if (msg.role === "guest") {
        const r = rooms.get(code);
        if (!r) {
          socket.send(JSON.stringify({ type: "error", message: "No game for that code (host may be offline)." }));
          return;
        }
        if (r.guest) {
          socket.send(JSON.stringify({ type: "error", message: "That game already has a guest." }));
          return;
        }
        roomCode = code;
        r.guest = socket;
        // Guest first so the guest client can create its RTCPeerConnection before the host sends the offer.
        socket.send(JSON.stringify({ type: "ready" }));
        r.host.send(JSON.stringify({ type: "ready" }));
        return;
      }
      return;
    }

    if (msg.type === "signal" && roomCode) {
      const r = rooms.get(roomCode);
      if (!r) return;
      const peer = socket === r.host ? r.guest : r.host;
      if (!peer || peer.readyState !== 1) return;
      peer.send(
        JSON.stringify({
          type: "signal",
          sdp: msg.sdp ?? undefined,
          candidate: msg.candidate ?? undefined
        })
      );
    }
  });

  socket.on("close", () => detachFromRoom(socket, roomCode));
  socket.on("error", () => detachFromRoom(socket, roomCode));
});
