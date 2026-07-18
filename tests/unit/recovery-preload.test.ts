import { beforeEach, expect, it, vi } from 'vitest';

const sendToHost = vi.hoisted(() => vi.fn());
vi.mock('electron', () => ({ ipcRenderer: { sendToHost } }));

import '../../src/main/recovery-preload';

beforeEach(() => {
  document.body.innerHTML = '<button id="restore" type="button">恢复并编辑</button>';
  sendToHost.mockClear();
});

it('sends the restricted desktop recovery message when the control button is clicked', () => {
  window.dispatchEvent(new Event('DOMContentLoaded'));

  document.getElementById('restore')?.click();

  expect(sendToHost).toHaveBeenCalledOnce();
  expect(sendToHost).toHaveBeenCalledWith('desktop-recovery:restore');
});
