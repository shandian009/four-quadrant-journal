import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { JournalApi } from '../../src/shared/ipc';
import { App } from '../../src/renderer/App';

function api(): JournalApi {
  return {
    app: { version: vi.fn().mockResolvedValue('0.3.0') },
    tasks: {
      listByDate: vi.fn().mockResolvedValue([]), listByRange: vi.fn().mockResolvedValue([]),
      create: vi.fn(), update: vi.fn(), complete: vi.fn(), restore: vi.fn(), setManualStruck: vi.fn(), remove: vi.fn()
    },
    reviews: { get: vi.fn().mockResolvedValue(null), listByRange: vi.fn().mockResolvedValue([]), save: vi.fn() },
    statistics: { forDate: vi.fn().mockResolvedValue({ planned: 0, completed: 0, pending: 0, completionRate: 0, focusSeconds: 0 }) },
    focus: { current: vi.fn().mockResolvedValue(null), start: vi.fn(), pause: vi.fn(), resume: vi.fn(), finish: vi.fn() },
    settings: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), setLoginOpen: vi.fn() },
    backup: { export: vi.fn(), restore: vi.fn() },
    reports: { exportText: vi.fn() },
    window: {
      getDesktopState: vi.fn().mockResolvedValue({ mode: 'desktop', opacity: .85 }),
      enterDesktopMode: vi.fn(), exitDesktopMode: vi.fn().mockResolvedValue({ mode: 'normal', opacity: 1 }), setDesktopOpacity: vi.fn()
    }
  };
}

describe('application shell', () => {
  it('renders the product identity and dashboard heading', () => {
    render(<App />);

    expect(screen.getByText('四象日志')).toBeVisible();
    expect(screen.getByRole('heading', { name: '今日工作台' })).toBeVisible();
  });

  it('uses the injected application clock for the preview calendar month', () => {
    render(<App now={() => new Date(2028, 1, 29, 9)} />);

    expect(screen.getByRole('heading', { name: '2028年2月' })).toBeVisible();
    expect(screen.getByTestId('calendar-day-2028-02-29')).toHaveClass('calendar-day--current');
  });

  it('renders one toolbar and preserves the approved dashboard region order in every theme', async () => {
    const themes = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const journalApi = api();
    const view = render(<App api={journalApi} now={() => new Date(2026, 6, 13, 9)} />);
    await waitFor(() => expect(screen.getByTestId('application-shell')).toHaveAttribute('data-theme', 'monday'));

    for (const themeId of themes) {
      view.rerender(<App api={journalApi} now={() => new Date(2026, 6, 13 + themes.indexOf(themeId), 9)} />);
      expect(screen.getByTestId('application-shell')).toHaveAttribute('data-theme', themeId);
      expect(screen.getAllByRole('toolbar', { name: '工作台工具条' })).toHaveLength(1);
      expect(screen.getAllByTestId(/^dashboard-region-/).map((node) => node.dataset.testid)).toEqual([
        'dashboard-region-priority', 'dashboard-region-calendar', 'dashboard-region-overview', 'dashboard-region-review'
      ]);
    }
  });

  it('keeps main navigation available while desktop controls are active', async () => {
    render(<App api={api()} />);

    expect(await screen.findByRole('button', { name: '恢复窗口' })).toBeVisible();
    expect(screen.getByRole('slider', { name: '窗口透明度' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeVisible();
    expect(screen.getByRole('button', { name: '四象限' })).toBeVisible();
  });

  it('opens weekly reports as an application modal without duplicating the toolbar', async () => {
    const user = userEvent.setup();
    render(<App api={api()} now={() => new Date(2026, 6, 12, 9)} />);

    await user.click(await screen.findByRole('button', { name: '周报' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('周报（2026-07-06 至 2026-07-12）');
    expect(screen.getAllByRole('toolbar', { name: '工作台工具条' })).toHaveLength(1);
  });

  it('adds only compact feature styles while retaining the approved grid and breakpoints', () => {
    const css = readFileSync('src/renderer/styles/layout.css', 'utf8');

    expect(css).toContain('grid-template-columns: 204px 1fr');
    expect(css).toContain('grid-template-columns: 1.04fr 1fr .9fr');
    expect(css).toContain('@media (max-height: 780px)');
    expect(css).toMatch(/\.workbench-toolbar__opacity\s*\{/);
    expect(css).toMatch(/\.workbench-toolbar__opacity input\[type="range"\][^{]*\{[^}]*accent-color: var\(--accent\)/s);
    expect(css).toMatch(/\.report-dialog\s*\{[^}]*background: var\(--surface-gradient\)/s);
    expect(css).not.toContain('var(--surface-primary)');
    expect(css).not.toContain('var(--border-subtle)');
  });
});
