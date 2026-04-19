/** Client route paths — respect Vite `base` (e.g. `/game/` on GitHub Pages). */
const rawBase = import.meta.env.BASE_URL.replace(/\/$/, "");

export const DOWNLOAD_ROUTE = rawBase ? `${rawBase}/download` : "/download";
