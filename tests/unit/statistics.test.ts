import { describe, expect, it } from 'vitest';
import type { Task } from '../../src/shared/domain';
import { calculateStatistics } from '../../src/main/services/statistics';

function task(id: string, status: Task['status']): Task {
  return {
    id, title: id, notes: '', quadrant: 'important', plannedDate: '2026-07-10',
    dueAt: null, remindAt: null, estimatedMinutes: null, status, manualStruck: false, sortOrder: 0,
    completedAt: status === 'completed' ? '2026-07-10T12:00:00.000Z' : null,
    createdAt: '2026-07-10T09:00:00.000Z', updatedAt: '2026-07-10T09:00:00.000Z'
  };
}

describe('daily statistics', () => {
  it('calculates completion and focus totals', () => {
    const tasks = [
      ...Array.from({ length: 6 }, (_, index) => task(`done-${index}`, 'completed')),
      task('pending-1', 'active'),
      task('pending-2', 'active')
    ];

    expect(calculateStatistics(tasks, [18_000, 4_320])).toEqual({
      planned: 8,
      completed: 6,
      pending: 2,
      completionRate: 75,
      focusSeconds: 22_320
    });
  });

  it('returns zero completion rate with no tasks', () => {
    expect(calculateStatistics([], [])).toMatchObject({ planned: 0, completionRate: 0 });
  });
});
