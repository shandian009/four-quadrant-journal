import { ipcRenderer } from 'electron';

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('restore')?.addEventListener('click', () => {
    ipcRenderer.send('desktop-recovery:restore');
  });
});
