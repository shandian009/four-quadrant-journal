import Database from 'better-sqlite3';
import { migrate } from './migrations';

export function openDatabase(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');
  if (filePath !== ':memory:') db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}
