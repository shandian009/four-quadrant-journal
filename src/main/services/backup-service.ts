import type Database from 'better-sqlite3';
import DatabaseConstructor from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

export interface BackupManifest {
  formatVersion: 1;
  createdAt: string;
  databaseSha256: string;
  databaseBase64: string;
}

export class BackupService {
  constructor(
    private databasePath: string,
    private db: Database.Database,
    private now: () => Date = () => new Date()
  ) {}

  async export(destination: string): Promise<BackupManifest> {
    this.db.pragma('wal_checkpoint(TRUNCATE)');
    const bytes = readFileSync(this.databasePath);
    const manifest: BackupManifest = {
      formatVersion: 1,
      createdAt: this.now().toISOString(),
      databaseSha256: this.hash(bytes),
      databaseBase64: bytes.toString('base64')
    };
    const temporary = `${destination}.tmp`;
    writeFileSync(temporary, JSON.stringify(manifest));
    renameSync(temporary, destination);
    return manifest;
  }

  async restore(source: string): Promise<void> {
    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(readFileSync(source, 'utf8')) as BackupManifest;
    } catch {
      throw new Error('备份文件格式无效');
    }
    if (manifest.formatVersion !== 1 || typeof manifest.databaseBase64 !== 'string') {
      throw new Error('备份文件格式无效');
    }
    const bytes = Buffer.from(manifest.databaseBase64, 'base64');
    if (this.hash(bytes) !== manifest.databaseSha256) throw new Error('备份文件校验失败');

    const candidate = `${this.databasePath}.restore-candidate`;
    writeFileSync(candidate, bytes);
    try {
      const testDb = new DatabaseConstructor(candidate, { readonly: true, fileMustExist: true });
      const integrity = testDb.pragma('integrity_check', { simple: true });
      const version = testDb.prepare('SELECT version FROM schema_meta LIMIT 1').get() as { version: number } | undefined;
      testDb.close();
      if (integrity !== 'ok' || !version || version.version > 1) throw new Error('备份数据库不可用');
    } catch {
      rmSync(candidate, { force: true });
      throw new Error('备份数据库不可用');
    }

    const timestamp = this.now().toISOString().replace(/[:.]/g, '-');
    const snapshot = `${this.databasePath}.pre-restore-${timestamp}.bak`;
    const displaced = `${this.databasePath}.replaced`;
    this.db.pragma('wal_checkpoint(TRUNCATE)');
    copyFileSync(this.databasePath, snapshot);
    this.db.close();
    try {
      renameSync(this.databasePath, displaced);
      renameSync(candidate, this.databasePath);
      rmSync(displaced, { force: true });
      rmSync(`${this.databasePath}-wal`, { force: true });
      rmSync(`${this.databasePath}-shm`, { force: true });
    } catch (error) {
      rmSync(this.databasePath, { force: true });
      copyFileSync(snapshot, this.databasePath);
      rmSync(candidate, { force: true });
      rmSync(displaced, { force: true });
      throw error;
    }
  }

  private hash(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
  }
}
