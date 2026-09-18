import { SCHEMA_VERSION, type Goal, type GoalTask, type Routine, type RoutineSnapshot, type WeekRecord } from '../domain/types';
import { getRoutineDayStates, hasDayMedal } from '../domain/medal';
import { planForDate, routinesInWeek, withPlanRevision } from '../domain/plan';
import {
  addDays,
  daysInMonth,
  daysLeftInYear,
  formatRange,
  fromISODate,
  isoWeekday,
  monthName,
  toISODate,
  weekEnd,
  weekId,
  weekNumber,
  weekStart,
  weeksLeftInYear
} from '../domain/time';
import type { Repositories } from '../repositories/interfaces';

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export interface TodayView {
  date: Date;
  routines: ReturnType<typeof getRoutineDayStates>;
  medal: boolean;
  goals: Array<{ goal: Goal; tasks: GoalTask[] }>;
  daysLeft: number;
  weeksLeft: number;
}

export class RitmoService {
  private booting?: Promise<void>;

  constructor(private readonly repos: Repositories) {}

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

    if ((settings.defaultsSeedVersion ?? 0) < 1) {
      await this.seedPersonalRoutine();
      settings = {
        ...settings,
        defaultsSeedVersion: 1
      };
      await this.repos.settings.put(settings);
    }

