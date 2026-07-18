import type { DailyReview, Quadrant, Task } from './domain';
export type { Task } from './domain';

export interface CreateTaskDto {
  title: string;
  notes?: string;
  quadrant: Quadrant;
  plannedDate: string;
  dueAt?: string | null;
  remindAt?: string | null;
  estimatedMinutes?: number | null;
}

export type UpdateTaskDto = Partial<Pick<Task,
  | 'title'
  | 'notes'
  | 'quadrant'
  | 'plannedDate'
  | 'dueAt'
  | 'remindAt'
  | 'estimatedMinutes'
  | 'sortOrder'
>>;

export interface TaskApi {
  listByDate(date: string): Promise<Task[]>;
  listByRange(startDate: string, endDate: string): Promise<Task[]>;
  create(input: CreateTaskDto): Promise<Task>;
  update(id: string, patch: UpdateTaskDto): Promise<Task>;
  complete(id: string): Promise<Task>;
  restore(id: string): Promise<Task>;
  setManualStruck(id: string, struck: boolean): Promise<Task>;
  remove(id: string): Promise<Task>;
}

export interface SaveReviewDto {
  wins: string;
  improvements: string;
  tomorrowFocus: string;
}

export interface ReviewApi {
  get(date: string): Promise<DailyReview | null>;
  listByRange(startDate: string, endDate: string): Promise<DailyReview[]>;
  save(date: string, input: SaveReviewDto): Promise<DailyReview>;
}

export interface DailyStatistics {
  planned: number;
  completed: number;
  pending: number;
  completionRate: number;
  focusSeconds: number;
}

export interface StatisticsApi {
  forDate(date: string): Promise<DailyStatistics>;
}

export interface FocusSession {
  id: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  lastResumedAt: string | null;
  state: 'running' | 'paused' | 'finished';
  createdAt: string;
  updatedAt: string;
}

export interface FocusApi {
  current(): Promise<FocusSession | null>;
  start(taskId: string | null): Promise<FocusSession>;
  pause(id: string): Promise<FocusSession>;
  resume(id: string): Promise<FocusSession>;
  finish(id: string): Promise<FocusSession>;
}

export interface SettingsApi {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
  setLoginOpen(open: boolean): Promise<void>;
}

export interface BackupApi {
  export(): Promise<string | null>;
  restore(): Promise<boolean>;
}

export interface ReportApi {
  exportText(suggestedName: string, text: string): Promise<string | null>;
}

export interface DesktopWindowState {
  mode: 'normal' | 'desktop';
  opacity: number;
  placement?: 'embedded' | 'compatible';
}

export interface WindowApi {
  getDesktopState(): Promise<DesktopWindowState>;
  enterDesktopMode(): Promise<DesktopWindowState>;
  exitDesktopMode(): Promise<DesktopWindowState>;
  setDesktopOpacity(opacity: number): Promise<DesktopWindowState>;
  onDesktopStateChanged(listener: (state: DesktopWindowState) => void): () => void;
}

export interface JournalApi {
  app: {
    version(): Promise<string>;
  };
  tasks: TaskApi;
  reviews: ReviewApi;
  statistics: StatisticsApi;
  focus: FocusApi;
  settings: SettingsApi;
  backup: BackupApi;
  reports: ReportApi;
  window: WindowApi;
}
