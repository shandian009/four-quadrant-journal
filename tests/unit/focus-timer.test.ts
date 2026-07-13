import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/migrations';
import { FocusRepository } from '../../src/main/repositories/focus';
import { FocusTimer } from '../../src/main/services/focus-timer';

function fakeClock(iso: string) {
  let current = new Date(iso);
  return {
    now: () => new Date(current),
    advanceMinutes(minutes: number) { current = new Date(current.getTime() + minutes * 60_000); }
  };
}

describe('FocusTimer', () => {
  let repo: FocusRepository;

  beforeEach(() => {
    const db = new Database(':memory:');
    migrate(db);
    repo = new FocusRepository(db);
  });

  it('records elapsed time when a session finishes', () => {
    const clock = fakeClock('2026-07-10T09:00:00.000Z');
    const timer = new FocusTimer(repo, clock.now);
    const session = timer.start(null);
    clock.advanceMinutes(25);

    const finished = timer.finish(session.id);

    expect(finished.durationSeconds).toBe(1500);
    expect(finished.state).toBe('finished');
    expect(repo.totalForDate('2026-07-10')).toBe(1500);
  });

  it('excludes paused time', () => {
    const clock = fakeClock('2026-07-10T09:00:00.000Z');
    const timer = new FocusTimer(repo, clock.now);
    const session = timer.start(null);
    clock.advanceMinutes(10);
    timer.pause(session.id);
    clock.advanceMinutes(5);
    timer.resume(session.id);
    clock.advanceMinutes(15);

    expect(timer.finish(session.id).durationSeconds).toBe(1500);
  });

  it('allows only one unfinished session and recovers it', () => {
    const clock = fakeClock('2026-07-10T09:00:00.000Z');
    const timer = new FocusTimer(repo, clock.now);
    const session = timer.start(null);

    expect(() => timer.start(null)).toThrow('已有正在进行的专注计时');
    expect(timer.current()).toMatchObject({ id: session.id, state: 'running' });
  });
});
