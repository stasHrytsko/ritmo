import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GoalTask } from '../domain/types';
import { logicalDayKey, toISODate } from '../domain/time';
import { describeBackup, parseBackup } from '../domain/backup';
import { repositories } from '../infrastructure/repositories';
import {
  RitmoService,
  type LifeView,
  type MonthView,
  type NotesView,
  type TodayView,
  type WeekView,
  type YearView
} from '../application/ritmoService';
import { NavButton } from './components/BottomNav';
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

const TOPBAR_LABELS: Partial<Record<View, string>> = { day: 'Today', notes: 'Notes' };

export function App() {
  const service = useMemo(() => new RitmoService(repositories), []);
  const [view, setView] = useState<View>('day');
  const [screen, setScreen] = useState<Screen | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Only the newest request is allowed to paint, so a slow response from a
  // screen the user already left cannot overwrite the one they are looking at.
  const pending = useRef(0);

  const load = useCallback(async (target: View): Promise<Screen> => {
    if (target === 'day') return { view: 'day', data: await service.getToday() };
    if (target === 'week') return { view: 'week', data: await service.getWeek() };
    if (target === 'month') return { view: 'month', data: await service.getMonth() };
    if (target === 'year') return { view: 'year', data: await service.getYear() };
    if (target === 'notes') return { view: 'notes', data: await service.getNotes() };
    return { view: 'life', data: await service.getLife() };
  }, [service]);

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
  const dayKey = screen?.view === 'day' ? toISODate(screen.data.date) : null;
  useEffect(() => {
    if (!dayKey) return;
    const timer = window.setInterval(() => {
      if (logicalDayKey(new Date(), service.dayBoundaryHour) !== dayKey) void refresh('day');
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

  const navigate = (target: View) => {
    if (target === view) return;
    setScreen(null);
    setView(target);
    setDataMenuOpen(false);
    void refresh(target);
  };

  const toggleRoutine = async (routineId: string) => {
    if (screen?.view !== 'day') return;
    await service.toggleRoutine(screen.data.date, routineId);
    await refresh('day');
  };

  const toggleTask = async (task: GoalTask) => {
    await service.toggleGoalTask(task);
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
        `Restore ${describeBackup(payload)}?\n\n`
        + 'This replaces everything currently stored on this device.'
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => navigate('day')}>Ritmo<span>.</span></button>
        {view === 'life' ? (
          <button
            type="button"
            className="topbar-menu"
            aria-label="Data menu"
            onClick={() => setDataMenuOpen(true)}
          >
            ⋯
          </button>
        ) : (
          <div className="topbar-mark">{TOPBAR_LABELS[view] ?? 'Progress'}</div>
        )}
      </header>

      <main className={busy ? 'loading' : ''}>
        {error && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Something went wrong</strong>
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => void (screen ? refresh(view) : start())}>Retry</button>
          </div>
        )}
        {busy && !screen && !error && (
          <div className="screen-loader" role="status" aria-live="polite">
            <span />
            <small>Loading</small>
          </div>
        )}

        {screen?.view === 'day' && (
          <TodayScreen
            data={screen.data}
            onToggleRoutine={toggleRoutine}
            onToggleTask={toggleTask}
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

        {screen?.view === 'notes' && (
          <NotesScreen
            data={screen.data}
            onCreateNote={async (title) => {
              await service.createNote(title);
              await refresh('notes');
            }}
            onRenameNote={async (note, title) => {
              await service.renameNote(note, title);
              await refresh('notes');
            }}
            onDeleteNote={async (noteId) => {
              await service.deleteNote(noteId);
              await refresh('notes');
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
              await service.deleteNoteEntry(entryId);
              await refresh('notes');
            }}
            onAddEntryToGoals={async (entry, startDate, endDate) => {
              await service.addEntryToGoals(entry, startDate, endDate);
              await refresh('notes');
            }}
          />
        )}

        {screen?.view === 'life' && (
          <LifeScreen
            data={screen.data}
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
              await service.deleteRoutine(id);
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
              await service.deleteGoal(id);
              await refresh('life');
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

      <footer className="bottom-nav">
        <NavButton label="Today" icon="today" active={view === 'day'} onClick={() => navigate('day')} />
        <NavButton
          label="Progress"
          icon="week"
          active={isProgress(view)}
          onClick={() => navigate(isProgress(view) ? view : 'week')}
        />
        <NavButton label="Life" icon="life" active={view === 'life'} onClick={() => navigate('life')} />
        <NavButton label="Notes" icon="notes" active={view === 'notes'} onClick={() => navigate('notes')} />
      </footer>
    </div>
  );
}

function describeError(cause: unknown) {
  if (cause instanceof Error && cause.message) return cause.message;
  return 'Unexpected error. Your data has not been changed.';
}
