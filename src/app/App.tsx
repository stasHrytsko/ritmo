import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GoalTask, ISODate } from '../domain/types';
import { logicalDayKey, plural, toISODate } from '../domain/time';
import { describeBackup, parseBackup } from '../domain/backup';
import { hasDayMedal } from '../domain/medal';
import { repositories } from '../infrastructure/repositories';
import {
  RitmoService,
  type LifeView,
  type MonthView,
  type NotesView,
  type TodayView,
  type WeekView,
  type YearView,
  dayProgress
} from '../application/ritmoService';
import { NavButton } from './components/BottomNav';
import { StreakMark } from './components/icons';
import { UndoToast } from './components/UndoToast';
import type { PeriodView } from './components/ui';
import { TodayScreen } from './views/TodayScreen';
import { ProgressScreen } from './views/ProgressScreen';
import { LifeScreen, type BeforeInstallPromptEvent } from './views/LifeScreen';
import { NotesScreen } from './views/NotesScreen';

type View = 'day' | PeriodView | 'life' | 'notes';

/**
 * One screen's data, tied to the view it belongs to. The union is what lets
 * every screen below take a real type instead of guessing at runtime.
 */
type Screen =
  | { view: 'day'; data: TodayView }
  | { view: 'week'; data: WeekView }
  | { view: 'month'; data: MonthView }
  | { view: 'year'; data: YearView }
  | { view: 'life'; data: LifeView }
  | { view: 'notes'; data: NotesView };

const isProgress = (view: View): view is PeriodView =>
  view === 'week' || view === 'month' || view === 'year';

const TOPBAR_LABELS: Partial<Record<View, string>> = { day: 'Сегодня', notes: 'Заметки' };

/** How long a removal can be taken back before it is written. */
const UNDO_MS = 5000;

/**
 * A removal the user can still take back. Nothing is deleted until the offer
 * runs out: the item is only hidden, so undoing needs no restore at all, and
 * a history that vanished by mistake is simply still there.
 */
interface PendingDelete {
  key: string;
  label: string;
  ids: ReadonlySet<string>;
  commit: () => Promise<void>;
}

