const navigation = [
  ['today-workbench', '今日工作台'],
  ['today', '今天'],
  ['quadrants', '四象限'],
  ['calendar', '日历'],
  ['review', '复盘'],
  ['statistics', '统计']
] as const;

export type NavigationId = (typeof navigation)[number][0] | 'settings';

export function Sidebar({
  active = 'today-workbench',
  onNavigate = () => undefined
}: {
  active?: NavigationId;
  onNavigate?(id: NavigationId): void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">四象日志</div>
      <nav aria-label="主导航">
        {navigation.map(([id, label]) => (
          <button key={id} className={`nav-item ${active === id ? 'nav-item--active' : ''}`} type="button" onClick={() => onNavigate(id)}>
            <span className="nav-item__icon" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
      <button className={`settings-button ${active === 'settings' ? 'settings-button--active' : ''}`} type="button" aria-label="设置" onClick={() => onNavigate('settings')}>
        <span className="settings-button__mark" aria-hidden="true">⌾</span>
      </button>
    </aside>
  );
}
