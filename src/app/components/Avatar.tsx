import type { AvatarKind } from '../../infrastructure/cloud';

/** Neutral silhouettes: a plain head-and-shoulders, one with longer hair. */
export function Avatar({ kind, size = 40 }: { kind: AvatarKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="avatar">
      <circle cx="20" cy="20" r="20" className="avatar-bg" />
      {kind === 'female' && (
        <path d="M11 22c-1-9 3-14 9-14s10 5 9 14c0 4-1 7-2 8H13c-1-1-2-4-2-8z" className="avatar-fg" />
      )}
      <circle cx="20" cy="16" r="6" className="avatar-skin" />
      <path d="M7 36c1-7 6-10 13-10s12 3 13 10a20 20 0 0 1-26 0z" className="avatar-fg" />
    </svg>
  );
}
