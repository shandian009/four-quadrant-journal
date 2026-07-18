import type { ThemeId } from '../../theme/resolve-theme';

export type ThemeSelection = ThemeId | 'auto';

export const THEME_ORDER: readonly ThemeId[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];
