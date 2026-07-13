import { describe, expect, it, vi } from 'vitest';
import type { Reminder, ReminderStore } from '../../src/main/services/reminder-scheduler';
import { ReminderScheduler } from '../../src/main/services/reminder-scheduler';

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'reminder-1', taskId: 'task-1', taskTitle: '提交项目报告',
    scheduledAt: '2026-07-10T08:00:00.000Z', status: 'pending', snoozeCount: 0,
    lastFiredAt: null, createdAt: '2026-07-09T09:00:00.000Z', updatedAt: '2026-07-09T09:00:00.000Z',
    ...overrides
  };
}

class MemoryReminderStore implements ReminderStore {
  constructor(public items: Reminder[]) {}
  pending() { return this.items.filter((item) => item.status === 'pending' || item.status === 'snoozed'); }
  get(id: string) { return this.items.find((item) => item.id === id) ?? null; }
  save(value: Reminder) { this.items = this.items.map((item) => item.id === value.id ? value : item); return value; }
}

describe('ReminderScheduler', () => {
  it('fires a missed reminder once when it is less than 24 hours late', async () => {
    const store = new MemoryReminderStore([reminder()]);
    const notifier = { show: vi.fn() };
    const scheduler = new ReminderScheduler(store, notifier, () => new Date('2026-07-10T09:00:00.000Z'));

    await scheduler.start();

    expect(notifier.show).toHaveBeenCalledTimes(1);
    expect(store.get('reminder-1')).toMatchObject({ status: 'fired', lastFiredAt: '2026-07-10T09:00:00.000Z' });
  });

  it('marks reminders older than 24 hours as missed without notifying', async () => {
    const store = new MemoryReminderStore([reminder({ scheduledAt: '2026-07-09T07:00:00.000Z' })]);
    const notifier = { show: vi.fn() };
    const scheduler = new ReminderScheduler(store, notifier, () => new Date('2026-07-10T09:00:00.000Z'));

    await scheduler.start();

    expect(notifier.show).not.toHaveBeenCalled();
    expect(store.get('reminder-1')?.status).toBe('missed');
  });

  it('persists a ten-minute snooze before rearming', async () => {
    const store = new MemoryReminderStore([reminder({ status: 'fired' })]);
    const scheduler = new ReminderScheduler(store, { show: vi.fn() }, () => new Date('2026-07-10T09:00:00.000Z'));

    await scheduler.snooze('reminder-1', 10);

    expect(store.get('reminder-1')).toMatchObject({
      status: 'snoozed',
      scheduledAt: '2026-07-10T09:10:00.000Z',
      snoozeCount: 1
    });
  });
});
