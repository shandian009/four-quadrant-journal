import { describe, expect, it } from 'vitest';
import { effectiveThemeOverride, resolveTheme } from '../../src/renderer/theme/resolve-theme';

describe('weekday theme selection', () => {
  it('treats an expired today override as automatic selection', () => {
    expect(effectiveThemeOverride(new Date(2026, 6, 7, 12), {
      themeId: 'monday',
      mode: 'today',
      date: '2026-07-06'
    })).toBeNull();
  });

  it.each([
    ['2026-07-06', 'monday'],
    ['2026-07-07', 'tuesday'],
    ['2026-07-08', 'wednesday'],
    ['2026-07-09', 'thursday'],
    ['2026-07-10', 'friday'],
    ['2026-07-11', 'saturday'],
    ['2026-07-12', 'saturday']
  ] as const)('maps %s to %s', (isoDate, themeId) => {
    expect(resolveTheme(new Date(`${isoDate}T12:00:00`), null)).toBe(themeId);
  });

  it('honors a persistent override', () => {
    expect(
      resolveTheme(new Date('2026-07-06T12:00:00'), {
        themeId: 'friday',
        mode: 'persistent'
      })
    ).toBe('friday');
  });

  it('honors a today-only override only on its date', () => {
    const override = {
      themeId: 'wednesday' as const,
      mode: 'today' as const,
      date: '2026-07-06'
    };

    expect(resolveTheme(new Date('2026-07-06T08:00:00'), override)).toBe('wednesday');
    expect(resolveTheme(new Date('2026-07-07T08:00:00'), override)).toBe('tuesday');
  });
});
