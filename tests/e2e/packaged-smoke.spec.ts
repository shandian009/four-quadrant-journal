import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const executablePath = process.env.PACKAGED_APP_PATH;

test.skip(!executablePath, '仅在 Windows 打包产物验证阶段运行');

function launchPackagedApp(userData: string): Promise<ElectronApplication> {
  return electron.launch({
    executablePath: executablePath!,
    env: {
      ...process.env,
      FOUR_QUADRANT_USER_DATA: userData,
      E2E_EXIT_ON_CLOSE: '1',
      ELECTRON_ENABLE_LOGGING: '1'
    }
  });
}

test('packaged Windows app supports the core workbench flow and restart', async () => {
  const userData = mkdtempSync(path.join(tmpdir(), 'four-quadrant-packaged-'));
  let application: ElectronApplication | undefined;

  try {
    application = await launchPackagedApp(userData);
    let window = await application.firstWindow({ timeout: 20_000 });
    await expect(window.getByRole('heading', { name: '今日工作台' })).toBeVisible({ timeout: 10_000 });

    await window.getByRole('button', { name: '添加事项' }).click();
    await window.getByLabel('事项标题').fill('打包验收事项');
    await window.getByRole('button', { name: '保存' }).click();
    await expect(window.getByText('打包验收事项')).toBeVisible();

    const themeButton = window.getByRole('button', { name: /切换皮肤，当前：/ });
    const originalThemeLabel = await themeButton.getAttribute('aria-label');
    expect(originalThemeLabel).toBeTruthy();
    await themeButton.click();
    await expect(themeButton).not.toHaveAttribute('aria-label', originalThemeLabel!);

    const calendarHeading = window.getByRole('region', { name: '月历' }).getByRole('heading');
    const originalMonth = await calendarHeading.textContent();
    expect(originalMonth).toMatch(/^\d{4}年\d{1,2}月$/);
    await window.getByRole('button', { name: '下个月' }).click();
    await expect(calendarHeading).not.toHaveText(originalMonth!);

    await application.close();
    application = await launchPackagedApp(userData);
    window = await application.firstWindow({ timeout: 20_000 });
    await expect(window.getByRole('heading', { name: '今日工作台' })).toBeVisible({ timeout: 10_000 });
    await expect(window.getByText('打包验收事项')).toBeVisible({ timeout: 10_000 });
  } finally {
    await application?.close().catch(() => undefined);
    rmSync(userData, { recursive: true, force: true });
  }
});
