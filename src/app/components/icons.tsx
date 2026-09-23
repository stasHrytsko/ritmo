/**
 * One vector tick everywhere, instead of the "✓" glyph each platform draws its
 * own way. Drawn as a stroke so it can animate on.
 */
export function Check({ className = '' }: { className?: string }) {
  return (
    <svg className={`icon-check ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 12.5l4 4 8-9" pathLength={1} />
    </svg>
  );
}

export function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg className={`icon-chevron ${className}`.trim()} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

/** A closed ring with a tick: the medal, as a mark for a run of them. */
export function StreakMark() {
  return (
    <svg className="icon-streak" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M5.4 8.2l1.8 1.8 3.4-3.8" />
    </svg>
  );
}

/** Disclosure mark for rows that open something. */
export function ChevronRight() {
  return (
    <svg className="icon-chevron-right" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}
