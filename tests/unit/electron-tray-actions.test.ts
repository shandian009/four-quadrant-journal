import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => {
  const state = {
    templates: [] as Array<Array<Record<string, unknown>>>,
    events: new Map<string, (...args: unknown[]) => void>()
  };
  class Tray {
    setToolTip = vi.fn();
    setContextMenu = vi.fn();
    on = vi.fn((event: string, handler: (...args: unknown[]) => void) => state.events.set(event, handler));
  }
  return {
    state,
    Menu: { buildFromTemplate: vi.fn((template: Array<Record<string, unknown>>) => {
      state.templates.push(template);
      return template;
    }) },
    nativeImage: { createFromPath: vi.fn(() => ({})) },
    Tray
  };
});

vi.mock('electron', () => electron);

import { createApplicationTray } from '../../src/main/electron-tray';

describe('electron tray actions', () => {
  beforeEach(() => {
    electron.state.templates.length = 0;
    electron.state.events.clear();
    vi.clearAllMocks();
  });

  it('routes show, quick add, restore and double click through supplied recovery actions', () => {
    const actions = {
      show: vi.fn(),
      quickAdd: vi.fn(),
      setRemindersPaused: vi.fn(),
      restoreWindow: vi.fn(),
      quit: vi.fn()
    };
    createApplicationTray(actions);
    const template = electron.state.templates.at(-1)!;

    (template[0].click as () => void)();
    (template[1].click as () => void)();
    (template[3].click as () => void)();
    electron.state.events.get('double-click')?.();

    expect(actions.show).toHaveBeenCalledOnce();
    expect(actions.quickAdd).toHaveBeenCalledOnce();
    expect(actions.restoreWindow).toHaveBeenCalledTimes(2);
  });

  it('keeps reminder pause state independent from window recovery', () => {
    const actions = {
      show: vi.fn(),
      quickAdd: vi.fn(),
      setRemindersPaused: vi.fn(),
      restoreWindow: vi.fn(),
      quit: vi.fn()
    };
    createApplicationTray(actions);

    (electron.state.templates.at(-1)![2].click as () => void)();

    expect(actions.setRemindersPaused).toHaveBeenCalledWith(true);
    expect(electron.state.templates.at(-1)![2]).toMatchObject({ label: '恢复提醒', checked: true });
  });
});
