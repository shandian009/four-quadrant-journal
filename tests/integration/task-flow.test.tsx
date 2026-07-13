import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task, TaskApi } from '../../src/shared/ipc';
import { TaskWorkspace } from '../../src/renderer/features/tasks/TaskWorkspace';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: '提交项目报告',
    notes: '',
    quadrant: 'urgent_important',
    plannedDate: '2026-07-10',
    dueAt: null,
    remindAt: null,
    estimatedMinutes: null,
    status: 'active',
    manualStruck: false,
    sortOrder: 0,
    completedAt: null,
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    ...overrides
  };
}

describe('task workspace', () => {
  it('creates a task and updates the selected calendar day count', async () => {
    const user = userEvent.setup();
    const task = makeTask();
    const api: TaskApi = {
      listByDate: vi.fn().mockResolvedValue([]),
      listByRange: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(task),
      update: vi.fn(),
      complete: vi.fn(),
      restore: vi.fn(),
      setManualStruck: vi.fn(),
      remove: vi.fn()
    };
    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);

    await user.click(screen.getByRole('button', { name: '添加事项' }));
    await user.type(screen.getByLabelText('事项标题'), '提交项目报告');
    await user.selectOptions(screen.getByLabelText('所属象限'), 'urgent_important');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('提交项目报告')).toBeVisible();
    expect(screen.getByTestId('calendar-day-2026-07-10')).toHaveAttribute('data-task-count', '1');
  });

  it('loads tasks when the selected date changes', async () => {
    const user = userEvent.setup();
    const api: TaskApi = {
      listByDate: vi.fn(),
      listByRange: vi.fn().mockResolvedValue([makeTask({ id: 'task-2', title: '周六复核', plannedDate: '2026-07-11' })]),
      create: vi.fn(), update: vi.fn(), complete: vi.fn(), restore: vi.fn(),
      setManualStruck: vi.fn(), remove: vi.fn()
    };
    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);

    await user.click(screen.getByTestId('calendar-day-2026-07-11'));

    expect(await screen.findByText('周六复核')).toBeVisible();
    expect(api.listByRange).toHaveBeenCalledTimes(1);
    expect(api.listByDate).not.toHaveBeenCalled();
  });

  it('restores an already completed task instead of completing it again', async () => {
    const user = userEvent.setup();
    const completed = makeTask({ status: 'completed', completedAt: '2026-07-10T10:00:00.000Z' });
    const restored = makeTask();
    const api: TaskApi = {
      listByDate: vi.fn(), listByRange: vi.fn().mockResolvedValue([completed]),
      create: vi.fn(), update: vi.fn(), complete: vi.fn(),
      restore: vi.fn().mockResolvedValue(restored), setManualStruck: vi.fn(), remove: vi.fn()
    };
    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);

    await user.click(await screen.findByRole('button', { name: '恢复“提交项目报告”' }));

    expect(api.restore).toHaveBeenCalledWith('task-1');
    expect(api.complete).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: '完成“提交项目报告”' })).toBeVisible();
  });
});
