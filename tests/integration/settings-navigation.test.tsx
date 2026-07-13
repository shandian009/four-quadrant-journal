import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { JournalApi } from '../../src/shared/ipc';
import { DashboardFrame } from '../../src/renderer/components/DashboardFrame';

it('opens settings from the sidebar', async () => {
  const user = userEvent.setup();
  const api = {
    tasks: { listByDate: vi.fn().mockResolvedValue([]) },
    reviews: { get: vi.fn().mockResolvedValue(null), save: vi.fn() },
    statistics: { forDate: vi.fn().mockResolvedValue({ planned: 0, completed: 0, pending: 0, completionRate: 0, focusSeconds: 0 }) },
    settings: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), setLoginOpen: vi.fn() },
    backup: { export: vi.fn(), restore: vi.fn() }
  } as unknown as JournalApi;
  render(<DashboardFrame themeId="tuesday" journalApi={api} onThemeChange={vi.fn()} />);

  await user.click(screen.getByRole('button', { name: '设置' }));

  expect(screen.getByRole('heading', { name: '设置' })).toBeVisible();
  expect(screen.getByLabelText('皮肤')).toBeVisible();
});
