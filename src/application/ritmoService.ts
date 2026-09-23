import {
  SCHEMA_VERSION,
  type ISODate,
  type Goal,
  type GoalTask,
  type Note,
  type NoteEntry,
  type Routine,
  type RoutineCompletion,
  type RoutineSnapshot,
  type WeekRecord
} from '../domain/types';
import { getRoutineDayStates, hasDayMedal, type RoutineDayState } from '../domain/medal';
import { planForDate, routinesInWeek, withPlanRevision } from '../domain/plan';
import { routineStatus, type RoutineStatus } from '../domain/status';
import { streaks, type Streak } from '../domain/streak';
import {
  addDays,
  dayOfYear,
  daysInMonth,
  daysInYear,
  daysLeftInYear,
  formatRange,
  fromISODate,
  isoWeekday,
  logicalDay,
  minutesIntoDay,
  monthName,
  routineMinutes,
  toISODate,
  weekEnd,
  weekId,
  weekNumber,
  weekStart,
  weeksLeftInYear
} from '../domain/time';
import type { Repositories } from '../repositories/interfaces';
import { DEFAULT_ROUTINES, normalizeRoutineName } from './defaultRoutines';

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export interface DayStrip {
  date: Date;
  medal: boolean;
  isToday: boolean;
  future: boolean;
  /** Day on screen in Today; defaults to the current day. */
  selected: boolean;
  /** Share of the day's scheduled routines done, 0..1. Zero for future days. */
  progress: number;
  /** Lived with the app: false for days before tracking began. */
  tracked: boolean;
}

export interface TodayView {
  /** The day on screen. Not necessarily the current one. */
  date: Date;
  /** The day the user is actually living. */
  today: Date;
  isToday: boolean;
  /** Past and current days can be ticked; days ahead are view-only. */
  editable: boolean;
  routines: RoutineDayState[];
  medal: boolean;
  week: DayStrip[];
  goals: Array<{ goal: Goal; tasks: GoalTask[] }>;
  daysLeft: number;
  weeksLeft: number;
  /** Share of the current year already lived, 0..1. */
  yearProgress: number;
  streak: Streak;
  /** Needed on screen to read clock times against the logical day. */
  dayBoundaryHour: number;
}

export interface WeekDayProgress {
  date: Date;
  scheduled: boolean;
  done: boolean;
  future: boolean;
  /** Not scheduled that day, or where it stands if it was. */
  status: RoutineStatus | 'off';
}

export interface WeekView {
  week: WeekRecord;
  label: string;
  days: DayStrip[];
  routineProgress: Array<{
    routine: RoutineSnapshot;
    days: WeekDayProgress[];
    done: number;
    total: number;
  }>;
  goalProgress: Array<{ goal: Goal; tasks: GoalTask[]; done: number; total: number }>;
  routineDone: number;
  routineTotal: number;
  goalDone: number;
  goalTotal: number;
  tasks: Array<{ task: GoalTask; goal?: Goal }>;
  /** Needed to place a past-midnight routine at the end of the day. */
  dayBoundaryHour: number;
}

export interface MonthDay {
  date: Date;
  medal: boolean;
  /** Tracked and already lived, today included. */
  known: boolean;
  future: boolean;
  isToday: boolean;
  progress: number;
}

export interface MonthView {
  date: Date;
  name: string;
  days: MonthDay[];
  medalCount: number;
  knownDays: number;
  /** Mean share done over the finished tracked days; null before there are any. */
  averageProgress: number | null;
  streak: Streak;
  goals: Array<{ goal: Goal; done: number; total: number }>;
}

export interface YearView {
  year: number;
  daysLeft: number;
  weeksLeft: number;
  currentDay: number;
  totalDays: number;
  months: Array<{ month: number; label: string; medals: number; knownDays: number }>;
}

export interface LifeView {
  routines: Routine[];
  goals: Goal[];
  tasks: GoalTask[];
  /** Needed to place a past-midnight routine at the end of the day. */
  dayBoundaryHour: number;
}

export interface NoteWithEntries {
  note: Note;
  entries: NoteEntry[];
}

export interface NotesView {
  notes: NoteWithEntries[];
}

export class RitmoService {
  private booting?: Promise<void>;
  private boundaryHour = 3;

  constructor(private readonly repos: Repositories) {}

  /** Hour at which a new day starts. Stable once init() has resolved. */
  get dayBoundaryHour() {
    return this.boundaryHour;
  }

