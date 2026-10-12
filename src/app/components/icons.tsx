import type { Tier } from '../../domain/award';
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

export function EditMark() {
  return (
    <svg className="icon-line" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
    </svg>
  );
}

export function FolderMark() {
  return (
    <svg className="icon-line" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 7.5v10a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 19 8h-7L10 5.5H5A1.5 1.5 0 0 0 3.5 7z" />
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

const MEDAL_STOPS: Record<Tier, [string, string]> = {
  gold: ['#f6cf5a', '#c98a10'],
  silver: ['#eef2f6', '#8798ac'],
  bronze: ['#ecae7d', '#a5592a']
};

/** Gold, silver or bronze: a metallic disc with a tick, so silver never reads as "off". */
export function MedalMark({ tier, className = '' }: { tier: Tier; className?: string }) {
  const id = `medal-${tier}`;
  const [light, dark] = MEDAL_STOPS[tier];
  return (
    <svg className={`icon-medal tier-${tier} ${className}`.trim()} viewBox="0 0 16 16" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <circle cx="8" cy="8" r="7" fill={`url(#${id})`} />
      <path d="M5 8.3l2 2 4-4.4" />
    </svg>
  );
}
