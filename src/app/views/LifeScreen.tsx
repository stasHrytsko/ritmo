import { useRef, useState } from 'react';
import type { LifeView } from '../../application/ritmoService';
import type { Goal, GoalTask, Routine } from '../../domain/types';
import { addDays, toISODate } from '../../domain/time';
import { EditorSheet } from '../components/EditorSheet';
import { Empty } from '../components/ui';

type LifeTab = 'routines' | 'goals';

interface RoutineDraft {
  id?: string;
  name: string;
  weekdays: number[];
  timing: Routine['timing'];
  time: string;
}

interface GoalDraft {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const WEEKDAYS = [
  { value: 1, label: 'M', name: 'Monday' },
  { value: 2, label: 'T', name: 'Tuesday' },
  { value: 3, label: 'W', name: 'Wednesday' },
  { value: 4, label: 'T', name: 'Thursday' },
  { value: 5, label: 'F', name: 'Friday' },
  { value: 6, label: 'S', name: 'Saturday' },
  { value: 7, label: 'S', name: 'Sunday' }
];

const ALL_WEEKDAYS = WEEKDAYS.map((day) => day.value);

const emptyRoutineDraft = (): RoutineDraft => ({
  name: '',
  weekdays: ALL_WEEKDAYS,
  timing: 'anytime',
  time: '07:30'
});

const emptyGoalDraft = (): GoalDraft => ({
  name: '',
  startDate: toISODate(new Date()),
  endDate: toISODate(addDays(new Date(), 30))
});

export function LifeScreen({
  data,
  dataMenuOpen,
  installPrompt,
  onSaveRoutine,
  onDeleteRoutine,
  onSaveGoal,
  onDeleteGoal,
  onAddTask,
  onToggleTask,
  onCloseDataMenu,
  onExport,
  onImport,
  onInstall
}: {
  data: LifeView;
  dataMenuOpen: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  onSaveRoutine: (draft: RoutineDraft, existing?: Routine) => Promise<void>;
  onDeleteRoutine: (id: string) => Promise<void>;
  onSaveGoal: (draft: GoalDraft, existing?: Goal) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
  onAddTask: (goalId: string, title: string) => Promise<void>;
  onToggleTask: (task: GoalTask) => Promise<void>;
  onCloseDataMenu: () => void;
  onExport: () => void;
  onImport: (file?: File) => void;
  onInstall: () => void;
}) {
  const [tab, setTab] = useState<LifeTab>('routines');
  const [editorOpen, setEditorOpen] = useState(false);
  const [routineDraft, setRoutineDraft] = useState<RoutineDraft>(emptyRoutineDraft);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(emptyGoalDraft);
  const [taskDraft, setTaskDraft] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const closeRoutineEditor = () => {
    setRoutineDraft(emptyRoutineDraft());
    setEditorOpen(false);
  };

  const closeGoalEditor = () => {
    setGoalDraft(emptyGoalDraft());
    setTaskDraft('');
    setEditorOpen(false);
  };

  const openNew = () => {
    if (tab === 'routines') setRoutineDraft(emptyRoutineDraft());
    else {
      setGoalDraft(emptyGoalDraft());
      setTaskDraft('');
    }
    setEditorOpen(true);
  };

  const saveRoutine = async () => {
    if (!routineDraft.name.trim() || routineDraft.weekdays.length === 0) return;
    if (routineDraft.timing === 'exact' && !routineDraft.time) return;

    const existing = routineDraft.id
      ? data.routines.find((item) => item.id === routineDraft.id)
      : undefined;
    if (routineDraft.id && !existing) return;

    await onSaveRoutine(routineDraft, existing);
    closeRoutineEditor();
  };

  const saveGoal = async () => {
    if (!goalDraft.name.trim()) return;

    const existing = goalDraft.id ? data.goals.find((item) => item.id === goalDraft.id) : undefined;
    if (goalDraft.id && !existing) return;

    await onSaveGoal(goalDraft, existing);
    closeGoalEditor();
  };

  const addTask = async () => {
    if (!goalDraft.id || !taskDraft.trim()) return;
    await onAddTask(goalDraft.id, taskDraft.trim());
    setTaskDraft('');
  };

  const showInstallSection = Boolean(installPrompt) || (isIOS() && !isStandalone());

  return (
    <section className="screen life-screen">
      <div className="eyebrow">Edit</div>
      <h1>Life</h1>

      <div className="segmented">
        <button
          type="button"
          className={tab === 'routines' ? 'active' : ''}
          aria-current={tab === 'routines' ? 'page' : undefined}
          onClick={() => { setTab('routines'); setEditorOpen(false); }}
        >
          Routine
        </button>
        <button
          type="button"
          className={tab === 'goals' ? 'active' : ''}
          aria-current={tab === 'goals' ? 'page' : undefined}
          onClick={() => { setTab('goals'); setEditorOpen(false); }}
        >
          Goals
        </button>
      </div>

      <button type="button" className="add-new" onClick={openNew}>
        <span>＋</span>
        Add new {tab === 'routines' ? 'routine' : 'goal'}
      </button>

      {tab === 'routines' && (
        <div className="manage-list">
          {data.routines.map((routine) => (
            <button
              type="button"
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

      {tab === 'goals' && (
        <div className="manage-list">
          {data.goals.map((goal) => {
            const tasks = data.tasks.filter((task) => task.goalId === goal.id);
            const done = tasks.filter((task) => task.status === 'done').length;
            return (
              <button
                type="button"
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

      {editorOpen && tab === 'routines' && (
        <EditorSheet title={routineDraft.id ? 'Edit routine' : 'New routine'} onClose={closeRoutineEditor}>
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
            <span id="routine-schedule-label">Schedule</span>
            <div className="weekday-picker" role="group" aria-labelledby="routine-schedule-label">
              {WEEKDAYS.map((day) => {
                const selected = routineDraft.weekdays.includes(day.value);
                return (
                  <button
                    type="button"
                    key={day.value}
                    className={selected ? 'active' : ''}
                    aria-pressed={selected}
                    aria-label={day.name}
                    onClick={() =>
                      setRoutineDraft({
                        ...routineDraft,
                        weekdays: selected
                          ? routineDraft.weekdays.filter((value) => value !== day.value)
                          : [...routineDraft.weekdays, day.value]
                      })
                    }
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field">
            <span id="routine-timing-label">Time</span>
            <div className="timing-picker" role="group" aria-labelledby="routine-timing-label">
              <button
                type="button"
                className={routineDraft.timing === 'exact' ? 'active' : ''}
                aria-pressed={routineDraft.timing === 'exact'}
                onClick={() => setRoutineDraft({ ...routineDraft, timing: 'exact' })}
              >
                Exact time
              </button>
              <button
                type="button"
                className={routineDraft.timing === 'anytime' ? 'active' : ''}
                aria-pressed={routineDraft.timing === 'anytime'}
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

          <button type="button" className="primary" onClick={() => void saveRoutine()}>
            {routineDraft.id ? 'Save changes' : 'Add routine'}
          </button>

          {routineDraft.id && (
            <button
              type="button"
              className="danger-link"
              onClick={async () => {
                await onDeleteRoutine(routineDraft.id!);
                closeRoutineEditor();
              }}
            >
              Delete routine
            </button>
          )}
        </EditorSheet>
      )}

      {editorOpen && tab === 'goals' && (
        <EditorSheet title={goalDraft.id ? 'Edit goal' : 'New goal'} onClose={closeGoalEditor}>
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

          <button type="button" className="primary" onClick={() => void saveGoal()}>
            {goalDraft.id ? 'Save changes' : 'Add goal'}
          </button>

          {goalDraft.id && (
            <>
              <div className="editor-divider" />
              <div className="field">
                <span>Tasks</span>
                <div className="editor-task-list">
                  {data.tasks
                    .filter((task) => task.goalId === goalDraft.id)
                    .map((task) => (
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
                <div className="task-add">
                  <input
                    value={taskDraft}
                    onChange={(event) => setTaskDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void addTask();
                      }
                    }}
                    placeholder="Add weekly task"
                  />
                  <button type="button" aria-label="Add task" onClick={() => void addTask()}>＋</button>
                </div>
              </div>

              <button
                type="button"
                className="danger-link"
                onClick={async () => {
                  await onDeleteGoal(goalDraft.id!);
                  closeGoalEditor();
                }}
              >
                Delete goal
              </button>
            </>
          )}
        </EditorSheet>
      )}

      {showInstallSection && (
        <section className="utility-section">
          {installPrompt && (
            <button type="button" className="utility-row" onClick={onInstall}>
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
        <EditorSheet title="Data" onClose={onCloseDataMenu}>
          <div className="data-sheet-copy">
            <strong>Local data</strong>
            <span>Ritmo stores your routines, goals and tracking history on this device.</span>
          </div>
          <div className="backup-actions">
            <button type="button" onClick={onExport}>Export backup</button>
            <button type="button" onClick={() => importRef.current?.click()}>Import backup</button>
            <input
              ref={importRef}
              hidden
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                onImport(file);
              }}
            />
          </div>
        </EditorSheet>
      )}
    </section>
  );
}

function formatSchedule(days: number[]) {
  if (days.length === 7) return 'Every day';
  return [...days]
    .sort((a, b) => a - b)
    .map((day) => WEEKDAYS[day - 1]?.label ?? '')
    .join(' · ');
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}
