import { useEffect, useMemo, useRef, useState } from 'react';
import type { TodayView } from '../../application/ritmoService';
import type { GoalTask, ISODate } from '../../domain/types';
import { monthGenitive, plural, toISODate, weekdayName } from '../../domain/time';
import { AccordionHeader, Empty } from '../components/ui';
import { RoutineTimeline } from '../components/RoutineTimeline';
import { WeekStrip } from '../components/WeekStrip';

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

  const timed = useMemo(
    () =>
      data.routines
        .filter((state) => state.scheduled && state.routine.timing === 'exact' && Boolean(state.routine.time))
        .sort((a, b) => (a.routine.time ?? '').localeCompare(b.routine.time ?? '')),
    [data.routines]
  );

  const anytime = useMemo(
    () =>
      data.routines.filter(
        (state) => state.scheduled && (state.routine.timing !== 'exact' || !state.routine.time)
      ),
    [data.routines]
  );

  const goalTaskCount = data.goals.reduce((sum, item) => sum + item.tasks.length, 0);
  const yearPercent = Math.round(data.yearProgress * 100);

  // Opening Today lands on what is next, but only when it would otherwise be
  // out of sight: the header with the days left stays put whenever it can.
  const screenRef = useRef<HTMLElement>(null);
  const dateKey = toISODate(data.date);
  useEffect(() => {
    if (!data.isToday) return;
    const next = screenRef.current?.querySelector<HTMLElement>('[data-next="true"]');
    if (!next) return;
    const { bottom } = next.getBoundingClientRect();
    if (bottom > window.innerHeight - 110) next.scrollIntoView({ block: 'center' });
    // Only on arrival at a day, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

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
        <div className="hero-left" aria-label={`${data.daysLeft} ${plural(data.daysLeft, ['день', 'дня', 'дней'])} до конца года`}>
          <strong className="hero-number accent">{data.daysLeft}</strong>
          <span className="hero-caption">
            <b>{plural(data.daysLeft, ['день', 'дня', 'дней'])} до<br />конца года</b>
            <small>{data.weeksLeft} {plural(data.weeksLeft, ['неделя', 'недели', 'недель'])}</small>
          </span>
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

      {!data.isToday && (
        <div className="day-banner">
          <span>{data.editable ? 'Можно отметить задним числом' : 'Этот день ещё не наступил'}</span>
          <button type="button" onClick={() => onSelectDay(undefined)}>К сегодня</button>
        </div>
      )}

      {data.medal && (
        <div className="medal-card">
          <div className="medal-mark">✓</div>
          <div>
            <strong>День закрыт</strong>
            <span>Все запланированные рутины выполнены.</span>
          </div>
        </div>
      )}

      {data.goals.length > 0 && (
        <section className={`content-block accordion-block ${sections.goals ? 'expanded' : 'collapsed'}`}>
          <AccordionHeader
            title="Цели"
            meta={String(goalTaskCount)}
            open={sections.goals}
            onToggle={() => setSections((current) => ({ ...current, goals: !current.goals }))}
          />

          {sections.goals && (
            <div className="stack compact accordion-content">
              {data.goals.map((group) => {
                const goalOpen = openGoals[group.goal.id] ?? true;
                const doneCount = group.tasks.filter((task) => task.status === 'done').length;

                return (
                  <article
                    className={`goal-today nested-accordion ${goalOpen ? 'expanded' : 'collapsed'}`}
                    key={group.goal.id}
                  >
                    <button
                      type="button"
                      className="goal-accordion-header"
                      aria-expanded={goalOpen}
                      onClick={() => setOpenGoals((current) => ({ ...current, [group.goal.id]: !goalOpen }))}
                    >
                      <span className="goal-accordion-copy">
                        <strong>{group.goal.name}</strong>
                        <small>{doneCount}/{group.tasks.length} {plural(group.tasks.length, ['задача', 'задачи', 'задач'])}</small>
                      </span>
                      <span className={`accordion-chevron ${goalOpen ? 'open' : ''}`}>⌄</span>
                    </button>

                    {goalOpen && (
                      <div className="goal-task-list">
                        {group.tasks.map((task) => (
                          <button
                            type="button"
                            key={task.id}
                            className={`check-row ${task.status === 'done' ? 'done' : ''}`}
                            aria-pressed={task.status === 'done'}
                            onClick={() => void onToggleTask(task)}
                          >
                            <span className="check-circle">{task.status === 'done' ? '✓' : ''}</span>
                            <span>{task.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className={`content-block accordion-block ${sections.routine ? 'expanded' : 'collapsed'}`}>
        <AccordionHeader
          title="Рутина"
          meta={`${timed.filter((item) => item.done).length}/${timed.length}`}
          open={sections.routine}
          onToggle={() => setSections((current) => ({ ...current, routine: !current.routine }))}
        />

        {sections.routine && (
          <div className="accordion-content">
            {timed.length > 0 ? (
              <RoutineTimeline
                key={dateKey}
                items={timed}
                live={data.isToday}
                disabled={!data.editable}
                onToggle={onToggleRoutine}
              />
            ) : (
              <Empty text="На этот день рутин по времени нет." />
            )}
          </div>
        )}
      </section>

      <section className={`content-block accordion-block ${sections.anytime ? 'expanded' : 'collapsed'}`}>
        <AccordionHeader
          title="В любое время"
          meta={`${anytime.filter((item) => item.done).length}/${anytime.length}`}
          open={sections.anytime}
          onToggle={() => setSections((current) => ({ ...current, anytime: !current.anytime }))}
        />

        {sections.anytime && (
          <div className="anytime-list accordion-content">
            {anytime.map((state) => (
              <button
                type="button"
                key={state.routine.routineId}
                className={`anytime-row ${state.done ? 'done' : ''}`}
                aria-pressed={state.done}
                disabled={!data.editable}
                onClick={() => void onToggleRoutine(state.routine.routineId)}
              >
                <span>{state.routine.name}</span>
                <span className="task-check">{state.done ? '✓' : ''}</span>
              </button>
            ))}
            {anytime.length === 0 && <Empty text="На этот день таких рутин нет." />}
          </div>
        )}
      </section>
    </section>
  );
}
