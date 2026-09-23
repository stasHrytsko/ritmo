import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TodayView } from '../../application/ritmoService';
import type { GoalTask, ISODate } from '../../domain/types';
import { monthGenitive, plural, routineMinutes, toISODate, weekdayName } from '../../domain/time';
import { AccordionHeader, Empty } from '../components/ui';
import { Celebration } from '../components/Celebration';
import { Collapse } from '../components/Collapse';
import { Check, Chevron } from '../components/icons';
import { RoutineTimeline } from '../components/RoutineTimeline';
import { useTick } from '../components/useTick';
import { WeekStrip } from '../components/WeekStrip';

/** How far a horizontal drag has to travel before it changes the day. */
const SWIPE_PX = 56;

export function TodayScreen({
  data,
  onToggleRoutine,
  onToggleTask,
  onSelectDay
}: {
  data: TodayView;
  onToggleRoutine: (routineId: string) => Promise<void>;
  onToggleTask: (task: GoalTask) => Promise<void>;
  onSelectDay: (day: ISODate | undefined) => void;
}) {
  const [sections, setSections] = useState({ goals: true, routine: true, anytime: true });
  const [openGoals, setOpenGoals] = useState<Record<string, boolean>>({});
  const [celebrating, setCelebrating] = useState(false);

  const timed = useMemo(
    () =>
      data.routines
        .filter((state) => state.scheduled && state.routine.timing === 'exact' && Boolean(state.routine.time))
        .sort((a, b) =>
          routineMinutes(a.routine.time ?? '00:00', data.dayBoundaryHour)
          - routineMinutes(b.routine.time ?? '00:00', data.dayBoundaryHour)),
    [data.routines, data.dayBoundaryHour]
  );

  const anytime = useMemo(
    () =>
      data.routines.filter(
        (state) => state.scheduled && (state.routine.timing !== 'exact' || !state.routine.time)
      ),
    [data.routines]
  );

  const anytimeTick = useTick(onToggleRoutine, false);

  const scheduledCount = data.routines.filter((state) => state.scheduled).length;
  const goalTaskCount = data.goals.reduce((sum, item) => sum + item.tasks.length, 0);
  const yearPercent = Math.round(data.yearProgress * 100);
  const dateKey = toISODate(data.date);
  const todayKey = toISODate(data.today);

  // A day that closes while you watch gets its moment. Loading a day that is
  // already closed does not: only the transition counts.
  const lastMedal = useRef<{ key: ISODate; medal: boolean } | null>(null);
  useEffect(() => {
    const previous = lastMedal.current;
    if (previous && previous.key === dateKey && !previous.medal && data.medal && data.isToday) {
      setCelebrating(true);
    }
    lastMedal.current = { key: dateKey, medal: data.medal };
  }, [dateKey, data.medal, data.isToday]);

  // Opening Today lands on what is next, but only when it would otherwise be
  // out of sight: the header with the date stays put whenever it can.
  const screenRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!data.isToday) return;
    const next = screenRef.current?.querySelector<HTMLElement>('[data-next="true"]');
    if (!next) return;
    const { bottom } = next.getBoundingClientRect();
    if (bottom > window.innerHeight - 110) next.scrollIntoView({ block: 'center' });
    // Only on arrival at a day, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  // The day's content slides in from the side it was reached from.
  const bodyRef = useRef<HTMLDivElement>(null);
  const shownKey = useRef(dateKey);
  useEffect(() => {
    const previous = shownKey.current;
    shownKey.current = dateKey;
    if (previous === dateKey) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const direction = dateKey > previous ? 1 : -1;
    bodyRef.current?.animate(
      [
        { opacity: 0, transform: `translateX(${direction * 28}px)` },
        { opacity: 1, transform: 'none' }
      ],
      { duration: 240, easing: 'cubic-bezier(.2, .7, .2, 1)' }
    );
  }, [dateKey]);

  // Swiping the day sideways moves to the day before or after, within the week.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const selectedIndex = data.week.findIndex((day) => day.selected);

  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) start.moved = true;
    if (start.moved && bodyRef.current) {
      bodyRef.current.style.transform = `translateX(${dx * .35}px)`;
      bodyRef.current.style.opacity = String(1 - Math.min(Math.abs(dx) / 500, .35));
    }
  };

  const endDrag = (event: ReactPointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (bodyRef.current) {
      bodyRef.current.style.transform = '';
      bodyRef.current.style.opacity = '';
    }
    if (!start?.moved) return;
    suppressClick.current = true;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) < SWIPE_PX) return;
    const target = data.week[selectedIndex + (dx < 0 ? 1 : -1)];
    if (target) onSelectDay(toISODate(target.date));
  };

  return (
    <section className="screen today-screen" ref={screenRef}>
      <div className="date-hero">
        <div className="hero-date">
          <strong className="hero-number">{data.date.getDate()}</strong>
          <span className="hero-caption">
            <b>{monthGenitive(data.date)}</b>
            <small>{weekdayName(data.date)}</small>
          </span>
        </div>
        <div className="hero-left">
          <b>{data.daysLeft}</b>
          <span>{plural(data.daysLeft, ['день', 'дня', 'дней'])} до</span>
          <span>конца года</span>
        </div>
      </div>
      <div
        className="year-track"
        role="progressbar"
        aria-label="Прошло года"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={yearPercent}
      >
        <i style={{ width: `${yearPercent}%` }} />
      </div>

      <WeekStrip days={data.week} onSelect={(day) => onSelectDay(toISODate(day))} />

      <div
        className="day-body"
        ref={bodyRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        {!data.isToday && (
          <div className="day-banner">
            <span>{data.editable ? 'Можно отметить задним числом' : 'Этот день ещё не наступил'}</span>
            <button type="button" onClick={() => onSelectDay(undefined)}>К сегодня</button>
          </div>
        )}

        {data.medal && (
          <div className="medal-card">
            <div className="medal-mark"><Check /></div>
            <strong>День закрыт</strong>
          </div>
        )}

        {data.goals.length > 0 && (
          <section className="content-block accordion-block">
            <AccordionHeader
              title="Цели"
              meta={String(goalTaskCount)}
              open={sections.goals}
              onToggle={() => setSections((current) => ({ ...current, goals: !current.goals }))}
            />

            <Collapse open={sections.goals}>
              <div className="stack compact accordion-content">
                {data.goals.map((group) => {
                  const doneCount = group.tasks.filter((task) => task.status === 'done').length;

                  // Nothing planned for the day: the goal stays in sight, quietly.
                  if (group.tasks.length === 0) {
                    return (
                      <article className="goal-today nested-accordion is-idle" key={group.goal.id}>
                        <div className="goal-accordion-header">
                          <span className="goal-accordion-copy">
                            <strong>{group.goal.name}</strong>
                          </span>
                        </div>
                      </article>
                    );
                  }

                  const goalOpen = openGoals[group.goal.id] ?? true;
                  return (
                    <article className="goal-today nested-accordion" key={group.goal.id}>
                      <button
                        type="button"
                        className="goal-accordion-header"
                        aria-expanded={goalOpen}
                        onClick={() => setOpenGoals((current) => ({ ...current, [group.goal.id]: !goalOpen }))}
                      >
                        <span className="goal-accordion-copy">
                          <strong>{group.goal.name}</strong>
                          <small>{doneCount}/{group.tasks.length}</small>
                        </span>
                        <Chevron />
                      </button>

                      <Collapse open={goalOpen}>
                        <div className="goal-task-list">
                          {group.tasks.map((task) => (
                            <button
                              type="button"
                              key={task.id}
                              className={`check-row ${task.status === 'done' ? 'done' : ''}`}
                              aria-pressed={task.status === 'done'}
                              onClick={() => void onToggleTask(task)}
                            >
                              <span className="check-circle"><Check /></span>
                              <span>{task.title}</span>
                            </button>
                          ))}
                        </div>
                      </Collapse>
                    </article>
                  );
                })}
              </div>
            </Collapse>
          </section>
        )}

        <section className="content-block accordion-block">
          <AccordionHeader
            title="Рутина"
            open={sections.routine}
            onToggle={() => setSections((current) => ({ ...current, routine: !current.routine }))}
          />

          <Collapse open={sections.routine}>
            <div className="accordion-content">
              {timed.length > 0 ? (
                <RoutineTimeline
                  key={dateKey}
                  items={timed}
                  dayKey={dateKey}
                  todayKey={todayKey}
                  boundaryHour={data.dayBoundaryHour}
                  disabled={!data.editable}
                  onToggle={onToggleRoutine}
                />
              ) : (
                <Empty text="На этот день рутин по времени нет." />
              )}
            </div>
          </Collapse>
        </section>

        <section className="content-block accordion-block">
          <AccordionHeader
            title="В любое время"
            meta={`${anytime.filter((item) => item.done).length}/${anytime.length}`}
            open={sections.anytime}
            onToggle={() => setSections((current) => ({ ...current, anytime: !current.anytime }))}
          />

          <Collapse open={sections.anytime}>
            <div className="anytime-list accordion-content">
              {anytime.map((state) => {
                const id = state.routine.routineId;
                const ticking = anytimeTick.ticking.has(id);
                return (
                  <button
                    type="button"
                    key={id}
                    className={`anytime-row ${state.done ? 'done' : ''} ${ticking ? 'is-ticking' : ''}`}
                    aria-pressed={state.done || ticking}
                    disabled={!data.editable || ticking}
                    onClick={() => (state.done ? void onToggleRoutine(id) : anytimeTick.tick(id))}
                  >
                    <span>{state.routine.name}</span>
                    <span className="task-check"><Check /></span>
                  </button>
                );
              })}
              {anytime.length === 0 && <Empty text="На этот день таких рутин нет." />}
            </div>
          </Collapse>
        </section>
      </div>

      {celebrating && (
        <Celebration
          routines={scheduledCount}
          streak={data.streak.current}
          onClose={() => setCelebrating(false)}
        />
      )}
    </section>
  );
}
