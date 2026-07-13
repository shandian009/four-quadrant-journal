import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewApi } from '../../src/shared/ipc';
import { DailyReviewEditor } from '../../src/renderer/features/review/DailyReviewEditor';

describe('daily review autosave', () => {
  it('saves once 500ms after the last edit', async () => {
    vi.useFakeTimers();
    const api: ReviewApi = {
      get: vi.fn().mockResolvedValue(null),
      listByRange: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue({
        id: 'review-1', reviewDate: '2026-07-10', wins: '完成报告', improvements: '', tomorrowFocus: '',
        createdAt: '2026-07-10T18:00:00.000Z', updatedAt: '2026-07-10T18:00:00.000Z'
      })
    };
    render(<DailyReviewEditor api={api} date="2026-07-10" />);
    await act(async () => Promise.resolve());

    fireEvent.change(screen.getByLabelText('今日收获'), { target: { value: '完成报告' } });
    await act(async () => vi.advanceTimersByTimeAsync(499));
    expect(api.save).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save).toHaveBeenCalledWith('2026-07-10', {
      wins: '完成报告', improvements: '', tomorrowFocus: ''
    });
    vi.useRealTimers();
  });

  it('retains text and offers retry when saving fails', async () => {
    vi.useFakeTimers();
    const api: ReviewApi = {
      get: vi.fn().mockResolvedValue(null),
      listByRange: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockRejectedValue(new Error('disk full'))
    };
    render(<DailyReviewEditor api={api} date="2026-07-10" />);
    await act(async () => Promise.resolve());
    fireEvent.change(screen.getByLabelText('待改进'), { target: { value: '提前复核' } });
    await act(async () => vi.advanceTimersByTimeAsync(500));

    expect(screen.getByLabelText('待改进')).toHaveValue('提前复核');
    expect(screen.getByRole('button', { name: '未保存，点击重试' })).toBeVisible();
    vi.useRealTimers();
  });
});
