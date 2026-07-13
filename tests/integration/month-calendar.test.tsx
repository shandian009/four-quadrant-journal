import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MonthCalendar, monthRange, shiftMonth } from '../../src/renderer/features/calendar/MonthCalendar';

describe('month calendar navigation', () => {
  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });

  it('returns the complete range for leap-year February', () => {
    expect(monthRange('2028-02')).toEqual({ startDate: '2028-02-01', endDate: '2028-02-29' });
    expect(monthRange('2027-02')).toEqual({ startDate: '2027-02-01', endDate: '2027-02-28' });
  });

  it('offers accessible previous, next and today controls', async () => {
    const user = userEvent.setup();
    const onDisplayMonthChange = vi.fn();
    const onToday = vi.fn();

    render(
      <MonthCalendar
        displayMonth="2026-12"
        selectedDate="2026-12-10"
        tasks={[]}
        onSelect={vi.fn()}
        onDisplayMonthChange={onDisplayMonthChange}
        onToday={onToday}
      />
    );

    await user.click(screen.getByRole('button', { name: '上个月' }));
    expect(onDisplayMonthChange).toHaveBeenLastCalledWith('2026-11');

    await user.click(screen.getByRole('button', { name: '下个月' }));
    expect(onDisplayMonthChange).toHaveBeenLastCalledWith('2027-01');

    await user.click(screen.getByRole('button', { name: '今天' }));
    expect(onToday).toHaveBeenCalledTimes(1);
  });
});
