import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Quadrant, Task } from '../../shared/domain';

export interface CreateTaskInput {
  title: string;
  notes?: string;
  quadrant: Quadrant;
  plannedDate: string;
  dueAt?: string | null;
  remindAt?: string | null;
  estimatedMinutes?: number | null;
}

interface TaskRow {
  id: string;
  title: string;
  notes: string;
  quadrant: Quadrant;
  planned_date: string;
  due_at: string | null;
  remind_at: string | null;
  estimated_minutes: number | null;
  status: Task['status'];
  manual_struck: number;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    quadrant: row.quadrant,
    plannedDate: row.planned_date,
    dueAt: row.due_at,
    remindAt: row.remind_at,
    estimatedMinutes: row.estimated_minutes,
    status: row.status,
    manualStruck: row.manual_struck === 1,
    sortOrder: row.sort_order,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class TaskRepository {
  constructor(private db: Database.Database, private now: () => Date = () => new Date()) {}

  create(input: CreateTaskInput): Task {
    const title = input.title.trim();
    if (!title) throw new Error('事项标题不能为空');
    const id = randomUUID();
    const timestamp = this.now().toISOString();
    const orderRow = this.db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
      FROM tasks WHERE planned_date = ? AND quadrant = ? AND status != 'deleted'
    `).get(input.plannedDate, input.quadrant) as { next_order: number };

    this.db.prepare(`
      INSERT INTO tasks (
        id, title, notes, quadrant, planned_date, due_at, remind_at,
        estimated_minutes, status, sort_order, completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NULL, ?, ?)
    `).run(
      id,
      title,
      input.notes ?? '',
      input.quadrant,
      input.plannedDate,
      input.dueAt ?? null,
      input.remindAt ?? null,
      input.estimatedMinutes ?? null,
      orderRow.next_order,
      timestamp,
      timestamp
    );
    return this.requireById(id);
  }

  update(id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>): Task {
    const columns: Record<string, string> = {
      title: 'title', notes: 'notes', quadrant: 'quadrant', plannedDate: 'planned_date',
      dueAt: 'due_at', remindAt: 'remind_at', estimatedMinutes: 'estimated_minutes',
      status: 'status', manualStruck: 'manual_struck', sortOrder: 'sort_order', completedAt: 'completed_at'
    };
    const entries = Object.entries(patch).filter(([key]) => columns[key]);
    if (!entries.length) return this.requireById(id);
    const setters = entries.map(([key]) => `${columns[key]} = ?`);
    const values = entries.map(([key, value]) => key === 'manualStruck' ? (value ? 1 : 0) : value);
    setters.push('updated_at = ?');
    values.push(this.now().toISOString());
    this.db.prepare(`UPDATE tasks SET ${setters.join(', ')} WHERE id = ?`).run(...values, id);
    return this.requireById(id);
  }

  complete(id: string): Task {
    const timestamp = this.now().toISOString();
    this.db.prepare(`UPDATE tasks SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`)
      .run(timestamp, timestamp, id);
    return this.requireById(id);
  }

  restore(id: string): Task {
    return this.update(id, { status: 'active', completedAt: null });
  }

  softDelete(id: string): Task {
    return this.update(id, { status: 'deleted' });
  }

  setManualStruck(id: string, struck: boolean): Task {
    return this.update(id, { manualStruck: struck });
  }

  findByDate(date: string): Task[] {
    const rows = this.db.prepare(`
      SELECT * FROM tasks
      WHERE planned_date = ? AND status != 'deleted'
      ORDER BY status = 'completed', sort_order, created_at
    `).all(date) as TaskRow[];
    return rows.map(toTask);
  }

  findByRange(startDate: string, endDate: string): Task[] {
    const rows = this.db.prepare(`
      SELECT * FROM tasks
      WHERE planned_date BETWEEN ? AND ? AND status != 'deleted'
      ORDER BY planned_date, status = 'completed', quadrant, sort_order, created_at
    `).all(startDate, endDate) as TaskRow[];
    return rows.map(toTask);
  }

  private requireById(id: string): Task {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
    if (!row) throw new Error('事项不存在');
    return toTask(row);
  }
}
