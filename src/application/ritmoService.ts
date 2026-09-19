import {
  SCHEMA_VERSION,
  type Goal,
  type GoalTask,
  type Note,
  type Routine,
  type RoutineSnapshot,
  type WeekRecord
} from '../domain/types';
import { getRoutineDayStates, hasDayMedal, type RoutineDayState } from '../domain/medal';
import { planForDate, routinesInWeek, withPlanRevision } from '../domain/plan';
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
  monthName,
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
}

export interface TodayView {
  date: Date;
  routines: RoutineDayState[];
  medal: boolean;
  week: DayStrip[];
  goals: Array<{ goal: Goal; tasks: GoalTask[] }>;
  notes: Note[];
  daysLeft: number;
  weeksLeft: number;
}

export interface WeekDayProgress {
  date: Date;
  scheduled: boolean;
  done: boolean;
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
}

export interface MonthView {
  date: Date;
  name: string;
  days: Array<{ date: Date; medal: boolean; known: boolean }>;
  medalCount: number;
  knownDays: number;
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
}

/** Still to do on top, newest first; anything ticked off sinks below. */
export const sortNotes = (notes: Note[]): Note[] =>
  [...notes].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

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

  async getToday(at = new Date()): Promise<TodayView> {
    const date = this.today(at);
    const week = await this.ensureWeek(date);
    await this.rolloverOpenGoalTasks(week, date);

    const dateKey = toISODate(date);
    const weekCompletions = await this.repos.completions.listBetween(week.startDate, week.endDate);
    const states = getRoutineDayStates(
      planForDate(week, dateKey),
      weekCompletions.filter((item) => item.date === dateKey),
      date
    );

    const goals = (await this.repos.goals.list()).filter((goal) => goal.status === 'active');
    const weekTasks = await this.repos.goalTasks.listByWeek(week.id);
    const notes = await this.repos.notes.list();

    return {
      date,
      routines: states,
      medal: hasDayMedal(states),
      week: this.buildDayStrip(week, weekCompletions, date),
      goals: goals
        .map((goal) => ({
          goal,
          tasks: weekTasks.filter(
            (task) => task.goalId === goal.id && (!task.plannedDate || task.plannedDate === dateKey)
          )
        }))
        .filter((item) => item.tasks.length > 0),
      notes: sortNotes(notes),
      daysLeft: daysLeftInYear(date),
      weeksLeft: weeksLeftInYear(date)
    };
  }

  async toggleRoutine(date: Date, routineId: string) {
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
    today: Date
  ): DayStrip[] {
    const todayKey = toISODate(today);
    return Array.from({ length: 7 }, (_, index) => {
      const day = addDays(fromISODate(week.startDate), index);
      const key = toISODate(day);
      // A day that has not happened yet cannot have earned anything.
      const future = key > todayKey;
      const states = getRoutineDayStates(
        planForDate(week, key),
        completions.filter((item) => item.date === key),
        day
      );
      return {
        date: day,
        medal: !future && hasDayMedal(states),
        isToday: key === todayKey,
        future
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

  async addNote(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const stamp = now();
    await this.repos.notes.create({
      id: id(),
      text: trimmed,
      status: 'open',
      createdAt: stamp,
      updatedAt: stamp
    });
  }

  async toggleNote(note: Note) {
    const done = note.status !== 'done';
    await this.repos.notes.update({
      ...note,
      status: done ? 'done' : 'open',
      completedAt: done ? now() : undefined,
      updatedAt: now()
    });
  }

  async deleteNote(noteId: string) {
    await this.repos.notes.remove(noteId);
  }

  async getWeek(at = new Date()): Promise<WeekView> {
    const today = this.today(at);
    const week = await this.ensureWeek(today);
    await this.rolloverOpenGoalTasks(week, today);

    const completions = await this.repos.completions.listBetween(week.startDate, week.endDate);
    const tasks = await this.repos.goalTasks.listByWeek(week.id);
    const goals = (await this.repos.goals.list()).filter((goal) => goal.status !== 'paused');
    const goalMap = new Map(goals.map((goal) => [goal.id, goal]));

    const routineProgress = routinesInWeek(week)
      .filter((routine) => routine.active)
      .map((routine) => {
        const days = Array.from({ length: 7 }, (_, index) => {
          const day = addDays(fromISODate(week.startDate), index);
          const key = toISODate(day);
          // A routine only counts on days whose plan revision actually had it.
          const planned = planForDate(week, key)
            .find((item) => item.routineId === routine.routineId);
          const scheduled = Boolean(planned?.active)
            && Boolean(planned?.weekdays.includes(isoWeekday(day)));
          const done = completions.some(
            (item) => item.date === key && item.routineId === routine.routineId && item.done
          );
          return { date: day, scheduled, done };
        });
        const scheduledDays = days.filter((item) => item.scheduled);
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
      days: this.buildDayStrip(week, completions, today),
      routineProgress,
      goalProgress,
      routineDone: routineProgress.reduce((sum, item) => sum + item.done, 0),
      routineTotal: routineProgress.reduce((sum, item) => sum + item.total, 0),
      goalDone: goalProgress.reduce((sum, item) => sum + item.done, 0),
      goalTotal: goalProgress.reduce((sum, item) => sum + item.total, 0),
      tasks: tasks.map((task) => ({ task, goal: goalMap.get(task.goalId) }))
    };
  }

  async getMonth(at = new Date()): Promise<MonthView> {
    const today = this.today(at);
    const date = today;
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstKey = toISODate(new Date(year, month, 1));
    const lastKey = toISODate(new Date(year, month, daysInMonth(year, month)));

    const weeks = (await this.repos.weeks.list()).filter(
      (week) => week.startDate <= lastKey && week.endDate >= firstKey
    );
    // Bounded by the month via the date index rather than scanning everything.
    const completions = await this.repos.completions.listBetween(firstKey, lastKey);
    const todayKey = toISODate(today);

    const days = Array.from({ length: daysInMonth(year, month) }, (_, index) => {
      const day = new Date(year, month, index + 1);
      const key = toISODate(day);
      const week = weeks.find((item) => key >= item.startDate && key <= item.endDate);
      if (!week || key > todayKey) return { date: day, medal: false, known: false };

      const states = getRoutineDayStates(
        planForDate(week, key),
        completions.filter((item) => item.date === key),
        day
      );
      return { date: day, medal: hasDayMedal(states), known: true };
    });

    const goals = await this.repos.goals.list();
    const tasks = await this.repos.goalTasks.list();

    return {
      date,
      name: monthName(date),
      days,
      medalCount: days.filter((day) => day.medal).length,
      knownDays: days.filter((day) => day.known).length,
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
    return { routines, goals, tasks };
  }

  exportBackup() {
    return this.repos.backup.exportAll();
  }

  importBackup(payload: Parameters<Repositories['backup']['importAll']>[0]) {
    return this.repos.backup.importAll(payload);
  }
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
