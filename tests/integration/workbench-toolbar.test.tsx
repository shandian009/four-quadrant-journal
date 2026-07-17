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
  it('opens all six themes and directly persists any selected theme', async () => {
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

    const options = screen.getAllByRole('menuitemradio');
    expect(options).toHaveLength(6);
    const labels = [
      '周一 · 冷启动',
      '周二 · 渐入状态',
      '周三 · 舒缓续航',
      '周四 · 沉稳推进',
      '周五 · 冲刺收官',
      '周六 · 松弛复盘'
    ];
    labels.forEach((label) => expect(screen.getByRole('menuitemradio', { name: label })).toBeVisible());
    expect(screen.getByRole('menuitemradio', { name: '周一 · 冷启动' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('menuitemradio', { name: '周六 · 松弛复盘' }));

    expect(settings.set).toHaveBeenCalledWith('themeOverride', {
      themeId: 'saturday',
      mode: 'persistent'
    });
    expect(onThemeChange).toHaveBeenCalledWith({ themeId: 'saturday', mode: 'persistent' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('can directly move backward from saturday to monday', async () => {
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
    await user.click(screen.getByRole('menuitemradio', { name: '周一 · 冷启动' }));

    expect(settings.set).toHaveBeenCalledWith('themeOverride', { themeId: 'monday', mode: 'persistent' });
    expect(onThemeChange).toHaveBeenCalledWith({ themeId: 'monday', mode: 'persistent' });
  });

  it('lets automatic mode select any concrete theme', async () => {
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
    await user.click(screen.getByRole('menuitemradio', { name: '周四 · 沉稳推进' }));

    expect(settings.set).toHaveBeenCalledWith('themeOverride', {
      themeId: 'thursday',
      mode: 'persistent'
    });
  });

  it('closes the theme menu with Escape', async () => {
    const user = userEvent.setup();
    render(<WorkbenchToolbar themeId="monday" selection="monday" onThemeChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '切换皮肤，当前：周一 · 冷启动' }));
    expect(screen.getByRole('menu')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
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
    await user.click(screen.getByRole('menuitemradio', { name: '周六 · 松弛复盘' }));

    expect(onThemeChange).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('皮肤保存失败，请重试');
    expect(button).toBeEnabled();

    await user.click(screen.getByRole('menuitemradio', { name: '周六 · 松弛复盘' }));
    expect(onThemeChange).toHaveBeenCalledWith({ themeId: 'saturday', mode: 'persistent' });
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
    await user.click(screen.getByRole('menuitemradio', { name: '周六 · 松弛复盘' }));
    expect(button).toBeDisabled();
    await user.click(screen.getByRole('menuitemradio', { name: '周五 · 冲刺收官' }));
    expect(settings.set).toHaveBeenCalledTimes(1);

    resolveSet();
    await waitFor(() => expect(button).toBeEnabled());
  });
});
