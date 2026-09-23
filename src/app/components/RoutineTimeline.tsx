import { Fragment, useEffect, useState, type ReactNode } from 'react';
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

const STATUS_WORDS: Record<RowStatus, string> = {
  done: 'выполнено',
  missed: 'пропущено',
  due: 'пора',
  next: 'следующее',
  ahead: 'впереди'
};

/** Minutes apart below which two routines read as back to back. */
const TIGHT_MINUTES = 20;
/** Minutes apart from which the pause is drawn as a break in the rail. */
const LONG_MINUTES = 90;

/**
 * The space between two rows follows the clock, so a glance shows what comes
 * straight after and what is hours away — without writing it down.
 */
function Gap({ minutes }: { minutes: number }) {
  if (minutes >= LONG_MINUTES) return <li className="timeline-gap is-long" aria-hidden="true" />;
  const extra = minutes <= TIGHT_MINUTES ? 0 : ((minutes - TIGHT_MINUTES) / (LONG_MINUTES - TIGHT_MINUTES)) * 14;
  return <li className="timeline-gap" style={{ height: 5 + Math.round(extra) }} aria-hidden="true" />;
}

/**
 * The day's timed routines in order. Done ones fold into a single line so the
 * list starts at what is still ahead. State is shown, not written: a dashed
 * row was missed, the accent row is due, the lifted one is next.
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

  // Rows and the now marker in order, each with the clock time it stands at,
  // so the gaps between them can follow the clock.
  const rows: Array<{ key: string; minutes: number; node: ReactNode }> = [];
  open.forEach((state, index) => {
    if (index === markerIndex) {
      rows.push({ key: 'now', minutes: nowMinutes, node: <NowMarker label={nowLabel} /> });
    }
    const id = state.routine.routineId;
    rows.push({
      key: id,
      minutes: minutesOf(state),
      node: (
        <TimelineRow
          state={state}
          status={statuses[index]}
          disabled={disabled || ticking.has(id)}
          ticking={ticking.has(id)}
          leaving={leaving.has(id)}
          onPress={() => tick(id)}
        />
      )
    });
  });
  if (markerIndex === open.length) {
    rows.push({ key: 'now', minutes: nowMinutes, node: <NowMarker label={nowLabel} /> });
  }

  return (
    <div className="routine-timeline">
      <button
        type="button"
        className="done-pill"
        aria-expanded={showDone}
        aria-label={`Выполнено ${done.length} из ${items.length}`}
        disabled={done.length === 0}
        onClick={() => setShowDone((current) => !current)}
      >
        <span className="done-pill-mark"><Check /></span>
        <span>
          Выполнено
          <b key={done.length} className="done-pill-count">{done.length}/{items.length}</b>
        </span>
        {done.length > 0 && <Chevron />}
      </button>
      <Collapse open={showDone && done.length > 0}>
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

      {rows.length > 0 && (
        <ol className="timeline-list">
          {rows.map((row, index) => (
            <Fragment key={row.key}>
              {index > 0 && <Gap minutes={row.minutes - rows[index - 1].minutes} />}
              {row.node}
            </Fragment>
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineRow({
  state,
  status,
  disabled,
  ticking = false,
  leaving = false,
  onPress
}: {
  state: RoutineDayState;
  status: RowStatus;
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
          aria-label={`${state.routine.name}, ${state.routine.time}, ${STATUS_WORDS[status]}`}
          disabled={disabled}
          onClick={onPress}
        >
          <span className="timeline-copy">
            <strong>{state.routine.name}</strong>
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
