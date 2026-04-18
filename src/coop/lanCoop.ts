import type { MoveDirection } from "../game/inputController";
import { inputController } from "../game/inputController";
import { gameStore } from "../game/state";
import type { GameSnapshot } from "../game/types";

export type LanRole = "solo" | "host" | "guest";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_DC_CHUNK = 14_000;

let role: LanRole = "solo";
let roomCode: string | null = null;
let statusMessage = "";
let lastError: string | null = null;

/** Bumped in {@link disconnectLan} so stale WebSocket handlers cannot tear down a newer session. */
let coopEpoch = 0;

let ws: WebSocket | null = null;
let pc: RTCPeerConnection | null = null;
let dc: RTCDataChannel | null = null;
let snapTimer: number | null = null;
/** Keeps the signaling socket from going idle (some proxies drop WS after ~2s with no frames). */
let signalingKeepAlive: number | null = null;

function clearSignalingKeepAlive(): void {
  if (signalingKeepAlive !== null) {
    window.clearInterval(signalingKeepAlive);
    signalingKeepAlive = null;
  }
}

const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function subscribeLanCoop(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLanRole(): LanRole {
  return role;
}

export function isLanHost(): boolean {
  return role === "host";
}

export function isLanGuest(): boolean {
  return role === "guest";
}

export function getLanRoomCode(): string | null {
  return roomCode;
}

export function getLanStatusMessage(): string {
  return statusMessage;
}

export function getLanLastError(): string | null {
  return lastError;
}

function generateCode(): string {
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    out.push(CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]!);
  }
  return out.join("");
}

function clearSnapTimer(): void {
  if (snapTimer !== null) {
    window.clearInterval(snapTimer);
    snapTimer = null;
  }
}

function closeRtc(): void {
  clearSnapTimer();
  try {
    dc?.close();
  } catch {
    /* ignore */
  }
  try {
    pc?.close();
  } catch {
    /* ignore */
  }
  dc = null;
  pc = null;
}

export function disconnectLan(): void {
  coopEpoch++;
  clearSnapTimer();
  clearSignalingKeepAlive();
  lastError = null;
  statusMessage = "";
  roomCode = null;
  role = "solo";
  inputController.clear();
  closeRtc();
  try {
    ws?.close();
  } catch {
    /* ignore */
  }
  ws = null;
  notify();
}

let snapChunkBuf: { id: number; n: number; parts: (string | undefined)[] } | null = null;

function applyGuestSnapJson(json: string): void {
  const parsed = JSON.parse(json) as GameSnapshot;
  gameStore.applyLanGuestSnapshot(parsed);
}

function onDcMessage(ev: MessageEvent<string>): void {
  if (role !== "host") {
    const raw = ev.data;
    if (!raw) return;
    try {
      const msg = JSON.parse(raw) as
        | { t: "snap"; body: string }
        | { t: "snapc"; id: number; i: number; n: number; d: string }
        | { t: "in"; d: MoveDirection; v: boolean };
      if (msg.t === "snap" && typeof msg.body === "string") {
        applyGuestSnapJson(msg.body);
        return;
      }
      if (msg.t === "snapc" && typeof msg.id === "number" && typeof msg.i === "number" && typeof msg.n === "number") {
        if (!snapChunkBuf || snapChunkBuf.id !== msg.id || snapChunkBuf.n !== msg.n) {
          snapChunkBuf = { id: msg.id, n: msg.n, parts: new Array(msg.n) };
        }
        snapChunkBuf.parts[msg.i] = msg.d;
        if (snapChunkBuf.parts.every((p) => typeof p === "string")) {
          applyGuestSnapJson(snapChunkBuf.parts.join(""));
          snapChunkBuf = null;
        }
        return;
      }
    } catch {
      /* ignore malformed */
    }
    return;
  }

  // Host: guest input relay
  try {
    const msg = JSON.parse(ev.data) as { t: "in"; d: MoveDirection; v: boolean };
    if (msg.t === "in" && (msg.d === "up" || msg.d === "down" || msg.d === "left" || msg.d === "right")) {
      inputController.setPressed(msg.d, Boolean(msg.v));
    }
  } catch {
    /* ignore */
  }
}