    await this.ensureWeek(new Date());
  }

  private async seedPersonalRoutine() {
    const existing = await this.repos.routines.list();
    const stamp = now();
    const everyDay = [1, 2, 3, 4, 5, 6, 7];
    const workDays = [1, 2, 3, 4, 5];

    const defaults: Array<{
      name: string;
      weekdays: number[];
      timing: Routine['timing'];
      time?: string;
      match?: (routine: Routine) => boolean;
    }> = [
      { name: 'Подъём + стакан воды', weekdays: everyDay, timing: 'exact', time: '07:30' },
      { name: 'Зарядка 10–15 мин', weekdays: everyDay, timing: 'exact', time: '07:40' },
      { name: 'Душ', weekdays: everyDay, timing: 'exact', time: '08:00' },
      { name: 'Завтрак', weekdays: everyDay, timing: 'exact', time: '08:15' },
      {
        name: 'Выгулить Локи',
        weekdays: everyDay,
        timing: 'exact',
        time: '08:30',
        match: (routine) => normalizeRoutineName(routine.name).includes('локи')
      },
      { name: 'На работу', weekdays: workDays, timing: 'exact', time: '08:40' },
      { name: 'Обед', weekdays: everyDay, timing: 'exact', time: '13:00' },
      { name: 'Ходьба 15 мин · после обеда', weekdays: everyDay, timing: 'exact', time: '13:15' },
      { name: 'Перекус при голоде', weekdays: everyDay, timing: 'exact', time: '17:00' },
      { name: 'Ходьба 15 мин · вечером', weekdays: everyDay, timing: 'exact', time: '17:10' },
      { name: 'Домой', weekdays: workDays, timing: 'exact', time: '18:00' },
      { name: 'Физическая активность 40 мин', weekdays: everyDay, timing: 'exact', time: '19:00' },
      { name: 'Ужин', weekdays: everyDay, timing: 'exact', time: '20:00' },
      { name: 'Ходьба 15 мин · после ужина', weekdays: everyDay, timing: 'exact', time: '20:30' },
      { name: 'Больше не есть', weekdays: everyDay, timing: 'exact', time: '22:00' },
      { name: 'Сон', weekdays: everyDay, timing: 'exact', time: '23:00' },
      {
        name: 'Разминаться на работе каждые ~2 часа',
        weekdays: workDays,
        timing: 'anytime'
      }
    ];

    for (const item of defaults) {
      const normalized = normalizeRoutineName(item.name);
      const found = existing.find((routine) =>
        item.match?.(routine)
        || normalizeRoutineName(routine.name) === normalized
      );

      if (found) {
        if (item.match && item.match(found)) {
          const updated: Routine = {
            ...found,
            weekdays: [...item.weekdays],
            timing: item.timing,
            time: item.timing === 'exact' ? item.time : undefined,
            updatedAt: stamp
          };
          await this.repos.routines.update(updated);
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
      routinePlan: [{
        appliesFrom: toISODate(start),
        routines: routines.map(toSnapshot)
      }],
      createdAt: now()
    };
    await this.repos.weeks.put(record);
    return record;
  }

  async getToday(date = new Date()): Promise<TodayView> {
    const week = await this.ensureWeek(date);
    await this.rolloverOpenGoalTasks(week);
    const dateKey = toISODate(date);
    const completions = await this.repos.completions.listByDate(dateKey);
    const states = getRoutineDayStates(planForDate(week, dateKey), completions, date);
    const goals = (await this.repos.goals.list()).filter((goal) => goal.status === 'active');
    const weekTasks = await this.repos.goalTasks.listByWeek(week.id);

    return {
      date,
      routines: states,
      medal: hasDayMedal(states),
      goals: goals
        .map((goal) => ({
          goal,
          tasks: weekTasks.filter(
            (task) => task.goalId === goal.id && (!task.plannedDate || task.plannedDate === dateKey)
          )
        }))
        .filter((item) => item.tasks.length > 0),
      daysLeft: daysLeftInYear(date),
      weeksLeft: weeksLeftInYear(date)
    };
  }

  async toggleRoutine(date: Date, routineId: string) {
    const dateKey = toISODate(date);
    const current = (await this.repos.completions.listByDate(dateKey))
      .find((item) => item.routineId === routineId);
    const done = !(current?.done === true);

    await this.repos.completions.put({
      id: `${dateKey}:${routineId}`,
      date: dateKey,
      routineId,
      done,
      completedAt: done ? now() : undefined
    });
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
      weekdays: [...weekdays].sort(),
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
  private async refreshCurrentWeekSnapshot(today = new Date()) {
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
  private async rolloverOpenGoalTasks(week: WeekRecord) {
    if (week.id !== weekId(new Date())) return false;

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
    const currentWeek = await this.ensureWeek(plannedDate ? fromISODate(plannedDate) : new Date());
    const stamp = now();
    await this.repos.goalTasks.create({
      id: id(),
      goalId,
      title: title.trim(),
      status: 'open',
      plannedWeekId: currentWeek.id,
      plannedDate: plannedDate || undefined,
      createdAt: stamp,
      updatedAt: stamp
    });
  }

  async toggleGoalTask(task: GoalTask) {
    await this.repos.goalTasks.update({
      ...task,
      status: task.status === 'done' ? 'open' : 'done',
      completedAt: task.status === 'done' ? undefined : now(),
      updatedAt: now()
    });
  }

  async getWeek(date = new Date()) {
    const week = await this.ensureWeek(date);
    await this.rolloverOpenGoalTasks(week);
    const completions = await this.repos.completions.listBetween(week.startDate, week.endDate);
    const tasks = await this.repos.goalTasks.listByWeek(week.id);
    const goals = (await this.repos.goals.list()).filter((goal) => goal.status !== 'paused');
    const goalMap = new Map(goals.map((goal) => [goal.id, goal]));

    const days = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(fromISODate(week.startDate), index);
      const key = toISODate(day);
      const states = getRoutineDayStates(
        planForDate(week, key),
        completions.filter((item) => item.date === key),
        day
      );
      const scheduled = states.filter((state) => state.scheduled);
      return {
        date: day,
        medal: hasDayMedal(states),
        done: scheduled.filter((state) => state.done).length,
        total: scheduled.length
      };
    });

    const routineProgress = routinesInWeek(week)
      .filter((routine) => routine.active)
      .map((routine) => {
        const state = Array.from({ length: 7 }, (_, index) => {
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
        const scheduledDays = state.filter((item) => item.scheduled);
        return {
          routine,
          days: state,
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

    const routineDone = routineProgress.reduce((sum, item) => sum + item.done, 0);
    const routineTotal = routineProgress.reduce((sum, item) => sum + item.total, 0);
    const goalDone = goalProgress.reduce((sum, item) => sum + item.done, 0);
    const goalTotal = goalProgress.reduce((sum, item) => sum + item.total, 0);

    return {
      week,
      label: formatRange(fromISODate(week.startDate), fromISODate(week.endDate)),
      days,
      routineProgress,
      goalProgress,
      routineDone,
      routineTotal,
      goalDone,
      goalTotal,
      tasks: tasks.map((task) => ({ task, goal: goalMap.get(task.goalId) }))
    };
  }

  async getMonth(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const weeks = (await this.repos.weeks.list()).filter((week) => {
      const start = fromISODate(week.startDate);
      const end = fromISODate(week.endDate);
      return (start.getFullYear() === year && start.getMonth() === month)
        || (end.getFullYear() === year && end.getMonth() === month);
    });
    const allCompletions = await this.repos.completions.list();
    const today = new Date();

    const days = Array.from({ length: daysInMonth(year, month) }, (_, index) => {
      const day = new Date(year, month, index + 1);
      const key = toISODate(day);
      const week = weeks.find((item) => key >= item.startDate && key <= item.endDate);
      if (!week || day > today) return { date: day, medal: false, known: false };

      const states = getRoutineDayStates(
        planForDate(week, key),
        allCompletions.filter((item) => item.date === key),
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

  async getYear(date = new Date()) {
    const year = date.getFullYear();
    const weeks = (await this.repos.weeks.list()).filter((week) => week.year === year);
    const completions = await this.repos.completions.list();
    const today = new Date();

    const months = Array.from({ length: 12 }, (_, month) => {
      let medals = 0;
      let knownDays = 0;

      for (let day = 1; day <= daysInMonth(year, month); day += 1) {
        const current = new Date(year, month, day);
        if (current > today) continue;

        const key = toISODate(current);
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
      daysLeft: daysLeftInYear(date),
      weeksLeft: weeksLeftInYear(date),
      currentDay: Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1,
      totalDays: new Date(year, 1, 29).getMonth() === 1 ? 366 : 365,
      months
    };
  }

  async getLife() {
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

function normalizeRoutineName(value: string) {
  return value.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
}
