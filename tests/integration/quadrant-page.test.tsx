import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task, TaskApi } from '../../src/shared/ipc';
import { QuadrantPage } from '../../src/renderer/features/tasks/QuadrantPage';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', title: '整理资料', notes: '', quadrant: 'urgent_important',
    plannedDate: '2026-07-10', dueAt: null, remindAt: null, estimatedMinutes: null,
    status: 'active', manualStruck: false, sortOrder: 0, completedAt: null,
    createdAt: '2026-07-10T09:00:00.000Z', updatedAt: '2026-07-10T09:00:00.000Z',
    ...overrides
  };
}

function makeApi(task: Task, updates: Partial<TaskApi> = {}): TaskApi {
  return {
    listByDate: vi.fn().mockResolvedValue([task]),
    listByRange: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn(),
    complete: vi.fn(), restore: vi.fn(), setManualStruck: vi.fn(), remove: vi.fn(),
    ...updates
  };
}

describe('quadrant page', () => {
  it('读取事项失败时显示可访问中文错误', async () => {
    const api = makeApi(makeTask(), {
      listByDate: vi.fn().mockRejectedValue(new Error('read failed'))
    });

    render(<QuadrantPage api={api} date="2026-07-10" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('读取事项失败，请重试');
  });

  it('日期变化并成功读取后清除读取错误', async () => {
    const nextTask = makeTask({ id: 'task-2', title: '新的日期', plannedDate: '2026-07-11' });
    const api = makeApi(makeTask());
    vi.mocked(api.listByDate)
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce([nextTask]);
    const view = render(<QuadrantPage api={api} date="2026-07-10" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('读取事项失败，请重试');

    view.rerender(<QuadrantPage api={api} date="2026-07-11" />);

    expect(await screen.findByText('新的日期')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('日期变化后忽略已过期读取请求的拒绝', async () => {
    let rejectOld!: (error: Error) => void;
    const oldRequest = new Promise<Task[]>((_resolve, reject) => { rejectOld = reject; });
    const nextTask = makeTask({ id: 'task-2', title: '保留新结果', plannedDate: '2026-07-11' });
    const api = makeApi(makeTask());
    vi.mocked(api.listByDate)
      .mockReturnValueOnce(oldRequest)
      .mockResolvedValueOnce([nextTask]);
    const view = render(<QuadrantPage api={api} date="2026-07-10" />);

    view.rerender(<QuadrantPage api={api} date="2026-07-11" />);
    expect(await screen.findByText('保留新结果')).toBeVisible();

    await act(async () => {
      rejectOld(new Error('stale read failed'));
      await oldRequest.catch(() => undefined);
    });

    expect(screen.getByText('保留新结果')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('卸载后消费读取请求的拒绝且不再回写', async () => {
    let rejectRequest!: (error: Error) => void;
    const request = new Promise<Task[]>((_resolve, reject) => { rejectRequest = reject; });
    const api = makeApi(makeTask(), { listByDate: vi.fn().mockReturnValue(request) });
    const view = render(<QuadrantPage api={api} date="2026-07-10" />);

    view.unmount();
    await act(async () => {
      rejectRequest(new Error('unmounted read failed'));
      await request.catch(() => undefined);
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('completes an active task and renders the API result', async () => {
    const user = userEvent.setup();
    const task = makeTask();
    const completed = makeTask({ status: 'completed', completedAt: '2026-07-10T10:00:00.000Z' });
    const api = makeApi(task, { complete: vi.fn().mockResolvedValue(completed) });
    render(<QuadrantPage api={api} date="2026-07-10" />);

    await user.click(await screen.findByRole('button', { name: '完成“整理资料”' }));

    expect(api.complete).toHaveBeenCalledWith('task-1');
    expect(await screen.findByRole('button', { name: '恢复“整理资料”' })).toBeVisible();
  });

  it('restores a completed task instead of completing it again', async () => {
    const user = userEvent.setup();
    const task = makeTask({ status: 'completed', completedAt: '2026-07-10T10:00:00.000Z' });
    const restored = makeTask();
    const api = makeApi(task, { restore: vi.fn().mockResolvedValue(restored) });
    render(<QuadrantPage api={api} date="2026-07-10" />);

    await user.click(await screen.findByRole('button', { name: '恢复“整理资料”' }));

    expect(api.restore).toHaveBeenCalledWith('task-1');
    expect(api.complete).not.toHaveBeenCalled();
  });

  it('sets manual strike to the opposite boolean without changing completion', async () => {
    const user = userEvent.setup();
    const task = makeTask();
    const struck = makeTask({ manualStruck: true });
    const api = makeApi(task, { setManualStruck: vi.fn().mockResolvedValue(struck) });
    render(<QuadrantPage api={api} date="2026-07-10" />);

    await user.click(await screen.findByRole('button', { name: '划线“整理资料”' }));

    expect(api.setManualStruck).toHaveBeenCalledWith('task-1', true);
    expect(api.complete).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: '取消划线“整理资料”' })).toBeVisible();
  });

  it('cancels a manual strike without restoring a completed task', async () => {
    const user = userEvent.setup();
    const task = makeTask({ status: 'completed', manualStruck: true, completedAt: '2026-07-10T10:00:00.000Z' });
    const unstruck = makeTask({ status: 'completed', manualStruck: false, completedAt: '2026-07-10T10:00:00.000Z' });
    const api = makeApi(task, { setManualStruck: vi.fn().mockResolvedValue(unstruck) });
    render(<QuadrantPage api={api} date="2026-07-10" />);

    await user.click(await screen.findByRole('button', { name: '取消划线“整理资料”' }));

    expect(api.setManualStruck).toHaveBeenCalledWith('task-1', false);
    expect(api.restore).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: '划线“整理资料”' })).toBeVisible();
    expect(screen.getByRole('button', { name: '恢复“整理资料”' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    ['移动', makeTask(), { update: vi.fn().mockRejectedValue(new Error('write failed')) }, async (user: ReturnType<typeof userEvent.setup>) => user.selectOptions(await screen.findByLabelText('移动“整理资料”'), 'important'), '移动事项失败，请重试'],
    ['完成', makeTask(), { complete: vi.fn().mockRejectedValue(new Error('write failed')) }, async (user: ReturnType<typeof userEvent.setup>) => user.click(await screen.findByRole('button', { name: '完成“整理资料”' })), '完成事项失败，请重试'],
    ['恢复', makeTask({ status: 'completed', completedAt: '2026-07-10T10:00:00.000Z' }), { restore: vi.fn().mockRejectedValue(new Error('write failed')) }, async (user: ReturnType<typeof userEvent.setup>) => user.click(await screen.findByRole('button', { name: '恢复“整理资料”' })), '恢复事项失败，请重试'],
    ['划线', makeTask(), { setManualStruck: vi.fn().mockRejectedValue(new Error('write failed')) }, async (user: ReturnType<typeof userEvent.setup>) => user.click(await screen.findByRole('button', { name: '划线“整理资料”' })), '更新划线失败，请重试']
  ] as const)('%s失败时显示可访问中文错误并保留原状态', async (_operation, task, updates, interact, message) => {
    const user = userEvent.setup();
    const api = makeApi(task, updates);
    render(<QuadrantPage api={api} date="2026-07-10" />);

    await interact(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    await waitFor(() => {
      expect(screen.getByLabelText('移动“整理资料”')).toHaveValue(task.quadrant);
      expect(screen.getByRole('button', { name: `${task.status === 'completed' ? '恢复' : '完成'}“整理资料”` }))
        .toHaveAttribute('aria-pressed', String(task.status === 'completed'));
      expect(screen.getByRole('button', { name: `${task.manualStruck ? '取消划线' : '划线'}“整理资料”` }))
        .toHaveAttribute('aria-pressed', String(task.manualStruck));
    });
  });
});
