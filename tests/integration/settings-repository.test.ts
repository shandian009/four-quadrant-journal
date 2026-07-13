import Database from 'better-sqlite3';
import { expect, it } from 'vitest';
import { migrate } from '../../src/main/migrations';
import { SettingsRepository } from '../../src/main/repositories/settings';

it('persists typed settings values', () => {
  const db = new Database(':memory:');
  migrate(db);
  const settings = new SettingsRepository(db, () => new Date('2026-07-10T18:00:00.000Z'));

  expect(settings.get('themeOverride', null)).toBeNull();
  settings.set('themeOverride', { themeId: 'friday', mode: 'persistent' });

  expect(settings.get('themeOverride', null)).toEqual({ themeId: 'friday', mode: 'persistent' });
});
