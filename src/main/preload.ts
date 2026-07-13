import { contextBridge, ipcRenderer } from 'electron';
import type { JournalApi } from '../shared/ipc';

const journalApi: JournalApi = {
  app: {
    version: () => ipcRenderer.invoke('app:version') as Promise<string>
  },
  tasks: {
    listByDate: (date) => ipcRenderer.invoke('tasks:listByDate', date),
    listByRange: (startDate, endDate) => ipcRenderer.invoke('tasks:listByRange', { startDate, endDate }),
    create: (input) => ipcRenderer.invoke('tasks:create', input),
    update: (id, patch) => ipcRenderer.invoke('tasks:update', id, patch),
    complete: (id) => ipcRenderer.invoke('tasks:complete', id),
    restore: (id) => ipcRenderer.invoke('tasks:restore', id),
    setManualStruck: (id, struck) => ipcRenderer.invoke('tasks:setManualStruck', id, struck),
    remove: (id) => ipcRenderer.invoke('tasks:remove', id)
  },
  reviews: {
    get: (date) => ipcRenderer.invoke('reviews:get', date),
    listByRange: (startDate, endDate) => ipcRenderer.invoke('reviews:listByRange', { startDate, endDate }),
    save: (date, input) => ipcRenderer.invoke('reviews:save', date, input)
  },
  statistics: {
    forDate: (date) => ipcRenderer.invoke('statistics:forDate', date)
  },
  focus: {
    current: () => ipcRenderer.invoke('focus:current'),
    start: (taskId) => ipcRenderer.invoke('focus:start', taskId),
    pause: (id) => ipcRenderer.invoke('focus:pause', id),
    resume: (id) => ipcRenderer.invoke('focus:resume', id),
    finish: (id) => ipcRenderer.invoke('focus:finish', id)
  },
  settings: {
    get: <T>(key: string, fallback: T) => ipcRenderer.invoke('settings:get', key, fallback) as Promise<T>,
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    setLoginOpen: (open) => ipcRenderer.invoke('app:setLoginOpen', open)
  },
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    restore: () => ipcRenderer.invoke('backup:restore')
  },
  reports: {
    exportText: (suggestedName, text) => ipcRenderer.invoke('reports:exportText', { suggestedName, text })
  },
  window: {
    getDesktopState: () => ipcRenderer.invoke('window:getDesktopState'),
    enterDesktopMode: () => ipcRenderer.invoke('window:enterDesktopMode'),
    exitDesktopMode: () => ipcRenderer.invoke('window:exitDesktopMode'),
    setDesktopOpacity: (opacity) => ipcRenderer.invoke('window:setDesktopOpacity', opacity)
  }
};

contextBridge.exposeInMainWorld('journalApi', journalApi);
