import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A modal bottom sheet: Escape closes it, Tab stays inside it, and focus
 * returns to whatever opened it.
 */
export function EditorSheet({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Callers usually pass a fresh closure on every render. Holding it in a ref
  // keeps the effects below tied to mount and unmount, so the opener is
  // captured once and focus is restored once.
  const close = useRef(onClose);
  close.current = onClose;

  // Captured during the first render, before focus moves into the sheet.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    // Focus goes to the sheet itself, never to a field: a text field in focus
    // opens the phone's keyboard, and that should wait for a tap on the field.
    if (!sheet.current?.contains(document.activeElement)) {
      sheet.current?.focus({ preventScroll: true });
    }
    return () => {
      if (opener && opener !== document.body && document.contains(opener)) opener.focus();
    };
  }, [opener]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== 'Tab' || !sheet.current) return;

      const focusable = [...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        .filter((node) => node.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !sheet.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return (
    <div className="sheet-backdrop" onClick={() => close.current()}>
      <div
        ref={sheet}
        className="editor-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <strong id={titleId}>{title}</strong>
          <button type="button" aria-label="Закрыть" onClick={() => close.current()}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
