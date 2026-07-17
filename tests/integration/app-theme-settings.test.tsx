import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { JournalApi } from '../../src/shared/ipc';
import { App } from '../../src/renderer/App';

it('loads a persisted theme override', async () => {
  const api = {
    reviews: { get: vi.fn().mockResolvedValue(null), save: vi.fn() },
    statistics: { forDate: vi.fn().mockResolvedValue({ planned: 0, completed: 0, pending: 0, completionRate: 0, focusSeconds: 0 }) },
    settings: { get: vi.fn().mockResolvedValue({ themeId: 'wednesday', mode: 'persistent' }) }
  } as unknown as JournalApi;
  render(<App api={api} now={() => new Date('2026-07-06T09:00:00')} />);

  expect(await screen.findByText('周三 · 舒缓续航')).toBeVisible();
});

it('can directly select any theme when a today override has expired', async () => {
  const user = userEvent.setup();
  const api = {
    reviews: { get: vi.fn().mockResolvedValue(null), save: vi.fn() },
    statistics: { forDate: vi.fn().mockResolvedValue({ planned: 0, completed: 0, pending: 0, completionRate: 0, focusSeconds: 0 }) },
    settings: {
      get: vi.fn().mockResolvedValue({ themeId: 'monday', mode: 'today', date: '2026-07-06' }),
      set: vi.fn().mockResolvedValue(undefined)
    }
  } as unknown as JournalApi;
  render(<App api={api} now={() => new Date(2026, 6, 7, 9)} />);

  const button = await screen.findByRole('button', { name: '切换皮肤，当前：周二 · 渐入状态' });
  await user.click(button);
  await user.click(screen.getByRole('menuitemradio', { name: '周六 · 松弛复盘' }));

  expect(api.settings.set).toHaveBeenCalledWith('themeOverride', { themeId: 'saturday', mode: 'persistent' });
  expect(await screen.findByRole('button', { name: '切换皮肤，当前：周六 · 松弛复盘' })).toBeVisible();
});

it('disables theme switching until the initial setting has loaded', async () => {
  const user = userEvent.setup();
  let resolveGet!: (value: { themeId: 'friday'; mode: 'persistent' }) => void;
  const get = vi.fn().mockReturnValue(new Promise((resolve) => { resolveGet = resolve; }));
  const set = vi.fn().mockResolvedValue(undefined);
  const api = {
    reviews: { get: vi.fn().mockResolvedValue(null), save: vi.fn() },
    statistics: { forDate: vi.fn().mockResolvedValue({ planned: 0, completed: 0, pending: 0, completionRate: 0, focusSeconds: 0 }) },
    settings: { get, set }
  } as unknown as JournalApi;
  render(<App api={api} now={() => new Date(2026, 6, 7, 9)} />);

  const loadingButton = screen.getByRole('button', { name: '切换皮肤，当前：周二 · 渐入状态' });
  expect(loadingButton).toBeDisabled();
  await user.click(loadingButton);
  expect(set).not.toHaveBeenCalled();

  resolveGet({ themeId: 'friday', mode: 'persistent' });
  const loadedButton = await screen.findByRole('button', { name: '切换皮肤，当前：周五 · 冲刺收官' });
  expect(loadedButton).toBeEnabled();
  await user.click(loadedButton);
  await user.click(screen.getByRole('menuitemradio', { name: '周一 · 冷启动' }));
  expect(set).toHaveBeenCalledWith('themeOverride', { themeId: 'monday', mode: 'persistent' });
});

it('reports an initial theme read failure and enables switching with the automatic theme', async () => {
  const api = {
    reviews: { get: vi.fn().mockResolvedValue(null), save: vi.fn() },
    statistics: { forDate: vi.fn().mockResolvedValue({ planned: 0, completed: 0, pending: 0, completionRate: 0, focusSeconds: 0 }) },
    settings: { get: vi.fn().mockRejectedValue(new Error('read failed')), set: vi.fn().mockResolvedValue(undefined) }
  } as unknown as JournalApi;
  render(<App api={api} now={() => new Date(2026, 6, 7, 9)} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('读取皮肤设置失败，已使用自动皮肤');
  expect(screen.getByRole('button', { name: '切换皮肤，当前：周二 · 渐入状态' })).toBeEnabled();
});

it('replaces a read warning with a save warning and clears all warnings after a successful retry', async () => {
  const user = userEvent.setup();
  const set = vi.fn()
    .mockRejectedValueOnce(new Error('write failed'))
    .mockResolvedValueOnce(undefined);
  const api = {
    reviews: { get: vi.fn().mockResolvedValue(null), save: vi.fn() },
    statistics: { forDate: vi.fn().mockResolvedValue({ planned: 0, completed: 0, pending: 0, completionRate: 0, focusSeconds: 0 }) },
    settings: { get: vi.fn().mockRejectedValue(new Error('read failed')), set }
  } as unknown as JournalApi;
  render(<App api={api} now={() => new Date(2026, 6, 7, 9)} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('读取皮肤设置失败，已使用自动皮肤');
  const button = screen.getByRole('button', { name: '切换皮肤，当前：周二 · 渐入状态' });

  await user.click(button);
  await user.click(screen.getByRole('menuitemradio', { name: '周三 · 舒缓续航' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('皮肤保存失败，请重试');
  expect(screen.queryByText('读取皮肤设置失败，已使用自动皮肤')).not.toBeInTheDocument();

  await user.click(screen.getByRole('menuitemradio', { name: '周三 · 舒缓续航' }));
  expect(set).toHaveBeenCalledTimes(2);
  expect(await screen.findByRole('button', { name: '切换皮肤，当前：周三 · 舒缓续航' })).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
