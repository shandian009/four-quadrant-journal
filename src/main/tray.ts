export interface TrayMenuItem { id: string; label?: string; checked?: boolean; }

export function buildTrayMenu(_paused: boolean): TrayMenuItem[] {
  return [
    { id: 'show', label: '显示四象日志' },
    { id: 'quickAdd', label: '快速添加事项' },
    { id: 'pauseReminders', label: _paused ? '恢复提醒' : '暂停提醒', checked: _paused },
    { id: 'restoreWindow', label: '恢复主窗口' },
    { id: 'separator' },
    { id: 'quit', label: '退出' }
  ];
}
