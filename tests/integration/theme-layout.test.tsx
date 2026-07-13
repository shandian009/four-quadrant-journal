import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DashboardFrame } from '../../src/renderer/components/DashboardFrame';

describe('weekday skin layout parity', () => {
  it('keeps dashboard regions unchanged across all six skins', () => {
    const { rerender } = render(<DashboardFrame themeId="monday" />);
    const baseline = screen.getAllByTestId(/^dashboard-region-/).map((node) => node.dataset.testid);

    for (const themeId of ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const) {
      rerender(<DashboardFrame themeId={themeId} />);
      expect(screen.getAllByTestId(/^dashboard-region-/).map((node) => node.dataset.testid)).toEqual(baseline);
      expect(screen.getByTestId('application-shell')).toHaveAttribute('data-theme', themeId);
    }

    expect(screen.getByText('周六 · 松弛复盘')).toBeVisible();
    expect(screen.getByTestId('application-shell').getAttribute('style')).toContain('--canvas-gradient:');
  });

  it('applies semantic gradients to each dashboard region', () => {
    const css = readFileSync('src/renderer/styles/layout.css', 'utf8');
    expect(css).toContain('background: var(--canvas-gradient)');
    expect(css).toContain('background: var(--sidebar-gradient)');
    expect(css).toContain('.calendar-panel { background: var(--calendar-gradient); }');
    expect(css).toContain('.overview-panel { background: var(--overview-gradient); }');
    expect(css).toContain('.review-panel { background: var(--review-gradient); }');
  });

  it('renders the approved dashboard regions', () => {
    render(<DashboardFrame themeId="tuesday" />);

    expect(screen.getByRole('navigation', { name: '主导航' })).toBeVisible();
    expect(screen.getByRole('region', { name: '今日优先事项' })).toBeVisible();
    expect(screen.getByRole('region', { name: '月历' })).toBeVisible();
    expect(screen.getByRole('region', { name: '今日概览' })).toBeVisible();
    expect(screen.getByRole('region', { name: '今日复盘' })).toBeVisible();
  });

  it('places the toolbar after the page heading without reordering dashboard content', () => {
    render(<DashboardFrame themeId="tuesday" />);

    const heading = screen.getByRole('heading', { name: '今日工作台' });
    const toolbar = screen.getByTestId('workbench-toolbar');
    const header = heading.closest('header');

    expect(header).not.toBeNull();
    expect(header?.children[0]).toBe(heading);
    expect(header?.children[1]).toBe(toolbar);
    expect(header?.nextElementSibling).toHaveClass('dashboard-grid');
    expect(screen.getAllByTestId(/^dashboard-region-/).map((node) => node.dataset.testid)).toEqual([
      'dashboard-region-priority',
      'dashboard-region-calendar',
      'dashboard-region-overview',
      'dashboard-region-review'
    ]);
  });
});
