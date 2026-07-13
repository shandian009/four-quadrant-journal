export type ThemeId = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

export interface ThemeOverride {
  themeId: ThemeId;
  mode: 'today' | 'persistent';
  date?: string;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function effectiveThemeOverride(date: Date, override: ThemeOverride | null): ThemeOverride | null {
  if (override?.mode === 'persistent') return override;
  if (override?.mode === 'today' && override.date === formatLocalDate(date)) return override;
  return null;
}

export function resolveTheme(date: Date, override: ThemeOverride | null): ThemeId {
  const effectiveOverride = effectiveThemeOverride(date, override);
  if (effectiveOverride) return effectiveOverride.themeId;

  const weekdayThemes: ThemeId[] = [
    'saturday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
  ];

  return weekdayThemes[date.getDay()];
}
