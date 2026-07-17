import { describe, expect, it } from 'vitest';
import { THEME_ORDER } from '../../src/renderer/features/toolbar/theme-cycle';

describe('theme picker order', () => {
  it('contains every weekday skin exactly once in display order', () => {
    expect(THEME_ORDER).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday'
    ]);
    expect(new Set(THEME_ORDER).size).toBe(6);
  });
});
