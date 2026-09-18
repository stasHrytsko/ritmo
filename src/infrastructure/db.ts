import Dexie, { type EntityTable } from 'dexie';
import type {
  AppSettings,
  Goal,
  GoalTask,
  Routine,
  RoutineCompletion,
  WeekRecord
} from '../domain/types';

export class RitmoDatabase extends Dexie {
  routines!: EntityTable<Routine, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  goalTasks!: EntityTable<GoalTask, 'id'>;
  weeks!: EntityTable<WeekRecord, 'id'>;
  completions!: EntityTable<RoutineCompletion, 'id'>;
  settings!: EntityTable<AppSettings, 'key'>;

  constructor() {
    super('ritmo');
    this.version(1).stores({
      routines: 'id, active, createdAt, updatedAt',
      goals: 'id, status, startDate, endDate, createdAt, updatedAt',
      goalTasks: 'id, goalId, status, plannedWeekId, plannedDate, createdAt, updatedAt',
      weeks: 'id, startDate, endDate, year, weekNumber',
      completions: 'id, date, routineId, [date+routineId]',
      settings: 'key'
    });

    this.version(2).stores({
      routines: 'id, active, timing, time, createdAt, updatedAt',
      goals: 'id, status, startDate, endDate, createdAt, updatedAt',
      goalTasks: 'id, goalId, status, plannedWeekId, plannedDate, createdAt, updatedAt',
      weeks: 'id, startDate, endDate, year, weekNumber',
      completions: 'id, date, routineId, [date+routineId]',
      settings: 'key'
    }).upgrade(async (tx) => {
      await tx.table('routines').toCollection().modify((routine) => {
        if (!routine.timing) routine.timing = 'anytime';
        if (routine.timing !== 'exact') delete routine.time;
      });

      await tx.table('weeks').toCollection().modify((week) => {
        week.routinePlanSnapshot = (week.routinePlanSnapshot ?? []).map((routine: any) => ({
          ...routine,
          timing: routine.timing ?? 'anytime',
          time: routine.timing === 'exact' ? routine.time : undefined
        }));
      });

      const settings = await tx.table('settings').get('app');
      if (settings) {
        settings.schemaVersion = 2;
        await tx.table('settings').put(settings);
      }
    });
  }
}

export const db = new RitmoDatabase();
