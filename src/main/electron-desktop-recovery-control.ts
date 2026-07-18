import { BrowserWindow, screen, type BrowserWindowConstructorOptions } from 'electron';
import type {
  RecoveryControlEnvironment,
  RecoveryControlWindowPort
} from './desktop-recovery-control';
import { isRecoveryControlUrl } from './desktop-recovery-control';
import type { WindowBounds } from './window-control';

const RECOVERY_URL = 'fqj-recovery://restore';
const CONTROL_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>四象日志桌面恢复</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body {
      color: #eef6ff;
      background: linear-gradient(135deg, #101b2e 0%, #153c4a 100%);
      border: 1px solid rgba(105, 218, 222, .52);
      border-radius: 14px;
      font-family: "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
      user-select: none;
    }
    main { height: 100%; display: flex; align-items: center; gap: 14px; padding: 14px 16px; }
    .status { min-width: 0; flex: 1; }
    .title { font-size: 15px; font-weight: 700; letter-spacing: .02em; }
    .hint { margin-top: 5px; color: #a8bdce; font-size: 12px; white-space: nowrap; }
    a {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 42px;
      min-width: 112px;
      padding: 0 16px;
      color: #06242c;
      background: linear-gradient(135deg, #77e3dc, #58bde8);
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      box-shadow: 0 8px 20px rgba(38, 181, 205, .24);
    }
    a[aria-disabled="true"] { opacity: .62; pointer-events: none; }
  </style>
</head>
<body>
  <main>
    <div class="status">
      <div class="title">四象日志已嵌入桌面</div>
      <div class="hint">需要设置或编辑时，请先恢复窗口</div>
    </div>
    <a id="restore" href="${RECOVERY_URL}">恢复并编辑</a>
  </main>
</body>
</html>`;

export function createRecoveryControlWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 340,
    height: 88,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
}

class ElectronRecoveryControlWindow implements RecoveryControlWindowPort {
  private restoreHandler: (() => Promise<void>) | null = null;
  private restoring = false;

  constructor(private readonly window: BrowserWindow) {
    window.setAlwaysOnTop(true, 'floating');
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, url) => {
      if (!isRecoveryControlUrl(url)) return;
      event.preventDefault();
      void this.triggerRestore().catch((error: unknown) => {
        console.error('桌面模式恢复失败', error);
      });
    });
  }

  load(): Promise<void> {
    return this.window.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(CONTROL_HTML)}`);
  }

  showInactive(): void {
    this.window.showInactive();
  }

  setPosition(x: number, y: number): void {
    this.window.setPosition(x, y, false);
  }

  close(): void {
    this.window.close();
  }

  isDestroyed(): boolean {
    return this.window.isDestroyed();
  }

  onRestore(handler: () => Promise<void>): void {
    this.restoreHandler = handler;
  }

  onClosed(handler: () => void): void {
    this.window.on('closed', handler);
  }

  private async triggerRestore(): Promise<void> {
    if (this.restoring || !this.restoreHandler) return;
    this.restoring = true;
    await this.setButtonState(true);
    try {
      await this.restoreHandler();
    } finally {
      this.restoring = false;
      await this.setButtonState(false);
    }
  }

  private async setButtonState(restoring: boolean): Promise<void> {
    if (this.window.isDestroyed()) return;
    const label = restoring ? '正在恢复…' : '恢复并编辑';
    await this.window.webContents.executeJavaScript(
      `(() => { const button = document.getElementById('restore'); if (button) { button.textContent = ${JSON.stringify(label)}; button.setAttribute('aria-disabled', ${JSON.stringify(String(restoring))}); } })()`
    );
  }
}

export class ElectronRecoveryControlEnvironment implements RecoveryControlEnvironment {
  createWindow(): RecoveryControlWindowPort {
    return new ElectronRecoveryControlWindow(new BrowserWindow(createRecoveryControlWindowOptions()));
  }

  getWorkArea(anchor: WindowBounds): WindowBounds {
    return screen.getDisplayMatching(anchor).workArea;
  }

  subscribeDisplayChanges(handler: () => void): () => void {
    screen.on('display-metrics-changed', handler);
    return () => screen.removeListener('display-metrics-changed', handler);
  }
}