  /** The day the user is still living, per the configured boundary. */
  today(at = new Date()) {
    return logicalDay(at, this.boundaryHour);
  }

  /**
   * Safe to call more than once: concurrent callers share one run. Without
   * this, two overlapping inits both see an unseeded database and seed twice.
   */
  init() {
    this.booting ??= this.boot().catch((error) => {
      this.booting = undefined;
      throw error;
    });
    return this.booting;
  }

  private async boot() {
    let settings = await this.repos.settings.get();
    if (!settings) {
      settings = {
        key: 'app',
        schemaVersion: SCHEMA_VERSION,
        installedAt: now(),
        dayBoundaryHour: 3,
        defaultsSeedVersion: 0
      };
      await this.repos.settings.put(settings);
    }

    this.boundaryHour = Number.isInteger(settings.dayBoundaryHour)
      && settings.dayBoundaryHour >= 0
      && settings.dayBoundaryHour < 12
      ? settings.dayBoundaryHour
      : 3;

    if ((settings.defaultsSeedVersion ?? 0) < 1) {
      await this.seedPersonalRoutine();
      settings = { ...settings, defaultsSeedVersion: 1 };
      await this.repos.settings.put(settings);
    }

    await this.ensureWeek(this.today());
  }

  private async seedPersonalRoutine() {
    const existing = await this.repos.routines.list();
    const stamp = now();

    for (const item of DEFAULT_ROUTINES) {
      const normalized = normalizeRoutineName(item.name);
      const found = existing.find((routine) =>
        item.match?.(routine)
        || normalizeRoutineName(routine.name) === normalized
      );

      if (found) {
        if (item.match && item.match(found)) {
          await this.repos.routines.update({
            ...found,
            weekdays: [...item.weekdays],
            timing: item.timing,
            time: item.timing === 'exact' ? item.time : undefined,
            updatedAt: stamp
          });
        }
        continue;
      }

      const routine: Routine = {
        id: id(),
        name: item.name,
        active: true,
        weekdays: [...item.weekdays],
        timing: item.timing,
        time: item.timing === 'exact' ? item.time : undefined,
        createdAt: stamp,
        updatedAt: stamp
      };

      await this.repos.routines.create(routine);
      existing.push(routine);
    }

    await this.refreshCurrentWeekSnapshot();
  }

  async ensureWeek(date: Date): Promise<WeekRecord> {
    const key = weekId(date);
    const existing = await this.repos.weeks.get(key);
    if (existing) return existing;

    const routines = await this.repos.routines.list();
    const start = weekStart(date);
    const end = weekEnd(date);
    const record: WeekRecord = {
      id: key,
      startDate: toISODate(start),
      endDate: toISODate(end),
      year: start.getFullYear(),
      weekNumber: weekNumber(date),
      routinePlan: [{ appliesFrom: toISODate(start), routines: routines.map(toSnapshot) }],
      createdAt: now()
    };
    await this.repos.weeks.put(record);
    return record;
  }

  getToday(at = new Date()): Promise<TodayView> {
    return this.getDay(undefined, at);
  }

  /**
   * Any day of the current week, so a routine forgotten last night can still
   * be ticked off. Anything outside the current week falls back to today.
   */
  async getDay(dayKey?: ISODate, at = new Date()): Promise<TodayView> {
    const today = this.today(at);
    const week = await this.ensureWeek(today);
    await this.rolloverOpenGoalTasks(week, today);

    const todayKey = toISODate(today);
    const inWeek = dayKey !== undefined && dayKey >= week.startDate && dayKey <= week.endDate;
    const dateKey = inWeek ? dayKey : todayKey;
    const date = fromISODate(dateKey);

    const weekCompletions = await this.repos.completions.listBetween(week.startDate, week.endDate);
    const states = getRoutineDayStates(
      planForDate(week, dateKey),
      weekCompletions.filter((item) => item.date === dateKey),
      date
    );

    const goals = (await this.repos.goals.list()).filter((goal) => goal.status === 'active');
    const weekTasks = await this.repos.goalTasks.listByWeek(week.id);

    return {
      date,
      today,
      isToday: dateKey === todayKey,
      editable: dateKey <= todayKey,
      routines: states,
      medal: hasDayMedal(states),
      week: this.buildDayStrip(
        week,
        weekCompletions,
        today,
        await this.trackingStart(await this.repos.weeks.list()),
        dateKey
      ),
      goals: goals
        .map((goal) => ({
          goal,
          tasks: weekTasks.filter(
            (task) => task.goalId === goal.id && (!task.plannedDate || task.plannedDate === dateKey)
          )
        }))
        .filter((item) => item.tasks.length > 0),
      daysLeft: daysLeftInYear(today),
      weeksLeft: weeksLeftInYear(today),
      yearProgress: (dayOfYear(today) - 1) / daysInYear(today.getFullYear()),
      streak: await this.getStreak(today),
      dayBoundaryHour: this.boundaryHour
    };
  }

