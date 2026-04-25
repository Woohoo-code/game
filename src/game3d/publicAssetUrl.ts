/**
 * Absolute URL for a root `public/` file (e.g. `idle.glb`).
 * Uses Vite `base` so GitHub Pages (`/game/`) and Electron (`./`) resolve correctly.
 */
export function publicAssetUrl(filename: string): string {
  const name = filename.startsWith("/") ? filename.slice(1) : filename;
  return `${import.meta.env.BASE_URL}${encodeURI(name)}`;
}
