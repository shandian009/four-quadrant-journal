import { useEffect, useState } from 'react';
import type { JournalApi } from '../shared/ipc';
import { DashboardFrame } from './components/DashboardFrame';
import { effectiveThemeOverride, resolveTheme, type ThemeOverride } from './theme/resolve-theme';
import './styles/tokens.css';
import './styles/layout.css';

export function App({ api, now = () => new Date() }: { api?: JournalApi; now?: () => Date } = {}) {
  const journalApi = api ?? (typeof window !== 'undefined' && 'journalApi' in window ? window.journalApi : undefined);
  const [override, setOverride] = useState<ThemeOverride | null>(null);
  const [themeLoading, setThemeLoading] = useState(Boolean(journalApi));
  const [themeError, setThemeError] = useState<string | null>(null);

  useEffect(() => {
    if (!journalApi) {
      setThemeLoading(false);
      return;
    }
    let active = true;
    setThemeLoading(true);
    setThemeError(null);
    void (async () => {
      try {
        const value = await journalApi.settings.get<ThemeOverride | null>('themeOverride', null);
        if (active) setOverride(value);
      } catch {
        if (active) {
          setOverride(null);
          setThemeError('读取皮肤设置失败，已使用自动皮肤');
        }
      } finally {
        if (active) setThemeLoading(false);
      }
    })();
    return () => { active = false; };
  }, [journalApi]);

  const currentDate = now();
  const effectiveOverride = effectiveThemeOverride(currentDate, override);
  return <DashboardFrame
    themeId={resolveTheme(currentDate, effectiveOverride)}
    themeSelection={effectiveOverride?.themeId ?? 'auto'}
    themeLoading={themeLoading}
    themeError={themeError}
    taskApi={journalApi?.tasks}
    journalApi={journalApi}
    now={now}
    onThemeAttempt={() => setThemeError(null)}
    onThemeChange={setOverride}
  />;
}
