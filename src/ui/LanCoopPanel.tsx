import { useEffect, useRef, useState } from "react";
import {
  defaultSignalingUrlForBrowser,
  disconnectLan,
  getLanLastError,
  getLanRoomCode,
  getLanStatusMessage,
  isMixedContentWsBlocked,
  joinLanGuest,
  startLanHost,
  subscribeLanCoop
} from "../coop/lanCoop";
import { useLanCoopRole } from "../coop/useLanCoopRole";

type Props = {
  onClose: () => void;
};

export function LanCoopPanel({ onClose }: Props) {
  const role = useLanCoopRole();
  const [signalingUrl, setSignalingUrl] = useState(defaultSignalingUrlForBrowser);
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
            Host runs <code>npm run coop-server</code> (port 8765, allow it in Windows Firewall). Both browsers must load
            the game over <strong>http://</strong> (e.g. <code>npm run dev -- --host 0.0.0.0</code> then open{" "}
            <code>http://&lt;host-LAN-IP&gt;:5173</code>) — <strong>https:// GitHub Pages cannot open ws://</strong>.
            Guest: set the signaling URL to <code>ws://&lt;host-LAN-IP&gt;:8765</code> (not localhost unless the server
            is on your own PC).
          </p>
          {isMixedContentWsBlocked(signalingUrl) && (
            <p className="lan-coop-warn">
              This page is HTTPS, so <code>ws://</code> signaling is blocked. Use a local HTTP dev URL on your LAN, or
              ship <code>wss://</code> signaling — the hosted site cannot reach your PC&apos;s coop server otherwise.
            </p>
          )}
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
