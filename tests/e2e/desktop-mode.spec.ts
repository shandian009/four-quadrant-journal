import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const executablePath = process.env.PACKAGED_APP_PATH;
const packagedAppExists = Boolean(executablePath && existsSync(executablePath));

test.skip(!packagedAppExists, '仅在 Windows 打包产物验证阶段运行');

interface NativeWindowState {
  hwnd: string;
  opacity: number;
  resourcesPath: string;
}

interface HostStatus {
  success: true;
  parent: string;
  style: string;
}

interface HostInspection extends HostStatus {
  originalParent: string;
  originalStyle: string;
}

async function nativeWindowState(application: ElectronApplication): Promise<NativeWindowState> {
  return application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) throw new Error('找不到应用窗口');
    const handle = window.getNativeWindowHandle();
    return {
      hwnd: (handle.length >= 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE())).toString(),
      opacity: window.getOpacity(),
      resourcesPath: process.resourcesPath
    };
  });
}

function getHostStatus(helperPath: string, hwnd: string): HostStatus {
  const output = execFileSync(helperPath, ['status', hwnd], { encoding: 'utf8', windowsHide: true });
  return JSON.parse(output) as HostStatus;
}

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

test('desktop mode attaches the real window, applies opacity and restores safely', async () => {
  const userData = mkdtempSync(path.join(tmpdir(), 'four-quadrant-desktop-'));
  let application: ElectronApplication | undefined;

  try {
    application = await launchPackagedApp(userData);
    let page = await application.firstWindow({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: '今日工作台' })).toBeVisible({ timeout: 10_000 });

    const initialWindow = await nativeWindowState(application);
    const helperPath = path.join(
      initialWindow.resourcesPath,
      'app.asar.unpacked',
      'build',
      'desktop-host.exe'
    );
    expect(existsSync(helperPath)).toBe(true);
    const inspection = JSON.parse(execFileSync(helperPath, ['inspect', initialWindow.hwnd], {
      encoding: 'utf8', windowsHide: true
    })) as HostInspection;

    await page.getByRole('button', { name: '嵌入桌面' }).click();
    const restoreButton = page.getByRole('button', { name: '恢复窗口' });
    try {
      await expect(restoreButton).toBeVisible({ timeout: 10_000 });
    } catch (uiError) {
      try {
        execFileSync(helperPath, ['attach', initialWindow.hwnd], { encoding: 'utf8', windowsHide: true });
        execFileSync(helperPath, [
          'detach', initialWindow.hwnd, inspection.originalParent, inspection.originalStyle
        ], { encoding: 'utf8', windowsHide: true });
      } catch (nativeError) {
        const output = `${(nativeError as { stdout?: string }).stdout ?? ''}${(nativeError as { stderr?: string }).stderr ?? ''}`;
        if (/找不到 (?:Progman|WorkerW)/.test(output)) {
          test.skip(true, `托管测试机缺少可交互桌面层：${output.trim()}`);
          return;
        }
        throw new Error(`桌面助手拒绝嵌入：${output.trim()}`, { cause: nativeError });
      }
      throw uiError;
    }

    const attachedWindow = await nativeWindowState(application);
    await expect.poll(() => getHostStatus(helperPath, attachedWindow.hwnd).parent).not.toBe('0');
    expect(getHostStatus(helperPath, attachedWindow.hwnd).success).toBe(true);

    const opacitySlider = page.getByRole('slider', { name: '桌面透明度' });
    for (const value of ['0.4', '0.85', '1']) {
      await opacitySlider.evaluate((element, nextValue) => {
        const input = element as HTMLInputElement;
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!setValue) throw new Error('无法设置透明度滑块');
        setValue.call(input, nextValue);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
      await expect.poll(async () => (await nativeWindowState(application!)).opacity).toBe(Number(value));
    }

    await page.getByRole('button', { name: '恢复窗口' }).click();
    await expect(page.getByRole('button', { name: '嵌入桌面' })).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => getHostStatus(helperPath, attachedWindow.hwnd).parent).toBe('0');
    await expect.poll(async () => (await nativeWindowState(application!)).opacity).toBe(1);

    await application.close();
    application = await launchPackagedApp(userData);
    page = await application.firstWindow({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: '今日工作台' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: '嵌入桌面' })).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => (await nativeWindowState(application!)).opacity).toBe(1);
  } finally {
    await application?.close().catch(() => undefined);
    rmSync(userData, { recursive: true, force: true });
  }
});
