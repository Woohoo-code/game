/**
 * Full-screen "resting at the inn" overlay. Rendered from App.tsx whenever
 * {@link GameSnapshot.sleeping} is true — the state layer auto-clears the
 * flag after fast-forwarding the world clock to 07:00 (see
 * {@link GameStore.healAtInn}), so this component only has to present the
 * moment without managing any timers of its own.
 */
export function SleepSplash() {
  return (
    <div
      className="sleep-splash-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sleep-splash-title"
    >
      <div className="sleep-splash-card">
        <div className="sleep-splash-icon" aria-hidden>
          <span className="sleep-splash-z sleep-splash-z--1">Z</span>
          <span className="sleep-splash-z sleep-splash-z--2">Z</span>
          <span className="sleep-splash-z sleep-splash-z--3">Z</span>
        </div>
        <h2 id="sleep-splash-title" className="sleep-splash-title">
          Resting at the inn
        </h2>
        <p className="sleep-splash-sub">Rising at dawn — 07:00.</p>
      </div>
    </div>
  );
}
