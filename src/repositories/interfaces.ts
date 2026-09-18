import type {
  AppSettings,
  BackupPayload,
  Goal,
  GoalTask,
  ISODate,
  Routine,
  RoutineCompletion,
  WeekRecord
} from '../domain/types';

export interface RoutineRepository {
  list(): Promise<Routine[]>;
  get(id: string): Promise<Routine | undefined>;
  create(routine: Routine): Promise<void>;
  update(routine: Routine): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface GoalRepository {
  list(): Promise<Goal[]>;
  get(id: string): Promise<Goal | undefined>;
  create(goal: Goal): Promise<void>;
  update(goal: Goal): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface GoalTaskRepository {
  list(): Promise<GoalTask[]>;
  listByGoal(goalId: string): Promise<GoalTask[]>;
  listByWeek(weekId: ISODate): Promise<GoalTask[]>;
  create(task: GoalTask): Promise<void>;
  update(task: GoalTask): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface WeekRepository {
  get(id: ISODate): Promise<WeekRecord | undefined>;
  list(): Promise<WeekRecord[]>;
  put(week: WeekRecord): Promise<void>;
}

export interface CompletionRepository {
  list(): Promise<RoutineCompletion[]>;
  listByDate(date: ISODate): Promise<RoutineCompletion[]>;
  listBetween(start: ISODate, end: ISODate): Promise<RoutineCompletion[]>;
  put(completion: RoutineCompletion): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<AppSettings | undefined>;
  put(settings: AppSettings): Promise<void>;
}

export interface BackupRepository {
  exportAll(): Promise<BackupPayload>;
  importAll(payload: BackupPayload): Promise<void>;
}

export interface Repositories {
  routines: RoutineRepository;
  goals: GoalRepository;
  goalTasks: GoalTaskRepository;
  weeks: WeekRepository;
  completions: CompletionRepository;
  settings: SettingsRepository;
  backup: BackupRepository;
}
