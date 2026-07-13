import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Task } from '../../shared/domain';
import type { Reminder, ReminderStore } from '../services/reminder-scheduler';

interface ReminderRow {
  id: string;
  task_id: string;
  task_title: string;
  scheduled_at: string;
  status: Reminder['status'];
  snooze_count: number;
  last_fired_at: string | null;
  created_at: string;
  updated_at: string;
}

function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    scheduledAt: row.scheduled_at,
    status: row.status,
    snoozeCount: row.snooze_count,
    lastFiredAt: row.last_fired_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class ReminderRepository implements ReminderStore {
  constructor(private db: Database.Database, private now: () => Date = () => new Date()) {}

  upsertForTask(task: Task): Reminder | null {
    const timestamp = this.now().toISOString();
    if (!task.remindAt) {
      this.db.prepare("UPDATE reminders SET status = 'cancelled', updated_at = ? WHERE task_id = ?").run(timestamp, task.id);
      return null;
    }
    this.db.prepare(`
      INSERT INTO reminders (
        id, task_id, scheduled_at, status, snooze_count, last_fired_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'pending', 0, NULL, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        scheduled_at = excluded.scheduled_at,
        status = 'pending',
        updated_at = excluded.updated_at
    `).run(randomUUID(), task.id, task.remindAt, timestamp, timestamp);
    return this.findForTask(task.id);
  }

  pending(): Reminder[] {
    return (this.db.prepare(`
      SELECT r.*, t.title AS task_title FROM reminders r
      JOIN tasks t ON t.id = r.task_id
      WHERE r.status IN ('pending','snoozed') AND t.status != 'deleted'
      ORDER BY r.scheduled_at
    `).all() as ReminderRow[]).map(toReminder);
  }

  get(id: string): Reminder | null {
    const row = this.db.prepare(`
      SELECT r.*, t.title AS task_title FROM reminders r
      JOIN tasks t ON t.id = r.task_id WHERE r.id = ?
    `).get(id) as ReminderRow | undefined;
    return row ? toReminder(row) : null;
  }

  save(reminder: Reminder): Reminder {
    this.db.prepare(`
      UPDATE reminders SET scheduled_at = ?, status = ?, snooze_count = ?,
        last_fired_at = ?, updated_at = ? WHERE id = ?
    `).run(reminder.scheduledAt, reminder.status, reminder.snoozeCount,
      reminder.lastFiredAt, reminder.updatedAt, reminder.id);
    return this.get(reminder.id)!;
  }

  private findForTask(taskId: string): Reminder | null {
    const row = this.db.prepare(`
      SELECT r.*, t.title AS task_title FROM reminders r
      JOIN tasks t ON t.id = r.task_id WHERE r.task_id = ?
    `).get(taskId) as ReminderRow | undefined;
    return row ? toReminder(row) : null;
  }
}
