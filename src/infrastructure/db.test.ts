import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { RitmoDatabase } from './db';
import { SCHEMA_VERSION, type WeekRecord } from '../domain/types';

const V1_STORES = {
  routines: 'id, active, createdAt, updatedAt',
  goals: 'id, status, startDate, endDate, createdAt, updatedAt',
  goalTasks: 'id, goalId, status, plannedWeekId, plannedDate, createdAt, updatedAt',
  weeks: 'id, startDate, endDate, year, weekNumber',
  completions: 'id, date, routineId, [date+routineId]',
  settings: 'key'
};

const V2_STORES = { ...V1_STORES, routines: 'id, active, timing, time, createdAt, updatedAt' };

afterEach(async () => {
  await Dexie.delete('ritmo');
});

/** Writes a database that looks the way the given schema version left it. */
async function seedLegacy(version: 1 | 2) {
  const legacy = new Dexie('ritmo');
  legacy.version(1).stores(V1_STORES);
  if (version === 2) legacy.version(2).stores(V2_STORES);
  await legacy.open();

  await legacy.table('routines').put({
    id: 'r1',
    name: 'Walk',
    active: true,
    weekdays: [1, 2, 3],
    ...(version === 2 ? { timing: 'exact', time: '07:30' } : {}),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  });
  await legacy.table('weeks').put({
    id: '2026-09-14',
    startDate: '2026-09-14',
    endDate: '2026-09-20',
    year: 2026,
    weekNumber: 38,
    routinePlanSnapshot: [{
      routineId: 'r1',
      name: 'Walk',
      active: true,
      weekdays: [1, 2, 3],
      ...(version === 2 ? { timing: 'exact', time: '07:30' } : {})
    }],
    createdAt: '2026-09-14T00:00:00.000Z'
  });
  await legacy.table('completions').put({
    id: '2026-09-15:r1', date: '2026-09-15', routineId: 'r1', done: true
  });
  await legacy.table('settings').put({
    key: 'app',
    schemaVersion: version,
    installedAt: '2026-01-01T00:00:00.000Z',
    dayBoundaryHour: 3,
    defaultsSeedVersion: 1
  });

  legacy.close();
}

describe.each([1, 2] as const)('upgrading from schema v%i', (version) => {
  it('keeps the user data and moves the week onto plan revisions', async () => {
    await seedLegacy(version);

    const db = new RitmoDatabase();
    await db.open();

    expect(await db.routines.count()).toBe(1);
    expect(await db.completions.count()).toBe(1);

    const week = (await db.weeks.get('2026-09-14'))!;
    expect(week.routinePlan).toHaveLength(1);
    expect(week.routinePlan[0].appliesFrom).toBe('2026-09-14');
    expect(week.routinePlan[0].routines.map((r) => r.routineId)).toEqual(['r1']);
    expect(week).not.toHaveProperty('routinePlanSnapshot');

    const settings = (await db.settings.get('app'))!;
    expect(settings.schemaVersion).toBe(SCHEMA_VERSION);
    // The one-time seed must not run again for an existing install.
    expect(settings.defaultsSeedVersion).toBe(1);

    db.close();
  });
});

describe('upgrading from schema v1', () => {
  it('gives untimed routines a timing', async () => {
    await seedLegacy(1);

    const db = new RitmoDatabase();
    await db.open();

    const routine = (await db.routines.get('r1'))!;
    expect(routine.timing).toBe('anytime');
    expect(routine.time).toBeUndefined();

    const week = (await db.weeks.get('2026-09-14'))!;
    expect(week.routinePlan[0].routines[0].timing).toBe('anytime');

    db.close();
  });
});

describe('a fresh database', () => {
  it('opens at the current version with nothing in it', async () => {
    const db = new RitmoDatabase();
    await db.open();

    expect(db.verno).toBe(SCHEMA_VERSION);
    expect(await db.routines.count()).toBe(0);
    expect(await db.weeks.count()).toBe(0);

    db.close();
  });
});

describe('week records', () => {
  it('round-trip their plan revisions', async () => {
    const db = new RitmoDatabase();
    await db.open();

    const week: WeekRecord = {
      id: '2026-09-14',
      startDate: '2026-09-14',
      endDate: '2026-09-20',
      year: 2026,
      weekNumber: 38,
      routinePlan: [],
      createdAt: '2026-09-14T00:00:00.000Z'
    };
    await db.weeks.put(week);
    expect((await db.weeks.get('2026-09-14'))?.routinePlan).toEqual([]);

    db.close();
  });
});
