import type { WindowBounds } from './window-control';

const CONTROL_WIDTH = 340;
const CONTROL_HEIGHT = 88;
const CONTROL_MARGIN = 18;

export function isRecoveryControlNavigation(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'data:' && url.hash === '#restore';
  } catch {
    return false;
  }
}

export interface RecoveryControlWindowPort {
  load(): Promise<void>;
  showInactive(): void;
  setPosition(x: number, y: number): void;
  close(): void;
  isDestroyed(): boolean;
  onRestore(handler: () => Promise<void>): void;
  onClosed(handler: () => void): void;
}

export interface RecoveryControlEnvironment {
  createWindow(): RecoveryControlWindowPort;
  getWorkArea(anchor: WindowBounds): WindowBounds;
  subscribeDisplayChanges(handler: () => void): () => void;
}

export class DesktopRecoveryControl {
  private window: RecoveryControlWindowPort | null = null;
  private opening: Promise<void> | null = null;
  private restoring: Promise<void> | null = null;
  private unsubscribeDisplayChanges: (() => void) | null = null;

  constructor(
    private readonly environment: RecoveryControlEnvironment,
    private readonly getAnchorBounds: () => WindowBounds,
    private readonly restore: () => Promise<void>
  ) {}

  show(): Promise<void> {
    if (this.opening) return this.opening;
    if (this.window && !this.window.isDestroyed()) {
      this.reposition();
      this.window.showInactive();
      return Promise.resolve();
    }

    const opening = this.open();
    this.opening = opening;
    return opening.finally(() => {
      if (this.opening === opening) this.opening = null;
    });
  }

  close(): void {
    const window = this.window;
    this.window = null;
    this.stopWatchingDisplays();
    if (window && !window.isDestroyed()) window.close();
  }

  reposition(): void {
    const window = this.window;
    if (!window || window.isDestroyed()) return;
    const area = this.environment.getWorkArea(this.getAnchorBounds());
    window.setPosition(
      area.x + area.width - CONTROL_WIDTH - CONTROL_MARGIN,
      area.y + area.height - CONTROL_HEIGHT - CONTROL_MARGIN
    );
  }

  isVisible(): boolean {
    return Boolean(this.window && !this.window.isDestroyed());
  }

  private async open(): Promise<void> {
    const window = this.environment.createWindow();
    this.window = window;
    window.onRestore(() => this.runRestore());
    window.onClosed(() => {
      if (this.window !== window) return;
      this.window = null;
      this.stopWatchingDisplays();
    });

    try {
      await window.load();
      if (this.window !== window || window.isDestroyed()) throw new Error('桌面恢复控制条已被关闭');
      this.reposition();
      window.showInactive();
      this.unsubscribeDisplayChanges = this.environment.subscribeDisplayChanges(() => this.reposition());
    } catch (error) {
      if (this.window === window) this.window = null;
      this.stopWatchingDisplays();
      if (!window.isDestroyed()) window.close();
      throw error;
    }
  }

  private runRestore(): Promise<void> {
    if (this.restoring) return this.restoring;
    const restoring = Promise.resolve().then(() => this.restore());
    this.restoring = restoring;
    return restoring.finally(() => {
      if (this.restoring === restoring) this.restoring = null;
    });
  }

  private stopWatchingDisplays(): void {
    this.unsubscribeDisplayChanges?.();
    this.unsubscribeDisplayChanges = null;
  }
}
