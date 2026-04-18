import type { GameSnapshot } from "./types";

/** Magic + version; bump if bundle format changes. */
export const TRANSFER_MAGIC = "MS1";

/** Exactly ten decimal digits (for your notes; the full clipboard line is what you paste). */
export function generateTransferKey(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const n = (BigInt(buf[0]) + (BigInt(buf[1]) << 32n)) % 10_000_000_000n;
  return n.toString().padStart(10, "0");
}

function utf8ToBase64(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin);
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Single-line portable save: `MS1|<10-digit-key>|<base64(json snapshot)>`
 * Paste the entire line on another device and choose Import transfer.
 */
export function encodeTransferBundle(key: string, snapshot: GameSnapshot): string {
  if (!/^\d{10}$/.test(key)) {
    throw new Error("Transfer key must be exactly 10 digits.");
  }
  return `${TRANSFER_MAGIC}|${key}|${utf8ToBase64(JSON.stringify(snapshot))}`;
}

export function decodeTransferBundle(raw: string): { key: string; snapshot: GameSnapshot } | null {
  const trimmed = raw.trim().replace(/\r\n/g, "\n").replace(/\n/g, "");
  const i0 = trimmed.indexOf("|");
  const i1 = trimmed.indexOf("|", i0 + 1);
  if (i0 < 1 || i1 <= i0 + 1) return null;
  const magic = trimmed.slice(0, i0);
  const key = trimmed.slice(i0 + 1, i1);
  const payload = trimmed.slice(i1 + 1);
  if (magic !== TRANSFER_MAGIC || !/^\d{10}$/.test(key) || !payload) return null;
  try {
    const snapshot = JSON.parse(base64ToUtf8(payload)) as GameSnapshot;
    if (!snapshot || typeof snapshot !== "object" || !snapshot.player || !snapshot.battle || !snapshot.world) {
      return null;
    }
    return { key, snapshot };
  } catch {
    return null;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
