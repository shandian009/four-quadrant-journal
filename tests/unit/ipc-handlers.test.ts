import type { IpcMain } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { registerReviewIpc, registerTaskIpc } from '../../src/main/ipc-handlers';
import type { FocusRepository } from '../../src/main/repositories/focus';
import type { DailyReviewRepository } from '../../src/main/repositories/reviews';
import type { TaskRepository } from '../../src/main/repositories/tasks';

type Handler = (...args: unknown[]) => unknown;

function captureHandlers() {
  const handlers = new Map<string, Handler>();
  const ipcMain = {
    handle: vi.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    })
  } as unknown as Pick<IpcMain, 'handle'>;
  return { handlers, ipcMain };
}

function handlerFor(handlers: Map<string, Handler>, channel: string): Handler {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`Missing IPC handler: ${channel}`);
  return handler;
}

describe('Task 2 IPC handler contracts', () => {
  it('registers and unwraps task range and manual-strike arguments', () => {
    const { handlers, ipcMain } = captureHandlers();
    const tasks = {
      findByRange: vi.fn(() => []),
      setManualStruck: vi.fn(() => ({ id: 'task-1' }))
    } as unknown as TaskRepository;

    registerTaskIpc(ipcMain, tasks);
    handlerFor(handlers, 'tasks:listByRange')({}, {
      startDate: '2026-07-01',
      endDate: '2026-07-31'
    });
    handlerFor(handlers, 'tasks:setManualStruck')({}, 'task-1', true);

    expect(tasks.findByRange).toHaveBeenCalledWith('2026-07-01', '2026-07-31');
    expect(tasks.setManualStruck).toHaveBeenCalledWith('task-1', true);
  });

  it('registers and unwraps review range arguments', () => {
    const { handlers, ipcMain } = captureHandlers();
    const tasks = {} as TaskRepository;
    const reviews = { findByRange: vi.fn(() => []) } as unknown as DailyReviewRepository;
    const focus = {} as FocusRepository;

    registerReviewIpc(ipcMain, tasks, reviews, focus);
    handlerFor(handlers, 'reviews:listByRange')({}, {
      startDate: '2026-07-01',
      endDate: '2026-07-31'
    });

    expect(reviews.findByRange).toHaveBeenCalledWith('2026-07-01', '2026-07-31');
  });

  it('rejects invalid values at all three new IPC boundaries', () => {
    const { handlers, ipcMain } = captureHandlers();
    const tasks = {
      findByRange: vi.fn(() => []),
      setManualStruck: vi.fn(() => ({ id: 'task-1' }))
    } as unknown as TaskRepository;
    const reviews = { findByRange: vi.fn(() => []) } as unknown as DailyReviewRepository;

    registerTaskIpc(ipcMain, tasks);
    registerReviewIpc(ipcMain, tasks, reviews, {} as FocusRepository);

    expect(() => handlerFor(handlers, 'tasks:listByRange')({}, {
      startDate: '2026-02-30',
      endDate: '2026-03-01'
    })).toThrow('日期格式无效');
    expect(() => handlerFor(handlers, 'tasks:setManualStruck')({}, 'task-1', 'true'))
      .toThrow();
    expect(() => handlerFor(handlers, 'reviews:listByRange')({}, {
      startDate: '2026-07-31',
      endDate: '2026-07-01'
    })).toThrow('起始日期不能晚于结束日期');

    expect(tasks.findByRange).not.toHaveBeenCalled();
    expect(tasks.setManualStruck).not.toHaveBeenCalled();
    expect(reviews.findByRange).not.toHaveBeenCalled();
  });
});