function sendSnapPayload(channel: RTCDataChannel, json: string): void {
  if (json.length <= MAX_DC_CHUNK) {
    channel.send(JSON.stringify({ t: "snap", body: json }));
    return;
  }
  const id = Date.now() + Math.floor(Math.random() * 1000);
  const n = Math.ceil(json.length / MAX_DC_CHUNK);
  for (let i = 0; i < n; i++) {
    const slice = json.slice(i * MAX_DC_CHUNK, (i + 1) * MAX_DC_CHUNK);
    channel.send(JSON.stringify({ t: "snapc", id, i, n, d: slice }));
  }
}

function startHostSnapLoop(channel: RTCDataChannel): void {
  clearSnapTimer();
  snapTimer = window.setInterval(() => {
    if (role !== "host" || channel.readyState !== "open") return;
    try {
      const json = JSON.stringify(gameStore.getSnapshot());
      sendSnapPayload(channel, json);
    } catch {
      /* ignore stringify errors */
    }
  }, 220);
}

export function sendGuestMove(direction: MoveDirection, pressed: boolean): void {
  if (role !== "guest" || !dc || dc.readyState !== "open") return;
  try {
    dc.send(JSON.stringify({ t: "in", d: direction, v: pressed }));
  } catch {
    /* ignore */
  }
}

const SIGNALING_OPEN_MS = 12_000;

/** True when the page is HTTPS and the given URL is plain ws:// (browser mixed-content block). */
export function isMixedContentWsBlocked(url: string): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "https:" && /^ws:\/\//i.test(url.trim());
}

/**
 * Default signaling URL for the LAN panel and connect().
 * - HTTPS (e.g. GitHub Pages): cannot use ws:// from the page — still default to loopback for typing override.
 * - file:// (desktop build): loopback.
 * - http://localhost: loopback (signaling runs on same machine as browser).
 * - http://LAN IP: same host so two devices that opened the game from the host PC URL hit the right machine.
 */
export function defaultSignalingUrlForBrowser(): string {
  if (typeof window === "undefined") return "ws://127.0.0.1:8765";
  const { protocol, hostname } = window.location;
  if (protocol === "https:" || protocol === "file:") {
    return "ws://127.0.0.1:8765";
  }
  const h = (hostname || "").trim();
  if (h === "" || h === "localhost" || h === "[::1]") {
    return "ws://127.0.0.1:8765";
  }
  return `ws://${h}:8765`;
}

function defaultSignalingUrl(): string {
  return defaultSignalingUrlForBrowser();
}

function mixedContentBlockMessage(): string {
  return "This game is on HTTPS, so the browser blocks ws:// signaling. Open the game over HTTP on your LAN (run Vite with --host and use http://YOUR-LAN-IP:5173), or host wss:// signaling.";
}

/**
 * Host: open signaling, register room with join code, then WebRTC offer once guest connects.
 */
