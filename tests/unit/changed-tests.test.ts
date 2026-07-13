import { describe, expect, it } from 'vitest';
import { changedFilesSince, selectTests } from '../../scripts/changed-tests';

describe('changed test selection', () => {
  it('selects calendar and task range tests for calendar changes', () => {
    expect(selectTests(['src/renderer/features/calendar/MonthCalendar.tsx'])).toEqual({
      full: false,
      tests: [
        'tests/integration/month-calendar.test.tsx',
        'tests/integration/task-repository.test.ts',
        'tests/integration/task-workspace.test.tsx'
      ]
    });
  });

  it('escalates shared IPC and migrations to full verification', () => {
    expect(selectTests(['src/shared/ipc.ts']).full).toBe(true);
    expect(selectTests(['src/main/migrations.ts']).full).toBe(true);
  });

  it('deduplicates tests for overlapping feature changes', () => {
    const result = selectTests([
      'src/renderer/features/tasks/QuadrantBoard.tsx',
      'src/renderer/features/tasks/QuadrantPage.tsx'
    ]);
    expect(new Set(result.tests).size).toBe(result.tests.length);
  });

  it('diffs the event base against HEAD so a multi-commit push includes the whole push', () => {
    const calls: Array<readonly string[]> = [];
    const changed = changedFilesSince('push-before-sha', (_file, args) => {
      calls.push(args);
      return args[0] === 'cat-file'
        ? ''
        : 'src/renderer/features/calendar/MonthCalendar.tsx\nsrc/main/migrations.ts\n';
    });

    expect(changed).toEqual([
      'src/renderer/features/calendar/MonthCalendar.tsx',
      'src/main/migrations.ts'
    ]);
    expect(calls).toEqual([
      ['cat-file', '-e', 'push-before-sha^{commit}'],
      ['diff', '--name-only', 'push-before-sha', 'HEAD']
    ]);
  });

  it.each([undefined, '', '0000000000000000000000000000000000000000'])(
    'returns no changed-file set for unusable event base %j',
    (base) => {
      expect(changedFilesSince(base, () => { throw new Error('git must not run'); })).toBeNull();
    }
  );

  it('returns no changed-file set when the event base commit is unavailable', () => {
    expect(changedFilesSince('missing-base', () => { throw new Error('unknown revision'); })).toBeNull();
  });
});
