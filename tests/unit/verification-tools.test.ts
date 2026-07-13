import { describe, expect, it } from 'vitest';
import { assertThemeParity } from '../../src/build/verify-theme-parity';
import { findNetworkViolations } from '../../src/build/verify-no-network';
import { THEMES } from '../../src/renderer/theme/themes';

describe('release verification tools', () => {
  it('accepts theme sets with identical token keys', () => {
    expect(() => assertThemeParity({ a: { one: '#fff', two: '#000' }, b: { one: '#eee', two: '#111' } })).not.toThrow();
  });

  it('rejects a theme missing a token', () => {
    expect(() => assertThemeParity({ a: { one: '#fff', two: '#000' }, b: { one: '#eee' } })).toThrow('主题令牌不一致');
  });

  it('defines six complete gradient-based weekday skins', () => {
    expect(Object.keys(THEMES)).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
    expect(() => assertThemeParity(THEMES)).not.toThrow();

    for (const theme of Object.values(THEMES)) {
      expect(theme).toEqual(expect.objectContaining({
        canvasGradient: expect.stringContaining('linear-gradient'),
        sidebarGradient: expect.stringContaining('linear-gradient'),
        surfaceGradient: expect.stringContaining('linear-gradient'),
        calendarGradient: expect.stringContaining('linear-gradient'),
        overviewGradient: expect.stringContaining('linear-gradient'),
        reviewGradient: expect.stringContaining('linear-gradient'),
        activeGradient: expect.stringContaining('linear-gradient')
      }));
    }
  });

  it('finds business network primitives', () => {
    expect(findNetworkViolations('const data = fetch("https://example.com")')).toEqual(expect.arrayContaining(['fetch(', 'https://']));
    expect(findNetworkViolations('const value = localStorage.getItem("x")')).toEqual([]);
  });
});
