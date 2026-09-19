export type ISODate = string;
export type GoalStatus = 'active' | 'paused' | 'done';
export type RoutineTiming = 'exact' | 'anytime';

export const SCHEMA_VERSION = 5;
export const SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3, 4, 5];

export interface Routine {
  id: string;
  name: string;
  active: boolean;
  weekdays: number[]; // ISO weekday: Monday=1 ... Sunday=7
  timing: RoutineTiming;
  time?: string; // HH:mm when timing === 'exact'
  createdAt: string;
  updatedAt: string;
}

export interface RoutineSnapshot {
  routineId: string;
  name: string;
  active: boolean;
  weekdays: number[];
  timing: RoutineTiming;
  time?: string;
}

/**
 * A week's routine plan is versioned: editing routines mid-week adds a new
 * revision from that day on, so days already lived keep the plan they were
 * judged against.
 */
export interface RoutinePlanRevision {
  appliesFrom: ISODate; // inclusive
  routines: RoutineSnapshot[];
}

export interface Goal {
  id: string;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GoalTask {
  id: string;
  goalId: string;
  title: string;
  status: 'open' | 'done';
  plannedWeekId: ISODate;
  plannedDate?: ISODate;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A named list kept outside the day/week/year timeline entirely: no schedule,
 * no completion, no effect on medals. A note holds entries, and an entry is
 * where a goal comes from.
 */
export interface Note {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteEntry {
  id: string;
  noteId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineCompletion {
  id: string;
  date: ISODate;
  routineId: string;
  done: boolean;
  completedAt?: string;
}

export interface WeekRecord {
  id: ISODate;
  startDate: ISODate;
  endDate: ISODate;
  year: number;
  weekNumber: number;
  routinePlan: RoutinePlanRevision[];
  createdAt: string;
  closedAt?: string;
}

export interface AppSettings {
  key: 'app';
  schemaVersion: number;
  installedAt: string;
  dayBoundaryHour: number;
  defaultsSeedVersion?: number;
}

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  routines: Routine[];
  goals: Goal[];
  goalTasks: GoalTask[];
  weeks: WeekRecord[];
  completions: RoutineCompletion[];
  notes: Note[];
  noteEntries: NoteEntry[];
  settings: AppSettings[];
}
