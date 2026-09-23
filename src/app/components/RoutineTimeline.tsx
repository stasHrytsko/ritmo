import { Fragment, useEffect, useState } from 'react';
import type { RoutineDayState } from '../../domain/medal';
import { routineStatus, type RoutineStatus } from '../../domain/status';
import type { ISODate } from '../../domain/types';
import { minutesIntoDay, routineMinutes } from '../../domain/time';
import { Check, Chevron } from './icons';
import { Collapse } from './Collapse';
import { useTick } from './useTick';

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

type RowStatus = RoutineStatus | 'next';

/** "43 мин", "1 ч 5 мин", "2 ч". */
function formatSpan(minutes: number) {
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

/**
 * The day's timed routines in order. Done ones fold into a single line so the
 * list starts at what is still ahead. What is left reads in three ways:
 * missed (quiet, still tickable), due right now (the one accent), and next
 * (lifted). Everything further ahead stays plain.
 */
export function RoutineTimeline({
  items,
  dayKey,
  todayKey,
  boundaryHour,
  disabled = false,
  onToggle
}: {
  items: RoutineDayState[];
  dayKey: ISODate;
  todayKey: ISODate;
  boundaryHour: number;
  disabled?: boolean;
  onToggle: (routineId: string) => void | Promise<void>;
}) {
  const now = useNow();
  const [showDone, setShowDone] = useState(false);
  const { ticking, leaving, tick } = useTick(onToggle);

  const live = dayKey === todayKey;
  const nowMinutes = minutesIntoDay(now, boundaryHour);
  const nowLabel = now.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

  const done = items.filter((item) => item.done);
  const open = items.filter((item) => !item.done);

  const statuses: RowStatus[] = open.map((item) =>
    routineStatus({
      done: false,
      time: item.routine.time,
      dayKey,
      todayKey,
      nowMinutes,
      boundaryHour
    })
  );
  if (live) {
    const firstAhead = statuses.indexOf('ahead');
    if (firstAhead !== -1) statuses[firstAhead] = 'next';
  }

  const minutesOf = (item: RoutineDayState) => routineMinutes(item.routine.time ?? '00:00', boundaryHour);
  const markerIndex = live
    ? (() => {
        const index = open.findIndex((item) => minutesOf(item) > nowMinutes);
        return index === -1 ? open.length : index;
      })()
    : -1;

  const labelFor = (status: RowStatus, item: RoutineDayState) => {
    if (disabled) return undefined;
    // The dashed row already says it can still be ticked.
    if (status === 'missed') return live ? 'пропущено' : 'не отмечено';
    if (status === 'due') {
      const late = nowMinutes - minutesOf(item);
      return late > 0 ? `сейчас · ${formatSpan(late)} назад` : 'сейчас';
    }
    if (status === 'next') return `следующее · через ${formatSpan(minutesOf(item) - nowMinutes)}`;
    return undefined;
  };

  return (
    <div className="routine-timeline">
      {done.length > 0 && (
        <>
          <button
            type="button"
            className="done-pill"
            aria-expanded={showDone}
            onClick={() => setShowDone((current) => !current)}
          >
            <span className="done-pill-mark"><Check /></span>
            <span>Выполнено · <b key={done.length} className="done-pill-count">{done.length}</b></span>
            <span className="done-pill-action">{showDone ? 'скрыть' : 'показать'}<Chevron /></span>
          </button>
          <Collapse open={showDone}>
            <ol className="timeline-list done-list">
              {done.map((state) => (
                <TimelineRow
                  key={state.routine.routineId}
                  state={state}
                  status="done"
                  disabled={disabled}
                  onPress={() => void onToggle(state.routine.routineId)}
                />
              ))}
            </ol>
          </Collapse>
        </>
      )}

      {open.length > 0 && (
        <ol className="timeline-list">
          {open.map((state, index) => (
            <Fragment key={state.routine.routineId}>
              {index === markerIndex && <NowMarker label={nowLabel} />}
              <TimelineRow
                state={state}
                status={statuses[index]}
                label={labelFor(statuses[index], state)}
                disabled={disabled || ticking.has(state.routine.routineId)}
                ticking={ticking.has(state.routine.routineId)}
                leaving={leaving.has(state.routine.routineId)}
                onPress={() => tick(state.routine.routineId)}
              />
            </Fragment>
          ))}
          {markerIndex === open.length && <NowMarker label={nowLabel} />}
        </ol>
      )}
    </div>
  );
}

function TimelineRow({
  state,
  status,
  label,
  disabled,
  ticking = false,
  leaving = false,
  onPress
}: {
  state: RoutineDayState;
  status: RowStatus;
  label?: string;
  disabled: boolean;
  ticking?: boolean;
  leaving?: boolean;
  onPress: () => void;
}) {
  const classes = ['timeline-item', `is-${status}`, ticking ? 'is-ticking' : '', leaving ? 'is-leaving' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <li className={classes} data-next={status === 'next' || status === 'due' ? 'true' : undefined}>
      <div className="timeline-item-inner">
        <time>{state.routine.time}</time>
        <span className="timeline-dot" />
        <button
          type="button"
          className="timeline-task"
          aria-pressed={status === 'done' || ticking}
          disabled={disabled}
          onClick={onPress}
        >
          <span className="timeline-copy">
            <strong>{state.routine.name}</strong>
            {label && <small>{label}</small>}
          </span>
          <span className="task-check"><Check /></span>
        </button>
      </div>
    </li>
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
