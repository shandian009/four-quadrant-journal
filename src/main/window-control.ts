import { spawn } from 'node:child_process';
import type { IpcMain } from 'electron';
import { z } from 'zod';
import type { DesktopWindowState } from '../shared/ipc';

export interface WindowBounds { x: number; y: number; width: number; height: number }

export interface WindowPort {
  getBounds(): WindowBounds;
  getNormalBounds(): WindowBounds;
  setBounds(bounds: WindowBounds): void;
  isMaximized(): boolean;
  maximize(): void;
  unmaximize(): void;
  setSkipTaskbar(skip: boolean): void;
  setMenuBarVisibility(visible: boolean): void;
  setOpacity(opacity: number): void;
  show(): void;
  focus(): void;
  getNativeWindowHandle(): bigint;
}

export interface SettingsPort {
  get<T>(key: string, fallback: T): T | Promise<T>;
  set(key: string, value: unknown): void | Promise<void>;
}

export interface DesktopRecoveryToken { originalParent: bigint; originalStyle: bigint }
export interface DesktopAttachResult {
  placement: 'embedded' | 'compatible';
  message: string;
}

export interface DesktopHostPort {
  inspect(hwnd: bigint): Promise<DesktopRecoveryToken>;
  attach(hwnd: bigint): Promise<DesktopAttachResult>;
  detach(hwnd: bigint, originalParent: bigint, originalStyle: bigint): Promise<void>;
}

export function clampDesktopOpacity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(.4, Math.round(value * 20) / 20))
    : .85;
}

const RECOVERY_MESSAGE = '未能嵌入桌面，已恢复普通窗口';
const RECOVERY_FAILED_MESSAGE = '恢复普通窗口失败，请从托盘重试';
const OPACITY_NOT_PERSISTED_MESSAGE = '透明度已应用，但未能保存设置';

export class WindowController {
  private state: DesktopWindowState = { mode: 'normal', opacity: 1 };
  private normalBounds: WindowBounds | null = null;
  private normalMaximized = false;
  private recoveryToken: DesktopRecoveryToken | null = null;
  private transitions: Promise<void> = Promise.resolve();

  constructor(
    private readonly window: WindowPort,
    private readonly settings: SettingsPort,
    private readonly host: DesktopHostPort
  ) {}

  getState(): DesktopWindowState {
    return { ...this.state };
  }

  async enter(): Promise<DesktopWindowState> {
    return this.enqueue(() => this.enterNow());
  }

  async exit(): Promise<DesktopWindowState> {
    return this.enqueue(() => this.exitNow());
  }

  async setOpacity(value: unknown): Promise<DesktopWindowState> {
    return this.enqueue(() => this.setOpacityNow(value));
  }

  async restoreVisibleWindow(): Promise<DesktopWindowState> {
    return this.enqueue(() => this.restoreVisibleWindowNow());
  }

  private async enterNow(): Promise<DesktopWindowState> {
    if (this.state.mode === 'desktop') return this.getState();
    this.normalBounds = this.window.getNormalBounds();
    this.normalMaximized = this.window.isMaximized();
    const hwnd = this.window.getNativeWindowHandle();

    try {
      this.recoveryToken = await this.host.inspect(hwnd);
      await this.settings.set('desktopNormalBounds', this.normalBounds);
      await this.settings.set('desktopNormalMaximized', this.normalMaximized);
      this.window.setSkipTaskbar(true);
      this.window.setMenuBarVisibility(false);
      const attached = await this.host.attach(hwnd);
      const legacyOpacity = await this.settings.get('desktopOpacity', .85);
      const opacity = clampDesktopOpacity(await this.settings.get('windowOpacity', legacyOpacity));
      this.window.setOpacity(opacity);
      this.state = attached.placement === 'compatible'
        ? { mode: 'desktop', opacity, placement: 'compatible' }
        : { mode: 'desktop', opacity };
      return this.getState();
    } catch (error) {
      try {
        await this.recoverCurrentSession(hwnd);
      } catch (recoveryError) {
        throw new Error(RECOVERY_FAILED_MESSAGE, { cause: recoveryError });
      }
      throw new Error(RECOVERY_MESSAGE, { cause: error });
    }
  }

  private async exitNow(): Promise<DesktopWindowState> {
    if (this.state.mode === 'normal' && !this.recoveryToken) {
      this.ensureVisible();
      return this.getState();
    }
    await this.recoverCurrentSession(this.window.getNativeWindowHandle());
    return this.getState();
  }

  private async setOpacityNow(value: unknown): Promise<DesktopWindowState> {
    const opacity = clampDesktopOpacity(value);
    this.window.setOpacity(opacity);
    this.state = { ...this.state, opacity };
    try {
      await this.settings.set('windowOpacity', opacity);
    } catch (error) {
      throw new Error(OPACITY_NOT_PERSISTED_MESSAGE, { cause: error });
    }
    return this.getState();
  }

  private async restoreVisibleWindowNow(): Promise<DesktopWindowState> {
    return this.exitNow();
  }

