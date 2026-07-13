import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/main/database';
import { migrate } from '../../src/main/migrations';

describe('database migrations', () => {
  it('creates schema version 2 and is idempotent', () => {
    const db = new Database(':memory:');

    migrate(db);
    migrate(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);
    const version = db.prepare('SELECT version FROM schema_meta').get() as { version: number };

    expect(tables).toEqual(expect.arrayContaining([
      'daily_reviews',
      'focus_sessions',
      'reminders',
      'schema_meta',
      'settings',
      'tasks'
    ]));
    expect(version.version).toBe(2);
    expect(db.prepare('PRAGMA table_info(tasks)').all()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'manual_struck', dflt_value: '0' })])
    );
    db.close();
  });

  it('upgrades a version-1 task table through the version-2 migration exactly once', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE schema_meta (version INTEGER NOT NULL);
      INSERT INTO schema_meta(version) VALUES (1);
      CREATE TABLE tasks (
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
    `);

    migrate(db);
    migrate(db);

    expect(db.prepare('SELECT version FROM schema_meta').pluck().get()).toBe(2);
    expect(db.prepare('PRAGMA table_info(tasks)').all()).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'manual_struck', dflt_value: '0' })])
    );
    expect((db.prepare('PRAGMA table_info(tasks)').all() as Array<{ name: string }>)
      .filter(({ name }) => name === 'manual_struck')).toHaveLength(1);
    db.close();
  });

  it('opens a ready-to-use database', () => {
    const db = openDatabase(':memory:');
    const version = db.prepare('SELECT version FROM schema_meta').get() as { version: number };

    expect(version.version).toBe(2);
    expect((db.pragma('foreign_keys', { simple: true }) as number)).toBe(1);
    db.close();
  });
});
