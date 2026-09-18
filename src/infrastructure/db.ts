import Dexie, { type EntityTable, type Transaction } from 'dexie';
import {
  SCHEMA_VERSION,
  type AppSettings,
  type Goal,
  type GoalTask,
  type Routine,
  type RoutineCompletion,
  type RoutinePlanRevision,
  type RoutineSnapshot,
  type WeekRecord
} from '../domain/types';

const STORES = {
  routines: 'id, active, timing, time, createdAt, updatedAt',
  goals: 'id, status, startDate, endDate, createdAt, updatedAt',
  goalTasks: 'id, goalId, status, plannedWeekId, plannedDate, createdAt, updatedAt',
  weeks: 'id, startDate, endDate, year, weekNumber',
  completions: 'id, date, routineId, [date+routineId]',
  settings: 'key'
};

/** Shapes as they exist on disk mid-migration, before the current types apply. */
interface StoredRoutine {
  timing?: string;
  time?: string;
}

interface StoredWeek {
  startDate: string;
  routinePlan?: RoutinePlanRevision[];
  routinePlanSnapshot?: RoutineSnapshot[];
}

const withTiming = <T extends StoredRoutine>(routine: T) => {
  if (routine.timing !== 'exact') {
    routine.timing = 'anytime';
    delete routine.time;
  }
  return routine;
};

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
      ...STORES,
      routines: 'id, active, createdAt, updatedAt'
    });

    // v2 introduced routine timing.
    this.version(2).stores(STORES).upgrade(async (tx) => {
      await tx.table<StoredRoutine>('routines').toCollection().modify((routine) => {
        withTiming(routine);
      });

      await tx.table<StoredWeek>('weeks').toCollection().modify((week) => {
        week.routinePlanSnapshot = (week.routinePlanSnapshot ?? []).map(withTiming);
      });

      await bumpSchemaVersion(tx, 2);
    });

    // v3 replaced the single week snapshot with dated plan revisions, so that
    // editing routines mid-week cannot re-judge the days already lived.
    this.version(3).stores(STORES).upgrade(async (tx) => {
      await tx.table<StoredWeek>('weeks').toCollection().modify((week) => {
        week.routinePlan ??= [{
          appliesFrom: week.startDate,
          routines: week.routinePlanSnapshot ?? []
        }];
        delete week.routinePlanSnapshot;
      });

      await bumpSchemaVersion(tx, SCHEMA_VERSION);
    });
  }
}

async function bumpSchemaVersion(tx: Transaction, version: number) {
  const table = tx.table<AppSettings, string>('settings');
  const settings = await table.get('app');
  if (settings) await table.put({ ...settings, schemaVersion: version });
}

export const db = new RitmoDatabase();
