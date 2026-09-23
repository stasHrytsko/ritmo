import { useRef, useState } from 'react';
import type { LifeView } from '../../application/ritmoService';
import type { Goal, GoalTask, Routine } from '../../domain/types';
import { addDays, routineMinutes, toISODate } from '../../domain/time';
import { EditorSheet } from '../components/EditorSheet';
import { Check, ChevronRight } from '../components/icons';
import { Empty, Segmented, type SegmentOption } from '../components/ui';
import { THEME_PREFERENCES, useThemePreference, type ThemePreference } from '../theme';

type LifeTab = 'routines' | 'goals';

const LIFE_TABS: SegmentOption<LifeTab>[] = [
  { value: 'routines', label: 'Рутина' },
  { value: 'goals', label: 'Цели' }
];

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
  { value: 1, label: 'П', short: 'Пн', name: 'Понедельник' },
  { value: 2, label: 'В', short: 'Вт', name: 'Вторник' },
  { value: 3, label: 'С', short: 'Ср', name: 'Среда' },
  { value: 4, label: 'Ч', short: 'Чт', name: 'Четверг' },
  { value: 5, label: 'П', short: 'Пт', name: 'Пятница' },
  { value: 6, label: 'С', short: 'Сб', name: 'Суббота' },
  { value: 7, label: 'В', short: 'Вс', name: 'Воскресенье' }
];

const ALL_WEEKDAYS = WEEKDAYS.map((day) => day.value);

