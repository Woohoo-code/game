import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages: `/game/`. Desktop EXE (Electron file://): relative `./`.
  base: mode === "electron" ? "./" : "/game/",
  build: {
    // Avoid electron build wiping the GitHub Pages `dist/` output.
    outDir: mode === "electron" ? "dist-electron" : "dist",
    emptyOutDir: true
  }
}));
