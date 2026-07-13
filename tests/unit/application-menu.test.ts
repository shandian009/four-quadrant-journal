import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('electron', () => ({
  app: { getName: () => '四象日志', getVersion: () => '0.3.0', quit: vi.fn() },
  dialog: { showMessageBox: vi.fn() },
  Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() }
}));

import { buildApplicationMenu } from '../../src/main/application-menu';

describe('application menu', () => {
  it('uses Chinese labels for every visible menu entry', () => {
    const menu = buildApplicationMenu();

    expect(menu.map((item) => item.label)).toEqual(['文件', '编辑', '视图', '窗口', '帮助']);

    const visibleLabels = menu.flatMap((item) =>
      Array.isArray(item.submenu)
        ? item.submenu.flatMap((child) => child.type === 'separator' || !child.label ? [] : [child.label])
        : []
    );

    expect(visibleLabels).toEqual([
      '退出',
      '撤销', '重做', '剪切', '复制', '粘贴', '全选',
      '重新加载', '强制重新加载', '开发者工具', '实际大小', '放大', '缩小', '切换全屏',
      '最小化', '关闭',
      '关于四象日志'
    ]);
    expect([...menu.map((item) => item.label), ...visibleLabels].join(' '))
      .not.toMatch(/\b(File|Edit|View|Window|Help|About|Quit|Copy|Paste|Close)\b/i);
  });

  it('installs the Chinese menu as the first whenReady operation', () => {
    const source = readFileSync('src/main/main.ts', 'utf8');
    const readyStart = source.indexOf('app.whenReady().then(() => {');
    const readyBody = source.slice(readyStart + 'app.whenReady().then(() => {'.length);

    expect(readyStart).toBeGreaterThan(-1);
    expect(readyBody?.trimStart()).toMatch(/^installApplicationMenu\(\);/);
  });
});
