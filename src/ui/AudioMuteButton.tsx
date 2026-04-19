import { useEffect, useState } from "react";
import { isAudioMuted, setAudioMuted, subscribeAudioPrefs, unlockAudio } from "../game/audio";

export function AudioMuteButton() {
  const [muted, setMuted] = useState(() => isAudioMuted());

  useEffect(() => {
    const unsub = subscribeAudioPrefs(() => setMuted(isAudioMuted()));
    return () => unsub();
  }, []);

  const onClick = () => {
    unlockAudio();
    setAudioMuted(!muted);
  };

  const label = muted ? "Unmute sound" : "Mute sound";
  return (
    <button
      type="button"
      className="audio-mute-btn"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
