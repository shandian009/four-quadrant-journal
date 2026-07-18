import { useEffect, useRef, useState } from 'react';
import type { DesktopWindowState, SettingsApi, WindowApi } from '../../../shared/ipc';
import type { ThemeId, ThemeOverride } from '../../theme/resolve-theme';
import { THEMES } from '../../theme/themes';
import { THEME_ORDER, type ThemeSelection } from './theme-cycle';

export function WorkbenchToolbar({
  themeId,
  selection,
  settings,
  windowApi,
  disabled = false,
  statusMessage = null,
  now = () => new Date(),
  onThemeAttempt,
  onThemeChange,
  onToggleDesktop,
  onOpacityChange,
  onWeeklyReport,
  onMonthlyReport
}: {
  themeId: ThemeId;
  selection: ThemeSelection;
  settings?: SettingsApi;
  windowApi?: WindowApi;
  disabled?: boolean;
  statusMessage?: string | null;
  now?: () => Date;
  onThemeAttempt?(): void;
  onThemeChange(override: ThemeOverride | null): void;
  onToggleDesktop?(): void;
  onOpacityChange?(): void;
  onWeeklyReport?(): void;
  onMonthlyReport?(): void;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [desktopState, setDesktopState] = useState<DesktopWindowState>({ mode: 'normal', opacity: 1 });
  const [desktopPending, setDesktopPending] = useState(Boolean(windowApi));
  const [desktopError, setDesktopError] = useState<string | null>(null);
  const opacityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!windowApi) return;
    let active = true;
    setDesktopPending(true);
    void windowApi.getDesktopState()
      .then((state) => { if (active) setDesktopState(state); })
      .catch(() => { if (active) setDesktopError('读取窗口状态失败，请重试'); })
      .finally(() => { if (active) setDesktopPending(false); });
    return () => {
      active = false;
      if (opacityTimer.current) clearTimeout(opacityTimer.current);
    };
  }, [windowApi]);

  async function selectTheme(selectedThemeId: ThemeId) {
    onThemeAttempt?.();
    const override: ThemeOverride = { themeId: selectedThemeId, mode: 'persistent' };

    setSaving(true);
    setSaveError(null);
    try {
      await settings?.set('themeOverride', override);
      onThemeChange(override);
      setThemeMenuOpen(false);
    } catch {
      setSaveError('皮肤保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  function handleThemeMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setThemeMenuOpen(false);
  }

  async function refreshAfterError(error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '';
    const message = errorMessage.includes('未能嵌入桌面')
      ? errorMessage.slice(errorMessage.indexOf('未能嵌入桌面'))
      : errorMessage.includes('恢复失败') || errorMessage.includes('请从托盘重试')
        ? '恢复失败，请从托盘重试'
        : '窗口操作失败，请重试';
    setDesktopError(message);
    try { setDesktopState(await windowApi!.getDesktopState()); } catch { /* keep recovery message */ }
  }

  async function toggleDesktop() {
    if (!windowApi) return onToggleDesktop?.();
    setDesktopPending(true);
    setDesktopError(null);
    try {
      setDesktopState(desktopState.mode === 'desktop'
        ? await windowApi.exitDesktopMode()
        : await windowApi.enterDesktopMode());
    } catch (error) {
      await refreshAfterError(error);
    } finally {
      setDesktopPending(false);
    }
  }

  function changeOpacity(value: number) {
    if (!windowApi) return;
    setDesktopState((state) => ({ ...state, opacity: value }));
    if (opacityTimer.current) clearTimeout(opacityTimer.current);
    opacityTimer.current = setTimeout(() => {
      void windowApi.setDesktopOpacity(value)
        .then(setDesktopState)
        .catch(refreshAfterError);
    }, 150);
  }

  function resetOpacity() {
    if (!windowApi) return onOpacityChange?.();
    if (opacityTimer.current) clearTimeout(opacityTimer.current);
    setDesktopState((state) => ({ ...state, opacity: 1 }));
    void windowApi.setDesktopOpacity(1).then(setDesktopState).catch(refreshAfterError);
  }

  return (
    <div className="workbench-toolbar" data-testid="workbench-toolbar" role="toolbar" aria-label="工作台工具条">
      <div className="workbench-toolbar__theme-picker" onKeyDown={handleThemeMenuKeyDown}>
        <button
          className="workbench-toolbar__theme"
          type="button"
          disabled={disabled || saving}
          aria-label={`切换皮肤，当前：${THEMES[themeId].label}`}
          aria-haspopup="menu"
          aria-expanded={themeMenuOpen}
          onClick={() => setThemeMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">🎨</span>
          <span>{THEMES[themeId].label}</span>
          <span aria-hidden="true">⌄</span>
        </button>
        {themeMenuOpen && (
          <div className="workbench-toolbar__theme-menu" role="menu" aria-label="选择皮肤">
            {THEME_ORDER.map((item) => (
              <button
                key={item}
                type="button"
                role="menuitemradio"
                aria-checked={themeId === item}
                disabled={saving}
                onClick={() => void selectTheme(item)}
              >
                <span aria-hidden="true" className="workbench-toolbar__theme-check">{themeId === item ? '✓' : ''}</span>
                <span>{THEMES[item].label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={windowApi ? desktopPending : !onToggleDesktop}
        onClick={() => void toggleDesktop()}
      >{desktopState.mode === 'desktop' ? '恢复窗口' : '嵌入桌面'}</button>
      {desktopState.mode === 'desktop' && desktopState.placement === 'compatible' && (
        <span className="workbench-toolbar__placement" title="系统未开放 WorkerW，已自动置于桌面底层">桌面兼容模式</span>
      )}
      {windowApi ? (
        <div className="workbench-toolbar__opacity">
          <span>透明度</span>
          <input
            type="range"
            aria-label="窗口透明度"
            min="0.4"
            max="1"
            step="0.05"
            value={desktopState.opacity}
            onChange={(event) => changeOpacity(Number(event.currentTarget.value))}
          />
          <output>{Math.round(desktopState.opacity * 100)}%</output>
          <button type="button" aria-label="恢复完全不透明" disabled={desktopState.opacity === 1} onClick={resetOpacity}>重置</button>
        </div>
      ) : !windowApi ? (
        <button type="button" disabled={!onOpacityChange} onClick={onOpacityChange}>透明度</button>
      ) : null}
      <button type="button" disabled={!onWeeklyReport} onClick={onWeeklyReport}>周报</button>
      <button type="button" disabled={!onMonthlyReport} onClick={onMonthlyReport}>月报</button>
      {(saveError ?? desktopError ?? statusMessage) && <span role="alert">{saveError ?? desktopError ?? statusMessage}</span>}
    </div>
  );
}
