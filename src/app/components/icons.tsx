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

/** What a note entry became: a goal, a task in a goal, or a routine. */
export function GoalMark() {
  return (
    <svg className="icon-line" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 21V4M5 4h12l-2.5 4.5L17 13H5" />
    </svg>
  );
}

export function TaskMark() {
  return (
    <svg className="icon-line" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.5 12.2l2.4 2.4 4.6-5" />
    </svg>
  );
}

export function RoutineMark() {
  return (
    <svg className="icon-line" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 3l3 3-3 3M4 12v-2a4 4 0 0 1 4-4h12M7 21l-3-3 3-3M20 12v2a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

export function TrashMark() {
  return (
    <svg className="icon-line" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" />
    </svg>
  );
}
