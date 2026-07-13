import { useEffect, useRef, useState } from 'react';
import type { DesktopWindowState, SettingsApi, WindowApi } from '../../../shared/ipc';
import type { ThemeId, ThemeOverride } from '../../theme/resolve-theme';
import { THEMES } from '../../theme/themes';
import { nextThemeSelection, type ThemeSelection } from './theme-cycle';

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

  async function cycleTheme() {
    onThemeAttempt?.();
    const next = nextThemeSelection(selection, now());
    const override: ThemeOverride | null = next === 'auto'
      ? null
      : { themeId: next, mode: 'persistent' };

    setSaving(true);
    setSaveError(null);
    try {
      await settings?.set('themeOverride', override);
      onThemeChange(override);
    } catch {
      setSaveError('皮肤保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  async function refreshAfterError(error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '';
    const message = errorMessage.includes('未能嵌入桌面')
      ? '未能嵌入桌面，已恢复普通窗口'
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
    if (!windowApi || desktopState.mode !== 'desktop') return;
    setDesktopState({ mode: 'desktop', opacity: value });
    if (opacityTimer.current) clearTimeout(opacityTimer.current);
    opacityTimer.current = setTimeout(() => {
      void windowApi.setDesktopOpacity(value)
        .then(setDesktopState)
        .catch(refreshAfterError);
    }, 150);
  }

  return (
    <div className="workbench-toolbar" data-testid="workbench-toolbar" role="toolbar" aria-label="工作台工具条">
      <button
        className="workbench-toolbar__theme"
        type="button"
        disabled={disabled || saving}
        aria-label={`切换皮肤，当前：${THEMES[themeId].label}`}
        onClick={() => void cycleTheme()}
      >
        <span aria-hidden="true">🎨</span>
        <span>{THEMES[themeId].label}</span>
      </button>
      <button
        type="button"
        disabled={windowApi ? desktopPending : !onToggleDesktop}
        onClick={() => void toggleDesktop()}
      >{desktopState.mode === 'desktop' ? '恢复窗口' : '嵌入桌面'}</button>
      {windowApi && desktopState.mode === 'desktop' ? (
        <label className="workbench-toolbar__opacity">
          <span>透明度</span>
          <input
            type="range"
            aria-label="桌面透明度"
            min="0.4"
            max="1"
            step="0.05"
            value={desktopState.opacity}
            onChange={(event) => changeOpacity(Number(event.currentTarget.value))}
          />
        </label>
      ) : !windowApi ? (
        <button type="button" disabled={!onOpacityChange} onClick={onOpacityChange}>透明度</button>
      ) : null}
      <button type="button" disabled={!onWeeklyReport} onClick={onWeeklyReport}>周报</button>
      <button type="button" disabled={!onMonthlyReport} onClick={onMonthlyReport}>月报</button>
      {(saveError ?? desktopError ?? statusMessage) && <span role="alert">{saveError ?? desktopError ?? statusMessage}</span>}
    </div>
  );
}