  /**
   * Medal days in a row, and the best run so far. Walks every tracked day from
   * install to today; a day with no week record was not tracked at all, so it
   * breaks a run rather than being skipped over.
   */
  async getStreak(today = this.today()): Promise<Streak> {
    const weeks = await this.repos.weeks.list();
    const todayKey = toISODate(today);
    const firstKey = await this.trackingStart(weeks);
    if (!firstKey || firstKey > todayKey) return { current: 0, best: 0 };

    const byWeek = new Map(weeks.map((week) => [week.id, week]));
    const byDate = new Map<ISODate, RoutineCompletion[]>();
    for (const completion of await this.repos.completions.listBetween(firstKey, todayKey)) {
      const list = byDate.get(completion.date) ?? [];
      list.push(completion);
      byDate.set(completion.date, list);
    }

    const days: Array<{ key: ISODate; medal: boolean }> = [];
    for (let day = fromISODate(firstKey); toISODate(day) <= todayKey; day = addDays(day, 1)) {
      const key = toISODate(day);
      const week = byWeek.get(weekId(day));
      const medal = week
        ? hasDayMedal(getRoutineDayStates(planForDate(week, key), byDate.get(key) ?? [], day))
        : false;
      days.push({ key, medal });
    }

    return streaks(days, todayKey);
  }

  /**
   * The first day anything was tracked. A week record covers the whole week it
   * was opened in, but days of that week before the install were never lived
   * with the app, so they are not "zero" — they are not tracked at all.
   */
  private async trackingStart(weeks: WeekRecord[]): Promise<ISODate | undefined> {
    if (weeks.length === 0) return undefined;
    const firstWeek = weeks.reduce((first, week) => (week.startDate < first ? week.startDate : first), weeks[0].startDate);
    const settings = await this.repos.settings.get();
    const installed = settings ? toISODate(new Date(settings.installedAt)) : firstWeek;
    return installed > firstWeek ? installed : firstWeek;
  }

  async toggleRoutine(date: Date, routineId: string) {
    // A day that has not happened yet cannot be ticked off.
    if (toISODate(date) > toISODate(this.today())) return;
    // One atomic read-modify-write, so a double tap cannot lose an update.
    await this.repos.completions.toggle(toISODate(date), routineId, now());
  }

  async createRoutine(
    name: string,
    weekdays: number[],
    timing: Routine['timing'] = 'anytime',
    time?: string
  ) {
    const stamp = now();
    const routine: Routine = {
      id: id(),
      name: name.trim(),
      active: true,
      weekdays: sortWeekdays(weekdays),
      timing,
      time: timing === 'exact' ? time : undefined,
      createdAt: stamp,
      updatedAt: stamp
    };
    await this.repos.routines.create(routine);
    await this.refreshCurrentWeekSnapshot();
  }

  async updateRoutine(routine: Routine) {
    await this.repos.routines.update({
      ...routine,
      weekdays: sortWeekdays(routine.weekdays),
      timing: routine.timing ?? 'anytime',
      time: routine.timing === 'exact' ? routine.time : undefined,
      updatedAt: now()
    });
    await this.refreshCurrentWeekSnapshot();
  }

  async deleteRoutine(idToDelete: string) {
    await this.repos.routines.remove(idToDelete);
    await this.refreshCurrentWeekSnapshot();
  }

  /**
   * Records the current routine list as a new plan revision starting today.
   * Days already lived keep the revision they were judged against, so editing
   * routines never retroactively takes away past medals.
   */
  private async refreshCurrentWeekSnapshot() {
    const today = this.today();
    const current = await this.ensureWeek(today);
    const routines = await this.repos.routines.list();
    await this.repos.weeks.put(
      withPlanRevision(current, toISODate(today), routines.map(toSnapshot))
    );
  }

