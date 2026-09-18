import type { BackupPayload } from '../domain/types';
import type { Repositories } from '../repositories/interfaces';
import { db } from './db';

export const repositories: Repositories = {
  routines: {
    list: () => db.routines.orderBy('createdAt').toArray(),
    get: (id) => db.routines.get(id),
    create: async (routine) => { await db.routines.add(routine); },
    update: async (routine) => { await db.routines.put(routine); },
    remove: async (id) => { await db.routines.delete(id); }
  },
  goals: {
    list: () => db.goals.orderBy('createdAt').toArray(),
    get: (id) => db.goals.get(id),
    create: async (goal) => { await db.goals.add(goal); },
    update: async (goal) => { await db.goals.put(goal); },
    remove: async (id) => {
      await db.transaction('rw', db.goals, db.goalTasks, async () => {
        await db.goals.delete(id);
        await db.goalTasks.where('goalId').equals(id).delete();
      });
    }
  },
  goalTasks: {
    list: () => db.goalTasks.orderBy('createdAt').toArray(),
    listByGoal: (goalId) => db.goalTasks.where('goalId').equals(goalId).toArray(),
    listByWeek: (weekId) => db.goalTasks.where('plannedWeekId').equals(weekId).toArray(),
    create: async (task) => { await db.goalTasks.add(task); },
    update: async (task) => { await db.goalTasks.put(task); },
    remove: async (id) => { await db.goalTasks.delete(id); }
  },
  weeks: {
    get: (id) => db.weeks.get(id),
    list: () => db.weeks.orderBy('startDate').toArray(),
    put: async (week) => { await db.weeks.put(week); }
  },
  completions: {
    list: () => db.completions.orderBy('date').toArray(),
    listByDate: (date) => db.completions.where('date').equals(date).toArray(),
    listBetween: (start, end) => db.completions.where('date').between(start, end, true, true).toArray(),
    put: async (completion) => { await db.completions.put(completion); }
  },
  settings: {
    get: () => db.settings.get('app'),
    put: async (settings) => { await db.settings.put(settings); }
  },
  backup: {
    exportAll: async () => ({
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      routines: await db.routines.toArray(),
      goals: await db.goals.toArray(),
      goalTasks: await db.goalTasks.toArray(),
      weeks: await db.weeks.toArray(),
      completions: await db.completions.toArray(),
      settings: await db.settings.toArray()
    }),
    importAll: async (payload: BackupPayload) => {
      if (![1, 2].includes(payload.schemaVersion)) {
        throw new Error('Unsupported backup version');
      }

      const routines = payload.routines.map((routine: any) => ({
        ...routine,
        timing: routine.timing ?? 'anytime',
        time: routine.timing === 'exact' ? routine.time : undefined
      }));

      const weeks = payload.weeks.map((week: any) => ({
        ...week,
        routinePlanSnapshot: (week.routinePlanSnapshot ?? []).map((routine: any) => ({
          ...routine,
          timing: routine.timing ?? 'anytime',
          time: routine.timing === 'exact' ? routine.time : undefined
        }))
      }));

      const settings = payload.settings.map((settings: any) => ({
        ...settings,
        schemaVersion: 2
      }));

      await db.transaction(
        'rw',
        [db.routines, db.goals, db.goalTasks, db.weeks, db.completions, db.settings],
        async () => {
          await Promise.all([
            db.routines.clear(),
            db.goals.clear(),
            db.goalTasks.clear(),
            db.weeks.clear(),
            db.completions.clear(),
            db.settings.clear()
          ]);
          await db.routines.bulkPut(routines);
          await db.goals.bulkPut(payload.goals);
          await db.goalTasks.bulkPut(payload.goalTasks);
          await db.weeks.bulkPut(weeks);
          await db.completions.bulkPut(payload.completions);
          await db.settings.bulkPut(settings);
        }
      );
    }
  }
};
