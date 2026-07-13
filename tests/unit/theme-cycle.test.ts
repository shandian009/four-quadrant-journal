import { describe, expect, it } from 'vitest';
import { nextThemeSelection, type ThemeSelection } from '../../src/renderer/features/toolbar/theme-cycle';

describe('theme selection cycle', () => {
  it.each<[ThemeSelection, ThemeSelection]>([
    ['monday', 'tuesday'],
    ['tuesday', 'wednesday'],
    ['wednesday', 'thursday'],
    ['thursday', 'friday'],
    ['friday', 'saturday'],
    ['saturday', 'auto']
  ])('advances %s to %s', (current, expected) => {
    expect(nextThemeSelection(current)).toBe(expected);
  });

  it('resolves auto from today before advancing so the click is visible', () => {
    expect(nextThemeSelection('auto', new Date(2026, 6, 6, 12))).toBe('tuesday');
  });

  it('wraps weekend auto to monday so the click remains visible', () => {
    expect(nextThemeSelection('auto', new Date(2026, 6, 12, 12))).toBe('monday');
  });
});
