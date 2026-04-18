import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ViewportScaler } from "./ViewportScaler";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ViewportScaler>
      <App />
    </ViewportScaler>
  </React.StrictMode>
);
