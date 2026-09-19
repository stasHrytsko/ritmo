import { parseBackup } from '../domain/backup';
import { SCHEMA_VERSION, type BackupPayload } from '../domain/types';
import type { Repositories } from '../repositories/interfaces';
import { db } from './db';

export const repositories: Repositories = {
  routines: {
    list: () => db.routines.orderBy('createdAt').toArray(),
    get: (id) => db.routines.get(id),
    create: async (routine) => { await db.routines.add(routine); },
    update: async (routine) => { await db.routines.put(routine); },
    remove: async (id) => {
      await db.transaction('rw', db.routines, db.completions, async () => {
        await db.routines.delete(id);
        await db.completions.where('routineId').equals(id).delete();
      });
    }
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
    listOpenBeforeWeek: (weekId) =>
      db.goalTasks
        .where('status').equals('open')
        .filter((task) => task.plannedWeekId < weekId)
        .toArray(),
    create: async (task) => { await db.goalTasks.add(task); },
    update: async (task) => { await db.goalTasks.put(task); },
    remove: async (id) => { await db.goalTasks.delete(id); }
  },
  notes: {
    list: () => db.notes.orderBy('createdAt').toArray(),
    create: async (note) => { await db.notes.add(note); },
    update: async (note) => { await db.notes.put(note); },
    remove: async (id) => {
      await db.transaction('rw', db.notes, db.noteEntries, async () => {
        await db.notes.delete(id);
        await db.noteEntries.where('noteId').equals(id).delete();
      });
    }
  },
  noteEntries: {
    list: () => db.noteEntries.orderBy('createdAt').toArray(),
    listByNote: (noteId) => db.noteEntries.where('noteId').equals(noteId).toArray(),
    create: async (entry) => { await db.noteEntries.add(entry); },
    update: async (entry) => { await db.noteEntries.put(entry); },
    remove: async (id) => { await db.noteEntries.delete(id); }
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
    put: async (completion) => { await db.completions.put(completion); },
    toggle: async (date, routineId, completedAt) => {
      let done = false;
      await db.transaction('rw', db.completions, async () => {
        const key = `${date}:${routineId}`;
        const current = await db.completions.get(key);
        done = current?.done !== true;
        await db.completions.put({
          id: key,
          date,
          routineId,
          done,
          completedAt: done ? completedAt : undefined
        });
      });
      return done;
    },
    removeByRoutine: async (routineId) => {
      await db.completions.where('routineId').equals(routineId).delete();
    }
  },
  settings: {
    get: () => db.settings.get('app'),
    put: async (settings) => { await db.settings.put(settings); }
  },
  backup: {
    exportAll: async () => ({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      routines: await db.routines.toArray(),
      goals: await db.goals.toArray(),
      goalTasks: await db.goalTasks.toArray(),
      weeks: await db.weeks.toArray(),
      completions: await db.completions.toArray(),
      notes: await db.notes.toArray(),
      noteEntries: await db.noteEntries.toArray(),
      settings: await db.settings.toArray()
    }),
    importAll: async (payload: BackupPayload) => {
      // Validate and upgrade before anything is cleared: a malformed file must
      // never be able to land halfway through a restore.
      const restored = parseBackup(payload);

      await db.transaction(
        'rw',
        [
          db.routines, db.goals, db.goalTasks, db.notes, db.noteEntries,
          db.weeks, db.completions, db.settings
        ],
        async () => {
          await Promise.all([
            db.routines.clear(),
            db.goals.clear(),
            db.goalTasks.clear(),
            db.notes.clear(),
            db.noteEntries.clear(),
            db.weeks.clear(),
            db.completions.clear(),
            db.settings.clear()
          ]);
          await db.routines.bulkPut(restored.routines);
          await db.goals.bulkPut(restored.goals);
          await db.goalTasks.bulkPut(restored.goalTasks);
          await db.weeks.bulkPut(restored.weeks);
          await db.completions.bulkPut(restored.completions);
          await db.notes.bulkPut(restored.notes);
          await db.noteEntries.bulkPut(restored.noteEntries);
          await db.settings.bulkPut(restored.settings);
        }
      );
    }
  }
};
