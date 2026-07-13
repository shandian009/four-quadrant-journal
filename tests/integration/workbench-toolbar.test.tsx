import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsApi } from '../../src/shared/ipc';
import { WorkbenchToolbar } from '../../src/renderer/features/toolbar/WorkbenchToolbar';

function settingsApi(): SettingsApi {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    setLoginOpen: vi.fn().mockResolvedValue(undefined)
  };
}

describe('workbench toolbar', () => {
  it('persists the next concrete theme as a long-term override', async () => {
    const user = userEvent.setup();
    const settings = settingsApi();
    const onThemeChange = vi.fn();
    render(
      <WorkbenchToolbar
        themeId="monday"
        selection="monday"
        settings={settings}
        onThemeChange={onThemeChange}
      />
    );

    await user.click(screen.getByRole('button', { name: '切换皮肤，当前：周一 · 冷启动' }));

    expect(settings.set).toHaveBeenCalledWith('themeOverride', {
      themeId: 'tuesday',
      mode: 'persistent'
    });
    expect(onThemeChange).toHaveBeenCalledWith({ themeId: 'tuesday', mode: 'persistent' });
  });

  it('clears the override after saturday to restore automatic selection', async () => {
    const user = userEvent.setup();
    const settings = settingsApi();
    const onThemeChange = vi.fn();
    render(
      <WorkbenchToolbar
        themeId="saturday"
        selection="saturday"
        settings={settings}
        onThemeChange={onThemeChange}
      />
    );

    await user.click(screen.getByRole('button', { name: '切换皮肤，当前：周六 · 松弛复盘' }));

    expect(settings.set).toHaveBeenCalledWith('themeOverride', null);
    expect(onThemeChange).toHaveBeenCalledWith(null);
  });

  it('advances auto from the resolved weekday and saves the visible next theme', async () => {
    const user = userEvent.setup();
    const settings = settingsApi();
    const onThemeChange = vi.fn();
    render(
      <WorkbenchToolbar
        themeId="monday"
        selection="auto"
        settings={settings}
        now={() => new Date(2026, 6, 6, 12)}
        onThemeChange={onThemeChange}
      />
    );

    await user.click(screen.getByRole('button', { name: '切换皮肤，当前：周一 · 冷启动' }));

    expect(settings.set).toHaveBeenCalledWith('themeOverride', {
      themeId: 'tuesday',
      mode: 'persistent'
    });
  });

  it('reserves disabled desktop, opacity and report controls', () => {
    render(
      <WorkbenchToolbar
        themeId="tuesday"
        selection="tuesday"
        onThemeChange={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: '嵌入桌面' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '透明度' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '周报' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '月报' })).toBeDisabled();
  });

  it('keeps the current theme, reports a save failure, and allows retry', async () => {
    const user = userEvent.setup();
    const settings = settingsApi();
    vi.mocked(settings.set).mockRejectedValueOnce(new Error('write failed')).mockResolvedValueOnce(undefined);
    const onThemeChange = vi.fn();
    render(
      <WorkbenchToolbar themeId="monday" selection="monday" settings={settings} onThemeChange={onThemeChange} />
    );

    const button = screen.getByRole('button', { name: '切换皮肤，当前：周一 · 冷启动' });
    await user.click(button);

    expect(onThemeChange).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('皮肤保存失败，请重试');
    expect(button).toBeEnabled();

    await user.click(button);
    expect(onThemeChange).toHaveBeenCalledWith({ themeId: 'tuesday', mode: 'persistent' });
  });

  it('disables the theme button while saving to prevent duplicate writes', async () => {
    const user = userEvent.setup();
    let resolveSet!: () => void;
    const settings = settingsApi();
    vi.mocked(settings.set).mockReturnValue(new Promise<void>((resolve) => { resolveSet = resolve; }));
    render(
      <WorkbenchToolbar themeId="monday" selection="monday" settings={settings} onThemeChange={vi.fn()} />
    );

    const button = screen.getByRole('button', { name: '切换皮肤，当前：周一 · 冷启动' });
    await user.click(button);
    expect(button).toBeDisabled();
    await user.click(button);
    expect(settings.set).toHaveBeenCalledTimes(1);

    resolveSet();
    await waitFor(() => expect(button).toBeEnabled());
  });
});
