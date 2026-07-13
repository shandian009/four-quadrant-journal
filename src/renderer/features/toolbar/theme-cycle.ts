import { resolveTheme, type ThemeId } from '../../theme/resolve-theme';

export type ThemeSelection = ThemeId | 'auto';

const themeOrder: ThemeId[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];

export function nextThemeSelection(current: ThemeSelection, now = new Date()): ThemeSelection {
  if (current === 'auto') {
    const resolved = resolveTheme(now, null);
    return themeOrder[(themeOrder.indexOf(resolved) + 1) % themeOrder.length];
  }

  const resolved = current;
  const index = themeOrder.indexOf(resolved);
  return index === themeOrder.length - 1 ? 'auto' : themeOrder[index + 1];
}
