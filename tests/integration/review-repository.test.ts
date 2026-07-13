import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/main/migrations';
import { DailyReviewRepository } from '../../src/main/repositories/reviews';

describe('DailyReviewRepository', () => {
  let repo: DailyReviewRepository;

  beforeEach(() => {
    const db = new Database(':memory:');
    migrate(db);
    repo = new DailyReviewRepository(db, () => new Date('2026-07-10T18:00:00.000Z'));
  });

  it('keeps one review per date and updates it in place', () => {
    const first = repo.save('2026-07-10', {
      wins: '完成报告',
      improvements: '',
      tomorrowFocus: '复核图纸'
    });
    const updated = repo.save('2026-07-10', {
      wins: '完成并发送报告',
      improvements: '更早开始复核',
      tomorrowFocus: '复核图纸'
    });

    expect(updated.id).toBe(first.id);
    expect(repo.findByDate('2026-07-10')).toMatchObject({
      wins: '完成并发送报告',
      improvements: '更早开始复核'
    });
  });

  it('finds reviews in an inclusive range ordered by review date', () => {
    repo.save('2026-07-31', { wins: '月末', improvements: '', tomorrowFocus: '' });
    repo.save('2026-07-01', { wins: '月初', improvements: '', tomorrowFocus: '' });
    repo.save('2026-08-01', { wins: '下月', improvements: '', tomorrowFocus: '' });

    expect(repo.findByRange('2026-07-01', '2026-07-31').map((review) => review.reviewDate))
      .toEqual(['2026-07-01', '2026-07-31']);
  });
});
