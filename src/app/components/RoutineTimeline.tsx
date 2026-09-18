import { useEffect, useState } from 'react';
import type { RoutineDayState } from '../../domain/medal';

const ROW_HEIGHT = 58;

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

export function RoutineTimeline({
  items,
  onToggle
}: {
  items: RoutineDayState[];
  onToggle: (routineId: string) => void | Promise<void>;
}) {
  const now = useNow();
  const markerTop = getTimelineMarkerTop(items, now, ROW_HEIGHT);
  const nowLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="routine-timeline" style={{ height: `${items.length * ROW_HEIGHT}px` }}>
      <div className="timeline-axis" />

      {items.map((state, index) => (
        <div
          className="timeline-item"
          key={state.routine.routineId}
          style={{ top: `${index * ROW_HEIGHT}px` }}
        >
          <span className="timeline-dot" />
          <button
            type="button"
            className={`timeline-task ${state.done ? 'done' : ''}`}
            aria-pressed={state.done}
            onClick={() => void onToggle(state.routine.routineId)}
          >
            <strong>{state.routine.name}</strong>
            <time>{state.routine.time}</time>
            <span className="task-check">{state.done ? '✓' : ''}</span>
          </button>
        </div>
      ))}

      {markerTop !== null && (
        <div className="now-marker" style={{ top: `${markerTop}px` }}>
          <span className="now-time">{nowLabel}</span>
          <i className="now-dot" />
          <b className="now-line" />
        </div>
      )}
    </div>
  );
}

function getTimelineMarkerTop(items: RoutineDayState[], now: Date, rowHeight: number) {
  if (items.length === 0) return null;

  const times = items.map((item) => timeToMinutes(item.routine.time));
  const current = now.getHours() * 60 + now.getMinutes();
  const centers = items.map((_, index) => index * rowHeight + rowHeight / 2);

  if (current <= times[0]) return centers[0];
  if (current >= times[times.length - 1]) return centers[centers.length - 1];

  for (let index = 0; index < times.length - 1; index += 1) {
    const start = times[index];
    const end = times[index + 1];
    if (current >= start && current <= end) {
      const range = Math.max(1, end - start);
      const ratio = (current - start) / range;
      return centers[index] + (centers[index + 1] - centers[index]) * ratio;
    }
  }

  return centers[0];
}

function timeToMinutes(value?: string) {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
