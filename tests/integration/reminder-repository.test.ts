import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openDatabase } from '../../src/main/database';
import { ReminderRepository } from '../../src/main/repositories/reminders';
import { TaskRepository } from '../../src/main/repositories/tasks';

let directory = '';
afterEach(() => { if (directory) rmSync(directory, { recursive: true, force: true }); });

it('persists pending reminders across database reopen', () => {
  directory = mkdtempSync(path.join(tmpdir(), 'four-quadrant-reminder-'));
  const databasePath = path.join(directory, 'journal.db');
  let db = openDatabase(databasePath);
  const task = new TaskRepository(db, () => new Date('2026-07-10T09:00:00.000Z')).create({
    title: '提交项目报告', quadrant: 'urgent_important', plannedDate: '2026-07-10',
    remindAt: '2026-07-10T16:00:00.000Z'
  });
  new ReminderRepository(db, () => new Date('2026-07-10T09:00:00.000Z')).upsertForTask(task);
  db.close();

  db = openDatabase(databasePath);
  const pending = new ReminderRepository(db).pending();

  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({ taskId: task.id, taskTitle: '提交项目报告', status: 'pending' });
  db.close();
});
