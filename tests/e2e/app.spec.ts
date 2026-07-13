import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('persists a task and review across restart', async () => {
  const userData = mkdtempSync(path.join(tmpdir(), 'four-quadrant-e2e-'));
  const launch = () => electron.launch({
    args: ['.'],
    env: { ...process.env, FOUR_QUADRANT_USER_DATA: userData, E2E_EXIT_ON_CLOSE: '1' }
  });

  let application = await launch();
  let window = await application.firstWindow();
  await window.getByRole('button', { name: '添加事项' }).click();
  await window.getByLabel('事项标题').fill('提交项目报告');
  await window.getByRole('button', { name: '保存' }).click();
  await expect(window.getByText('提交项目报告')).toBeVisible();
  await window.getByLabel('今日收获').fill('完成报告');
  await window.waitForTimeout(700);
  await application.close();

  application = await launch();
  window = await application.firstWindow();
  await expect(window.getByText('提交项目报告')).toBeVisible();
  await expect(window.getByLabel('今日收获')).toHaveValue('完成报告');
  await application.close();
  rmSync(userData, { recursive: true, force: true });
});
