import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { BackupApi, SettingsApi } from '../../src/shared/ipc';
import { SettingsPage } from '../../src/renderer/features/settings/SettingsPage';
import type { ThemeId } from '../../src/renderer/theme/resolve-theme';
import { THEMES } from '../../src/renderer/theme/themes';

it('persists a manual theme override', async () => {
  const user = userEvent.setup();
  const settings: SettingsApi = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    setLoginOpen: vi.fn().mockResolvedValue(undefined)
  };
  const backup: BackupApi = { export: vi.fn(), restore: vi.fn() };
  const onThemeChange = vi.fn();
  render(<SettingsPage settings={settings} backup={backup} onThemeChange={onThemeChange} />);

  for (const id of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as ThemeId[]) {
    expect(screen.getByRole('option', { name: THEMES[id].label })).toHaveValue(id);
  }

  await user.selectOptions(screen.getByLabelText('皮肤'), 'saturday');
  await user.selectOptions(screen.getByLabelText('应用方式'), 'persistent');
  await user.click(screen.getByRole('button', { name: '应用皮肤' }));

  expect(settings.set).toHaveBeenCalledWith('themeOverride', { themeId: 'saturday', mode: 'persistent' });
  expect(onThemeChange).toHaveBeenCalledWith({ themeId: 'saturday', mode: 'persistent' });
});
