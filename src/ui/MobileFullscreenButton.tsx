import { useCallback, useEffect, useState } from "react";

function fullscreenElement(): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function requestFullscreenRoot(): Promise<void> {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => void;
  };
  if (typeof el.requestFullscreen === "function") {
    return el.requestFullscreen();
  }
  if (typeof el.webkitRequestFullscreen === "function") {
    el.webkitRequestFullscreen();
    return Promise.resolve();
  }
  return Promise.reject(new Error("Fullscreen API not available"));
}

function exitFullscreenRoot(): Promise<void> {
  const d = document as Document & { webkitExitFullscreen?: () => void };
  if (typeof document.exitFullscreen === "function") {
    return document.exitFullscreen();
  }
  if (typeof d.webkitExitFullscreen === "function") {
    d.webkitExitFullscreen();
    return Promise.resolve();
  }
  return Promise.reject(new Error("Exit fullscreen not available"));
}

function canToggleFullscreen(): boolean {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  return typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
}

/**
 * Browser fullscreen toggle (Android Chrome / desktop). iOS Safari has limited
 * support; the button is hidden when the API is missing.
 */
export function MobileFullscreenButton({ className }: { className?: string }) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && canToggleFullscreen());
  }, []);

  useEffect(() => {
    if (!supported) return;
    const sync = () => setActive(!!fullscreenElement());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync as EventListener);
    };
  }, [supported]);

  const onClick = useCallback(() => {
    if (!supported) return;
    const on = !!fullscreenElement();
    void (on ? exitFullscreenRoot() : requestFullscreenRoot()).catch(() => {});
  }, [supported]);

  if (!supported) return null;

  return (
    <button type="button" className={["mobile-fullscreen-btn", className].filter(Boolean).join(" ")} onClick={onClick}>
      {active ? "Exit fullscreen" : "Fullscreen"}
    </button>
  );
}
