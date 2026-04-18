/** Bright coin glyph for currency — tuned for dark HUD backgrounds. */
export function IconGold({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle cx="12" cy="13.25" r="7.75" fill="#7a5208" opacity="0.65" />
      <circle cx="12" cy="10.75" r="9.35" fill="#f2c41a" stroke="#1a1304" strokeWidth="1.45" />
      <circle cx="12" cy="10.75" r="6.35" fill="#d9a514" opacity="0.92" />
      <circle cx="12" cy="10.75" r="6.35" fill="none" stroke="#5c430a" strokeWidth="0.9" opacity="0.75" />
      <ellipse cx="9.25" cy="8.25" rx="4" ry="2.35" fill="#fff6b8" opacity="0.55" transform="rotate(-28 9.25 8.25)" />
    </svg>
  );
}
