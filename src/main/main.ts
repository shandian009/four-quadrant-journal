import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Notification, type Tray } from 'electron';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openDatabase } from './database';
import { registerFocusIpc, registerReportIpc, registerReviewIpc, registerTaskIpc } from './ipc-handlers';
import { TaskRepository } from './repositories/tasks';
import { DailyReviewRepository } from './repositories/reviews';
import { FocusRepository } from './repositories/focus';
import { FocusTimer } from './services/focus-timer';
import { ReminderRepository } from './repositories/reminders';
import { ReminderScheduler } from './services/reminder-scheduler';
import { createApplicationTray } from './electron-tray';
import { createWindowOptions, loadRenderer } from './window';
import { SettingsRepository } from './repositories/settings';
import { BackupService } from './services/backup-service';
import { installApplicationMenu } from './application-menu';
import { DesktopHostProcess, WindowController, registerWindowIpc, type WindowPort } from './window-control';
import { DesktopRecoveryControl } from './desktop-recovery-control';
import { ElectronRecoveryControlEnvironment } from './electron-desktop-recovery-control';
import {
  WindowActivationController,
  registerRecoveryShortcut,
  type RecoveryShortcutRegistration
} from './window-activation';

let mainWindow: BrowserWindow | null = null;
let applicationTray: Tray | null = null;
let windowController: WindowController | null = null;
let desktopRecoveryControl: DesktopRecoveryControl | null = null;
let windowActivationController: WindowActivationController | null = null;
let recoveryShortcut: RecoveryShortcutRegistration | null = null;
let quitting = false;

if (process.env.FOUR_QUADRANT_USER_DATA) {
  app.setPath('userData', process.env.FOUR_QUADRANT_USER_DATA);
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow(createWindowOptions());
  void loadRenderer(window, app.getAppPath(), process.env.VITE_DEV_SERVER_URL);
  window.once('ready-to-show', () => window.show());
  window.on('close', (event) => {
    if (quitting || process.env.E2E_EXIT_ON_CLOSE === '1') return;
    event.preventDefault();
    window.hide();
  });
  return window;
}