export async function startLanHost(signalingUrl?: string): Promise<string> {
  disconnectLan();
  const myEpoch = coopEpoch;
  lastError = null;
  const url = signalingUrl?.trim() || defaultSignalingUrl();
  if (isMixedContentWsBlocked(url)) {
    lastError = mixedContentBlockMessage();
    notify();
    throw new Error(lastError);
  }
  const code = generateCode();
  roomCode = code;
  role = "host";
  statusMessage = "Waiting for guest on LAN…";
  notify();

  return await new Promise<string>((resolve, reject) => {
    let settled = false;
    let openTimer: number | null = null;
    const clearOpenTimer = () => {
      if (openTimer !== null) {
        window.clearTimeout(openTimer);
        openTimer = null;
      }
    };

    const socket = new WebSocket(url);
    ws = socket;

    const stale = () => myEpoch !== coopEpoch;

    const fail = (msg: string) => {
      clearOpenTimer();
      if (stale() || settled) return;
      settled = true;
      lastError = msg;
      statusMessage = "";
      disconnectLan();
      reject(new Error(msg));
    };

    openTimer = window.setTimeout(() => {
      if (stale() || settled) return;
      if (socket.readyState !== WebSocket.OPEN) {
        fail(
          "Signaling server did not answer (wrong WebSocket URL, port 8765 blocked by firewall, or run `npm run coop-server` on the host PC)."
        );
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    }, SIGNALING_OPEN_MS);

    socket.onerror = () => {
      if (stale()) return;
      fail("Could not reach signaling server (is it running?).");
    };

    socket.onclose = () => {
      clearOpenTimer();
      clearSignalingKeepAlive();
      if (stale()) return;
      // Before hello-ok: treat as fatal. After room is registered, signaling may drop (proxy idle
      // timeout, etc.) while WebRTC keeps working — do not un-host the game.
      if (!settled && role === "host") {
        fail("Signaling connection closed.");
        return;
      }
      if (settled && ws === socket) {
        ws = null;
        notify();
      }
    };

    socket.onmessage = async (ev) => {
      if (stale()) return;
      let msg: { type: string; message?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.type === "error") {
        fail(msg.message || "Signaling error");
        return;
      }
      if (msg.type === "hello-ok") {
        if (!settled) {
          settled = true;
          resolve(code);
        }
        return;
      }
      if (msg.type === "peer-left") {
        statusMessage = "Guest disconnected.";
        notify();
        closeRtc();
        return;
      }
      if (msg.type === "ready") {
        statusMessage = "Linking peer…";
        notify();
        await startRtcHost(socket);
        return;
      }
      if (msg.type === "signal") {
        await hostHandleSignal(msg);
      }
    };

    socket.onopen = () => {
      clearOpenTimer();
      if (stale()) return;
      socket.send(JSON.stringify({ type: "hello", role: "host", code }));
      clearSignalingKeepAlive();
      signalingKeepAlive = window.setInterval(() => {
        if (stale()) return;
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: "noop" }));
          } catch {
            /* ignore */
          }
        }
      }, 800);
    };
  });
}

async function startRtcHost(socket: WebSocket): Promise<void> {
  if (pc) return;
  const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc = conn;

  const channel = conn.createDataChannel("game", { ordered: true });
  dc = channel;
  channel.onmessage = onDcMessage;
  channel.onopen = () => {
    statusMessage = "Guest connected — shared world.";
    notify();
    startHostSnapLoop(channel);
  };
  channel.onclose = () => {
    statusMessage = "Data channel closed.";
    notify();
  };

  conn.onicecandidate = (e) => {
    if (e.candidate && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "signal", candidate: e.candidate.toJSON() }));
    }
  };

  conn.onconnectionstatechange = () => {
    if (conn.connectionState === "failed" || conn.connectionState === "disconnected") {
      lastError = `WebRTC ${conn.connectionState}`;
      notify();
    }
  };

  const offer = await conn.createOffer();
  await conn.setLocalDescription(offer);
  if (socket.readyState === WebSocket.OPEN && conn.localDescription) {
    socket.send(JSON.stringify({ type: "signal", sdp: conn.localDescription.toJSON() }));
  }
}

