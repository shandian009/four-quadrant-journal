import { expect, it } from 'vitest';
import { buildTrayMenu } from '../../src/main/tray';

it('builds the expected tray actions', () => {
  expect(buildTrayMenu(false).map((item) => item.id)).toEqual([
    'show', 'quickAdd', 'pauseReminders', 'restoreWindow', 'separator', 'quit'
  ]);
  expect(buildTrayMenu(false)[3]).toEqual({ id: 'restoreWindow', label: '恢复主窗口' });
  expect(buildTrayMenu(false).find((item) => item.id === 'pauseReminders')).toMatchObject({
    label: '暂停提醒', checked: false
  });
  expect(buildTrayMenu(true).find((item) => item.id === 'pauseReminders')).toMatchObject({
    label: '恢复提醒', checked: true
  });
});
