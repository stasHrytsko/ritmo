import { useEffect, useRef, type CSSProperties } from 'react';
import { plural } from '../../domain/time';
import { Check } from './icons';

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;
const BURST = Array.from({ length: 10 }, (_, index) => index * 36);

/**
 * The moment a day closes: the ring completes, the tick draws, a small burst.
 * Short on purpose, and gone on its own — it marks the day, it does not
 * interrupt it. Tapping anywhere dismisses it sooner.
 */
export function Celebration({
  routines,
  streak,
  onClose
}: {
  routines: number;
  streak: number;
  onClose: () => void;
}) {
  // The parent re-renders while this is up (the day reloads quietly); holding
  // onClose in a ref keeps the timer from restarting each time.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    navigator.vibrate?.([12, 70, 20]);
    const timer = window.setTimeout(() => close.current(), 3400);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close.current(); };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="celebration" role="status" aria-live="polite" onClick={onClose}>
      <div className="celebration-card">
        <div className="celebration-ring">
          <svg viewBox="0 0 96 96" aria-hidden="true">
            <circle className="track" cx="48" cy="48" r={RING_R} />
            <circle className="fill" cx="48" cy="48" r={RING_R} strokeDasharray={RING_C} strokeDashoffset={RING_C} />
          </svg>
          <span className="celebration-burst" aria-hidden="true">
            {BURST.map((angle) => <i key={angle} style={{ '--angle': `${angle}deg` } as CSSProperties} />)}
          </span>
          <span className="celebration-tick"><Check /></span>
        </div>
        <strong>День закрыт</strong>
        <span>
          {routines > 0
            ? `${plural(routines, ['Выполнена', 'Выполнены', 'Выполнены'])} все ${routines} ${plural(routines, ['рутина', 'рутины', 'рутин'])}`
            : 'На сегодня всё'}
        </span>
        {streak > 0 && (
          <em>Серия: {streak} {plural(streak, ['день', 'дня', 'дней'])}</em>
        )}
      </div>
    </div>
  );
}
