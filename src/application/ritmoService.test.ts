import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RitmoService } from './ritmoService';
import { createMemoryRepositories, type MemoryStore } from './testRepositories';
import { toISODate, weekId } from '../domain/time';
import type { Repositories } from '../repositories/interfaces';

// Friday 2026-09-18, midweek so "yesterday" is still inside the same week.
const NOW = new Date('2026-09-18T10:00:00+02:00');
const THIS_WEEK = '2026-09-14';

let repos: Repositories;
let store: MemoryStore;
let service: RitmoService;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  ({ repos, store } = createMemoryRepositories());
  // Start from an empty life so assertions are about the test's own data,
  // not the 17 seeded defaults.
  await repos.settings.put({
    key: 'app',
    schemaVersion: 3,
    installedAt: NOW.toISOString(),
    dayBoundaryHour: 3,
    defaultsSeedVersion: 1
  });
  service = new RitmoService(repos);
  await service.init();
});

afterEach(() => {
  vi.useRealTimers();
});

const addRoutine = async (name: string, weekdays = [1, 2, 3, 4, 5, 6, 7]) => {
  await service.createRoutine(name, weekdays, 'anytime');
  return store.routines.find((routine) => routine.name === name)!;
};

describe('init', () => {
  it('seeds the default routines once, even when called concurrently', async () => {
    const { repos: fresh } = createMemoryRepositories();
    const twice = new RitmoService(fresh);
    await Promise.all([twice.init(), twice.init(), twice.init()]);
    const seeded = await fresh.routines.list();
    expect(seeded).toHaveLength(17);

    await twice.init();
    expect(await fresh.routines.list()).toHaveLength(17);
  });

  it('opens the current week', () => {
    expect(store.weeks.map((week) => week.id)).toEqual([THIS_WEEK]);
  });
});

describe('day boundary', () => {
  it('treats the small hours as the previous day', async () => {
    vi.setSystemTime(new Date('2026-09-19T01:30:00+02:00'));
    expect(toISODate((await service.getToday()).date)).toBe('2026-09-18');
  });

  it('rolls over at the boundary hour', async () => {
    vi.setSystemTime(new Date('2026-09-19T03:05:00+02:00'));
    expect(toISODate((await service.getToday()).date)).toBe('2026-09-19');
  });
});

describe('toggleRoutine', () => {
  it('turns a routine on and off again', async () => {
    const routine = await addRoutine('Walk');

    await service.toggleRoutine(service.today(), routine.id);
    expect((await service.getToday()).routines.find((s) => s.routine.routineId === routine.id)?.done)
      .toBe(true);

    await service.toggleRoutine(service.today(), routine.id);
    expect((await service.getToday()).routines.find((s) => s.routine.routineId === routine.id)?.done)
      .toBe(false);
  });

  it('writes one record per routine per day', async () => {
    const routine = await addRoutine('Walk');
    await service.toggleRoutine(service.today(), routine.id);
    await service.toggleRoutine(service.today(), routine.id);
    await service.toggleRoutine(service.today(), routine.id);
    expect(store.completions.filter((item) => item.routineId === routine.id)).toHaveLength(1);
  });

  it('records the completion against the logical day, not the clock day', async () => {
    const routine = await addRoutine('Walk');
    vi.setSystemTime(new Date('2026-09-19T01:30:00+02:00'));
    const view = await service.getToday();
    await service.toggleRoutine(view.date, routine.id);
    expect(store.completions[0].date).toBe('2026-09-18');
  });
});

describe('medals', () => {
  it('is earned once every scheduled routine is done', async () => {
    const walk = await addRoutine('Walk');
    const gym = await addRoutine('Gym');

    await service.toggleRoutine(service.today(), walk.id);
    expect((await service.getToday()).medal).toBe(false);

    await service.toggleRoutine(service.today(), gym.id);
    expect((await service.getToday()).medal).toBe(true);
  });

  it('is never shown for days that have not happened yet', async () => {
    await addRoutine('Walk', [1, 2, 3, 4, 5]);
    const week = await service.getWeek();
    const weekend = week.days.filter((day) => day.future);

    expect(weekend).toHaveLength(2);
    expect(weekend.every((day) => day.medal === false)).toBe(true);
  });

  it('survives a routine added later the same week', async () => {
    // Monday: one routine exists and gets done, earning the day its medal.
    vi.setSystemTime(new Date('2026-09-14T09:00:00+02:00'));
    const walk = await addRoutine('Walk');
    await service.toggleRoutine(service.today(), walk.id);
    expect((await service.getWeek()).days[0].medal).toBe(true);

    // Friday: a second routine is added. Monday was judged without it and
    // must keep its medal.
    vi.setSystemTime(NOW);
    await addRoutine('Gym');

    const week = await service.getWeek();
    expect(week.days[0].medal).toBe(true);
    expect(week.days[4].medal).toBe(false);
  });
});

