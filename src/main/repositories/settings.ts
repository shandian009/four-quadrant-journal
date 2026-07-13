import type Database from 'better-sqlite3';

export class SettingsRepository {
  constructor(private db: Database.Database, private now: () => Date = () => new Date()) {}

  get<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (!row) return fallback;
    try { return JSON.parse(row.value) as T; } catch { return fallback; }
  }

  set(key: string, value: unknown): void {
    this.db.prepare(`
      INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, JSON.stringify(value), this.now().toISOString());
  }
}
