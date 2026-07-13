import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DailyReview, Task } from '../../src/shared/domain';
import type { JournalApi } from '../../src/shared/ipc';
import { ReportDialog } from '../../src/renderer/features/reports/ReportDialog';
import { DashboardFrame } from '../../src/renderer/components/DashboardFrame';

const task: Task = {
  id: 'task-1', title: '完成真实事项', notes: '', quadrant: 'urgent_important', plannedDate: '2026-07-08',
  dueAt: null, remindAt: null, estimatedMinutes: null, status: 'completed', manualStruck: false, sortOrder: 0,
  completedAt: '2026-07-08T08:00:00.000Z', createdAt: '2026-07-08T01:00:00.000Z', updatedAt: '2026-07-08T08:00:00.000Z'
};
const review: DailyReview = {
  id: 'review-1', reviewDate: '2026-07-08', wins: '完成范围确认', improvements: '更早同步风险', tomorrowFocus: '继续收尾',
  createdAt: '2026-07-08T01:00:00.000Z', updatedAt: '2026-07-08T01:00:00.000Z'
};

function api(overrides: Partial<JournalApi> = {}): JournalApi {
  return {
    app: { version: vi.fn() },
    tasks: {
      listByDate: vi.fn(), listByRange: vi.fn().mockResolvedValue([task]), create: vi.fn(), update: vi.fn(), complete: vi.fn(),
      restore: vi.fn(), setManualStruck: vi.fn(), remove: vi.fn()
    },
    reviews: { get: vi.fn().mockResolvedValue(null), listByRange: vi.fn().mockResolvedValue([review]), save: vi.fn() },
    statistics: { forDate: vi.fn().mockResolvedValue({ planned: 0, completed: 0, pending: 0, completionRate: 0, focusSeconds: 0 }) },
    focus: { current: vi.fn(), start: vi.fn(), pause: vi.fn(), resume: vi.fn(), finish: vi.fn() },
    settings: { get: vi.fn(), set: vi.fn(), setLoginOpen: vi.fn() },
    backup: { export: vi.fn(), restore: vi.fn() },
    reports: { exportText: vi.fn().mockResolvedValue('/tmp/report.txt') },
    window: {
      getDesktopState: vi.fn().mockResolvedValue({ mode: 'normal', opacity: 1 }),
      enterDesktopMode: vi.fn(), exitDesktopMode: vi.fn(), setDesktopOpacity: vi.fn()
    },
    ...overrides
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('ReportDialog', () => {
  it('wires toolbar reports to the selected day and current displayed month', async () => {
    const user = userEvent.setup();
    const journalApi = api();
    render(<DashboardFrame themeId="monday" journalApi={journalApi} taskApi={journalApi.tasks} now={() => new Date(2026, 6, 12, 12)} />);
    await waitFor(() => expect(journalApi.tasks.listByRange).toHaveBeenCalledWith('2026-07-01', '2026-07-31'));

    await user.click(screen.getByRole('button', { name: '下个月' }));
    await user.click(screen.getByTestId('calendar-day-2026-08-18'));
    await user.click(screen.getByRole('button', { name: '月报' }));
    await waitFor(() => expect(journalApi.reviews.listByRange).toHaveBeenCalledWith('2026-08-01', '2026-08-31'));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('月报（2026-08-01 至 2026-08-31）');

    await user.click(screen.getByRole('button', { name: '关闭报告' }));
    await user.click(screen.getByRole('button', { name: '周报' }));
    await waitFor(() => expect(journalApi.reviews.listByRange).toHaveBeenCalledWith('2026-08-17', '2026-08-23'));
    expect(screen.getByRole('dialog')).toHaveAccessibleName('周报（2026-08-17 至 2026-08-23）');
  });

  it('loads one inclusive task and review range then shows readonly generated text and injected generation time', async () => {
    const journalApi = api();
    render(<ReportDialog api={journalApi} kind="weekly" anchorDate="2026-07-12" now={() => new Date('2030-01-02T03:04:05.000Z')} onClose={() => undefined} />);

    expect(screen.getByText('正在生成本地报告…')).toBeInTheDocument();
    const textbox = await screen.findByRole('textbox', { name: '报告正文' });
    expect(textbox).toHaveAttribute('readonly');
    expect((textbox as HTMLTextAreaElement).value).toContain('完成真实事项');
    expect(journalApi.tasks.listByRange).toHaveBeenCalledTimes(1);
    expect(journalApi.tasks.listByRange).toHaveBeenCalledWith('2026-07-06', '2026-07-12');
    expect(journalApi.reviews.listByRange).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/2030-01-02/)).toBeInTheDocument();
  });

  it('copies generated text and reports clipboard permission failure', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const journalApi = api();
    render(<ReportDialog api={journalApi} kind="weekly" anchorDate="2026-07-12" onClose={() => undefined} />);
    await screen.findByRole('textbox', { name: '报告正文' });

    fireEvent.click(screen.getByRole('button', { name: '复制' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('完成真实事项')));
    writeText.mockRejectedValueOnce(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: '复制' }));
    expect(await screen.findByRole('status')).toHaveTextContent('复制失败，请手动选择文本');
  });

  it('exports with the exact weekly filename and treats cancellation as a non-error', async () => {
    const journalApi = api();
    vi.mocked(journalApi.reports.exportText).mockResolvedValueOnce(null);
    render(<ReportDialog api={journalApi} kind="weekly" anchorDate="2026-07-12" onClose={() => undefined} />);
    const textbox = await screen.findByRole('textbox', { name: '报告正文' });

    fireEvent.click(screen.getByRole('button', { name: '导出 TXT' }));
    await waitFor(() => expect(journalApi.reports.exportText).toHaveBeenCalledWith('四象日志-周报-2026-07-06.txt', (textbox as HTMLTextAreaElement).value));
    expect(screen.queryByText(/导出失败/)).not.toBeInTheDocument();
  });

  it('regenerates by issuing one new range call per data source and keeps existing text on failure', async () => {
    const journalApi = api();
    render(<ReportDialog api={journalApi} kind="monthly" anchorDate="2026-07-15" onClose={() => undefined} />);
    const textbox = await screen.findByRole('textbox', { name: '报告正文' });
    const existing = (textbox as HTMLTextAreaElement).value;
    vi.mocked(journalApi.tasks.listByRange).mockRejectedValueOnce(new Error('read failed'));

    fireEvent.click(screen.getByRole('button', { name: '重新生成' }));
    await waitFor(() => expect(journalApi.tasks.listByRange).toHaveBeenCalledTimes(2));
    expect(journalApi.reviews.listByRange).toHaveBeenCalledTimes(2);
    expect(textbox).toHaveValue(existing);
    expect(await screen.findByRole('alert')).toHaveTextContent('报告生成失败，请重试');
  });

  it('shows the fixed unconfigured AI result without fetch or an SDK request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const journalApi = api();
    render(<ReportDialog api={journalApi} kind="weekly" anchorDate="2026-07-12" onClose={() => undefined} />);
    await screen.findByRole('textbox', { name: '报告正文' });

    fireEvent.click(screen.getByRole('button', { name: 'AI 润色' }));
    expect(await screen.findByRole('status')).toHaveTextContent('尚未配置 AI 服务，本地报告不受影响');
    expect(fetch).not.toHaveBeenCalled();
  });
});
