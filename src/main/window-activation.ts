export interface RecoverableWindowController {
  restoreVisibleWindow(): Promise<unknown>;
}

export interface ActivatableWindowPort {
  show(): void;
  focus(): void;
}

export interface GlobalShortcutPort {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
}

export class WindowActivationController {
  private recoveryInFlight: Promise<void> | null = null;

  constructor(
    private readonly controller: RecoverableWindowController,
    private readonly window: ActivatableWindowPort
  ) {}

  async restoreAndShow(afterRestore?: () => void | Promise<void>): Promise<void> {
    await this.ensureRecovered();
    this.window.show();
    this.window.focus();
    await afterRestore?.();
  }

  private ensureRecovered(): Promise<void> {
    if (this.recoveryInFlight) return this.recoveryInFlight;
    const recovery = Promise.resolve()
      .then(() => this.controller.restoreVisibleWindow())
      .then(() => undefined);
    this.recoveryInFlight = recovery;
    recovery.then(
      () => { if (this.recoveryInFlight === recovery) this.recoveryInFlight = null; },
      () => { if (this.recoveryInFlight === recovery) this.recoveryInFlight = null; }
    );
    return recovery;
  }
}

export interface RecoveryShortcutRegistration {
  registered: boolean;
  dispose(): void;
}

export function registerRecoveryShortcut(
  shortcuts: GlobalShortcutPort,
  restore: () => Promise<void>
): RecoveryShortcutRegistration {
  const accelerator = 'Ctrl+Alt+J';
  const registered = shortcuts.register(accelerator, () => {
    void restore().catch((error: unknown) => console.error('快捷键恢复主窗口失败', error));
  });
  let disposed = false;
  return {
    registered,
    dispose: () => {
      if (disposed || !registered) return;
      disposed = true;
      shortcuts.unregister(accelerator);
    }
  };
}