const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (windowActivationController) runWindowActivation(() => windowActivationController!.restoreAndShow());
    else if (windowController) void windowController.restoreVisibleWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });

  app.whenReady().then(() => {
    installApplicationMenu();
    ipcMain.handle('app:version', () => app.getVersion());
    const databasePath = path.join(app.getPath('userData'), 'journal.db');
    const database = openDatabase(databasePath);
    const taskRepository = new TaskRepository(database);
    const focusRepository = new FocusRepository(database);
    const reminderRepository = new ReminderRepository(database);
    const settingsRepository = new SettingsRepository(database);
    const backupService = new BackupService(databasePath, database);
    registerTaskIpc(ipcMain, taskRepository, reminderRepository);
    registerReviewIpc(ipcMain, taskRepository, new DailyReviewRepository(database), focusRepository);
    registerFocusIpc(ipcMain, new FocusTimer(focusRepository));
    registerReportIpc(ipcMain, dialog, writeFile);
    ipcMain.handle('settings:get', (_event, key: string, fallback: unknown) => settingsRepository.get(key, fallback));
    ipcMain.handle('settings:set', (_event, key: string, value: unknown) => settingsRepository.set(key, value));
    ipcMain.handle('app:setLoginOpen', (_event, open: boolean) => app.setLoginItemSettings({ openAtLogin: open }));
    ipcMain.handle('backup:export', async () => {
      const selection = await dialog.showSaveDialog({
        title: '导出四象日志备份',
        defaultPath: `四象日志-${new Date().toISOString().slice(0, 10)}.fqjbackup`,
        filters: [{ name: '四象日志备份', extensions: ['fqjbackup'] }]
      });
      if (selection.canceled || !selection.filePath) return null;
      await backupService.export(selection.filePath);
      return selection.filePath;
    });
    ipcMain.handle('backup:restore', async () => {
      const selection = await dialog.showOpenDialog({
        title: '选择四象日志备份',
        properties: ['openFile'],
        filters: [{ name: '四象日志备份', extensions: ['fqjbackup'] }]
      });
      if (selection.canceled || !selection.filePaths[0]) return false;
      const confirmation = await dialog.showMessageBox({
        type: 'warning',
        title: '恢复本地数据',
        message: '恢复会替换当前数据，系统将先自动创建快照。是否继续？',
        buttons: ['取消', '继续恢复'],
        defaultId: 0,
        cancelId: 0
      });
      if (confirmation.response !== 1) return false;
      await backupService.restore(selection.filePaths[0]);
      quitting = true;
      app.relaunch();
      app.exit(0);
      return true;
    });
    mainWindow = createMainWindow();
    const controlledWindow = mainWindow;
    const windowPort: WindowPort = {
      getBounds: () => controlledWindow.getBounds(),
      getNormalBounds: () => controlledWindow.getNormalBounds(),
      setBounds: (bounds) => controlledWindow.setBounds(bounds),
      isMaximized: () => controlledWindow.isMaximized(),
      maximize: () => controlledWindow.maximize(),
      unmaximize: () => controlledWindow.unmaximize(),
      setSkipTaskbar: (skip) => controlledWindow.setSkipTaskbar(skip),
      setMenuBarVisibility: (visible) => controlledWindow.setMenuBarVisibility(visible),
      setOpacity: (opacity) => controlledWindow.setOpacity(opacity),
      show: () => controlledWindow.show(),
      focus: () => controlledWindow.focus(),
      getNativeWindowHandle: () => {
        const handle = controlledWindow.getNativeWindowHandle();
        return handle.length >= 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE());
      }
    };
    const helperPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'desktop-host.exe')
      : path.join(app.getAppPath(), 'build', 'desktop-host.exe');
    desktopRecoveryControl = new DesktopRecoveryControl(
      new ElectronRecoveryControlEnvironment(),
      () => controlledWindow.getBounds(),
      async () => {
        if (windowActivationController) await windowActivationController.restoreAndShow();
        else await windowController?.restoreVisibleWindow();
      }
    );
    windowController = new WindowController(
      windowPort,
      settingsRepository,
      new DesktopHostProcess(helperPath),
      {
        entered: async () => {
          await desktopRecoveryControl?.show();
          if (!controlledWindow.webContents.isDestroyed()) {
            controlledWindow.webContents.send('window:desktopStateChanged', windowController?.getState());
          }
        },
        exited: () => {
          desktopRecoveryControl?.close();
          if (!controlledWindow.webContents.isDestroyed()) {
            controlledWindow.webContents.send('window:desktopStateChanged', windowController?.getState());
          }
        }
      }
    );
    windowActivationController = new WindowActivationController(windowController, {
      show: () => controlledWindow.show(),
      focus: () => controlledWindow.focus()
    });
    recoveryShortcut = registerRecoveryShortcut(
      globalShortcut,
      () => windowActivationController!.restoreAndShow()
    );
    if (!recoveryShortcut.registered) console.warn('Ctrl+Alt+J 已被其他程序占用，托盘和恢复控制条仍可使用');
    app.on('before-quit', () => {
      desktopRecoveryControl?.close();
      recoveryShortcut?.dispose();
    });
    registerWindowIpc(ipcMain, windowController);
    let scheduler: ReminderScheduler;
    scheduler = new ReminderScheduler(reminderRepository, {
      show: (reminder) => {
        const notification = new Notification({
          title: '四象日志',
          body: reminder.taskTitle,
          actions: [{ type: 'button', text: '稍后 10 分钟' }],
          closeButtonText: '关闭'
        });
        notification.on('click', () => {
          if (windowActivationController) runWindowActivation(() => windowActivationController!.restoreAndShow());
        });
        notification.on('action', (_event, index) => { if (index === 0) void scheduler.snooze(reminder.id, 10); });
        notification.show();
      }
    });
    void scheduler.start();
    applicationTray = createApplicationTray({
      show: () => {
        if (windowActivationController) runWindowActivation(() => windowActivationController!.restoreAndShow());
      },
      quickAdd: () => {
        if (windowActivationController) {
          runWindowActivation(() => windowActivationController!.restoreAndShow(
            () => mainWindow?.webContents.send('ui:quickAdd')
          ));
        }
      },
      setRemindersPaused: (paused) => scheduler.setPaused(paused),
      restoreWindow: () => {
        if (windowActivationController) runWindowActivation(() => windowActivationController!.restoreAndShow());
      },
      quit: () => { quitting = true; app.quit(); }
    });
  });
}

function runWindowActivation(operation: () => Promise<void>): void {
  void operation().catch((error: unknown) => {
    console.error('恢复主窗口失败', error);
    dialog.showErrorBox('无法恢复主窗口', error instanceof Error ? error.message : '请从托盘重试');
  });
}
