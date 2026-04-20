import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ViewportScaler } from "./ViewportScaler";
import "./styles.css";

const BUILD_VERSION_STORAGE_KEY = "msty-build-version";
const BUILD_RELOAD_SENTINEL_KEY = "msty-build-reload-sentinel";

function hideInitialLoadSplash(): void {
  const el = document.getElementById("initial-load-splash");
  if (!el) return;
  el.classList.add("initial-load-splash--out");
  window.setTimeout(() => el.remove(), 420);
}

function enforceFreshBuildVersion(): void {
  if (typeof window === "undefined") return;
  const current = String(import.meta.env.VITE_BUILD_VERSION ?? "").trim();
  if (!current) return;
  try {
    const prev = window.localStorage.getItem(BUILD_VERSION_STORAGE_KEY);
    if (!prev) {
      window.localStorage.setItem(BUILD_VERSION_STORAGE_KEY, current);
      window.sessionStorage.removeItem(BUILD_RELOAD_SENTINEL_KEY);
      return;
    }
    if (prev === current) {
      window.sessionStorage.removeItem(BUILD_RELOAD_SENTINEL_KEY);
      return;
    }
    // Version changed: request one hard reload to drop stale cached module graph.
    if (!window.sessionStorage.getItem(BUILD_RELOAD_SENTINEL_KEY)) {
      window.sessionStorage.setItem(BUILD_RELOAD_SENTINEL_KEY, "1");
      window.localStorage.setItem(BUILD_VERSION_STORAGE_KEY, current);
      window.location.reload();
      return;
    }
    // Reload already attempted this tab; just accept current build marker.
    window.localStorage.setItem(BUILD_VERSION_STORAGE_KEY, current);
    window.sessionStorage.removeItem(BUILD_RELOAD_SENTINEL_KEY);
  } catch {
    // Ignore storage access failures (private mode/security).
  }
}

enforceFreshBuildVersion();

const rootEl = document.getElementById("root")!;
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ViewportScaler>
      <App />
    </ViewportScaler>
  </React.StrictMode>
);

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    hideInitialLoadSplash();
  });
});