export function App() {
  const service = useMemo(() => new RitmoService(repositories), []);
  const [view, setView] = useState<View>('day');
  const [screen, setScreen] = useState<Screen | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  // Something new landed in Life from a note; the tab says so until visited.
  const [lifeBadge, setLifeBadge] = useState(false);
  const pendingDeleteRef = useRef<PendingDelete | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);
  const viewRef = useRef(view);
  viewRef.current = view;
  // Which day Today shows. Undefined means the current day, whatever it is.
  const [selectedDay, setSelectedDay] = useState<ISODate | undefined>();
  const selectedDayRef = useRef(selectedDay);
  selectedDayRef.current = selectedDay;

  // Only the newest request is allowed to paint, so a slow response from a
  // screen the user already left cannot overwrite the one they are looking at.
  const pending = useRef(0);

  const load = useCallback(async (target: View): Promise<Screen> => {
    if (target === 'day') return { view: 'day', data: await service.getDay(selectedDayRef.current) };
    if (target === 'week') return { view: 'week', data: await service.getWeek() };
    if (target === 'month') return { view: 'month', data: await service.getMonth() };
    if (target === 'year') return { view: 'year', data: await service.getYear() };
    if (target === 'notes') return { view: 'notes', data: await service.getNotes() };
    return { view: 'life', data: await service.getLife() };
  }, [service]);

  /**
   * Loads a screen without hiding or dimming the one already painted: the old
   * screen stays until the new data is in, so taps and tab switches never
   * flash a loader.
   */
  const refresh = useCallback(async (target: View) => {
    const ticket = ++pending.current;
    setBusy(true);
    try {
      const next = await load(target);
      if (ticket !== pending.current) return;
      setScreen(next);
      setError(null);
    } catch (cause) {
      if (ticket === pending.current) setError(describeError(cause));
    } finally {
      if (ticket === pending.current) setBusy(false);
    }
  }, [load]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await service.init();
    } catch (cause) {
      // Storage can be unavailable entirely: private browsing, a full quota, a
      // corrupted database. Without this the app just span forever.
      setError(describeError(cause));
      setBusy(false);
      return;
    }
    await refresh('day');
  }, [service, refresh]);

  useEffect(() => {
    void start();
  }, [start]);

  // The day can roll over while the app sits open. Poll cheaply and only act
  // when the logical day actually changes.
  const dayKey = screen?.view === 'day' ? toISODate(screen.data.today) : null;
  useEffect(() => {
    if (!dayKey) return;
    const timer = window.setInterval(() => {
      if (logicalDayKey(new Date(), service.dayBoundaryHour) !== dayKey) {
        setSelectedDay(undefined);
        selectedDayRef.current = undefined;
        void refresh('day');
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [dayKey, service, refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  /** Writes the pending removal now, if there is one. */
  const flushDelete = useCallback(async () => {
    const pendingNow = pendingDeleteRef.current;
    if (!pendingNow) return;
    window.clearTimeout(undoTimer.current);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
    try {
      await pendingNow.commit();
    } catch (cause) {
      setError(describeError(cause));
    }
    await refresh(viewRef.current);
  }, [refresh]);

  const scheduleDelete = useCallback(async (label: string, ids: string[], commit: () => Promise<void>) => {
    // One offer at a time: a second removal settles the first.
    await flushDelete();
    const next: PendingDelete = { key: crypto.randomUUID(), label, ids: new Set(ids), commit };
    pendingDeleteRef.current = next;
    setPendingDelete(next);
    undoTimer.current = window.setTimeout(() => void flushDelete(), UNDO_MS);
  }, [flushDelete]);

  const undoDelete = () => {
    window.clearTimeout(undoTimer.current);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
  };

  // Leaving the app settles a pending removal instead of silently dropping it.
  useEffect(() => {
    const settle = () => {
      if (document.visibilityState === 'hidden') void flushDelete();
    };
    document.addEventListener('visibilitychange', settle);
    window.addEventListener('pagehide', settle);
    return () => {
      document.removeEventListener('visibilitychange', settle);
      window.removeEventListener('pagehide', settle);
    };
  }, [flushDelete]);

  const navigate = (target: View) => {
    if (target === view) return;
    void flushDelete();
    // Leaving Today always brings you back to the current day next time.
    if (target !== 'day') {
      setSelectedDay(undefined);
      selectedDayRef.current = undefined;
    }
    setView(target);
    setDataMenuOpen(false);
    void refresh(target);
  };

  const selectDay = (key: ISODate | undefined) => {
    if (screen?.view !== 'day') return;
    const next = key === toISODate(screen.data.today) ? undefined : key;
    setSelectedDay(next);
    selectedDayRef.current = next;
    void refresh('day');
  };

  /**
   * The tick shows straight away; the write and a quiet reload follow. If the
   * write fails, the reload puts the screen back to what is really stored.
   */
  const toggleRoutine = async (routineId: string) => {
    if (screen?.view !== 'day' || !screen.data.editable) return;
    const data = screen.data;
    setScreen({ view: 'day', data: withToggledRoutine(data, routineId) });
    try {
      await service.toggleRoutine(data.date, routineId);
    } catch (cause) {
      setError(describeError(cause));
    }
    await refresh('day');
  };

  const toggleTask = async (task: GoalTask) => {
    if (screen?.view === 'day') {
      setScreen({ view: 'day', data: withToggledTask(screen.data, task.id) });
    }
    try {
      await service.toggleGoalTask(task);
    } catch (cause) {
      setError(describeError(cause));
    }
    await refresh(view);
  };

  const exportBackup = async () => {
    try {
      const backup = await service.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ritmo-backup-${toISODate(new Date())}.json`;
      anchor.click();
      // Revoking in the same tick can cancel the download in some browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(describeError(cause));
    }
  };

  const importBackup = async (file?: File) => {
    if (!file) return;

    try {
      // Parse and validate first, so a broken file is rejected before the
      // user is asked to give up what they already have.
      const payload = parseBackup(JSON.parse(await file.text()));

      const confirmed = window.confirm(
        `Восстановить: ${describeBackup(payload)}?\n\n`
        + 'Всё, что сейчас хранится на этом устройстве, будет заменено.'
      );
      if (!confirmed) return;

      await service.importBackup(payload);
      setDataMenuOpen(false);
      await refresh('life');
    } catch (cause) {
      setError(describeError(cause));
    }
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') setInstallPrompt(null);
  };

  const shown = screen && pendingDelete ? withoutIds(screen, pendingDelete.ids) : screen;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => navigate('day')}>Ritmo<span>.</span></button>
        {view === 'life' ? (
          <button
            type="button"
            className="topbar-menu"
            aria-label="Данные"
            onClick={() => setDataMenuOpen(true)}
          >
            ⋯
          </button>
        ) : (
          <TopbarMark view={view} screen={screen} />
        )}
      </header>

      <main>
        {error && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Что-то пошло не так</strong>
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => void (screen ? refresh(view) : start())}>Повторить</button>
          </div>
        )}
        {busy && !screen && !error && (
          <div className="screen-loader" role="status" aria-live="polite">
            <span />
            <small>Загрузка</small>
          </div>
        )}

        {shown?.view === 'day' && (
          <TodayScreen
            data={shown.data}
            onToggleRoutine={toggleRoutine}
            onToggleTask={toggleTask}
            onSelectDay={selectDay}
          />
        )}

        {screen?.view === 'week' && (
          <ProgressScreen screen={{ view: 'week', data: screen.data }} onChange={navigate} />
        )}
        {screen?.view === 'month' && (
          <ProgressScreen screen={{ view: 'month', data: screen.data }} onChange={navigate} />
        )}
        {screen?.view === 'year' && (
          <ProgressScreen screen={{ view: 'year', data: screen.data }} onChange={navigate} />
        )}

        {shown?.view === 'notes' && (
          <NotesScreen
            data={shown.data}
            onCreateNote={async (title) => {
              await service.createNote(title);
              await refresh('notes');
            }}
            onRenameNote={async (note, title) => {
              await service.renameNote(note, title);
              await refresh('notes');
            }}
            onDeleteNote={async (noteId) => {
              const note = screen?.view === 'notes'
                ? screen.data.notes.find((item) => item.note.id === noteId)
                : undefined;
              await scheduleDelete(
                note ? `Заметка «${note.note.title}» удалена` : 'Заметка удалена',
                [noteId, ...(note?.entries.map((entry) => entry.id) ?? [])],
                () => service.deleteNote(noteId)
              );
            }}
            onAddEntry={async (noteId, text) => {
              await service.addNoteEntry(noteId, text);
              await refresh('notes');
            }}
            onUpdateEntry={async (entry, text) => {
              await service.updateNoteEntry(entry, text);
              await refresh('notes');
            }}
            onDeleteEntry={async (entryId) => {
              await scheduleDelete('Запись удалена', [entryId], () => service.deleteNoteEntry(entryId));
            }}
            onConvertEntry={async (entry, text, target) => {
              // An edit made in the same sheet travels with the conversion.
              const current = text !== entry.text ? { ...entry, text } : entry;
              if (current !== entry) await service.updateNoteEntry(entry, text);
              if (target.kind === 'goal') {
                await service.entryToGoal(current, target.startDate, target.endDate);
              } else if (target.kind === 'task') {
                await service.entryToGoalTask(current, target.goalId);
              } else {
                await service.entryToRoutine(current, target.weekdays, target.timing, target.time);
              }
              setLifeBadge(true);
              await refresh('notes');
            }}
          />
        )}

        {shown?.view === 'life' && (
          <LifeScreen
            data={shown.data}
            dataMenuOpen={dataMenuOpen}
            installPrompt={installPrompt}
            onSaveRoutine={async (draft, existing) => {
              if (existing) {
                await service.updateRoutine({
                  ...existing,
                  name: draft.name.trim(),
                  weekdays: draft.weekdays,
                  timing: draft.timing,
                  time: draft.timing === 'exact' ? draft.time : undefined
                });
              } else {
                await service.createRoutine(
                  draft.name,
                  draft.weekdays,
                  draft.timing,
                  draft.timing === 'exact' ? draft.time : undefined
                );
              }
              await refresh('life');
            }}
            onDeleteRoutine={async (id) => {
              const routine = screen?.view === 'life'
                ? screen.data.routines.find((item) => item.id === id)
                : undefined;
              await scheduleDelete(
                routine ? `Рутина «${routine.name}» удалена` : 'Рутина удалена',
                [id],
                () => service.deleteRoutine(id)
              );
            }}
            onToggleActive={async (routine) => {
              await service.updateRoutine({ ...routine, active: !routine.active });
              await refresh('life');
            }}
            onSaveGoal={async (draft, existing) => {
              if (existing) {
                await service.updateGoal({
                  ...existing,
                  name: draft.name.trim(),
                  startDate: draft.startDate,
                  endDate: draft.endDate
                });
              } else {
                await service.createGoal(draft.name, draft.startDate, draft.endDate);
              }
              await refresh('life');
            }}
            onDeleteGoal={async (id) => {
              const goal = screen?.view === 'life'
                ? screen.data.goals.find((item) => item.id === id)
                : undefined;
              await scheduleDelete(
                goal ? `Цель «${goal.name}» удалена` : 'Цель удалена',
                [id],
                () => service.deleteGoal(id)
              );
            }}
            onAddTask={async (goalId, title) => {
              await service.addGoalTask(goalId, title);
              await refresh('life');
            }}
            onToggleTask={toggleTask}
            onCloseDataMenu={() => setDataMenuOpen(false)}
            onExport={() => void exportBackup()}
            onImport={(file) => void importBackup(file)}
            onInstall={() => void installApp()}
          />
        )}
      </main>

      {pendingDelete && (
        <UndoToast
          key={pendingDelete.key}
          label={pendingDelete.label}
          durationMs={UNDO_MS}
          onUndo={undoDelete}
        />
      )}

      <footer className="bottom-nav">
        <NavButton label="Сегодня" icon="today" active={view === 'day'} onClick={() => navigate('day')} />
        <NavButton
          label="Прогресс"
          icon="week"
          active={isProgress(view)}
          onClick={() => navigate(isProgress(view) ? view : 'week')}
        />
        <NavButton
          label="Жизнь"
          icon="life"
          active={view === 'life'}
          badge={lifeBadge}
          onClick={() => { setLifeBadge(false); navigate('life'); }}
        />
        <NavButton label="Заметки" icon="notes" active={view === 'notes'} onClick={() => navigate('notes')} />
      </footer>
    </div>
  );
}

function describeError(cause: unknown) {
  if (cause instanceof Error && cause.message) return cause.message;
  return 'Неожиданная ошибка. Данные не изменились.';
}

/** Today with one routine flipped, medal and strip recomputed to match. */
function withToggledRoutine(data: TodayView, routineId: string): TodayView {
  const routines = data.routines.map((state) => {
    if (state.routine.routineId !== routineId) return state;
    const done = !state.done;
    return { ...state, done, satisfied: state.scheduled ? done : true };
  });
  const medal = hasDayMedal(routines);
  const dateKey = toISODate(data.date);
  // Closing or reopening today moves the run by one; the quiet reload that
  // follows confirms it from storage.
  const shift = data.isToday && medal !== data.medal ? (medal ? 1 : -1) : 0;
  const current = Math.max(0, data.streak.current + shift);
  return {
    ...data,
    routines,
    medal,
    streak: { current, best: Math.max(data.streak.best, current) },
    week: data.week.map((day) =>
      toISODate(day.date) === dateKey ? { ...day, medal, progress: dayProgress(routines) } : day
    )
  };
}

function withToggledTask(data: TodayView, taskId: string): TodayView {
  return {
    ...data,
    goals: data.goals.map((group) => ({
      ...group,
      tasks: group.tasks.map((task) =>
        task.id === taskId ? { ...task, status: task.status === 'done' ? 'open' : 'done' } : task
      )
    }))
  };
}

/** A screen with the items of a pending removal left out. */
function withoutIds(screen: Screen, ids: ReadonlySet<string>): Screen {
  if (screen.view === 'life') {
    return {
      view: 'life',
      data: {
        ...screen.data,
        routines: screen.data.routines.filter((routine) => !ids.has(routine.id)),
        goals: screen.data.goals.filter((goal) => !ids.has(goal.id)),
        tasks: screen.data.tasks.filter((task) => !ids.has(task.goalId))
      }
    };
  }
  if (screen.view === 'notes') {
    return {
      view: 'notes',
      data: {
        ...screen.data,
        notes: screen.data.notes
          .filter((item) => !ids.has(item.note.id))
          .map((item) => ({ ...item, entries: item.entries.filter((entry) => !ids.has(entry.id)) }))
      }
    };
  }
  if (screen.view === 'day') {
    return {
      view: 'day',
      data: {
        ...screen.data,
        routines: screen.data.routines.filter((state) => !ids.has(state.routine.routineId))
      }
    };
  }
  return screen;
}

/**
 * The right-hand side of the top bar: the running streak on Today, a plain
 * label elsewhere.
 */
function TopbarMark({ view, screen }: { view: View; screen: Screen | null }) {
  if (screen?.view === 'day') {
    if (!screen.data.isToday) return <div className="topbar-mark">День</div>;
    const { current } = screen.data.streak;
    if (current > 0) {
      return (
        <div className="streak-chip" aria-label={`Серия: ${current} ${plural(current, ['день', 'дня', 'дней'])} подряд`}>
          <StreakMark />
          <span>{current} {plural(current, ['день', 'дня', 'дней'])} подряд</span>
        </div>
      );
    }
  }
  return <div className="topbar-mark">{TOPBAR_LABELS[view] ?? 'Прогресс'}</div>;
}
