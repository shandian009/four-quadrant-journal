import { describe, expect, it, vi } from 'vitest';
import {
  WindowActivationController,
  registerRecoveryShortcut,
  type GlobalShortcutPort
} from '../../src/main/window-activation';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('window activation controller', () => {
  it('restores before showing, focusing and running the requested action', async () => {
    const calls: string[] = [];
    const activation = new WindowActivationController(
      { restoreVisibleWindow: vi.fn(async () => { calls.push('restore'); }) },
      {
        show: vi.fn(() => { calls.push('show'); }),
        focus: vi.fn(() => { calls.push('focus'); })
      }
    );

    await activation.restoreAndShow(() => { calls.push('quick-add'); });

    expect(calls).toEqual(['restore', 'show', 'focus', 'quick-add']);
  });

  it('deduplicates concurrent native recovery while preserving follow-up actions', async () => {
    const gate = deferred<void>();
    const calls: string[] = [];
    const restoreVisibleWindow = vi.fn(async () => {
      calls.push('restore');
      await gate.promise;
    });
    const activation = new WindowActivationController(
      { restoreVisibleWindow },
      { show: vi.fn(), focus: vi.fn() }
    );

    const show = activation.restoreAndShow();
    const quickAdd = activation.restoreAndShow(() => { calls.push('quick-add'); });
    const notification = activation.restoreAndShow(() => { calls.push('notification'); });
    await vi.waitFor(() => expect(restoreVisibleWindow).toHaveBeenCalledOnce());
    gate.resolve();
    await Promise.all([show, quickAdd, notification]);

    expect(restoreVisibleWindow).toHaveBeenCalledOnce();
    expect(calls).toEqual(['restore', 'quick-add', 'notification']);
  });

  it('does not show or execute follow-up actions when recovery rejects', async () => {
    const window = { show: vi.fn(), focus: vi.fn() };
    const followUp = vi.fn();
    const activation = new WindowActivationController(
      { restoreVisibleWindow: vi.fn(async () => { throw new Error('detach failed'); }) },
      window
    );

    await expect(activation.restoreAndShow(followUp)).rejects.toThrow('detach failed');

    expect(window.show).not.toHaveBeenCalled();
    expect(window.focus).not.toHaveBeenCalled();
    expect(followUp).not.toHaveBeenCalled();
  });
});

describe('recovery shortcut', () => {
  it('registers Ctrl+Alt+J and unregisters it on cleanup', () => {
    let callback: (() => void) | undefined;
    const shortcuts: GlobalShortcutPort = {
      register: vi.fn((_accelerator, handler) => { callback = handler; return true; }),
      unregister: vi.fn()
    };
    const restore = vi.fn(async () => undefined);

    const registration = registerRecoveryShortcut(shortcuts, restore);
    callback?.();
    registration.dispose();
    registration.dispose();

    expect(shortcuts.register).toHaveBeenCalledWith('Ctrl+Alt+J', expect.any(Function));
    expect(restore).toHaveBeenCalledOnce();
    expect(shortcuts.unregister).toHaveBeenCalledOnce();
    expect(registration.registered).toBe(true);
  });

  it('keeps startup usable when Ctrl+Alt+J is already occupied', () => {
    const shortcuts: GlobalShortcutPort = {
      register: vi.fn(() => false),
      unregister: vi.fn()
    };

    const registration = registerRecoveryShortcut(shortcuts, vi.fn());
    registration.dispose();

    expect(registration.registered).toBe(false);
    expect(shortcuts.unregister).not.toHaveBeenCalled();
  });
});
