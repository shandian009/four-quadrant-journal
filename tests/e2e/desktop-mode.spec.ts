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

async function nativeWindowState(application: ElectronApplication): Promise<NativeWindowState> {
  return application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((candidate) => candidate.getTitle() === '四象日志');
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
    const initialHostState = getHostStatus(helperPath, initialWindow.hwnd);

    const normalOpacitySlider = page.getByRole('slider', { name: '窗口透明度' });
    await normalOpacitySlider.evaluate((element) => {
      const input = element as HTMLInputElement;
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setValue) throw new Error('无法设置透明度滑块');
      setValue.call(input, '0.6');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect.poll(async () => (await nativeWindowState(application!)).opacity).toBe(.6);
    await page.getByRole('button', { name: '恢复完全不透明' }).click();
    await expect.poll(async () => (await nativeWindowState(application!)).opacity).toBe(1);

    const recoveryWindowPromise = application.waitForEvent('window');
    await page.getByRole('button', { name: '嵌入桌面' }).click();
    const recoveryPage = await recoveryWindowPromise;
    await expect(page.getByRole('button', { name: '恢复窗口' })).toBeVisible({ timeout: 10_000 });
    await expect(recoveryPage.getByText('四象日志已嵌入桌面')).toBeVisible({ timeout: 10_000 });
    await expect(recoveryPage.getByRole('link', { name: '恢复并编辑' })).toBeVisible();

    const attachedWindow = await nativeWindowState(application);
    const attachedHostState = getHostStatus(helperPath, attachedWindow.hwnd);
    const compatible = await page.getByText('桌面兼容模式').isVisible().catch(() => false);
    const style = BigInt(attachedHostState.style) & 0xffffffffn;
    if (compatible) {
      expect(attachedHostState.parent).toBe('0');
      // Electron may normalize WS_POPUP after the native helper has placed the
      // top-level window at HWND_BOTTOM. The durable safety invariant is that a
      // compatibility window remains top-level and never keeps WS_CHILD.
      expect(style & 0x40000000n).toBe(0n);
    } else {
      expect(attachedHostState.parent).not.toBe('0');
      expect(style & 0x40000000n).toBe(0x40000000n);
      expect(style & 0x80000000n).toBe(0n);
    }

    const opacitySlider = page.getByRole('slider', { name: '窗口透明度' });
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

    await recoveryPage.getByRole('link', { name: '恢复并编辑' }).click();
    await expect(page.getByRole('button', { name: '嵌入桌面' })).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => recoveryPage.isClosed()).toBe(true);
    await expect.poll(() => getHostStatus(helperPath, attachedWindow.hwnd).parent).toBe(initialHostState.parent);
    expect(getHostStatus(helperPath, attachedWindow.hwnd).style).toBe(initialHostState.style);
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
