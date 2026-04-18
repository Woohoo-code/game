import { useEffect, useRef, useState } from "react";
import {
  disconnectLan,
  getLanLastError,
  getLanRoomCode,
  getLanStatusMessage,
  joinLanGuest,
  startLanHost,
  subscribeLanCoop
} from "../coop/lanCoop";
import { useLanCoopRole } from "../coop/useLanCoopRole";

type Props = {
  onClose: () => void;
};

function defaultWsUrl(): string {
  if (typeof window === "undefined") return "ws://127.0.0.1:8765";
  const host = window.location.hostname || "127.0.0.1";
  return `ws://${host}:8765`;
}

export function LanCoopPanel({ onClose }: Props) {
  const role = useLanCoopRole();
  const [signalingUrl, setSignalingUrl] = useState(defaultWsUrl);
  const [joinInput, setJoinInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [, refresh] = useState(0);
  const hostOrJoinInFlight = useRef(false);

  useEffect(() => subscribeLanCoop(() => refresh((n) => n + 1)), []);

  const code = getLanRoomCode();
  const status = getLanStatusMessage();
  const err = getLanLastError();

  const handleHost = async () => {
    if (hostOrJoinInFlight.current) return;
    hostOrJoinInFlight.current = true;
    setBusy(true);
    try {
      await startLanHost(signalingUrl);
    } catch {
      /* error surfaced via getLanLastError */
    } finally {
      setBusy(false);
      hostOrJoinInFlight.current = false;
    }
  };

  const handleJoin = async () => {
    if (hostOrJoinInFlight.current) return;
    hostOrJoinInFlight.current = true;
    setBusy(true);
    try {
      await joinLanGuest(joinInput, signalingUrl);
    } catch {
      /* surfaced via getLanLastError */
    } finally {
      setBusy(false);
      hostOrJoinInFlight.current = false;
    }
  };

  return (
    <div className="lan-coop-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="lan-coop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lan-coop-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lan-coop-head">
          <h2 id="lan-coop-title">LAN co-op</h2>
          <p className="lan-coop-lead">
            One player runs the <strong>signaling server</strong> on the LAN (<code>npm run coop-server</code>), then
            hosts. The other machine opens the same game URL (or the host&apos;s IP) and joins with the code.
          </p>
          <button type="button" className="lan-coop-close" onClick={() => !busy && onClose()} aria-label="Close">
            ×
          </button>
        </header>

        <label className="lan-coop-field">
          <span>Signaling WebSocket URL</span>
          <input
            type="text"
            spellCheck={false}
            autoComplete="off"
            value={signalingUrl}
            onChange={(e) => setSignalingUrl(e.target.value)}
            disabled={busy || role !== "solo"}
          />
        </label>

        {err && <p className="lan-coop-err">{err}</p>}
        {status && <p className="lan-coop-status">{status}</p>}

        {role === "solo" && (
          <div className="lan-coop-actions">
            <button type="button" onClick={() => void handleHost()} disabled={busy}>
              Host game
            </button>
            <div className="lan-coop-join-row">
              <input
                type="text"
                placeholder="Join code"
                maxLength={8}
                spellCheck={false}
                autoComplete="off"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                disabled={busy}
              />
              <button type="button" onClick={() => void handleJoin()} disabled={busy || joinInput.length < 6}>
                Join
              </button>
            </div>
          </div>
        )}

        {role === "host" && code && (
          <div className="lan-coop-host-code">
            <p>Give this code to your partner:</p>
            <p className="lan-coop-code">{code}</p>
          </div>
        )}

        {role !== "solo" && (
          <footer className="lan-coop-foot">
            <button
              type="button"
              className="lan-coop-leave"
              onClick={() => {
                disconnectLan();
                onClose();
              }}
            >
              Leave LAN session
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