  private async recoverCurrentSession(hwnd: bigint): Promise<void> {
    const token = this.recoveryToken;
    if (!token) {
      this.ensureVisible();
      this.state = { mode: 'normal', opacity: this.state.opacity };
      return;
    }
    try {
      await this.host.detach(hwnd, token.originalParent, token.originalStyle);
    } catch (error) {
      this.ensureVisible();
      throw new Error(RECOVERY_FAILED_MESSAGE, { cause: error });
    }
    this.window.setSkipTaskbar(false);
    this.window.setMenuBarVisibility(true);
    this.window.unmaximize();
    if (this.normalBounds) this.window.setBounds(this.normalBounds);
    if (this.normalMaximized) this.window.maximize();
    const opacity = this.state.opacity;
    this.window.setOpacity(opacity);
    this.window.show();
    this.window.focus();
    this.recoveryToken = null;
    this.normalBounds = null;
    this.normalMaximized = false;
    this.state = { mode: 'normal', opacity };
  }

  private ensureVisible(showAndFocus = true): void {
    this.window.setSkipTaskbar(false);
    this.window.setMenuBarVisibility(true);
    this.window.setOpacity(this.state.opacity);
    if (showAndFocus) {
      this.window.show();
      this.window.focus();
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.transitions.then(operation, operation);
    this.transitions = result.then(() => undefined, () => undefined);
    return result;
  }
}

const integerText = z.string().regex(/^-?(0|[1-9]\d*)$/);
const nonNegativeIntegerText = z.string().regex(/^(0|[1-9]\d*)$/);
const positiveIntegerText = z.string().regex(/^[1-9]\d*$/);
const failureResponseSchema = z.strictObject({ success: z.literal(false), message: z.string().min(1) });
const inspectResponseSchema = z.strictObject({
  success: z.literal(true),
  parent: nonNegativeIntegerText,
  originalParent: nonNegativeIntegerText,
  originalStyle: integerText,
  message: z.string()
});
const attachResponseSchema = z.strictObject({
  success: z.literal(true),
  parent: nonNegativeIntegerText,
  placement: z.enum(['embedded', 'compatible']),
  message: z.string()
});
const detachResponseSchema = z.strictObject({
  success: z.literal(true),
  parent: nonNegativeIntegerText,
  style: integerText,
  message: z.string()
});
const MAX_HELPER_OUTPUT_BYTES = 64 * 1024;

export class DesktopHostProcess implements DesktopHostPort {
  constructor(
    private readonly executable: string,
    private readonly timeoutMs = 12_000,
    private readonly spawnProcess: typeof spawn = spawn
  ) {}

  async inspect(hwnd: bigint): Promise<DesktopRecoveryToken> {
    const response = inspectResponseSchema.parse(await this.run(['inspect', positiveHandle(hwnd)]));
    return { originalParent: BigInt(response.originalParent), originalStyle: BigInt(response.originalStyle) };
  }

  async attach(hwnd: bigint): Promise<DesktopAttachResult> {
    const response = attachResponseSchema.parse(await this.run(['attach', positiveHandle(hwnd)]));
    return { placement: response.placement, message: response.message };
  }

  async detach(hwnd: bigint, originalParent: bigint, originalStyle: bigint): Promise<void> {
    if (originalParent < 0n) throw new Error('原始父窗口句柄无效');
    detachResponseSchema.parse(await this.run([
      'detach',
      positiveHandle(hwnd),
      originalParent.toString(),
      originalStyle.toString()
    ]));
  }

  private run(args: string[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const child = this.spawnProcess(this.executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (error?: Error, response?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error); else resolve(response ?? {});
      };
      const timer = setTimeout(() => {
        child.kill();
        finish(new Error('桌面宿主响应超时'));
      }, this.timeoutMs);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      const append = (target: 'stdout' | 'stderr', chunk: string) => {
        if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) + Buffer.byteLength(chunk) > MAX_HELPER_OUTPUT_BYTES) {
          child.kill();
          finish(new Error('桌面宿主输出超过限制'));
          return;
        }
        if (target === 'stdout') stdout += chunk; else stderr += chunk;
      };
      child.stdout.on('data', (chunk: string) => append('stdout', chunk));
      child.stderr.on('data', (chunk: string) => append('stderr', chunk));
      child.on('error', (error) => finish(error));
      child.on('close', (code) => {
        let response: unknown;
        try { response = JSON.parse(stdout.trim()) as unknown; }
        catch { return finish(new Error(stderr.trim() || '桌面宿主返回无效响应')); }
        if (code !== 0) {
          const failure = failureResponseSchema.safeParse(response);
          return finish(new Error(failure.success ? failure.data.message : stderr.trim() || '桌面宿主执行失败'));
        }
        finish(undefined, response);
      });
    });
  }
}

function positiveHandle(hwnd: bigint): string {
  if (hwnd <= 0n) throw new Error('窗口句柄无效');
  return hwnd.toString();
}

const opacitySchema = z.number().finite();

export function registerWindowIpc(ipcMain: Pick<IpcMain, 'handle'>, controller: WindowController): void {
  ipcMain.handle('window:getDesktopState', () => controller.getState());
  ipcMain.handle('window:enterDesktopMode', () => controller.enter());
  ipcMain.handle('window:exitDesktopMode', () => controller.exit());
  ipcMain.handle('window:setDesktopOpacity', (_event, opacity: unknown) => controller.setOpacity(opacitySchema.parse(opacity)));
}
