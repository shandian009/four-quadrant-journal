import type { Task } from '../../shared/domain';
import type { DailyStatistics } from '../../shared/ipc';

export function calculateStatistics(_tasks: Task[], _focusDurations: number[]): DailyStatistics {
  const tasks = _tasks.filter((task) => task.status !== 'deleted');
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const planned = tasks.length;
  return {
    planned,
    completed,
    pending: planned - completed,
    completionRate: planned === 0 ? 0 : Math.round((completed / planned) * 100),
    focusSeconds: _focusDurations.reduce((total, duration) => total + duration, 0)
  };
}
