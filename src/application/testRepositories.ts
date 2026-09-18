import type { Repositories } from '../repositories/interfaces';
import type { AppSettings, Goal, GoalTask, Routine, RoutineCompletion, WeekRecord } from '../domain/types';

export interface MemoryStore {
  routines: Routine[];
  goals: Goal[];
  goalTasks: GoalTask[];
  weeks: WeekRecord[];
  completions: RoutineCompletion[];
  settings?: AppSettings;
}

/** In-memory repositories for tests. Mirrors the Dexie adapter's cascades. */
export function createMemoryRepositories(): { repos: Repositories; store: MemoryStore } {
  const store: MemoryStore = { routines: [], goals: [], goalTasks: [], weeks: [], completions: [] };

  const put = <T extends { id: string }>(list: T[], item: T) => {
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index === -1) list.push(item);
    else list[index] = item;
  };

  const drop = <T>(list: T[], match: (item: T) => boolean) => {
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (match(list[index])) list.splice(index, 1);
    }
  };

  const repos: Repositories = {
    routines: {
      list: async () => [...store.routines],
      get: async (id) => store.routines.find((item) => item.id === id),
      create: async (routine) => { store.routines.push(routine); },
      update: async (routine) => put(store.routines, routine),
      remove: async (id) => {
        drop(store.routines, (item) => item.id === id);
        drop(store.completions, (item) => item.routineId === id);
      }
    },
    goals: {
      list: async () => [...store.goals],
      get: async (id) => store.goals.find((item) => item.id === id),
      create: async (goal) => { store.goals.push(goal); },
      update: async (goal) => put(store.goals, goal),
      remove: async (id) => {
        drop(store.goals, (item) => item.id === id);
        drop(store.goalTasks, (item) => item.goalId === id);
      }
    },
    goalTasks: {
      list: async () => [...store.goalTasks],
      listByGoal: async (goalId) => store.goalTasks.filter((item) => item.goalId === goalId),
      listByWeek: async (weekId) => store.goalTasks.filter((item) => item.plannedWeekId === weekId),
      listOpenBeforeWeek: async (weekId) =>
        store.goalTasks.filter((item) => item.status === 'open' && item.plannedWeekId < weekId),
      create: async (task) => { store.goalTasks.push(task); },
      update: async (task) => put(store.goalTasks, task),
      remove: async (id) => drop(store.goalTasks, (item) => item.id === id)
    },
    weeks: {
      get: async (id) => store.weeks.find((item) => item.id === id),
      list: async () => [...store.weeks],
      put: async (week) => put(store.weeks, week)
    },
    completions: {
      list: async () => [...store.completions],
      listByDate: async (date) => store.completions.filter((item) => item.date === date),
      listBetween: async (start, end) =>
        store.completions.filter((item) => item.date >= start && item.date <= end),
      put: async (completion) => put(store.completions, completion),
      toggle: async (date, routineId, completedAt) => {
        const id = `${date}:${routineId}`;
        const done = store.completions.find((item) => item.id === id)?.done !== true;
        put(store.completions, { id, date, routineId, done, completedAt: done ? completedAt : undefined });
        return done;
      },
      removeByRoutine: async (routineId) => drop(store.completions, (item) => item.routineId === routineId)
    },
    settings: {
      get: async () => store.settings,
      put: async (settings) => { store.settings = settings; }
    },
    backup: {
      exportAll: async () => { throw new Error('not used in tests'); },
      importAll: async () => { throw new Error('not used in tests'); }
    }
  };

  return { repos, store };
}
