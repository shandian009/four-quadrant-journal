import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BackupService } from '../../src/main/services/backup-service';
import { openDatabase } from '../../src/main/database';
import { TaskRepository } from '../../src/main/repositories/tasks';

let directory = '';
afterEach(() => { if (directory) rmSync(directory, { recursive: true, force: true }); });

function fixture() {
  directory = mkdtempSync(path.join(tmpdir(), 'four-quadrant-backup-'));
  const databasePath = path.join(directory, 'journal.db');
  const backupPath = path.join(directory, 'journal.fqjbackup');
  const db = openDatabase(databasePath);
  new TaskRepository(db).create({ title: '原始事项', quadrant: 'important', plannedDate: '2026-07-10' });
  return { databasePath, backupPath, db };
}

describe('BackupService', () => {
  it('exports a versioned backup with a valid hash', async () => {
    const { databasePath, backupPath, db } = fixture();
    const service = new BackupService(databasePath, db, () => new Date('2026-07-10T18:00:00.000Z'));

    const manifest = await service.export(backupPath);

    expect(manifest).toMatchObject({ formatVersion: 1, createdAt: '2026-07-10T18:00:00.000Z' });
    expect(manifest.databaseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(readFileSync(backupPath, 'utf8')).databaseSha256).toBe(manifest.databaseSha256);
    db.close();
  });

  it('rejects a corrupt backup without replacing current data', async () => {
    const { databasePath, backupPath, db } = fixture();
    const service = new BackupService(databasePath, db);
    await service.export(backupPath);
    const manifest = JSON.parse(readFileSync(backupPath, 'utf8'));
    manifest.databaseBase64 = Buffer.from('not sqlite').toString('base64');
    writeFileSync(backupPath, JSON.stringify(manifest));

    await expect(service.restore(backupPath)).rejects.toThrow('备份文件校验失败');
    const tasks = db.prepare("SELECT title FROM tasks WHERE status != 'deleted'").all() as Array<{ title: string }>;
    expect(tasks).toEqual([{ title: '原始事项' }]);
    db.close();
  });
});
