import type Database from 'better-sqlite3';
import type { FocusSession } from '../../shared/ipc';

interface FocusRow {
  id: string;
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  last_resumed_at: string | null;
  state: FocusSession['state'];
  created_at: string;
  updated_at: string;
}

function toSession(row: FocusRow): FocusSession {
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    lastResumedAt: row.last_resumed_at,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class FocusRepository {
  constructor(private db: Database.Database) {}

  insert(session: FocusSession): FocusSession {
    this.db.prepare(`
      INSERT INTO focus_sessions (
        id, task_id, started_at, ended_at, duration_seconds, last_resumed_at,
        state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(session.id, session.taskId, session.startedAt, session.endedAt, session.durationSeconds,
      session.lastResumedAt, session.state, session.createdAt, session.updatedAt);
    return this.findById(session.id)!;
  }

  update(session: FocusSession): FocusSession {
    this.db.prepare(`
      UPDATE focus_sessions SET task_id = ?, ended_at = ?, duration_seconds = ?,
        last_resumed_at = ?, state = ?, updated_at = ? WHERE id = ?
    `).run(session.taskId, session.endedAt, session.durationSeconds, session.lastResumedAt,
      session.state, session.updatedAt, session.id);
    return this.findById(session.id)!;
  }

  findById(id: string): FocusSession | null {
    const row = this.db.prepare('SELECT * FROM focus_sessions WHERE id = ?').get(id) as FocusRow | undefined;
    return row ? toSession(row) : null;
  }

  findActive(): FocusSession | null {
    const row = this.db.prepare("SELECT * FROM focus_sessions WHERE state IN ('running','paused') ORDER BY created_at DESC LIMIT 1").get() as FocusRow | undefined;
    return row ? toSession(row) : null;
  }

  totalForDate(date: string): number {
    const row = this.db.prepare(`
      SELECT COALESCE(SUM(duration_seconds), 0) AS total
      FROM focus_sessions WHERE substr(started_at, 1, 10) = ? AND state = 'finished'
    `).get(date) as { total: number };
    return row.total;
  }
}
