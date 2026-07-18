import { ipcRenderer } from 'electron';

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('restore')?.addEventListener('click', () => {
    // The recovery window listens on WebContents' `ipc-message` event. Electron
    // emits that event for sendToHost; `send` is reserved for ipcMain handlers.
    ipcRenderer.sendToHost('desktop-recovery:restore');
  });
});
