import type { Goal, GoalTask, Routine, WeekRecord } from '../domain/types';
import { getRoutineDayStates, hasDayMedal } from '../domain/medal';
import {
  addDays,
  daysInMonth,
  daysLeftInYear,
  formatRange,
  fromISODate,
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
  constructor(private readonly repos: Repositories) {}

  async init() {
    const settings = await this.repos.settings.get();
    if (!settings) {
      await this.repos.settings.put({
        key: 'app',
        schemaVersion: 1,
        installedAt: now(),
        dayBoundaryHour: 3
      });
    }
    await this.ensureWeek(new Date());
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
      routinePlanSnapshot: routines.map((routine) => ({
        routineId: routine.id,
        name: routine.name,
        active: routine.active,
        weekdays: [...routine.weekdays]
      })),
      createdAt: now()
    };
    await this.repos.weeks.put(record);
    return record;
  }

  async getToday(date = new Date()): Promise<TodayView> {
    const week = await this.ensureWeek(date);
    const dateKey = toISODate(date);
    const completions = await this.repos.completions.listByDate(dateKey);
    const states = getRoutineDayStates(week.routinePlanSnapshot, completions, date);
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

  async createRoutine(name: string, weekdays: number[]) {
    const stamp = now();
    const routine: Routine = {
      id: id(),
      name: name.trim(),
      active: true,
      weekdays: [...weekdays].sort(),
      createdAt: stamp,
      updatedAt: stamp
    };
    await this.repos.routines.create(routine);
    await this.refreshCurrentWeekSnapshot();
  }

  async updateRoutine(routine: Routine) {
    await this.repos.routines.update({ ...routine, updatedAt: now() });
    await this.refreshCurrentWeekSnapshot();
  }

  async deleteRoutine(idToDelete: string) {
    await this.repos.routines.remove(idToDelete);
    await this.refreshCurrentWeekSnapshot();
  }

  private async refreshCurrentWeekSnapshot() {
    const current = await this.ensureWeek(new Date());
    const routines = await this.repos.routines.list();
    await this.repos.weeks.put({
      ...current,
      routinePlanSnapshot: routines.map((routine) => ({
        routineId: routine.id,
        name: routine.name,
        active: routine.active,
        weekdays: [...routine.weekdays]
      }))
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
    const completions = await this.repos.completions.listBetween(week.startDate, week.endDate);
    const tasks = await this.repos.goalTasks.listByWeek(week.id);
    const goals = (await this.repos.goals.list()).filter((goal) => goal.status !== 'paused');
    const goalMap = new Map(goals.map((goal) => [goal.id, goal]));

    const days = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(fromISODate(week.startDate), index);
      const key = toISODate(day);
      const states = getRoutineDayStates(
        week.routinePlanSnapshot,
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

    const routineProgress = week.routinePlanSnapshot
      .filter((routine) => routine.active)
      .map((routine) => {
        const state = Array.from({ length: 7 }, (_, index) => {
          const day = addDays(fromISODate(week.startDate), index);
          const key = toISODate(day);
          const scheduled = routine.weekdays.includes(((day.getDay() + 6) % 7) + 1);
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
        week.routinePlanSnapshot,
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
          week.routinePlanSnapshot,
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
