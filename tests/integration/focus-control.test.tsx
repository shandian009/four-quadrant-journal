import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { FocusApi, FocusSession } from '../../src/shared/ipc';
import { FocusControl } from '../../src/renderer/features/focus/FocusControl';

const running: FocusSession = {
  id: 'focus-1', taskId: 'task-1', startedAt: '2026-07-10T09:00:00.000Z', endedAt: null,
  durationSeconds: 0, lastResumedAt: '2026-07-10T09:00:00.000Z', state: 'running',
  createdAt: '2026-07-10T09:00:00.000Z', updatedAt: '2026-07-10T09:00:00.000Z'
};

it('starts and finishes focus for a task', async () => {
  const user = userEvent.setup();
  const api: FocusApi = {
    current: vi.fn().mockResolvedValue(null),
    start: vi.fn().mockResolvedValue(running),
    pause: vi.fn(), resume: vi.fn(),
    finish: vi.fn().mockResolvedValue({ ...running, state: 'finished', durationSeconds: 1500 })
  };
  render(<FocusControl api={api} taskId="task-1" />);

  await user.click(screen.getByRole('button', { name: '开始专注' }));
  expect(await screen.findByRole('button', { name: '结束专注' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: '结束专注' }));

  expect(api.start).toHaveBeenCalledWith('task-1');
  expect(api.finish).toHaveBeenCalledWith('focus-1');
});
