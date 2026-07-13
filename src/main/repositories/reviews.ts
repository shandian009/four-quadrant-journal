import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { DailyReview } from '../../shared/domain';

export interface SaveReviewInput {
  wins: string;
  improvements: string;
  tomorrowFocus: string;
}

interface ReviewRow {
  id: string;
  review_date: string;
  wins: string;
  improvements: string;
  tomorrow_focus: string;
  created_at: string;
  updated_at: string;
}

function toReview(row: ReviewRow): DailyReview {
  return {
    id: row.id,
    reviewDate: row.review_date,
    wins: row.wins,
    improvements: row.improvements,
    tomorrowFocus: row.tomorrow_focus,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class DailyReviewRepository {
  constructor(private db: Database.Database, private now: () => Date = () => new Date()) {}

  save(date: string, input: SaveReviewInput): DailyReview {
    const timestamp = this.now().toISOString();
    this.db.prepare(`
      INSERT INTO daily_reviews (
        id, review_date, wins, improvements, tomorrow_focus, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(review_date) DO UPDATE SET
        wins = excluded.wins,
        improvements = excluded.improvements,
        tomorrow_focus = excluded.tomorrow_focus,
        updated_at = excluded.updated_at
    `).run(randomUUID(), date, input.wins, input.improvements, input.tomorrowFocus, timestamp, timestamp);
    return this.findByDate(date)!;
  }

  findByDate(date: string): DailyReview | null {
    const row = this.db.prepare('SELECT * FROM daily_reviews WHERE review_date = ?').get(date) as ReviewRow | undefined;
    return row ? toReview(row) : null;
  }

  findByRange(startDate: string, endDate: string): DailyReview[] {
    const rows = this.db.prepare(`
      SELECT * FROM daily_reviews
      WHERE review_date BETWEEN ? AND ?
      ORDER BY review_date
    `).all(startDate, endDate) as ReviewRow[];
    return rows.map(toReview);
  }
}
