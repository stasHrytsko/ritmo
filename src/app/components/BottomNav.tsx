export type NavIconType = 'today' | 'week' | 'life' | 'notes';

function NavIcon({ type }: { type: NavIconType }) {
  if (type === 'today') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" />
      </svg>
    );
  }

  if (type === 'week') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="14" rx="2" />
        <path d="M8 3v5M16 3v5M4 10h16" />
      </svg>
    );
  }

  if (type === 'life') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 4 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
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
      <NavIcon type={icon} />
      <span>{label}</span>
    </button>
  );
}
