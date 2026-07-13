import type Database from 'better-sqlite3';

const VERSION = 2;

export function migrate(db: Database.Database): void {
  const run = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (
        version INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
        notes TEXT NOT NULL DEFAULT '',
        quadrant TEXT NOT NULL CHECK(quadrant IN ('urgent_important','important','urgent','neither')),
        planned_date TEXT NOT NULL,
        due_at TEXT,
        remind_at TEXT,
        estimated_minutes INTEGER CHECK(estimated_minutes IS NULL OR estimated_minutes > 0),
        status TEXT NOT NULL CHECK(status IN ('active','completed','deleted')) DEFAULT 'active',
        sort_order INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_reviews (
        id TEXT PRIMARY KEY,
        review_date TEXT NOT NULL UNIQUE,
        wins TEXT NOT NULL DEFAULT '',
        improvements TEXT NOT NULL DEFAULT '',
        tomorrow_focus TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        last_resumed_at TEXT,
        state TEXT NOT NULL CHECK(state IN ('running','paused','finished')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        scheduled_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','fired','snoozed','cancelled','missed')),
        snooze_count INTEGER NOT NULL DEFAULT 0,
        last_fired_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_date_status ON tasks(planned_date, status);
      CREATE INDEX IF NOT EXISTS idx_reminders_schedule_status ON reminders(scheduled_at, status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_task ON reminders(task_id);
      CREATE INDEX IF NOT EXISTS idx_focus_started ON focus_sessions(started_at);
    `);

    let current = db.prepare('SELECT version FROM schema_meta LIMIT 1').get() as { version: number } | undefined;
    if (!current) {
      db.prepare('INSERT INTO schema_meta(version) VALUES (1)').run();
      current = { version: 1 };
    }
    if (current.version < VERSION) {
      db.exec(`
        ALTER TABLE tasks ADD COLUMN manual_struck INTEGER NOT NULL DEFAULT 0
        CHECK (manual_struck IN (0, 1));
      `);
      db.prepare('UPDATE schema_meta SET version = ?').run(VERSION);
    }
  });

  run();
}
