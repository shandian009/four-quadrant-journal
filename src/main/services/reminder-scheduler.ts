export interface Reminder {
  id: string;
  taskId: string;
  taskTitle: string;
  scheduledAt: string;
  status: 'pending' | 'fired' | 'snoozed' | 'cancelled' | 'missed';
  snoozeCount: number;
  lastFiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderStore {
  pending(): Reminder[];
  get(id: string): Reminder | null;
  save(reminder: Reminder): Reminder;
}

export interface ReminderNotifier { show(reminder: Reminder): void | Promise<void>; }

export class ReminderScheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private paused = false;

  constructor(
    private store: ReminderStore,
    private notifier: ReminderNotifier,
    private now: () => Date = () => new Date()
  ) {}

  async start(): Promise<void> {
    this.clearTimers();
    if (this.paused) return;
    for (const reminder of this.store.pending()) {
      const delay = new Date(reminder.scheduledAt).getTime() - this.now().getTime();
      if (delay > 0) {
        this.arm(reminder, delay);
      } else if (Math.abs(delay) <= 24 * 60 * 60 * 1000) {
        await this.fire(reminder.id);
      } else {
        this.store.save({ ...reminder, status: 'missed', updatedAt: this.now().toISOString() });
      }
    }
  }

  async snooze(id: string, minutes: number): Promise<void> {
    const reminder = this.store.get(id);
    if (!reminder) throw new Error('提醒不存在');
    const scheduledAt = new Date(this.now().getTime() + minutes * 60_000).toISOString();
    const updated = this.store.save({
      ...reminder,
      scheduledAt,
      status: 'snoozed',
      snoozeCount: reminder.snoozeCount + 1,
      updatedAt: this.now().toISOString()
    });
    this.disarm(id);
    if (!this.paused) this.arm(updated, minutes * 60_000);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.clearTimers();
    else void this.start();
  }

  private arm(reminder: Reminder, delay: number): void {
    const timer = setTimeout(() => void this.fire(reminder.id), delay);
    if (typeof timer === 'object' && 'unref' in timer) timer.unref();
    this.timers.set(reminder.id, timer);
  }

  private async fire(id: string): Promise<void> {
    const reminder = this.store.get(id);
    if (!reminder || !['pending', 'snoozed'].includes(reminder.status) || this.paused) return;
    await this.notifier.show(reminder);
    const timestamp = this.now().toISOString();
    this.store.save({ ...reminder, status: 'fired', lastFiredAt: timestamp, updatedAt: timestamp });
    this.disarm(id);
  }

  private disarm(id: string): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
  }

  private clearTimers(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}