const TIMINGS: SegmentOption<Routine['timing']>[] = [
  { value: 'exact', label: 'Точное время' },
  { value: 'anytime', label: 'В любое время' }
];

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
  onToggleActive,
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
  onToggleActive: (routine: Routine) => Promise<void>;
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
      <h1>Жизнь</h1>

      <Segmented
        options={LIFE_TABS}
        value={tab}
        kind="current"
        onChange={(next) => { setTab(next); setEditorOpen(false); }}
      />

      {/* Keyed by tab, so switching slides the new list in from its side. */}
      <div className={`tab-pane from-${tab === 'goals' ? 'right' : 'left'}`} key={tab}>
        <button type="button" className="add-new" onClick={openNew}>
          <span>＋</span>
          {tab === 'routines' ? 'Новая рутина' : 'Новая цель'}
        </button>

        {tab === 'routines' && (
          <div className="life-groups">
            {groupByTimeOfDay(data.routines, data.dayBoundaryHour).map(([label, routines]) => (
              <section className="life-group" key={label} aria-label={label}>
                <h2 className="life-group-label">{label}</h2>
                <ul className="inset-list">
                  {routines.map((routine) => (
                    <li className={`inset-row${routine.active ? '' : ' is-off'}`} key={routine.id}>
                      <button
                        type="button"
                        className="inset-row-main"
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
                        <strong>{routine.name}</strong>
                        <small>
                          {formatSchedule(routine.weekdays)}
                          {routine.timing === 'exact' && routine.time ? ` · ${routine.time}` : ''}
                        </small>
                      </button>
                      <button
                        type="button"
                        className="switch"
                        role="switch"
                        aria-checked={routine.active}
                        aria-label={`${routine.name}: ${routine.active ? 'включена' : 'выключена'}`}
                        onClick={() => void onToggleActive(routine)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {data.routines.length === 0 && <Empty text="Рутин пока нет." />}
          </div>
        )}

        {tab === 'goals' && (
          <div className="life-groups">
            {data.goals.length > 0 && (
              <ul className="inset-list">
                {data.goals.map((goal) => {
                  const tasks = data.tasks.filter((task) => task.goalId === goal.id);
                  const done = tasks.filter((task) => task.status === 'done').length;
                  return (
                    <li className="inset-row" key={goal.id}>
                      <button
                        type="button"
                        className="inset-row-main"
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
                        <strong>{goal.name}</strong>
                        <small>{formatGoalDates(goal.startDate, goal.endDate)}</small>
                      </button>
                      <span className="inset-row-meta">{done}/{tasks.length}</span>
                      <ChevronRight />
                    </li>
                  );
                })}
              </ul>
            )}
            {data.goals.length === 0 && <Empty text="Целей пока нет." />}
          </div>
        )}
      </div>

      {editorOpen && tab === 'routines' && (
        <EditorSheet title={routineDraft.id ? 'Рутина' : 'Новая рутина'} onClose={closeRoutineEditor}>
          <label className="field">
            <span>Название</span>
            <input
              autoFocus
              value={routineDraft.name}
              onChange={(event) => setRoutineDraft({ ...routineDraft, name: event.target.value })}
              placeholder="Зал, вода, выгулять Локи…"
            />
          </label>

          <div className="field">
            <span id="routine-schedule-label">Дни</span>
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
            <span id="routine-timing-label">Время</span>
            <Segmented
              options={TIMINGS}
              value={routineDraft.timing}
              labelledBy="routine-timing-label"
              onChange={(timing) => setRoutineDraft({ ...routineDraft, timing })}
            />
          </div>

          {routineDraft.timing === 'exact' && (
            <label className="field">
              <span>Во сколько</span>
              <input
                type="time"
                value={routineDraft.time}
                onChange={(event) => setRoutineDraft({ ...routineDraft, time: event.target.value })}
              />
            </label>
          )}

          <button type="button" className="primary" onClick={() => void saveRoutine()}>
            {routineDraft.id ? 'Сохранить' : 'Добавить рутину'}
          </button>

          {routineDraft.id && (
            <button
              type="button"
              className="danger-link"
              onClick={() => void onDeleteRoutine(routineDraft.id!).then(closeRoutineEditor)}
            >
              Удалить рутину
            </button>
          )}
        </EditorSheet>
      )}

      {editorOpen && tab === 'goals' && (
        <EditorSheet title={goalDraft.id ? 'Цель' : 'Новая цель'} onClose={closeGoalEditor}>
          <label className="field">
            <span>Название</span>
            <input
              autoFocus
              value={goalDraft.name}
              onChange={(event) => setGoalDraft({ ...goalDraft, name: event.target.value })}
              placeholder="Выпустить первую игру"
            />
          </label>

          <div className="date-fields">
            <label className="field">
              <span>Начало</span>
              <input
                type="date"
                value={goalDraft.startDate}
                onChange={(event) => setGoalDraft({ ...goalDraft, startDate: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Конец</span>
              <input
                type="date"
                value={goalDraft.endDate}
                onChange={(event) => setGoalDraft({ ...goalDraft, endDate: event.target.value })}
              />
            </label>
          </div>

          <button type="button" className="primary" onClick={() => void saveGoal()}>
            {goalDraft.id ? 'Сохранить' : 'Добавить цель'}
          </button>

          {goalDraft.id && (
            <>
              <div className="editor-divider" />
              <div className="field">
                <span>Задачи</span>
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
                        <span className="check-circle"><Check /></span>
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
                    placeholder="Задача на неделю"
                  />
                  <button type="button" aria-label="Добавить задачу" onClick={() => void addTask()}>＋</button>
                </div>
              </div>

              <button
                type="button"
                className="danger-link"
                onClick={() => void onDeleteGoal(goalDraft.id!).then(closeGoalEditor)}
              >
                Удалить цель
              </button>
            </>
          )}
        </EditorSheet>
      )}

      <section className="utility-section">
        <ThemePicker />
      </section>

      {showInstallSection && (
        <section className="utility-section">
          {installPrompt && (
            <button type="button" className="utility-row" onClick={onInstall}>
              <span><strong>Установить Ritmo</strong><small>Иконка на главном экране</small></span>
              <ChevronRight />
            </button>
          )}
          {isIOS() && !isStandalone() && (
            <div className="ios-hint">
              <strong>На экран «Домой»</strong>
              <span>Safari → Поделиться → На экран «Домой»</span>
            </div>
          )}
        </section>
      )}

      {dataMenuOpen && (
        <EditorSheet title="Данные" onClose={onCloseDataMenu}>
          <div className="data-sheet-copy">
            <strong>Данные на устройстве</strong>
            <span>Рутины, цели и вся история отметок хранятся только на этом устройстве.</span>
          </div>
          <div className="backup-actions">
            <button type="button" onClick={onExport}>Сохранить бэкап</button>
            <button type="button" onClick={() => importRef.current?.click()}>Восстановить из бэкапа</button>
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

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Как в системе',
  light: 'Светлая',
  dark: 'Тёмная'
};

function ThemePicker() {
  const [preference, choose] = useThemePreference();

  return (
    <div className="field theme-field">
      <span id="theme-label">Тема</span>
      <Segmented
        options={THEME_PREFERENCES.map((option) => ({ value: option, label: THEME_LABELS[option] }))}
        value={preference}
        labelledBy="theme-label"
        onChange={choose}
      />
    </div>
  );
}

const GROUPS = ['Утро', 'День', 'Вечер', 'В любое время'] as const;

/**
 * Routines split by part of the day, in the day's own order. A routine past
 * midnight belongs to the evening it ends, not the morning.
 */
function groupByTimeOfDay(routines: Routine[], boundaryHour: number) {
  const groups = new Map<(typeof GROUPS)[number], Routine[]>(GROUPS.map((label) => [label, []]));
  for (const routine of routines) {
    if (routine.timing !== 'exact' || !routine.time) {
      groups.get('В любое время')!.push(routine);
      continue;
    }
    const minutes = routineMinutes(routine.time, boundaryHour);
    const label = minutes < 12 * 60 ? 'Утро' : minutes < 18 * 60 ? 'День' : 'Вечер';
    groups.get(label)!.push(routine);
  }
  return [...groups].filter(([, items]) => items.length > 0);
}

/** «1 окт — 31 дек», with the year only when it is not this one. */
function formatGoalDates(start: string, end: string) {
  const thisYear = new Date().getFullYear();
  const format = (iso: string) => {
    const date = new Date(`${iso}T00:00:00`);
    const text = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' })
      .format(date)
      .replace('.', '');
    return date.getFullYear() === thisYear ? text : `${text} ${date.getFullYear()}`;
  };
  return `${format(start)} — ${format(end)}`;
}

function formatSchedule(days: number[]) {
  if (days.length === 7) return 'Каждый день';
  const key = [...days].sort((a, b) => a - b).join(',');
  if (key === '1,2,3,4,5') return 'По будням';
  if (key === '6,7') return 'По выходным';
  return [...days]
    .sort((a, b) => a - b)
    .map((day) => WEEKDAYS[day - 1]?.short ?? '')
    .join(', ');
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}
