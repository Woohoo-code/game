import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const buildVersion = process.env.VITE_BUILD_VERSION ?? String(Date.now());
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_BUILD_VERSION": JSON.stringify(buildVersion)
    },
    // GitHub Pages: `/game/`. Desktop EXE (Electron file://): relative `./`.
    base: mode === "electron" ? "./" : "/game/",
    build: {
      // Avoid electron build wiping the GitHub Pages `dist/` output.
      outDir: mode === "electron" ? "dist-electron" : "dist",
      emptyOutDir: true
    }
  };
});
