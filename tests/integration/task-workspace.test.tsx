import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task, TaskApi } from '../../src/shared/ipc';
import { TaskWorkspace } from '../../src/renderer/features/tasks/TaskWorkspace';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: '七月计划',
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

function makeApi(rangeResult: Task[] = []): TaskApi {
  return {
    listByDate: vi.fn(),
    listByRange: vi.fn().mockResolvedValue(rangeResult),
    create: vi.fn(),
    update: vi.fn(),
    complete: vi.fn(),
    restore: vi.fn(),
    setManualStruck: vi.fn(),
    remove: vi.fn()
  };
}

describe('task workspace month loading', () => {
  it('完成失败时保留原状态并显示错误，重试成功后清除错误', async () => {
    const user = userEvent.setup();
    const original = makeTask();
    const completed = makeTask({ status: 'completed', completedAt: '2026-07-10T10:00:00.000Z' });
    const api = makeApi([original]);
    vi.mocked(api.complete)
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce(completed);

    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);
    const completeButton = await screen.findByRole('button', { name: '完成“七月计划”' });

    await user.click(completeButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('完成事项失败，请重试');
    expect(screen.getByRole('button', { name: '完成“七月计划”' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: '完成“七月计划”' }));

    expect(await screen.findByRole('button', { name: '恢复“七月计划”' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.complete).toHaveBeenCalledTimes(2);
  });

  it('恢复失败时保留原状态并显示错误，重试成功后清除错误', async () => {
    const user = userEvent.setup();
    const completed = makeTask({ status: 'completed', completedAt: '2026-07-10T10:00:00.000Z' });
    const restored = makeTask();
    const api = makeApi([completed]);
    vi.mocked(api.restore)
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce(restored);

    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);
    const restoreButton = await screen.findByRole('button', { name: '恢复“七月计划”' });

    await user.click(restoreButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('恢复事项失败，请重试');
    expect(screen.getByRole('button', { name: '恢复“七月计划”' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '恢复“七月计划”' }));

    expect(await screen.findByRole('button', { name: '完成“七月计划”' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.restore).toHaveBeenCalledTimes(2);
  });

  it('issues one range request for a displayed month in strict mode', async () => {
    const api = makeApi([makeTask()]);

    render(
      <StrictMode>
        <TaskWorkspace api={api} initialDate="2026-07-10" />
      </StrictMode>
    );

    expect(await screen.findByText('七月计划')).toBeVisible();
    expect(api.listByRange).toHaveBeenCalledTimes(1);
  });

  it('loads each displayed month once and selecting a day does not query again', async () => {
    const user = userEvent.setup();
    const julyTask = makeTask();
    const augustTask = makeTask({ id: 'task-2', title: '八月计划', plannedDate: '2026-08-03' });
    const api = makeApi();
    vi.mocked(api.listByRange)
      .mockResolvedValueOnce([julyTask])
      .mockResolvedValueOnce([augustTask]);

    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);

    await waitFor(() => expect(api.listByRange).toHaveBeenCalledWith('2026-07-01', '2026-07-31'));
    expect(api.listByRange).toHaveBeenCalledTimes(1);
    expect(api.listByDate).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('calendar-day-2026-07-11'));
    expect(api.listByRange).toHaveBeenCalledTimes(1);
    expect(api.listByDate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '下个月' }));
    await waitFor(() => expect(api.listByRange).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31'));
    expect(api.listByRange).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: '2026年8月' })).toBeVisible();
  });

  it('reuses a cached month when navigating July to August to July', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    vi.mocked(api.listByRange)
      .mockResolvedValueOnce([makeTask()])
      .mockResolvedValueOnce([]);

    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);

    expect(await screen.findByText('七月计划')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '下个月' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '2026年8月' })).toBeVisible());
    await user.click(screen.getByRole('button', { name: '上个月' }));

    expect(await screen.findByText('七月计划')).toBeVisible();
    expect(api.listByRange).toHaveBeenCalledTimes(2);
  });

  it('evicts a failed month request so returning to it can retry', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    vi.mocked(api.listByRange)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeTask()]);

    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('读取事项失败');
    expect(api.listByRange).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '下个月' }));
    await waitFor(() => expect(api.listByRange).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: '上个月' }));

    expect(await screen.findByText('七月计划')).toBeVisible();
    expect(api.listByRange).toHaveBeenCalledTimes(3);
  });

  it('reloads the month after unmount so external task changes are visible', async () => {
    const active = makeTask();
    const completed = makeTask({ status: 'completed', completedAt: '2026-07-10T10:00:00.000Z' });
    const api = makeApi();
    vi.mocked(api.listByRange)
      .mockResolvedValueOnce([active])
      .mockResolvedValueOnce([completed]);

    const first = render(<TaskWorkspace api={api} initialDate="2026-07-10" />);
    expect(await screen.findByRole('button', { name: '完成“七月计划”' })).toBeVisible();
    first.unmount();

    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);

    expect(await screen.findByRole('button', { name: '恢复“七月计划”' })).toBeVisible();
    expect(api.listByRange).toHaveBeenCalledTimes(2);
  });

  it('does not let a pending range snapshot overwrite a newly created task', async () => {
    const user = userEvent.setup();
    let resolveRange!: (tasks: Task[]) => void;
    const pendingRange = new Promise<Task[]>((resolve) => { resolveRange = resolve; });
    const created = makeTask({ id: 'task-2', title: '请求中创建' });
    const api = makeApi();
    vi.mocked(api.listByRange).mockReturnValue(pendingRange);
    vi.mocked(api.create).mockResolvedValue(created);

    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);
    await user.click(screen.getByRole('button', { name: '添加事项' }));
    await user.type(screen.getByLabelText('事项标题'), '请求中创建');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('请求中创建')).toBeVisible();

    await act(async () => {
      resolveRange([]);
      await pendingRange;
    });

    expect(screen.getByText('请求中创建')).toBeVisible();
    expect(screen.getByTestId('calendar-day-2026-07-10')).toHaveAttribute('data-task-count', '1');
  });

  it('isolates month caches between task API instances', async () => {
    const firstApi = makeApi([makeTask()]);
    const secondApi = makeApi([makeTask({ id: 'task-2', title: '另一个资料源' })]);
    const view = render(<TaskWorkspace api={firstApi} initialDate="2026-07-10" />);

    expect(await screen.findByText('七月计划')).toBeVisible();
    view.rerender(<TaskWorkspace api={secondApi} initialDate="2026-07-10" />);

    expect(await screen.findByText('另一个资料源')).toBeVisible();
    expect(firstApi.listByRange).toHaveBeenCalledTimes(1);
    expect(secondApi.listByRange).toHaveBeenCalledTimes(1);
  });

  it('keeps created and status-updated tasks in the cached month snapshot', async () => {
    const user = userEvent.setup();
    const original = makeTask();
    const created = makeTask({ id: 'task-2', title: '新建事项' });
    const completed = makeTask({ status: 'completed', completedAt: '2026-07-10T10:00:00.000Z' });
    const restored = makeTask();
    const api = makeApi([original]);
    vi.mocked(api.create).mockResolvedValue(created);
    vi.mocked(api.complete).mockResolvedValue(completed);
    vi.mocked(api.restore).mockResolvedValue(restored);

    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);
    await user.click(await screen.findByRole('button', { name: '完成“七月计划”' }));
    await user.click(await screen.findByRole('button', { name: '恢复“七月计划”' }));
    await user.click(screen.getByRole('button', { name: '添加事项' }));
    await user.type(screen.getByLabelText('事项标题'), '新建事项');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('新建事项')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '下个月' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '2026年8月' })).toBeVisible());
    await user.click(screen.getByRole('button', { name: '上个月' }));

    expect(await screen.findByText('新建事项')).toBeVisible();
    expect(screen.getByRole('button', { name: '完成“七月计划”' })).toBeVisible();
    expect(api.listByRange).toHaveBeenCalledTimes(2);
  });

  it('today selects today and returns the displayed month to today', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    render(<TaskWorkspace api={api} initialDate="2025-12-15" />);

    await waitFor(() => expect(api.listByRange).toHaveBeenCalledWith('2025-12-01', '2025-12-31'));
    await user.click(screen.getByRole('button', { name: '今天' }));

    const today = new Date();
    const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayMonth = todayDate.slice(0, 7);
    await waitFor(() => expect(screen.getByRole('heading', { name: `${today.getFullYear()}年${today.getMonth() + 1}月` })).toBeVisible());
    expect(screen.getByTestId(`calendar-day-${todayDate}`)).toHaveClass('calendar-day--current');
    expect(api.listByRange).toHaveBeenLastCalledWith(`${todayMonth}-01`, expect.stringMatching(new RegExp(`^${todayMonth}-`)));
  });

  it('keeps existing tasks visible and shows an alert when the next month fails to load', async () => {
    const user = userEvent.setup();
    const api = makeApi();
    vi.mocked(api.listByRange)
      .mockResolvedValueOnce([makeTask()])
      .mockRejectedValueOnce(new Error('offline'));

    render(<TaskWorkspace api={api} initialDate="2026-07-10" />);
    expect(await screen.findByText('七月计划')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '下个月' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('读取事项失败');
    expect(screen.getByText('七月计划')).toBeVisible();
  });
});
