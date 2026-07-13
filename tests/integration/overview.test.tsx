import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Overview, OverviewLoader } from '../../src/renderer/features/dashboard/Overview';

it('renders daily statistics', () => {
  render(<Overview statistics={{ planned: 8, completed: 6, pending: 2, completionRate: 75, focusSeconds: 22_320 }} />);

  expect(screen.getByText('75%')).toBeVisible();
  expect(screen.getByText('6.2h')).toBeVisible();
  expect(screen.getByText('6/8')).toBeVisible();
  expect(screen.getByText('2')).toBeVisible();
});

it('loads statistics for the selected date', async () => {
  const api = { forDate: vi.fn().mockResolvedValue({ planned: 4, completed: 1, pending: 3, completionRate: 25, focusSeconds: 3600 }) };
  render(<OverviewLoader api={api} date="2026-07-10" />);

  expect(await screen.findByText('25%')).toBeVisible();
  expect(api.forDate).toHaveBeenCalledWith('2026-07-10');
});
