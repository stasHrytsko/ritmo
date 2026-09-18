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
  }
}

export const db = new RitmoDatabase();
