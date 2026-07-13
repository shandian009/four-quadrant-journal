import type { JournalApi } from '../shared/ipc';

declare global {
  interface Window {
    journalApi: JournalApi;
  }
}

export {};