describe('week plan revisions', () => {
  it('does not backdate a routine added today', async () => {
    await addRoutine('Walk');
    await addRoutine('Gym');

    const week = store.weeks.find((item) => item.id === THIS_WEEK)!;
    expect(week.routinePlan.length).toBeGreaterThan(1);

    const monday = week.routinePlan.find((r) => r.appliesFrom === '2026-09-14')!;
    expect(monday.routines.map((r) => r.name)).not.toContain('Gym');
  });

  it('keeps a deleted routine out of today but present in the week list', async () => {
    const walk = await addRoutine('Walk');
    await service.toggleRoutine(new Date(2026, 8, 14), walk.id);
    await service.deleteRoutine(walk.id);

    const today = await service.getToday();
    expect(today.routines).toHaveLength(0);
    // Its completions went with it.
    expect(store.completions).toHaveLength(0);
  });
});

describe('goal tasks', () => {
  const seedGoal = async () => {
    await service.createGoal('Ship', '2026-01-01', '2026-12-31');
    return store.goals[0];
  };

  it('rolls an open task forward from a past week', async () => {
    const goal = await seedGoal();
    store.goalTasks.push({
      id: 'stale',
      goalId: goal.id,
      title: 'Stale',
      status: 'open',
      plannedWeekId: weekId(new Date(2026, 8, 7)),
      plannedDate: '2026-09-07',
      createdAt: '2026-09-07T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z'
    });

    const today = await service.getToday();
    const moved = store.goalTasks.find((task) => task.id === 'stale')!;

    expect(moved.plannedWeekId).toBe(THIS_WEEK);
    expect(moved.plannedDate).toBeUndefined();
    expect(today.goals[0].tasks.map((task) => task.id)).toContain('stale');
  });

  it('leaves a completed task in the week it was finished', async () => {
    const goal = await seedGoal();
    store.goalTasks.push({
      id: 'old',
      goalId: goal.id,
      title: 'Done',
      status: 'done',
      plannedWeekId: '2026-09-07',
      createdAt: '2026-09-07T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z'
    });

    await service.getWeek();
    expect(store.goalTasks.find((task) => task.id === 'old')!.plannedWeekId).toBe('2026-09-07');
  });

  it('clears completedAt when a task is reopened', async () => {
    const goal = await seedGoal();
    await service.addGoalTask(goal.id, 'Write it');
    const task = store.goalTasks[0];

    await service.toggleGoalTask(task);
    expect(store.goalTasks[0].status).toBe('done');
    expect(store.goalTasks[0].completedAt).toBeDefined();

    await service.toggleGoalTask(store.goalTasks[0]);
    expect(store.goalTasks[0].status).toBe('open');
    expect(store.goalTasks[0].completedAt).toBeUndefined();
  });

  it('removes a goal\'s tasks with the goal', async () => {
    const goal = await seedGoal();
    await service.addGoalTask(goal.id, 'Write it');
    await service.deleteGoal(goal.id);
    expect(store.goalTasks).toHaveLength(0);
  });
});

describe('createRoutine', () => {
  it('sorts weekdays numerically', async () => {
    const routine = await addRoutine('Walk', [7, 1, 3]);
    expect(routine.weekdays).toEqual([1, 3, 7]);
  });

  it('drops a time from an anytime routine', async () => {
    await service.createRoutine('Walk', [1], 'anytime', '07:30');
    expect(store.routines.find((r) => r.name === 'Walk')!.time).toBeUndefined();
  });
});

describe('year view', () => {
  it('reports the day of the year and the year length', async () => {
    const year = await service.getYear();
    expect(year.year).toBe(2026);
    expect(year.currentDay).toBe(261);
    expect(year.totalDays).toBe(365);
  });
});
