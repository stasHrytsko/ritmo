import { useCallback, useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How long the tick draws before the row starts to fold away. */
export const TICK_MS = 340;
/** How long the row takes to fold before the change is committed. */
export const FOLD_MS = 260;

/**
 * Lets a tick land visibly before the data changes: the check draws, the row
 * folds away, then the toggle runs. Without this the row simply vanishes the
 * instant it is tapped. Unticking is immediate — there is nothing to celebrate.
 */
export function useTick(onToggle: (id: string) => void | Promise<void>, fold = true) {
  const [ticking, setTicking] = useState<ReadonlySet<string>>(new Set());
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const tick = useCallback((id: string) => {
    // A light tap of confirmation where the device supports it (Android).
    navigator.vibrate?.(10);

    if (prefersReducedMotion()) {
      void onToggle(id);
      return;
    }

    setTicking((current) => new Set(current).add(id));
    const done = () => {
      void onToggle(id);
      setTicking((current) => { const next = new Set(current); next.delete(id); return next; });
      setLeaving((current) => { const next = new Set(current); next.delete(id); return next; });
    };

    if (!fold) {
      timers.current.push(window.setTimeout(done, TICK_MS + 80));
      return;
    }
    timers.current.push(window.setTimeout(() => setLeaving((current) => new Set(current).add(id)), TICK_MS));
    timers.current.push(window.setTimeout(done, TICK_MS + FOLD_MS));
  }, [onToggle, fold]);

  return { ticking, leaving, tick };
}