async function hostHandleSignal(msg: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }): Promise<void> {
  const conn = pc;
  if (!conn) return;
  try {
    if (msg.sdp) {
      if (msg.sdp.type === "answer") {
        await conn.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      }
      return;
    }
    if (msg.candidate) {
      await conn.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Guest: join an existing room by code.
 */
export async function joinLanGuest(joinCode: string, signalingUrl?: string): Promise<void> {
  disconnectLan();
  const myEpoch = coopEpoch;
  lastError = null;
  const url = signalingUrl?.trim() || defaultSignalingUrl();
  if (isMixedContentWsBlocked(url)) {
    lastError = mixedContentBlockMessage();
    notify();
    throw new Error(lastError);
  }
  const code = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (code.length !== 6) {
    throw new Error("Enter the 6-character join code from the host.");
  }
  roomCode = code;
  role = "guest";
  statusMessage = "Connecting…";
  notify();

  return await new Promise<void>((resolve, reject) => {
    let settled = false;
    let openTimer: number | null = null;
    const clearOpenTimer = () => {
      if (openTimer !== null) {
        window.clearTimeout(openTimer);
        openTimer = null;
      }
    };

    const socket = new WebSocket(url);
    ws = socket;

    const stale = () => myEpoch !== coopEpoch;

    const fail = (err: Error) => {
      clearOpenTimer();
      if (stale() || settled) return;
      settled = true;
      lastError = err.message;
      disconnectLan();
      reject(err);
    };

    openTimer = window.setTimeout(() => {
      if (stale() || settled) return;
      if (socket.readyState !== WebSocket.OPEN) {
        fail(
          new Error(
            "Signaling server did not answer (wrong WebSocket URL, port 8765 blocked, or coop-server not running on the host)."
          )
        );
        try {
          socket.close();
        } catch {
          /* ignore */
        }
      }
    }, SIGNALING_OPEN_MS);

    socket.onerror = () => {
      if (stale()) return;
      fail(new Error("Could not reach signaling server (is it running?)."));
    };

    socket.onclose = () => {
      clearOpenTimer();
      clearSignalingKeepAlive();
      if (stale()) return;
      if (!settled) {
        fail(new Error("Signaling connection closed."));
        return;
      }
      if (ws === socket) {
        ws = null;
        notify();
      }
    };

    socket.onmessage = async (ev) => {
      if (stale()) return;
      let msg: { type: string; message?: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
      try {
        msg = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (msg.type === "error") {
        fail(new Error(msg.message || "Signaling error"));
        return;
      }
      if (msg.type === "ready") {
        await startRtcGuest(socket, () => {
          if (stale() || settled) return;
          settled = true;
          resolve();
        });
        return;
      }
      if (msg.type === "signal") {
        await guestHandleSignal(msg);
      }
    };

    socket.onopen = () => {
      clearOpenTimer();
      if (stale()) return;
      socket.send(JSON.stringify({ type: "hello", role: "guest", code }));
      clearSignalingKeepAlive();
      signalingKeepAlive = window.setInterval(() => {
        if (stale()) return;
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: "noop" }));
          } catch {
            /* ignore */
          }
        }
      }, 800);
    };
  });
}

async function startRtcGuest(socket: WebSocket, onLinked: () => void): Promise<void> {
  if (pc) return;
  const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc = conn;

  conn.ondatachannel = (ev) => {
    const ch = ev.channel;
    dc = ch;
    ch.onmessage = onDcMessage;
    ch.onopen = () => {
      statusMessage = "Connected — following host.";
      onLinked();
      notify();
    };
    ch.onclose = () => {
      statusMessage = "Disconnected from host.";
      notify();
    };
  };

  conn.onicecandidate = (e) => {
    if (e.candidate && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "signal", candidate: e.candidate.toJSON() }));
    }
  };

  conn.onconnectionstatechange = () => {
    if (conn.connectionState === "failed") {
      lastError = "WebRTC connection failed.";
      notify();
    }
  };
}

async function guestHandleSignal(msg: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }): Promise<void> {
  const conn = pc;
  if (!conn) return;
  try {
    if (msg.sdp) {
      if (msg.sdp.type === "offer") {
        await conn.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await conn.createAnswer();
        await conn.setLocalDescription(answer);
        const s = ws;
        if (s && s.readyState === WebSocket.OPEN && conn.localDescription) {
          s.send(JSON.stringify({ type: "signal", sdp: conn.localDescription.toJSON() }));
        }
      }
      return;
    }
    if (msg.candidate) {
      await conn.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }
  } catch {
    /* ignore */
  }
}
