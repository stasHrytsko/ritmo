import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Goal, GoalTask, Routine } from '../domain/types';
import { addDays, monthName, toISODate, weekdayName, weekStart } from '../domain/time';
import { repositories } from '../infrastructure/repositories';
import { RitmoService } from '../application/ritmoService';

type View = 'day' | 'week' | 'month' | 'year' | 'life';
type LifeTab = 'routines' | 'goals';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const weekdays = [
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
  { value: 7, label: 'S' }
];

const allWeekdays = weekdays.map((day) => day.value);

export function App() {
  const service = useMemo(() => new RitmoService(repositories), []);
  const [view, setView] = useState<View>('day');
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [lifeTab, setLifeTab] = useState<LifeTab>('routines');
  const [editorOpen, setEditorOpen] = useState(false);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [todaySections, setTodaySections] = useState({ goals: true, routine: true, anytime: true });
  const [openGoals, setOpenGoals] = useState<Record<string, boolean>>({});
  const [clockNow, setClockNow] = useState(new Date());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [routineDraft, setRoutineDraft] = useState<{
    id?: string;
    name: string;
    weekdays: number[];
    timing: Routine['timing'];
    time: string;
  }>({
    name: '',
    weekdays: allWeekdays,
    timing: 'anytime',
    time: '07:30'
  });
  const [goalDraft, setGoalDraft] = useState<{
    id?: string;
    name: string;
    startDate: string;
    endDate: string;
  }>({
    name: '',
    startDate: toISODate(new Date()),
    endDate: toISODate(addDays(new Date(), 30))
  });
  const [taskDraft, setTaskDraft] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (target: View) => {
    setBusy(true);
    try {
      if (target === 'day') setData(await service.getToday());
      if (target === 'week') setData(await service.getWeek());
      if (target === 'month') setData(await service.getMonth());
      if (target === 'year') setData(await service.getYear());
      if (target === 'life') setData(await service.getLife());
    } finally {
      setBusy(false);
    }
  }, [service]);

  useEffect(() => {
    void service.init().then(() => refresh('day'));
  }, [service, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const navigate = (target: View) => {
    if (target === view) return;
    setData(null);
    setView(target);
    setEditorOpen(false);
    setDataMenuOpen(false);
    void refresh(target);
  };

  const isProgressView = view === 'week' || view === 'month' || view === 'year';
  const timedRoutines =
    view === 'day' && Array.isArray(data?.routines)
      ? data.routines
          .filter((state: any) =>
            state.scheduled
            && state.routine.timing === 'exact'
            && Boolean(state.routine.time)
          )
          .sort((a: any, b: any) => a.routine.time.localeCompare(b.routine.time))
      : [];
  const anytimeRoutines =
    view === 'day' && Array.isArray(data?.routines)
      ? data.routines.filter((state: any) =>
          state.scheduled
          && (state.routine.timing !== 'exact' || !state.routine.time)
        )
      : [];

  const resetRoutineDraft = () => {
    setRoutineDraft({
      name: '',
      weekdays: allWeekdays,
      timing: 'anytime',
      time: '07:30'
    });
    setEditorOpen(false);
  };

  const resetGoalDraft = () => {
    setGoalDraft({
      name: '',
      startDate: toISODate(new Date()),
      endDate: toISODate(addDays(new Date(), 30))
    });
    setTaskDraft('');
    setEditorOpen(false);
  };

  const openNew = () => {
    if (lifeTab === 'routines') {
      setRoutineDraft({
        name: '',
        weekdays: allWeekdays,
        timing: 'anytime',
        time: '07:30'
      });
    } else {
      setGoalDraft({
        name: '',
        startDate: toISODate(new Date()),
        endDate: toISODate(addDays(new Date(), 30))
      });
      setTaskDraft('');
    }
    setEditorOpen(true);
  };

  const saveRoutine = async () => {
    if (!routineDraft.name.trim() || routineDraft.weekdays.length === 0) return;
    if (routineDraft.timing === 'exact' && !routineDraft.time) return;

    if (routineDraft.id) {
      const existing = data.routines.find((item: Routine) => item.id === routineDraft.id);
      if (existing) {
        await service.updateRoutine({
          ...existing,
          name: routineDraft.name.trim(),
          weekdays: routineDraft.weekdays,
          timing: routineDraft.timing,
          time: routineDraft.timing === 'exact' ? routineDraft.time : undefined
        });
      }
    } else {
      await service.createRoutine(
        routineDraft.name,
        routineDraft.weekdays,
        routineDraft.timing,
        routineDraft.timing === 'exact' ? routineDraft.time : undefined
      );
    }

    resetRoutineDraft();
    await refresh('life');
  };

  const saveGoal = async () => {
    if (!goalDraft.name.trim()) return;

    if (goalDraft.id) {
      const existing = data.goals.find((item: Goal) => item.id === goalDraft.id);
      if (existing) {
        await service.updateGoal({
          ...existing,
          name: goalDraft.name.trim(),
          startDate: goalDraft.startDate,
          endDate: goalDraft.endDate
        });
      }
    } else {
      await service.createGoal(goalDraft.name, goalDraft.startDate, goalDraft.endDate);
    }

    resetGoalDraft();
    await refresh('life');
  };

  const addTaskToEditingGoal = async () => {
    if (!goalDraft.id || !taskDraft.trim()) return;
    await service.addGoalTask(goalDraft.id, taskDraft.trim());
    setTaskDraft('');
    await refresh('life');
  };

  const exportBackup = async () => {
    const backup = await service.exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ritmo-backup-${toISODate(new Date())}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    const payload = JSON.parse(await file.text());
    await service.importBackup(payload);
    await refresh('life');
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') setInstallPrompt(null);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('day')}>Ritmo<span>.</span></button>
        {view === 'life' ? (
          <button
            className="topbar-menu"
            aria-label="Data menu"
            onClick={() => {
              setEditorOpen(false);
              setDataMenuOpen(true);
            }}
          >
            ⋯
          </button>
        ) : (
          <div className="topbar-mark">{view === 'day' ? 'Today' : 'Progress'}</div>
        )}
      </header>

      <main className={busy ? 'loading' : ''}>
        {busy && !data && (
          <div className="screen-loader" role="status" aria-live="polite">
            <span />
            <small>Loading</small>
          </div>
        )}
        {view === 'day' && data && (
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

            <WeekStrip medal={data.medal} />

            {data.medal && (
              <div className="medal-card">
                <div className="medal-mark">✓</div>
                <div>
                  <strong>Day complete</strong>
                  <span>All planned routines are done.</span>
                </div>
              </div>
            )}

            <section className={`content-block accordion-block ${todaySections.goals ? 'expanded' : 'collapsed'}`}>
              <AccordionHeader
                title="Goals"
                meta={String(data.goals.reduce((sum: number, item: any) => sum + item.tasks.length, 0))}
                open={todaySections.goals}
                onToggle={() => setTodaySections((current) => ({ ...current, goals: !current.goals }))}
              />

              {todaySections.goals && (
                <div className="stack compact accordion-content">
                  {data.goals.map((group: any) => {
                    const goalOpen = openGoals[group.goal.id] ?? true;
                    const doneCount = group.tasks.filter((task: GoalTask) => task.status === 'done').length;

                    return (
                      <article className={`goal-today nested-accordion ${goalOpen ? 'expanded' : 'collapsed'}`} key={group.goal.id}>
                        <button
                          className="goal-accordion-header"
                          aria-expanded={goalOpen}
                          onClick={() => setOpenGoals((current) => ({
                            ...current,
                            [group.goal.id]: !goalOpen
                          }))}
                        >
                          <span className="goal-accordion-copy">
                            <strong>{group.goal.name}</strong>
                            <small>{doneCount}/{group.tasks.length} tasks</small>
                          </span>
                          <span className={`accordion-chevron ${goalOpen ? 'open' : ''}`}>⌄</span>
                        </button>

                        {goalOpen && (
                          <div className="goal-task-list">
                            {group.tasks.map((task: GoalTask) => (
                              <button
                                key={task.id}
                                className={`check-row ${task.status === 'done' ? 'done' : ''}`}
                                onClick={async () => {
                                  await service.toggleGoalTask(task);
                                  await refresh('day');
                                }}
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

            <section className={`content-block accordion-block ${todaySections.routine ? 'expanded' : 'collapsed'}`}>
              <AccordionHeader
                title="Routine"
                meta={`${timedRoutines.filter((item: any) => item.done).length}/${timedRoutines.length}`}
                open={todaySections.routine}
                onToggle={() => setTodaySections((current) => ({ ...current, routine: !current.routine }))}
              />

              {todaySections.routine && (
                <div className="accordion-content">
                  {timedRoutines.length > 0 ? (
                    <RoutineTimeline
                      items={timedRoutines}
                      now={clockNow}
                      onToggle={async (routineId) => {
                        await service.toggleRoutine(data.date, routineId);
                        await refresh('day');
                      }}
                    />
                  ) : (
                    <Empty text="No timed routines scheduled for today." />
                  )}
                </div>
              )}
            </section>

            <section className={`content-block accordion-block ${todaySections.anytime ? 'expanded' : 'collapsed'}`}>
              <AccordionHeader
                title="Anytime Routine"
                meta={`${anytimeRoutines.filter((item: any) => item.done).length}/${anytimeRoutines.length}`}
                open={todaySections.anytime}
                onToggle={() => setTodaySections((current) => ({ ...current, anytime: !current.anytime }))}
              />

              {todaySections.anytime && (
                <div className="anytime-list accordion-content">
                  {anytimeRoutines.map((state: any) => (
                    <button
                      key={state.routine.routineId}
                      className={`anytime-row ${state.done ? 'done' : ''}`}
                      onClick={async () => {
                        await service.toggleRoutine(data.date, state.routine.routineId);
                        await refresh('day');
                      }}
                    >
                      <span>{state.routine.name}</span>
                      <span className="task-check">{state.done ? '✓' : ''}</span>
                    </button>
                  ))}
                  {anytimeRoutines.length === 0 && (
                    <Empty text="No anytime routines scheduled for today." />
                  )}
                </div>
              )}
            </section>
          </section>
        )}

        {isProgressView && data && (
          <section className="screen progress-screen">
            {view === 'week' && data.week && (
              <>
                <div className="progress-heading">
                  <div>
                    <div className="eyebrow">Week {data.week.weekNumber}</div>
                    <h1>{data.label}</h1>
                  </div>
                </div>
                <PeriodSwitch current={view} onChange={navigate} />

                <div className="summary-grid">
                  <ProgressSummary
                    title="Routine"
                    done={data.routineDone}
                    total={data.routineTotal}
                  />
                  <ProgressSummary
                    title="Goals"
                    done={data.goalDone}
                    total={data.goalTotal}
                  />
                </div>

                <section className="content-block">
                  <SectionHeader title="Routine" meta={`${data.routineDone}/${data.routineTotal}`} />
                  <div className="progress-list">
                    {data.routineProgress.map((item: any) => (
                      <div className="weekly-row" key={item.routine.routineId}>
                        <div className="weekly-row-title">
                          <strong>{item.routine.name}</strong>
                          <span>{item.done}/{item.total}</span>
                        </div>
                        <div className="week-dots">
                          {item.days.map((day: any, index: number) => (
                            <span
                              key={index}
                              className={
                                !day.scheduled
                                  ? 'off'
                                  : day.done
                                    ? 'done'
                                    : 'pending'
                              }
                            >
                              {day.done ? '✓' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {data.routineProgress.length === 0 && <Empty text="No routines yet." />}
                  </div>
                </section>

                <section className="content-block">
                  <SectionHeader title="Goals" meta={`${data.goalDone}/${data.goalTotal}`} />
                  <div className="progress-list">
                    {data.goalProgress.map((item: any) => (
                      <div className="goal-progress-row" key={item.goal.id}>
                        <div className="goal-progress-copy">
                          <strong>{item.goal.name}</strong>
                          <span>{item.done}/{item.total} this week</span>
                        </div>
                        <ProgressBar done={item.done} total={item.total} />
                      </div>
                    ))}
                    {data.goalProgress.length === 0 && <Empty text="No goal tasks this week." />}
                  </div>
                </section>
              </>
            )}

            {view === 'month' && data.date && Array.isArray(data.days) && (
              <>
                <div className="eyebrow">{data.date.getFullYear()}</div>
                <h1>{data.name}</h1>
                <PeriodSwitch current={view} onChange={navigate} />

                <div className="summary-grid one-line">
                  <div className="summary-card">
                    <span>Day medals</span>
                    <strong>{data.medalCount}</strong>
                    <small>{data.knownDays} tracked days</small>
                  </div>
                  <div className="summary-card">
                    <span>Month</span>
                    <strong>{data.date.getMonth() + 1}</strong>
                    <small>of 12</small>
                  </div>
                </div>

                <div className="calendar-head">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
                    <span key={index}>{label}</span>
                  ))}
                </div>
                <div className="month-grid">
                  {Array.from({
                    length: (new Date(data.date.getFullYear(), data.date.getMonth(), 1).getDay() + 6) % 7
                  }).map((_, index) => <span key={`pad-${index}`} />)}
                  {data.days.map((day: any) => (
                    <div
                      className={`month-day ${day.medal ? 'earned' : ''} ${!day.known ? 'unknown' : ''}`}
                      key={day.date.toISOString()}
                    >
                      <span>{day.date.getDate()}</span>
                      {day.medal && <b>✓</b>}
                    </div>
                  ))}
                </div>

                <section className="content-block">
                  <SectionHeader title="Goals" meta="" />
                  <div className="progress-list">
                    {data.goals.map((item: any) => (
                      <div className="goal-progress-row" key={item.goal.id}>
                        <div className="goal-progress-copy">
                          <strong>{item.goal.name}</strong>
                          <span>{item.done}/{item.total} tasks</span>
                        </div>
                        <ProgressBar done={item.done} total={item.total} />
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {view === 'year' && typeof data.year === 'number' && Array.isArray(data.months) && (
              <>
                <div className="eyebrow">Year</div>
                <div className="year-title">
                  <h1>{data.year}</h1>
                  <div><strong>{data.currentDay}</strong><span>day of {data.totalDays}</span></div>
                </div>
                <PeriodSwitch current={view} onChange={navigate} />

                <div className="summary-grid">
                  <div className="summary-card">
                    <span>Days left</span>
                    <strong>{data.daysLeft}</strong>
                    <small>until year end</small>
                  </div>
                  <div className="summary-card">
                    <span>Weeks left</span>
                    <strong>{data.weeksLeft}</strong>
                    <small>approximately</small>
                  </div>
                </div>

                <div className="quarters-list">
                  {[0, 1, 2, 3].map((quarterIndex) => {
                    const quarterMonths = data.months.slice(quarterIndex * 3, quarterIndex * 3 + 3);
                    const quarterMedals = quarterMonths.reduce((sum: number, month: any) => sum + month.medals, 0);
                    const quarterKnownDays = quarterMonths.reduce((sum: number, month: any) => sum + month.knownDays, 0);
                    const isCurrentQuarter =
                      data.year === new Date().getFullYear()
                      && quarterIndex === Math.floor(new Date().getMonth() / 3);

                    return (
                      <section
                        className={`quarter-card ${isCurrentQuarter ? 'current' : ''}`}
                        key={quarterIndex}
                      >
                        <div className="quarter-header">
                          <div>
                            <strong>Q{quarterIndex + 1}</strong>
                            <span>
                              {quarterMonths.map((month: any) => month.label).join(' · ')}
                            </span>
                          </div>
                          <div className="quarter-meta">
                            <b>{quarterMedals}</b>
                            <span>medals</span>
                          </div>
                        </div>

                        <div className="quarter-months">
                          {quarterMonths.map((month: any) => (
                            <div className="month-card" key={month.month}>
                              <strong>{month.label.toUpperCase()}</strong>
                              <span>{month.medals} medals</span>
                              <div className="month-bar">
                                <i style={{
                                  width: `${month.knownDays ? Math.round((month.medals / month.knownDays) * 100) : 0}%`
                                }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="quarter-progress">
                          <span>
                            {quarterKnownDays
                              ? `${Math.round((quarterMedals / quarterKnownDays) * 100)}% of tracked days with medals`
                              : 'No tracked days yet'}
                          </span>
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {view === 'life' && data && Array.isArray(data.routines) && Array.isArray(data.goals) && (
          <section className="screen life-screen">
            <div className="eyebrow">Edit</div>
            <h1>Life</h1>

            <div className="segmented">
              <button
                className={lifeTab === 'routines' ? 'active' : ''}
                onClick={() => {
                  setLifeTab('routines');
                  setEditorOpen(false);
                }}
              >
                Routine
              </button>
              <button
                className={lifeTab === 'goals' ? 'active' : ''}
                onClick={() => {
                  setLifeTab('goals');
                  setEditorOpen(false);
                }}
              >
                Goals
              </button>
            </div>

            <button className="add-new" onClick={openNew}>
              <span>＋</span>
              Add new {lifeTab === 'routines' ? 'routine' : 'goal'}
            </button>

            {lifeTab === 'routines' && (
              <div className="manage-list">
                {data.routines.map((routine: Routine) => (
                  <button
                    className="manage-row"
                    key={routine.id}
                    onClick={() => {
                      setRoutineDraft({
                        id: routine.id,
                        name: routine.name,
                        weekdays: routine.weekdays,
                        timing: routine.timing ?? 'anytime',
                        time: routine.time ?? '07:30'
                      });
                      setEditorOpen(true);
                    }}
                  >
                    <span>
                      <strong>{routine.name}</strong>
                      <small>
                        {formatSchedule(routine.weekdays)} · {routine.timing === 'exact' && routine.time ? routine.time : 'Anytime'}
                      </small>
                    </span>
                    <b>{routine.active ? 'On' : 'Off'}</b>
                    <i>›</i>
                  </button>
                ))}
                {data.routines.length === 0 && <Empty text="No routines yet." />}
              </div>
            )}

            {lifeTab === 'goals' && (
              <div className="manage-list">
                {data.goals.map((goal: Goal) => {
                  const tasks = data.tasks.filter((task: GoalTask) => task.goalId === goal.id);
                  const done = tasks.filter((task: GoalTask) => task.status === 'done').length;
                  return (
                    <button
                      className="manage-row goal-manage-row"
                      key={goal.id}
                      onClick={() => {
                        setGoalDraft({
                          id: goal.id,
                          name: goal.name,
                          startDate: goal.startDate,
                          endDate: goal.endDate
                        });
                        setTaskDraft('');
                        setEditorOpen(true);
                      }}
                    >
                      <span>
                        <strong>{goal.name}</strong>
                        <small>{goal.startDate} → {goal.endDate}</small>
                      </span>
                      <b>{done}/{tasks.length}</b>
                      <i>›</i>
                    </button>
                  );
                })}
                {data.goals.length === 0 && <Empty text="No goals yet." />}
              </div>
            )}

            {editorOpen && lifeTab === 'routines' && (
              <EditorSheet title={routineDraft.id ? 'Edit routine' : 'New routine'} onClose={resetRoutineDraft}>
                <label className="field">
                  <span>Name</span>
                  <input
                    autoFocus
                    value={routineDraft.name}
                    onChange={(event) => setRoutineDraft({ ...routineDraft, name: event.target.value })}
                    placeholder="Gym, water, walk Loki…"
                  />
                </label>

                <div className="field">
                  <span>Schedule</span>
                  <div className="weekday-picker">
                    {weekdays.map((day) => (
                      <button
                        key={day.value}
                        className={routineDraft.weekdays.includes(day.value) ? 'active' : ''}
                        onClick={() => {
                          const selected = routineDraft.weekdays.includes(day.value)
                            ? routineDraft.weekdays.filter((value) => value !== day.value)
                            : [...routineDraft.weekdays, day.value];
                          setRoutineDraft({ ...routineDraft, weekdays: selected });
                        }}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <span>Time</span>
                  <div className="timing-picker">
                    <button
                      className={routineDraft.timing === 'exact' ? 'active' : ''}
                      onClick={() => setRoutineDraft({ ...routineDraft, timing: 'exact' })}
                    >
                      Exact time
                    </button>
                    <button
                      className={routineDraft.timing === 'anytime' ? 'active' : ''}
                      onClick={() => setRoutineDraft({ ...routineDraft, timing: 'anytime' })}
                    >
                      Anytime
                    </button>
                  </div>
                </div>

                {routineDraft.timing === 'exact' && (
                  <label className="field">
                    <span>Exact time</span>
                    <input
                      type="time"
                      value={routineDraft.time}
                      onChange={(event) => setRoutineDraft({ ...routineDraft, time: event.target.value })}
                    />
                  </label>
                )}

                <button className="primary" onClick={saveRoutine}>
                  {routineDraft.id ? 'Save changes' : 'Add routine'}
                </button>

                {routineDraft.id && (
                  <button
                    className="danger-link"
                    onClick={async () => {
                      await service.deleteRoutine(routineDraft.id!);
                      resetRoutineDraft();
                      await refresh('life');
                    }}
                  >
                    Delete routine
                  </button>
                )}
              </EditorSheet>
            )}

            {editorOpen && lifeTab === 'goals' && (
              <EditorSheet title={goalDraft.id ? 'Edit goal' : 'New goal'} onClose={resetGoalDraft}>
                <label className="field">
                  <span>Name</span>
                  <input
                    autoFocus
                    value={goalDraft.name}
                    onChange={(event) => setGoalDraft({ ...goalDraft, name: event.target.value })}
                    placeholder="Release first game"
                  />
                </label>

                <div className="date-fields">
                  <label className="field">
                    <span>Start</span>
                    <input
                      type="date"
                      value={goalDraft.startDate}
                      onChange={(event) => setGoalDraft({ ...goalDraft, startDate: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>End</span>
                    <input
                      type="date"
                      value={goalDraft.endDate}
                      onChange={(event) => setGoalDraft({ ...goalDraft, endDate: event.target.value })}
                    />
                  </label>
                </div>

                <button className="primary" onClick={saveGoal}>
                  {goalDraft.id ? 'Save changes' : 'Add goal'}
                </button>

                {goalDraft.id && (
                  <>
                    <div className="editor-divider" />
                    <div className="field">
                      <span>Tasks</span>
                      <div className="editor-task-list">
                        {data.tasks
                          .filter((task: GoalTask) => task.goalId === goalDraft.id)
                          .map((task: GoalTask) => (
                            <button
                              key={task.id}
                              className={`check-row ${task.status === 'done' ? 'done' : ''}`}
                              onClick={async () => {
                                await service.toggleGoalTask(task);
                                await refresh('life');
                              }}
                            >
                              <span className="check-circle">{task.status === 'done' ? '✓' : ''}</span>
                              <span>{task.title}</span>
                            </button>
                          ))}
                      </div>
                      <div className="task-add">
                        <input
                          value={taskDraft}
                          onChange={(event) => setTaskDraft(event.target.value)}
                          placeholder="Add weekly task"
                        />
                        <button onClick={addTaskToEditingGoal}>＋</button>
                      </div>
                    </div>

                    <button
                      className="danger-link"
                      onClick={async () => {
                        await service.deleteGoal(goalDraft.id!);
                        resetGoalDraft();
                        await refresh('life');
                      }}
                    >
                      Delete goal
                    </button>
                  </>
                )}
              </EditorSheet>
            )}

            {(installPrompt || (isIOS() && !isStandalone())) && (
              <section className="utility-section">
                {installPrompt && (
                  <button className="utility-row" onClick={installApp}>
                    <span><strong>Install Ritmo</strong><small>Add it to your home screen</small></span>
                    <i>›</i>
                  </button>
                )}
                {isIOS() && !isStandalone() && (
                  <div className="ios-hint">
                    <strong>Add to Home Screen</strong>
                    <span>Safari → Share → Add to Home Screen</span>
                  </div>
                )}
              </section>
            )}

            {dataMenuOpen && (
              <EditorSheet title="Data" onClose={() => setDataMenuOpen(false)}>
                <div className="data-sheet-copy">
                  <strong>Local data</strong>
                  <span>Ritmo stores your routines, goals and tracking history on this device.</span>
                </div>
                <div className="backup-actions">
                  <button onClick={exportBackup}>Export backup</button>
                  <button onClick={() => importRef.current?.click()}>Import backup</button>
                  <input
                    ref={importRef}
                    hidden
                    type="file"
                    accept="application/json"
                    onChange={(event) => void importBackup(event.target.files?.[0])}
                  />
                </div>
              </EditorSheet>
            )}
          </section>
        )}
      </main>

      <footer className="bottom-nav">
        <NavButton
          label="Today"
          icon="today"
          active={view === 'day'}
          onClick={() => navigate('day')}
        />
        <NavButton
          label="Progress"
          icon="week"
          active={isProgressView}
          onClick={() => navigate(isProgressView ? view : 'week')}
        />
        <NavButton
          label="Life"
          icon="life"
          active={view === 'life'}
          onClick={() => navigate('life')}
        />
      </footer>
    </div>
  );
}

function RoutineTimeline({
  items,
  now,
  onToggle
}: {
  items: any[];
  now: Date;
  onToggle: (routineId: string) => void | Promise<void>;
}) {
  const rowHeight = 58;
  const markerTop = getTimelineMarkerTop(items, now, rowHeight);
  const nowLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="routine-timeline" style={{ height: `${items.length * rowHeight}px` }}>
      <div className="timeline-axis" />

      {items.map((state, index) => (
        <div
          className="timeline-item"
          key={state.routine.routineId}
          style={{ top: `${index * rowHeight}px` }}
        >
          <span className="timeline-dot" />
          <button
            className={`timeline-task ${state.done ? 'done' : ''}`}
            onClick={() => onToggle(state.routine.routineId)}
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

function getTimelineMarkerTop(items: any[], now: Date, rowHeight: number) {
  if (!items.length) return null;

  const times = items.map((item) => timeToMinutes(item.routine.time));
  const current = now.getHours() * 60 + now.getMinutes();
  const centers = items.map((_: any, index: number) => index * rowHeight + rowHeight / 2);

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

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function AccordionHeader({
  title,
  meta,
  open,
  onToggle
}: {
  title: string;
  meta: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button className="accordion-header" aria-expanded={open} onClick={onToggle}>
      <h2>{title}</h2>
      <span className="accordion-header-right">
        <b>{meta}</b>
        <i className={`accordion-chevron ${open ? 'open' : ''}`}>⌄</i>
      </span>
    </button>
  );
}

function SectionHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      <span>{meta}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function PeriodSwitch({ current, onChange }: { current: View; onChange: (view: View) => void }) {
  return (
    <div className="period-switch">
      {(['week', 'month', 'year'] as View[]).map((period) => (
        <button
          key={period}
          className={current === period ? 'active' : ''}
          onClick={() => onChange(period)}
        >
          {period}
        </button>
      ))}
    </div>
  );
}

function ProgressSummary({ title, done, total }: { title: string; done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="summary-card">
      <span>{title}</span>
      <strong>{percent}%</strong>
      <small>{done}/{total} complete</small>
      <ProgressBar done={done} total={total} />
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="progress-bar">
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}

function WeekStrip({ medal }: { medal: boolean }) {
  const start = weekStart(new Date());
  const today = toISODate(new Date());

  return (
    <div className="week-strip">
      {Array.from({ length: 7 }, (_, index) => {
        const date = addDays(start, index);
        const isToday = toISODate(date) === today;
        return (
          <div className={isToday ? 'today' : ''} key={index}>
            <span>{weekdayName(date, 'short').slice(0, 1)}</span>
            <b>{date.getDate()}</b>
            <i>{isToday && medal ? '✓' : ''}</i>
          </div>
        );
      })}
    </div>
  );
}

function EditorSheet({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="editor-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <strong>{title}</strong>
          <button onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NavButton({
  label,
  icon,
  active,
  onClick
}: {
  label: string;
  icon: 'today' | 'week' | 'life';
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      <NavIcon type={icon} />
      <span>{label}</span>
    </button>
  );
}

function NavIcon({ type }: { type: 'today' | 'week' | 'life' }) {
  if (type === 'today') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" />
      </svg>
    );
  }

  if (type === 'week') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="6" width="16" height="14" rx="2" />
        <path d="M8 3v5M16 3v5M4 10h16" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
    </svg>
  );
}

function formatSchedule(days: number[]) {
  if (days.length === 7) return 'Every day';
  return days.map((day) => weekdays[day - 1]?.label ?? '').join(' · ');
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}
