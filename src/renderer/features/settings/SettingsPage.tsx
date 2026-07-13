import { useState } from 'react';
import type { BackupApi, SettingsApi } from '../../../shared/ipc';
import type { ThemeId, ThemeOverride } from '../../theme/resolve-theme';
import { THEMES } from '../../theme/themes';

export function SettingsPage({ settings, backup, onThemeChange }: {
  settings: SettingsApi;
  backup: BackupApi;
  onThemeChange(override: ThemeOverride | null): void;
}) {
  const [themeId, setThemeId] = useState<ThemeId>('tuesday');
  const [mode, setMode] = useState<ThemeOverride['mode']>('persistent');
  const [loginOpen, setLoginOpen] = useState(false);
  const [message, setMessage] = useState('');

  async function applyTheme() {
    const now = new Date();
    const override: ThemeOverride = {
      themeId,
      mode,
      ...(mode === 'today' ? { date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` } : {})
    };
    await settings.set('themeOverride', override);
    onThemeChange(override);
    setMessage('皮肤已应用');
  }

  return (
    <div className="settings-page">
      <section className="settings-card">
        <h2>工作日皮肤</h2>
        <div className="settings-row">
          <label>皮肤<select value={themeId} onChange={(event) => setThemeId(event.target.value as ThemeId)}>
            {(Object.entries(THEMES) as Array<[ThemeId, (typeof THEMES)[ThemeId]]>).map(([id, theme]) => <option key={id} value={id}>{theme.label}</option>)}
          </select></label>
          <label>应用方式<select value={mode} onChange={(event) => setMode(event.target.value as ThemeOverride['mode'])}>
            <option value="today">仅今天</option><option value="persistent">保持使用</option>
          </select></label>
          <button className="primary-button" type="button" onClick={() => void applyTheme()}>应用皮肤</button>
        </div>
      </section>
      <section className="settings-card">
        <h2>桌面行为</h2>
        <label className="toggle-row"><input type="checkbox" checked={loginOpen} onChange={async (event) => {
          const value = event.target.checked; setLoginOpen(value); await settings.setLoginOpen(value);
        }} />开机时自动启动</label>
      </section>
      <section className="settings-card">
        <h2>本地数据</h2>
        <p>导出完整备份，或从备份恢复任务、复盘、专注记录和设置。</p>
        <div className="button-row">
          <button type="button" onClick={async () => { const path = await backup.export(); setMessage(path ? '备份已导出' : '已取消'); }}>导出备份</button>
          <button type="button" onClick={async () => { const restored = await backup.restore(); setMessage(restored ? '恢复成功，应用即将重启' : '已取消'); }}>恢复备份</button>
        </div>
      </section>
      {message && <p className="settings-message" role="status">{message}</p>}
    </div>
  );
}
