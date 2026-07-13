import type { BrowserWindowConstructorOptions } from 'electron';
import path from 'node:path';

interface RendererWindow {
  loadURL(url: string): Promise<unknown> | void;
  loadFile(filePath: string): Promise<unknown> | void;
}

export function createWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    backgroundColor: '#F4F7FA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
}

export async function loadRenderer(window: RendererWindow, appPath: string, developmentUrl?: string): Promise<void> {
  if (developmentUrl) {
    await window.loadURL(developmentUrl);
  } else {
    await window.loadFile(path.join(appPath, 'dist', 'renderer', 'index.html'));
  }
}
