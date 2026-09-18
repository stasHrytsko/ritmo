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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [routineDraft, setRoutineDraft] = useState<{ id?: string; name: string; weekdays: number[] }>({
    name: '',
    weekdays: allWeekdays
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
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const navigate = (target: View) => {
    setView(target);
    setEditorOpen(false);
    void refresh(target);
  };

  const isProgressView = view === 'week' || view === 'month' || view === 'year';

  const resetRoutineDraft = () => {
    setRoutineDraft({ name: '', weekdays: allWeekdays });
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
      setRoutineDraft({ name: '', weekdays: allWeekdays });
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

    if (routineDraft.id) {
      const existing = data.routines.find((item: Routine) => item.id === routineDraft.id);
      if (existing) {
        await service.updateRoutine({
          ...existing,
          name: routineDraft.name.trim(),
          weekdays: routineDraft.weekdays
        });
      }
    } else {
      await service.createRoutine(routineDraft.name, routineDraft.weekdays);
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
        <div className="topbar-mark">{view === 'day' ? 'Today' : isProgressView ? 'Progress' : 'Edit'}</div>
      </header>

      <main className={busy ? 'loading' : ''}>
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

            <section className="content-block">
              <SectionHeader
                title="Goals"
                meta={String(data.goals.reduce((sum: number, item: any) => sum + item.tasks.length, 0))}
              />
              <div className="stack compact">
                {data.goals.map((group: any) => (
                  <article className="goal-today" key={group.goal.id}>
                    <div className="goal-title">{group.goal.name}</div>
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
                  </article>
                ))}
                {data.goals.length === 0 && <Empty text="No goal tasks for today." />}
              </div>
            </section>

            <section className="content-block">
              <SectionHeader
                title="Routine"
                meta={`${data.routines.filter((item: any) => item.scheduled && item.done).length}/${data.routines.filter((item: any) => item.scheduled).length}`}
              />
              <div className="stack compact">
                {data.routines
                  .filter((state: any) => state.scheduled)
                  .map((state: any) => (
                    <button
                      key={state.routine.routineId}
                      className={`check-row ${state.done ? 'done' : ''}`}
                      onClick={async () => {
                        await service.toggleRoutine(data.date, state.routine.routineId);
                        await refresh('day');
                      }}
                    >
                      <span className="check-circle">{state.done ? '✓' : ''}</span>
                      <span>{state.routine.name}</span>
                    </button>
                  ))}
                {data.routines.filter((state: any) => state.scheduled).length === 0 && (
                  <Empty text="No routines scheduled for today." />
                )}
              </div>
            </section>
          </section>
        )}

        {isProgressView && data && (
          <section className="screen progress-screen">
            {view === 'week' && (
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

            {view === 'month' && (
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

            {view === 'year' && (
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

                <div className="months-grid">
                  {data.months.map((month: any) => (
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
              </>
            )}
          </section>
        )}

        {view === 'life' && data && (
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
                        weekdays: routine.weekdays
                      });
                      setEditorOpen(true);
                    }}
                  >
                    <span>
                      <strong>{routine.name}</strong>
                      <small>{formatSchedule(routine.weekdays)}</small>
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
            </section>
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
          label="Week"
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
