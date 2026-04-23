import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ViewportScaler } from "./ViewportScaler";
import "./styles.css";

    function hideInitialLoadSplash(): void {
  const el = document.getElementById("initial-load-splash");
  if (!el) return;
  el.remove();
}

const rootEl = document.getElementById("root")!;
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ViewportScaler>
      <App />
    </ViewportScaler>
  </React.StrictMode>
);

// Remove unnecessary artificial delay for faster loading
    hideInitialLoadSplash();
