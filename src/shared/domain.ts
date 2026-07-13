export type Quadrant =
  | 'urgent_important'
  | 'important'
  | 'urgent'
  | 'neither';

export type TaskStatus = 'active' | 'completed' | 'deleted';

export interface Task {
  id: string;
  title: string;
  notes: string;
  quadrant: Quadrant;
  plannedDate: string;
  dueAt: string | null;
  remindAt: string | null;
  estimatedMinutes: number | null;
  status: TaskStatus;
  manualStruck: boolean;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReview {
  id: string;
  reviewDate: string;
  wins: string;
  improvements: string;
  tomorrowFocus: string;
  createdAt: string;
  updatedAt: string;
}
