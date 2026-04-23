import { useBackgroundMusic } from "../game/music";

/**
 * Compact button that toggles the background music on/off. Rendered alongside
 * the fullscreen button in the app chrome.
 */
export function MusicToggleButton({ className }: { className?: string }) {
  const { enabled, toggle } = useBackgroundMusic();

  return (
    <button
      type="button"
      className={["mobile-fullscreen-btn", className].filter(Boolean).join(" ")}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Turn music off" : "Turn music on"}
      title={enabled ? "Music: on" : "Music: off"}
    >
      {enabled ? "♪ Music on" : "♪ Music off"}
    </button>
  );
}
