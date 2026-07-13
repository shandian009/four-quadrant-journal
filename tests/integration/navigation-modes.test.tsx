import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { JournalApi } from '../../src/shared/ipc';
import { DashboardFrame } from '../../src/renderer/components/DashboardFrame';

function api(): JournalApi {
  return {
    app: { version: vi.fn().mockResolvedValue('0.1.0') },
    tasks: {
      listByDate: vi.fn().mockResolvedValue([]), listByRange: vi.fn().mockResolvedValue([]),
      create: vi.fn(), update: vi.fn(), complete: vi.fn(), restore: vi.fn(),
      setManualStruck: vi.fn(), remove: vi.fn()
    },
    reviews: { get: vi.fn().mockResolvedValue(null), listByRange: vi.fn().mockResolvedValue([]), save: vi.fn() },
    statistics: { forDate: vi.fn().mockResolvedValue({ planned: 0, completed: 0, pending: 0, completionRate: 0, focusSeconds: 0 }) },
    focus: { current: vi.fn().mockResolvedValue(null), start: vi.fn(), pause: vi.fn(), resume: vi.fn(), finish: vi.fn() },
    settings: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), setLoginOpen: vi.fn() },
    backup: { export: vi.fn(), restore: vi.fn() },
    reports: { exportText: vi.fn() },
    window: {
      getDesktopState: vi.fn().mockResolvedValue({ mode: 'normal', opacity: 1 }),
      enterDesktopMode: vi.fn(), exitDesktopMode: vi.fn(), setDesktopOpacity: vi.fn()
    }
  } as JournalApi;
}

it('switches between quadrant, calendar, review and statistics modes', async () => {
  const user = userEvent.setup();
  render(<DashboardFrame themeId="tuesday" journalApi={api()} taskApi={api().tasks} />);

  await user.click(screen.getByRole('button', { name: '四象限' }));
  expect(screen.getByRole('heading', { name: '四象限' })).toBeVisible();
  expect(await screen.findByRole('region', { name: '重要且紧急' })).toBeVisible();

  await user.click(screen.getByRole('button', { name: '日历' }));
  expect(screen.getByRole('heading', { name: '日历' })).toBeVisible();
  expect(screen.getByRole('region', { name: '月历' })).toBeVisible();

  await user.click(screen.getByRole('button', { name: '复盘' }));
  expect(screen.getByRole('heading', { name: '复盘' })).toBeVisible();
  expect(screen.getByLabelText('今日收获')).toBeVisible();

  await user.click(screen.getByRole('button', { name: '统计' }));
  expect(screen.getByRole('heading', { name: '统计' })).toBeVisible();
  expect(screen.getByText('计划完成度')).toBeVisible();
});
