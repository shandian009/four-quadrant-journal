import { beforeEach, expect, it, vi } from 'vitest';

const send = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ ipcRenderer: { send } }));

import '../../src/main/recovery-preload';

beforeEach(() => {
  document.body.innerHTML = '<button id="restore" type="button">恢复并编辑</button>';
  send.mockClear();
});

it('sends the restricted desktop recovery message when the control button is clicked', () => {
  window.dispatchEvent(new Event('DOMContentLoaded'));

  document.getElementById('restore')?.click();

  expect(send).toHaveBeenCalledOnce();
  expect(send).toHaveBeenCalledWith('desktop-recovery:restore');
});
