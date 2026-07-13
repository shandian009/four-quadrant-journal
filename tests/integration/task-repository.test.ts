import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/migrations';
import { TaskRepository } from '../../src/main/repositories/tasks';

describe('TaskRepository', () => {
  let db: Database.Database;
  let repo: TaskRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    repo = new TaskRepository(db, () => new Date('2026-07-10T09:00:00.000Z'));
  });

  it('creates and moves a task without losing identity', () => {
    const task = repo.create({
      title: '提交项目报告',
      notes: '复核后发送',
      quadrant: 'urgent_important',
      plannedDate: '2026-07-10'
    });

    const moved = repo.update(task.id, { quadrant: 'important' });

    expect(moved).toMatchObject({
      id: task.id,
      title: '提交项目报告',
      quadrant: 'important',
      status: 'active'
    });
    expect(repo.findByDate('2026-07-10')).toHaveLength(1);
  });

  it('completes and restores a task', () => {
    const task = repo.create({
      title: '确认会议材料',
      quadrant: 'urgent',
      plannedDate: '2026-07-10'
    });

    expect(repo.complete(task.id).completedAt).toBe('2026-07-10T09:00:00.000Z');
    expect(repo.restore(task.id)).toMatchObject({ status: 'active', completedAt: null });
  });

  it('soft deletes without returning the task in date results', () => {
    const task = repo.create({
      title: '删除测试',
      quadrant: 'neither',
      plannedDate: '2026-07-10'
    });

    repo.softDelete(task.id);

    expect(repo.findByDate('2026-07-10')).toEqual([]);
  });

  it('persists manual strike as a boolean', () => {
    const task = repo.create({
      title: '手动划线测试',
      quadrant: 'important',
      plannedDate: '2026-07-10'
    });

    expect(task.manualStruck).toBe(false);
    expect(repo.setManualStruck(task.id, true).manualStruck).toBe(true);
    expect(repo.setManualStruck(task.id, false).manualStruck).toBe(false);
    expect(db.prepare('SELECT manual_struck FROM tasks WHERE id = ?').pluck().get(task.id)).toBe(0);
  });

  it('finds non-deleted tasks in an inclusive date range', () => {
    const first = repo.create({ title: '月初事项', quadrant: 'important', plannedDate: '2026-07-01' });
    const last = repo.create({ title: '月末事项', quadrant: 'urgent', plannedDate: '2026-07-31' });
    repo.create({ title: '范围外事项', quadrant: 'neither', plannedDate: '2026-08-01' });
    const deleted = repo.create({ title: '已删除事项', quadrant: 'neither', plannedDate: '2026-07-15' });
    repo.softDelete(deleted.id);

    expect(repo.findByRange('2026-07-01', '2026-07-31').map((item) => item.id)).toEqual([first.id, last.id]);
  });
});
