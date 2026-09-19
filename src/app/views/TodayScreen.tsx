import { useMemo, useState } from 'react';
import type { TodayView } from '../../application/ritmoService';
import type { GoalTask, Note } from '../../domain/types';
import { monthName, weekdayName } from '../../domain/time';
import { AccordionHeader, Empty } from '../components/ui';
import { NotesBlock } from '../components/NotesBlock';
import { RoutineTimeline } from '../components/RoutineTimeline';
import { WeekStrip } from '../components/WeekStrip';

export function TodayScreen({
  data,
  onToggleRoutine,
  onToggleTask,
  onAddNote,
  onToggleNote,
  onDeleteNote
}: {
  data: TodayView;
  onToggleRoutine: (routineId: string) => Promise<void>;
  onToggleTask: (task: GoalTask) => Promise<void>;
  onAddNote: (text: string) => Promise<void>;
  onToggleNote: (note: Note) => Promise<void>;
  onDeleteNote: (note: Note) => Promise<void>;
}) {
  const [sections, setSections] = useState({
    goals: true,
    routine: true,
    anytime: true,
    // The backlog is reference material, not today's work: open it on purpose.
    notes: false
  });
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

  return (
    <section className="screen today-screen">
      <div className="date-hero">
        <div className="date-main">
          <div className="date-number">{data.date.getDate()}</div>
          <div className="date-copy">
            <strong>{monthName(data.date).toUpperCase()}</strong>
            <span>{weekdayName(data.date).toUpperCase()}</span>
          </div>
        </div>
        <div className="countdown">
          <div><strong>{data.daysLeft}</strong><span>days left</span></div>
          <div><strong>{data.weeksLeft}</strong><span>weeks left</span></div>
        </div>
      </div>

      <WeekStrip days={data.week} />

      {data.medal && (
        <div className="medal-card">
          <div className="medal-mark">✓</div>
          <div>
            <strong>Day complete</strong>
            <span>All planned routines are done.</span>
          </div>
        </div>
      )}

      <section className={`content-block accordion-block ${sections.goals ? 'expanded' : 'collapsed'}`}>
        <AccordionHeader
          title="Goals"
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
                      <small>{doneCount}/{group.tasks.length} tasks</small>
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
            {data.goals.length === 0 && <Empty text="No goal tasks for today." />}
          </div>
        )}
      </section>

      <section className={`content-block accordion-block ${sections.routine ? 'expanded' : 'collapsed'}`}>
        <AccordionHeader
          title="Routine"
          meta={`${timed.filter((item) => item.done).length}/${timed.length}`}
          open={sections.routine}
          onToggle={() => setSections((current) => ({ ...current, routine: !current.routine }))}
        />

        {sections.routine && (
          <div className="accordion-content">
            {timed.length > 0 ? (
              <RoutineTimeline items={timed} onToggle={onToggleRoutine} />
            ) : (
              <Empty text="No timed routines scheduled for today." />
            )}
          </div>
        )}
      </section>

      <section className={`content-block accordion-block ${sections.anytime ? 'expanded' : 'collapsed'}`}>
        <AccordionHeader
          title="Anytime Routine"
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
                onClick={() => void onToggleRoutine(state.routine.routineId)}
              >
                <span>{state.routine.name}</span>
                <span className="task-check">{state.done ? '✓' : ''}</span>
              </button>
            ))}
            {anytime.length === 0 && <Empty text="No anytime routines scheduled for today." />}
          </div>
        )}
      </section>

      <NotesBlock
        notes={data.notes}
        open={sections.notes}
        onToggleOpen={() => setSections((current) => ({ ...current, notes: !current.notes }))}
        onAdd={onAddNote}
        onToggle={onToggleNote}
        onDelete={onDeleteNote}
      />
    </section>
  );
}
