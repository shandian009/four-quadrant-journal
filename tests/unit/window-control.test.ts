import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  DesktopHostProcess,
  WindowController,
  clampDesktopOpacity,
  registerWindowIpc,
  type DesktopModeLifecycle,
  type DesktopHostPort,
  type SettingsPort,
  type WindowBounds,
  type WindowPort
} from '../../src/main/window-control';

function fakeSpawn(stdout: string, options: { close?: boolean; code?: number } = {}) {
  return vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
      kill: ReturnType<typeof vi.fn>;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = vi.fn();
    queueMicrotask(() => {
      child.stdout.write(stdout);
      if (options.close !== false) child.emit('close', options.code ?? 0);
    });
    return child;
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function harness(options: {
  opacity?: unknown;
  attachError?: Error;
  detachError?: Error;
  maximized?: boolean;
  settingsErrorKey?: string;
  attachGate?: Promise<void>;
  lifecycle?: DesktopModeLifecycle;
} = {}) {
  const calls: string[] = [];
  const bounds: WindowBounds = { x: 10, y: 20, width: 1200, height: 760 };
  const window: WindowPort = {
    getBounds: vi.fn(() => bounds),
    getNormalBounds: vi.fn(() => bounds),
    setBounds: vi.fn((value) => { calls.push(`bounds:${JSON.stringify(value)}`); }),
    isMaximized: vi.fn(() => options.maximized ?? false),
    maximize: vi.fn(() => { calls.push('maximize'); }),
    unmaximize: vi.fn(() => { calls.push('unmaximize'); }),
    setSkipTaskbar: vi.fn((value) => { calls.push(`taskbar:${value}`); }),
    setMenuBarVisibility: vi.fn((value) => { calls.push(`menu:${value}`); }),
    setOpacity: vi.fn((value) => { calls.push(`opacity:${value}`); }),
    show: vi.fn(() => { calls.push('show'); }),
    focus: vi.fn(() => { calls.push('focus'); }),
    getNativeWindowHandle: vi.fn(() => 42n)
  };
  const stored = new Map<string, unknown>([['desktopOpacity', options.opacity]]);
  const settings: SettingsPort = {
    get: vi.fn(async (key, fallback) => stored.has(key) ? stored.get(key) as never : fallback),
    set: vi.fn(async (key, value) => {
      if (key === options.settingsErrorKey) throw new Error('settings rejected');
      stored.set(key, value);
      calls.push(`setting:${key}`);
    })
  };
  const host: DesktopHostPort = {
    inspect: vi.fn(async () => {
      calls.push('inspect');
      return { originalParent: 0n, originalStyle: 0x10cf0000n };
    }),
    attach: vi.fn(async () => {
      calls.push('attach');
      await options.attachGate;
      if (options.attachError) throw options.attachError;
      return { placement: 'embedded' as const, message: '已嵌入桌面' };
    }),
    detach: vi.fn(async () => {
      calls.push('detach');
      if (options.detachError) throw options.detachError;
    })
  };
  return {
    controller: new WindowController(window, settings, host, options.lifecycle),
    window,
    settings,
    host,
    calls,
    bounds
  };
}

describe('desktop window controller', () => {
  it('clamps desktop opacity to 5% steps and defaults damaged values to 85%', () => {
    expect(clampDesktopOpacity(0.1)).toBe(.4);
    expect(clampDesktopOpacity(.83)).toBe(.85);
    expect(clampDesktopOpacity(2)).toBe(1);
    expect(clampDesktopOpacity(Number.NaN)).toBe(.85);
    expect(clampDesktopOpacity('0.5')).toBe(.85);
  });

  it('enters in safe order and applies saved opacity only after attach', async () => {
    const { controller, calls } = harness({ opacity: .72 });

    await expect(controller.enter()).resolves.toEqual({ mode: 'desktop', opacity: .7 });

    expect(calls).toEqual([
      'inspect',
      'setting:desktopNormalBounds',
      'setting:desktopNormalMaximized',
      'taskbar:true',
      'menu:false',
      'attach',
      'opacity:0.7'
    ]);
  });

  it('applies and persists opacity while in normal mode', async () => {
    const { controller, window, settings } = harness();

    await expect(controller.setOpacity(.55)).resolves.toEqual({ mode: 'normal', opacity: .55 });

    expect(window.setOpacity).toHaveBeenLastCalledWith(.55);
    expect(settings.set).toHaveBeenLastCalledWith('windowOpacity', .55);
  });

  it('clamps and persists opacity while in desktop mode', async () => {
    const { controller, window, settings } = harness({ opacity: .85 });
    await controller.enter();

    await expect(controller.setOpacity(.39)).resolves.toEqual({ mode: 'desktop', opacity: .4 });

    expect(window.setOpacity).toHaveBeenLastCalledWith(.4);
    expect(settings.set).toHaveBeenLastCalledWith('windowOpacity', .4);
  });

  it('reports whether Windows used true embedding or compatibility placement', async () => {
    const { controller, host } = harness();
    vi.mocked(host.attach).mockResolvedValueOnce({ placement: 'compatible', message: '已进入桌面兼容模式' });

    await expect(controller.enter()).resolves.toEqual({
      mode: 'desktop', opacity: .85, placement: 'compatible'
    });
  });

  it('exits by detaching first and restores bounds, maximized state and visibility', async () => {
    const { controller, calls, bounds } = harness({ opacity: .85, maximized: true });
    await controller.enter();
    calls.length = 0;

    await expect(controller.exit()).resolves.toEqual({ mode: 'normal', opacity: .85 });

    expect(calls).toEqual([
      'detach',
      'taskbar:false',
      'menu:true',
      'unmaximize',
      `bounds:${JSON.stringify(bounds)}`,
      'maximize',
      'opacity:0.85',
      'show',
      'focus'
    ]);
  });

  it('opens the external recovery control after entering and closes it after restoring', async () => {
    const lifecycle: DesktopModeLifecycle = { entered: vi.fn(), exited: vi.fn() };
    const { controller, host } = harness({ lifecycle });

    await controller.enter();

    expect(lifecycle.entered).toHaveBeenCalledOnce();
    expect(lifecycle.exited).not.toHaveBeenCalled();

    await controller.restoreVisibleWindow();

    expect(host.detach).toHaveBeenCalledOnce();
    expect(lifecycle.exited).toHaveBeenCalledOnce();
  });

  it('rolls back desktop embedding when the external recovery control cannot open', async () => {
    const lifecycle: DesktopModeLifecycle = {
      entered: vi.fn(async () => { throw new Error('control failed'); }),
      exited: vi.fn()
    };
    const { controller, host, window } = harness({ lifecycle });

    await expect(controller.enter()).rejects.toThrow('未能嵌入桌面，已恢复普通窗口');

    expect(host.detach).toHaveBeenCalledOnce();
    expect(window.setSkipTaskbar).toHaveBeenLastCalledWith(false);
    expect(window.show).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
    expect(lifecycle.exited).toHaveBeenCalledOnce();
    expect(controller.getState()).toEqual({ mode: 'normal', opacity: .85 });
  });

  it('performs one native detach for concurrent external recovery requests', async () => {
    const lifecycle: DesktopModeLifecycle = { entered: vi.fn(), exited: vi.fn() };
    const { controller, host } = harness({ lifecycle });
    await controller.enter();

    await Promise.all([
      controller.restoreVisibleWindow(),
      controller.restoreVisibleWindow(),
      controller.restoreVisibleWindow()
    ]);

    expect(host.detach).toHaveBeenCalledOnce();
    expect(lifecycle.exited).toHaveBeenCalledOnce();
  });

  it('captures Electron normal bounds rather than maximized bounds', async () => {
    const { controller, window, settings } = harness({ maximized: true });
    const normalBounds = { x: 30, y: 40, width: 900, height: 600 };
    vi.mocked(window.getNormalBounds).mockReturnValue(normalBounds);

    await controller.enter();

    expect(window.getNormalBounds).toHaveBeenCalledOnce();
    expect(window.getBounds).not.toHaveBeenCalled();
    expect(settings.set).toHaveBeenCalledWith('desktopNormalBounds', normalBounds);
  });

  it.each(['helper failure', 'helper timeout'])('unconditionally restores after %s', async (message) => {
    const { controller, window, host, calls } = harness({ attachError: new Error(message) });

    await expect(controller.enter()).rejects.toThrow('未能嵌入桌面，已恢复普通窗口');

    expect(host.detach).toHaveBeenCalled();
    expect(window.setSkipTaskbar).toHaveBeenLastCalledWith(false);
    expect(window.setMenuBarVisibility).toHaveBeenLastCalledWith(true);
    expect(window.setOpacity).toHaveBeenLastCalledWith(1);
    expect(window.show).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
    expect(calls.indexOf('detach')).toBeLessThan(calls.indexOf('taskbar:false'));
  });

  it.each(['attach response timeout', 'attach returned malformed JSON'])(
    'uses the pre-attach recovery token after %s',
    async (message) => {
      const { controller, host } = harness({ attachError: new Error(message) });

      await expect(controller.enter()).rejects.toThrow('未能嵌入桌面，已恢复普通窗口');

      expect(host.inspect).toHaveBeenCalledWith(42n);
      expect(host.detach).toHaveBeenCalledWith(42n, 0n, 0x10cf0000n);
      expect(controller.getState()).toEqual({ mode: 'normal', opacity: 1 });
    }
  );

  it('keeps the recovery token and conservative desktop state when detach fails', async () => {
    const { controller, host, window } = harness({ detachError: new Error('detach failed') });
    await controller.enter();

    await expect(controller.exit()).rejects.toThrow('恢复普通窗口失败，请从托盘重试');

    expect(controller.getState()).toEqual({ mode: 'desktop', opacity: .85 });
    expect(host.detach).toHaveBeenCalledWith(42n, 0n, 0x10cf0000n);
    expect(window.setSkipTaskbar).toHaveBeenLastCalledWith(false);
    expect(window.setMenuBarVisibility).toHaveBeenLastCalledWith(true);
    expect(window.setOpacity).toHaveBeenLastCalledWith(.85);
    expect(window.show).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();

    vi.mocked(host.detach).mockResolvedValueOnce();
    await expect(controller.restoreVisibleWindow()).resolves.toEqual({ mode: 'normal', opacity: .85 });
    expect(host.detach).toHaveBeenCalledTimes(2);
  });

  it('starts normal and visible even when persisted values exist', () => {
    const { controller, window } = harness({ opacity: .4 });

    expect(controller.getState()).toEqual({ mode: 'normal', opacity: 1 });
    expect(window.setSkipTaskbar).not.toHaveBeenCalled();
    expect(window.setOpacity).not.toHaveBeenCalled();
  });

  it('restoreVisibleWindow in normal mode only makes the current window safely visible', async () => {
    const { controller, window, host } = harness();

    await expect(controller.restoreVisibleWindow()).resolves.toEqual({ mode: 'normal', opacity: 1 });

    expect(host.detach).not.toHaveBeenCalled();
    expect(window.setSkipTaskbar).toHaveBeenCalledWith(false);
    expect(window.setOpacity).toHaveBeenCalledWith(1);
    expect(window.show).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
    expect(window.getBounds).not.toHaveBeenCalled();
    expect(window.getNormalBounds).not.toHaveBeenCalled();
    expect(window.setBounds).not.toHaveBeenCalled();
    expect(window.unmaximize).not.toHaveBeenCalled();
    expect(window.maximize).not.toHaveBeenCalled();
  });

  it('serializes concurrent enter, exit and opacity operations', async () => {
    const gate = deferred<void>();
    const { controller, host, window } = harness({ attachGate: gate.promise });

    const firstEnter = controller.enter();
    const secondEnter = controller.enter();
    const exit = controller.exit();
    const opacity = controller.setOpacity(.55);
    await vi.waitFor(() => expect(host.attach).toHaveBeenCalledTimes(1));

    expect(host.inspect).toHaveBeenCalledTimes(1);
    expect(host.attach).toHaveBeenCalledTimes(1);
    expect(host.detach).not.toHaveBeenCalled();

    gate.resolve();
    await expect(Promise.all([firstEnter, secondEnter, exit, opacity])).resolves.toEqual([
      { mode: 'desktop', opacity: .85 },
      { mode: 'desktop', opacity: .85 },
      { mode: 'normal', opacity: .85 },
      { mode: 'normal', opacity: .55 }
    ]);
    expect(host.inspect).toHaveBeenCalledTimes(1);
    expect(host.attach).toHaveBeenCalledTimes(1);
    expect(host.detach).toHaveBeenCalledTimes(1);
    expect(window.setOpacity).toHaveBeenLastCalledWith(.55);
  });

  it('keeps controller state consistent with real opacity when persistence rejects', async () => {
    const { controller, window } = harness({ settingsErrorKey: 'windowOpacity' });
    await controller.enter();

    await expect(controller.setOpacity(.55)).rejects.toThrow('透明度已应用，但未能保存设置');

    expect(window.setOpacity).toHaveBeenLastCalledWith(.55);
    expect(controller.getState()).toEqual({ mode: 'desktop', opacity: .55 });
  });

  it('registers restricted IPC without accepting a renderer window handle', async () => {
    const { controller, window } = harness();
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = { handle: (channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler) };
    registerWindowIpc(ipcMain as never, controller);

    await handlers.get('window:enterDesktopMode')?.({}, 999999n);

    expect(window.getNativeWindowHandle).toHaveBeenCalled();
    expect(window.getNativeWindowHandle).toHaveReturnedWith(42n);
    expect(() => handlers.get('window:setDesktopOpacity')?.({}, '0.5')).toThrow();
  });
});

describe('desktop host process protocol', () => {
  it('accepts only the strict inspect response schema', async () => {
    const validSpawn = fakeSpawn(JSON.stringify({
      success: true,
      parent: '0',
      originalParent: '0',
      originalStyle: '281018368',
      message: 'ok'
    }));
    const validHost = new DesktopHostProcess('helper.exe', 100, validSpawn as never);
    await expect(validHost.inspect(42n)).resolves.toEqual({ originalParent: 0n, originalStyle: 281018368n });
    expect(validSpawn).toHaveBeenCalledWith(
      'helper.exe',
      ['inspect', '42'],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const extraFieldHost = new DesktopHostProcess('helper.exe', 100, fakeSpawn(JSON.stringify({
      success: true,
      parent: '0',
      originalParent: '0',
      originalStyle: '281018368',
      message: 'ok',
      unexpected: true
    })) as never);
    await expect(extraFieldHost.inspect(42n)).rejects.toThrow();
  });

  it('rejects malformed JSON and bounded-output violations', async () => {
    const malformed = new DesktopHostProcess('helper.exe', 100, fakeSpawn('{bad json') as never);
    await expect(malformed.attach(42n)).rejects.toThrow('桌面宿主返回无效响应');

    const oversized = new DesktopHostProcess('helper.exe', 100, fakeSpawn('x'.repeat(65 * 1024)) as never);
    await expect(oversized.attach(42n)).rejects.toThrow('桌面宿主输出超过限制');
  });

  it('kills and rejects a helper that exceeds the response timeout', async () => {
    vi.useFakeTimers();
    try {
      const spawnProcess = fakeSpawn('', { close: false });
      const host = new DesktopHostProcess('helper.exe', 25, spawnProcess as never);
      const result = expect(host.attach(42n)).rejects.toThrow('桌面宿主响应超时');
      await vi.advanceTimersByTimeAsync(25);
      await result;
      const child = vi.mocked(spawnProcess).mock.results[0]?.value;
      expect(child.kill).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows a 12 second cold start by default', async () => {
    vi.useFakeTimers();
    try {
      const spawnProcess = fakeSpawn('', { close: false });
      const host = new DesktopHostProcess('helper.exe', undefined, spawnProcess as never);
      const pending = host.attach(42n).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(11_999);
      expect(vi.mocked(spawnProcess).mock.results[0]?.value.kill).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      const error = await pending;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('桌面宿主响应超时');
    } finally {
      vi.useRealTimers();
    }
  });
});
