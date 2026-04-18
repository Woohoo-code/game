import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from /game/ (the repo name).
  // Setting base here makes all asset URLs correct in the built output.
  base: "/game/"
});
