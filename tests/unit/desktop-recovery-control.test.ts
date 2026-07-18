import { describe, expect, it, vi } from 'vitest';
import {
  DesktopRecoveryControl,
  isRecoveryControlNavigation,
  type RecoveryControlEnvironment,
  type RecoveryControlWindowPort
} from '../../src/main/desktop-recovery-control';

function harness(options: { loadError?: Error; restoreError?: Error } = {}) {
  let restoreHandler: (() => Promise<void>) | undefined;
  let closedHandler: (() => void) | undefined;
  let displayHandler: (() => void) | undefined;
  const window: RecoveryControlWindowPort = {
    load: vi.fn(async () => {
      if (options.loadError) throw options.loadError;
    }),
    showInactive: vi.fn(),
    setPosition: vi.fn(),
    close: vi.fn(),
    isDestroyed: vi.fn(() => false),
    onRestore: vi.fn((handler) => { restoreHandler = handler; }),
    onClosed: vi.fn((handler) => { closedHandler = handler; })
  };
  const unsubscribe = vi.fn();
  const environment: RecoveryControlEnvironment = {
    createWindow: vi.fn(() => window),
    getWorkArea: vi.fn(() => ({ x: 100, y: 50, width: 1600, height: 900 })),
    subscribeDisplayChanges: vi.fn((handler) => {
      displayHandler = handler;
      return unsubscribe;
    })
  };
  const restore = vi.fn(async () => {
    if (options.restoreError) throw options.restoreError;
  });
  const control = new DesktopRecoveryControl(
    environment,
    () => ({ x: 200, y: 100, width: 1200, height: 760 }),
    restore
  );
  return {
    control,
    window,
    environment,
    restore,
    unsubscribe,
    triggerRestore: () => restoreHandler?.(),
    triggerClosed: () => closedHandler?.(),
    triggerDisplayChange: () => displayHandler?.()
  };
}

describe('desktop recovery control', () => {
  it('accepts only the recovery page fragment navigation', () => {
    expect(isRecoveryControlNavigation('data:text/html,control#restore')).toBe(true);
    expect(isRecoveryControlNavigation('data:text/html,control#other')).toBe(false);
    expect(isRecoveryControlNavigation('https://example.com/#restore')).toBe(false);
    expect(isRecoveryControlNavigation('not a url')).toBe(false);
  });

  it('creates one external control and positions it at the current display bottom right', async () => {
    const { control, environment, window } = harness();

    await Promise.all([control.show(), control.show(), control.show()]);

    expect(environment.createWindow).toHaveBeenCalledOnce();
    expect(window.load).toHaveBeenCalledOnce();
    expect(window.setPosition).toHaveBeenLastCalledWith(1342, 844);
    expect(window.showInactive).toHaveBeenCalledOnce();
  });

  it('runs one restore operation even when the recovery button is clicked repeatedly', async () => {
    const { control, restore, triggerRestore } = harness();
    await control.show();

    await Promise.all([triggerRestore(), triggerRestore(), triggerRestore()]);

    expect(restore).toHaveBeenCalledOnce();
  });

  it('keeps the control available when restore rejects so the user can retry', async () => {
    const { control, window, triggerRestore } = harness({ restoreError: new Error('detach failed') });
    await control.show();

    await expect(triggerRestore()).rejects.toThrow('detach failed');

    expect(window.close).not.toHaveBeenCalled();
    expect(control.isVisible()).toBe(true);
  });

  it('repositions on display changes and removes the subscription when closed', async () => {
    const { control, window, unsubscribe, triggerDisplayChange } = harness();
    await control.show();
    vi.mocked(window.setPosition).mockClear();

    triggerDisplayChange();
    expect(window.setPosition).toHaveBeenCalledOnce();

    control.close();
    control.close();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(window.close).toHaveBeenCalledOnce();
  });

  it('clears its state if Explorer or Windows closes the control', async () => {
    const { control, unsubscribe, triggerClosed } = harness();
    await control.show();

    triggerClosed();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(control.isVisible()).toBe(false);
  });

  it('rejects creation failures so desktop embedding can roll back', async () => {
    const { control, window } = harness({ loadError: new Error('load failed') });

    await expect(control.show()).rejects.toThrow('load failed');

    expect(window.close).toHaveBeenCalledOnce();
    expect(control.isVisible()).toBe(false);
  });
});
