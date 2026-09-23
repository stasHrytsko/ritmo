import { Fragment, useEffect, useState } from 'react';
import type { RoutineDayState } from '../../domain/medal';

/**
 * Ticks on its own so the moving "now" marker re-renders this component
 * instead of the whole app.
 */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * The day's timed routines in order. Done ones fold into a single line so the
 * list starts at what is still ahead; missed ones stay in view on purpose.
 */
export function RoutineTimeline({
  items,
  live,
  disabled = false,
  onToggle
}: {
  items: RoutineDayState[];
  /** Only the current day has a "now" to mark. */
  live: boolean;
  disabled?: boolean;
  onToggle: (routineId: string) => void | Promise<void>;
}) {
  const now = useNow();
  const [showDone, setShowDone] = useState(false);

  const doneCount = items.filter((item) => item.done).length;
  const visible = showDone ? items : items.filter((item) => !item.done);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowLabel = now.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  // The marker sits before the first visible routine that is still ahead.
  const markerIndex = live
    ? (() => {
        const index = visible.findIndex((item) => toMinutes(item.routine.time) > nowMinutes);
        return index === -1 ? visible.length : index;
      })()
    : -1;
  const nextId = visible.find((item, index) => !item.done && (!live || index >= markerIndex))
    ?.routine.routineId;

  return (
    <div className="routine-timeline">
      {doneCount > 0 && (
        <button
          type="button"
          className="timeline-done-toggle"
          aria-expanded={showDone}
          onClick={() => setShowDone((current) => !current)}
        >
          <span className="task-check">✓</span>
          <span>Выполнено: {doneCount}</span>
          <small>{showDone ? 'Скрыть' : 'Показать'}</small>
        </button>
      )}

      {visible.length > 0 && (
        <ol className="timeline-list">
          {visible.map((state, index) => (
            <Fragment key={state.routine.routineId}>
              {index === markerIndex && <NowMarker label={nowLabel} />}
              <li
                className={`timeline-item ${state.done ? 'done' : ''}`}
                data-next={state.routine.routineId === nextId ? 'true' : undefined}
              >
                <time>{state.routine.time}</time>
                <span className="timeline-dot" />
                <button
                  type="button"
                  className={`timeline-task ${state.done ? 'done' : ''}`}
                  aria-pressed={state.done}
                  disabled={disabled}
                  onClick={() => void onToggle(state.routine.routineId)}
                >
                  <strong>{state.routine.name}</strong>
                  <span className="task-check">{state.done ? '✓' : ''}</span>
                </button>
              </li>
            </Fragment>
          ))}
          {markerIndex === visible.length && <NowMarker label={nowLabel} />}
        </ol>
      )}
    </div>
  );
}

function NowMarker({ label }: { label: string }) {
  return (
    <li className="now-marker" aria-label={`Сейчас ${label}`}>
      <time>{label}</time>
      <i className="now-dot" />
      <b className="now-line" />
    </li>
  );
}

function toMinutes(value?: string) {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
