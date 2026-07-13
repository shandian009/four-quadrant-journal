import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/shared/domain';
import { QuadrantBoard } from '../../src/renderer/features/tasks/QuadrantBoard';

const task: Task = {
  id: 'task-1', title: '整理资料', notes: '', quadrant: 'urgent_important',
  plannedDate: '2026-07-10', dueAt: null, remindAt: null, estimatedMinutes: null,
  status: 'active', manualStruck: false, sortOrder: 0, completedAt: null,
  createdAt: '2026-07-10T09:00:00.000Z', updatedAt: '2026-07-10T09:00:00.000Z'
};

function renderBoard(tasks: Task[] = [task]) {
  const callbacks = {
    onMove: vi.fn().mockResolvedValue(undefined),
    onToggleComplete: vi.fn().mockResolvedValue(undefined),
    onToggleManualStrike: vi.fn().mockResolvedValue(undefined)
  };
  render(<QuadrantBoard tasks={tasks} {...callbacks} />);
  return callbacks;
}

it('moves a task to another quadrant', async () => {
  const user = userEvent.setup();
  const { onMove } = renderBoard();

  await user.selectOptions(screen.getByLabelText('移动“整理资料”'), 'important');

  expect(onMove).toHaveBeenCalledWith('task-1', 'important');
});

it('numbers visible tasks independently inside every quadrant', () => {
  renderBoard([
    task,
    { ...task, id: 'task-2', title: '确认预算' },
    { ...task, id: 'task-3', title: '整理灵感', quadrant: 'important' },
    { ...task, id: 'task-deleted', title: '已删除', status: 'deleted' }
  ]);

  const urgentImportant = within(screen.getByRole('region', { name: '重要且紧急' }));
  const important = within(screen.getByRole('region', { name: '重要不紧急' }));
  expect(urgentImportant.getByText('1')).toBeVisible();
  expect(urgentImportant.getByText('2')).toBeVisible();
  expect(important.getByText('1')).toBeVisible();
  expect(screen.queryByText('已删除')).not.toBeInTheDocument();
});

it('requests completion and manual strike independently for the exact task', async () => {
  const user = userEvent.setup();
  const { onToggleComplete, onToggleManualStrike } = renderBoard();

  await user.click(screen.getByRole('button', { name: '完成“整理资料”' }));
  await user.click(screen.getByRole('button', { name: '划线“整理资料”' }));

  expect(onToggleComplete).toHaveBeenCalledWith(task);
  expect(onToggleManualStrike).toHaveBeenCalledWith(task);
});

it('represents completed and manual strike as independent states that can coexist', () => {
  renderBoard([{ ...task, status: 'completed', manualStruck: true }]);

  const article = screen.getByText('整理资料').closest('article');
  expect(article).toHaveClass('quadrant-task--completed', 'quadrant-task--manual-struck');
  expect(screen.getByRole('button', { name: '恢复“整理资料”' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '取消划线“整理资料”' })).toHaveAttribute('aria-pressed', 'true');
});
