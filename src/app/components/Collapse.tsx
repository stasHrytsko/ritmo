import type { ReactNode } from 'react';

/**
 * Opens and closes by animating its height. The content stays mounted so the
 * transition has something to animate, and `inert` keeps it out of the tab
 * order and away from screen readers while it is closed.
 */
export function Collapse({
  open,
  children,
  id
}: {
  open: boolean;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div className={`collapse${open ? ' open' : ''}`} id={id}>
      <div className="collapse-inner" inert={!open}>
        {children}
      </div>
    </div>
  );
}
