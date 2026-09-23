export type NavIconType = 'today' | 'week' | 'life' | 'notes';

/**
 * Outline at rest, filled when active: the current section reads at a glance,
 * not only by colour.
 */
function NavIcon({ type, active }: { type: NavIconType; active: boolean }) {
  const fill = active ? 'fill' : undefined;

  if (type === 'today') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className={fill} d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" />
      </svg>
    );
  }

  if (type === 'week') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect className={fill} x="4" y="6" width="16" height="14" rx="2.5" />
        <path d="M8 3v5M16 3v5" />
        {!active && <path d="M4 10h16" />}
      </svg>
    );
  }

  if (type === 'life') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className={fill} d="m12 4 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect className={fill} x="5" y="3" width="14" height="18" rx="2.5" />
      <path className={active ? 'cut' : undefined} d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function NavButton({
  label,
  icon,
  active,
  onClick
}: {
  label: string;
  icon: NavIconType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? 'active' : ''}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <NavIcon type={icon} active={active} />
      <span>{label}</span>
    </button>
  );
}
