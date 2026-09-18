export type ISODate = string;
export type GoalStatus = 'active' | 'paused' | 'done';
export type RoutineTiming = 'exact' | 'anytime';

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
  routinePlanSnapshot: RoutineSnapshot[];
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
  settings: AppSettings[];
}
