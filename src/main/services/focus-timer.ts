import type { FocusRepository } from '../repositories/focus';
import type { FocusSession } from '../../shared/ipc';
import { randomUUID } from 'node:crypto';

export class FocusTimer {
  constructor(private repo: FocusRepository, private now: () => Date = () => new Date()) {}

  start(taskId: string | null): FocusSession {
    if (this.repo.findActive()) throw new Error('已有正在进行的专注计时');
    const timestamp = this.now().toISOString();
    return this.repo.insert({
      id: randomUUID(), taskId, startedAt: timestamp, endedAt: null,
      durationSeconds: 0, lastResumedAt: timestamp, state: 'running',
      createdAt: timestamp, updatedAt: timestamp
    });
  }

  pause(id: string): FocusSession {
    const session = this.require(id);
    if (session.state !== 'running' || !session.lastResumedAt) throw new Error('当前计时不能暂停');
    const now = this.now();
    return this.repo.update({
      ...session,
      durationSeconds: session.durationSeconds + this.elapsed(session.lastResumedAt, now),
      lastResumedAt: null,
      state: 'paused',
      updatedAt: now.toISOString()
    });
  }

  resume(id: string): FocusSession {
    const session = this.require(id);
    if (session.state !== 'paused') throw new Error('当前计时不能继续');
    const timestamp = this.now().toISOString();
    return this.repo.update({ ...session, state: 'running', lastResumedAt: timestamp, updatedAt: timestamp });
  }

  finish(id: string): FocusSession {
    const session = this.require(id);
    if (session.state === 'finished') return session;
    const now = this.now();
    const extra = session.state === 'running' && session.lastResumedAt ? this.elapsed(session.lastResumedAt, now) : 0;
    return this.repo.update({
      ...session,
      state: 'finished',
      endedAt: now.toISOString(),
      lastResumedAt: null,
      durationSeconds: session.durationSeconds + extra,
      updatedAt: now.toISOString()
    });
  }

  current(): FocusSession | null {
    return this.repo.findActive();
  }

  private require(id: string): FocusSession {
    const session = this.repo.findById(id);
    if (!session) throw new Error('专注记录不存在');
    return session;
  }

  private elapsed(fromIso: string, to: Date): number {
    return Math.max(0, Math.floor((to.getTime() - new Date(fromIso).getTime()) / 1000));
  }
}