  /**
   * Open tasks left behind in past weeks move to the current week instead of
   * disappearing. Done tasks stay where they were, so past weeks stay honest.
   */
  private async rolloverOpenGoalTasks(week: WeekRecord, today: Date) {
    if (week.id !== weekId(today)) return false;

    const stale = await this.repos.goalTasks.listOpenBeforeWeek(week.id);
    if (stale.length === 0) return false;

    const stamp = now();
    for (const task of stale) {
      await this.repos.goalTasks.update({
        ...task,
        plannedWeekId: week.id,
        plannedDate: undefined,
        updatedAt: stamp
      });
    }
    return true;
  }

  private buildDayStrip(
    week: WeekRecord,
    completions: Awaited<ReturnType<Repositories['completions']['list']>>,
    today: Date,
    trackedFrom: ISODate | undefined,
    selectedKey = toISODate(today)
  ): DayStrip[] {
    const todayKey = toISODate(today);
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(fromISODate(week.startDate), index);
      const key = toISODate(day);
      // A day that has not happened yet cannot have earned anything, and a day
      // before the app was installed was never lived with it.
      const future = key > todayKey;
      const tracked = !future && trackedFrom !== undefined && key >= trackedFrom;
      const states = getRoutineDayStates(
        planForDate(week, key),
        completions.filter((item) => item.date === key),
        day
      );
      return {
        date: day,
        medal: tracked && hasDayMedal(states),
        isToday: key === todayKey,
        future,
        selected: key === selectedKey,
        progress: tracked ? dayProgress(states) : 0,
        tracked
      };
    });
  }

  async createGoal(name: string, startDate: string, endDate: string) {
    const stamp = now();
    await this.repos.goals.create({
      id: id(),
      name: name.trim(),
      startDate,
      endDate,
      status: 'active',
      createdAt: stamp,
      updatedAt: stamp
    });
  }

  async updateGoal(goal: Goal) {
    await this.repos.goals.update({ ...goal, updatedAt: now() });
  }

  async deleteGoal(goalId: string) {
    await this.repos.goals.remove(goalId);
  }

  async addGoalTask(goalId: string, title: string, plannedDate?: string) {
    const week = await this.ensureWeek(plannedDate ? fromISODate(plannedDate) : this.today());
    const stamp = now();
    await this.repos.goalTasks.create({
      id: id(),
      goalId,
      title: title.trim(),
      status: 'open',
      plannedWeekId: week.id,
      plannedDate: plannedDate || undefined,
      createdAt: stamp,
      updatedAt: stamp
    });
  }

  async toggleGoalTask(task: GoalTask) {
    const done = task.status !== 'done';
    await this.repos.goalTasks.update({
      ...task,
      status: done ? 'done' : 'open',
      completedAt: done ? now() : undefined,
      updatedAt: now()
    });
  }

  async getNotes(): Promise<NotesView> {
    const [notes, entries] = await Promise.all([
      this.repos.notes.list(),
      this.repos.noteEntries.list()
    ]);

    // Newest note first; entries stay in the order they were written.
    return {
      notes: [...notes]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((note) => ({
          note,
          entries: entries
            .filter((entry) => entry.noteId === note.id)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        }))
    };
  }

  async createNote(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;

    const stamp = now();
    await this.repos.notes.create({ id: id(), title: trimmed, createdAt: stamp, updatedAt: stamp });
  }

  async renameNote(note: Note, title: string) {
    const trimmed = title.trim();
    if (!trimmed || trimmed === note.title) return;
    await this.repos.notes.update({ ...note, title: trimmed, updatedAt: now() });
  }

  async deleteNote(noteId: string) {
    await this.repos.notes.remove(noteId);
  }

  async addNoteEntry(noteId: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const stamp = now();
    await this.repos.noteEntries.create({
      id: id(),
      noteId,
      text: trimmed,
      createdAt: stamp,
      updatedAt: stamp
    });
  }

  async updateNoteEntry(entry: NoteEntry, text: string) {
    const trimmed = text.trim();
    if (!trimmed || trimmed === entry.text) return;
    await this.repos.noteEntries.update({ ...entry, text: trimmed, updatedAt: now() });
  }

  async deleteNoteEntry(entryId: string) {
    await this.repos.noteEntries.remove(entryId);
  }

  /**
   * Turns an entry into a goal. The entry stays on its note: adding to goals
   * copies it rather than moving it.
   */
  async addEntryToGoals(entry: NoteEntry, startDate: string, endDate: string) {
    await this.createGoal(entry.text, startDate, endDate);
  }

  async getWeek(at = new Date()): Promise<WeekView> {
    const today = this.today(at);
    const week = await this.ensureWeek(today);
    await this.rolloverOpenGoalTasks(week, today);

    const completions = await this.repos.completions.listBetween(week.startDate, week.endDate);
    const tasks = await this.repos.goalTasks.listByWeek(week.id);
    const goals = (await this.repos.goals.list()).filter((goal) => goal.status !== 'paused');
    const goalMap = new Map(goals.map((goal) => [goal.id, goal]));
    const todayKey = toISODate(today);
    const nowMinutes = minutesIntoDay(at, this.boundaryHour);
    const trackedFrom = await this.trackingStart(await this.repos.weeks.list());

    const routineProgress = [...routinesInWeek(week)]
      .filter((routine) => routine.active)
      .sort(byTimeOfDay(this.boundaryHour))
      .map((routine) => {
        const days = Array.from({ length: 7 }, (_, index): WeekDayProgress => {
          const day = addDays(fromISODate(week.startDate), index);
          const key = toISODate(day);
          // A routine only counts on days whose plan revision actually had it.
          const planned = planForDate(week, key)
            .find((item) => item.routineId === routine.routineId);
          // Before tracking began nothing was owed, whatever the plan said.
          const lived = trackedFrom !== undefined && key >= trackedFrom;
          const scheduled = (key > todayKey || lived)
            && Boolean(planned?.active)
            && Boolean(planned?.weekdays.includes(isoWeekday(day)));
          const done = completions.some(
            (item) => item.date === key && item.routineId === routine.routineId && item.done
          );
          const status = scheduled
            ? routineStatus({
                done,
                time: routine.timing === 'exact' ? routine.time : undefined,
                dayKey: key,
                todayKey,
                nowMinutes,
                boundaryHour: this.boundaryHour
              })
            : 'off';
          return { date: day, scheduled, done, future: key > todayKey, status };
        });
        // Days still ahead are not owed yet, so they do not count against the week.
        const scheduledDays = days.filter((item) => item.scheduled && !item.future);
        return {
          routine,
          days,
          done: scheduledDays.filter((item) => item.done).length,
          total: scheduledDays.length
        };
      });

    const goalProgress = goals
      .map((goal) => {
        const goalTasks = tasks.filter((task) => task.goalId === goal.id);
        return {
          goal,
          tasks: goalTasks,
          done: goalTasks.filter((task) => task.status === 'done').length,
          total: goalTasks.length
        };
      })
      .filter((item) => item.total > 0);

    return {
      week,
      label: formatRange(fromISODate(week.startDate), fromISODate(week.endDate)),
      days: this.buildDayStrip(week, completions, today, trackedFrom),
      routineProgress,
      goalProgress,
      routineDone: routineProgress.reduce((sum, item) => sum + item.done, 0),
      routineTotal: routineProgress.reduce((sum, item) => sum + item.total, 0),
      goalDone: goalProgress.reduce((sum, item) => sum + item.done, 0),
      goalTotal: goalProgress.reduce((sum, item) => sum + item.total, 0),
      tasks: tasks.map((task) => ({ task, goal: goalMap.get(task.goalId) })),
      dayBoundaryHour: this.boundaryHour
    };
  }

  async getMonth(at = new Date()): Promise<MonthView> {
    const today = this.today(at);
    const date = today;
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstKey = toISODate(new Date(year, month, 1));
    const lastKey = toISODate(new Date(year, month, daysInMonth(year, month)));

    const allWeeks = await this.repos.weeks.list();
    const trackedFrom = await this.trackingStart(allWeeks);
    const weeks = allWeeks.filter((week) => week.startDate <= lastKey && week.endDate >= firstKey);
    // Bounded by the month via the date index rather than scanning everything.
    const completions = await this.repos.completions.listBetween(firstKey, lastKey);
    const todayKey = toISODate(today);

    const days = Array.from({ length: daysInMonth(year, month) }, (_, index): MonthDay => {
      const day = new Date(year, month, index + 1);
      const key = toISODate(day);
      const week = weeks.find((item) => key >= item.startDate && key <= item.endDate);
      const base = { date: day, future: key > todayKey, isToday: key === todayKey };
      const tracked = week && trackedFrom !== undefined && key >= trackedFrom;
      if (!tracked || key > todayKey) return { ...base, medal: false, known: false, progress: 0 };

      const states = getRoutineDayStates(
        planForDate(week, key),
        completions.filter((item) => item.date === key),
        day
      );
      return { ...base, medal: hasDayMedal(states), known: true, progress: dayProgress(states) };
    });

    const goals = await this.repos.goals.list();
    const tasks = await this.repos.goalTasks.list();
    // Today is still in progress, so it would only drag the average down.
    const finished = days.filter((day) => day.known && !day.isToday);

    return {
      date,
      name: monthName(date),
      days,
      medalCount: days.filter((day) => day.medal).length,
      knownDays: days.filter((day) => day.known).length,
      averageProgress: finished.length
        ? finished.reduce((sum, day) => sum + day.progress, 0) / finished.length
        : null,
      streak: await this.getStreak(today),
      goals: goals.map((goal) => {
        const goalTasks = tasks.filter((task) => task.goalId === goal.id);
        return {
          goal,
          done: goalTasks.filter((task) => task.status === 'done').length,
          total: goalTasks.length
        };
      })
    };
  }

  async getYear(at = new Date()): Promise<YearView> {
    const today = this.today(at);
    const year = today.getFullYear();
    const weeks = (await this.repos.weeks.list()).filter((week) => week.year === year);
    const completions = await this.repos.completions.listBetween(
      toISODate(new Date(year, 0, 1)),
      toISODate(new Date(year, 11, 31))
    );
    const todayKey = toISODate(today);

    const months = Array.from({ length: 12 }, (_, month) => {
      let medals = 0;
      let knownDays = 0;

      for (let day = 1; day <= daysInMonth(year, month); day += 1) {
        const current = new Date(year, month, day);
        const key = toISODate(current);
        if (key > todayKey) continue;

        const week = weeks.find((item) => key >= item.startDate && key <= item.endDate);
        if (!week) continue;

        knownDays += 1;
        const states = getRoutineDayStates(
          planForDate(week, key),
          completions.filter((item) => item.date === key),
          current
        );
        if (hasDayMedal(states)) medals += 1;
      }

      return {
        month,
        label: monthName(new Date(year, month, 1), 'short'),
        medals,
        knownDays
      };
    });

    return {
      year,
      daysLeft: daysLeftInYear(today),
      weeksLeft: weeksLeftInYear(today),
      currentDay: dayOfYear(today),
      totalDays: daysInYear(year),
      months
    };
  }

  async getLife(): Promise<LifeView> {
    const [routines, goals, tasks] = await Promise.all([
      this.repos.routines.list(),
      this.repos.goals.list(),
      this.repos.goalTasks.list()
    ]);
    return {
      routines: [...routines].sort(byTimeOfDay(this.boundaryHour)),
      goals,
      tasks,
      dayBoundaryHour: this.boundaryHour
    };
  }

  exportBackup() {
    return this.repos.backup.exportAll();
  }

  importBackup(payload: Parameters<Repositories['backup']['importAll']>[0]) {
    return this.repos.backup.importAll(payload);
  }
}

