import { Menu, nativeImage, Tray, type BrowserWindow } from 'electron';
import path from 'node:path';
import { buildTrayMenu } from './tray';

export function createApplicationTray(
  window: BrowserWindow,
  actions: { quickAdd(): void; setRemindersPaused(paused: boolean): void; restoreWindow(): void; quit(): void }
): Tray {
  let paused = false;
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.png'));
  const tray = new Tray(icon);
  tray.setToolTip('四象日志');

  const refresh = () => {
    const items = buildTrayMenu(paused);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: items[0].label, click: () => { window.show(); window.focus(); } },
      { label: items[1].label, click: actions.quickAdd },
      { label: items[2].label, type: 'checkbox', checked: paused, click: () => {
        paused = !paused;
        actions.setRemindersPaused(paused);
        refresh();
      } },
      { label: items[3].label, click: actions.restoreWindow },
      { type: 'separator' },
      { label: items[5].label, click: actions.quit }
    ]));
  };
  refresh();
  tray.on('double-click', actions.restoreWindow);
  return tray;
}