/**
 * Share of a day's scheduled routines that are done. A day with nothing
 * scheduled counts as complete, matching the medal rule.
 */
export function dayProgress(states: RoutineDayState[]) {
  const scheduled = states.filter((state) => state.scheduled);
  if (scheduled.length === 0) return states.length > 0 ? 1 : 0;
  return scheduled.filter((state) => state.done).length / scheduled.length;
}

/**
 * Timed routines by their place in the day, anytime ones after them, then by
 * name. A 00:30 routine comes after 23:00 when the day runs past midnight.
 */
function byTimeOfDay(boundaryHour: number) {
  type Sortable = { timing?: Routine['timing']; time?: string; name: string };
  const keyOf = (item: Sortable) =>
    item.timing === 'exact' && item.time ? routineMinutes(item.time, boundaryHour) : Number.POSITIVE_INFINITY;
  return (a: Sortable, b: Sortable) => keyOf(a) - keyOf(b) || a.name.localeCompare(b.name, 'ru');
}

function sortWeekdays(weekdays: number[]) {
  return [...weekdays].sort((a, b) => a - b);
}

function toSnapshot(routine: Routine): RoutineSnapshot {
  return {
    routineId: routine.id,
    name: routine.name,
    active: routine.active,
    weekdays: [...routine.weekdays],
    timing: routine.timing ?? 'anytime',
    time: routine.timing === 'exact' ? routine.time : undefined
  };
}
