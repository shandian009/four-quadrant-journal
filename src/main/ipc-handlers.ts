import type { IpcMain } from 'electron';
import { z } from 'zod';
import type { TaskRepository } from './repositories/tasks';
import type { DailyReviewRepository } from './repositories/reviews';
import { calculateStatistics } from './services/statistics';
import type { FocusRepository } from './repositories/focus';
import type { FocusTimer } from './services/focus-timer';
import type { ReminderRepository } from './repositories/reminders';
import { createTaskSchema, dateSchema, idSchema, rangeSchema, updateTaskSchema } from './ipc-validation';

const reportExportSchema = z.object({
  suggestedName: z.string().regex(/^四象日志-(周报|月报)-[0-9-]+\.txt$/),
  text: z.string().max(30_000)
}).strict();

interface ReportSaveDialog {
  showSaveDialog(options: {
    title: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ canceled: boolean; filePath?: string }>;
}

export function registerReportIpc(
  ipcMain: Pick<IpcMain, 'handle'>,
  dialog: ReportSaveDialog,
  writeText: (path: string, text: string, encoding: 'utf8') => Promise<void>
): void {
  ipcMain.handle('reports:exportText', async (_event, input: unknown) => {
    const { suggestedName, text } = reportExportSchema.parse(input);
    const selection = await dialog.showSaveDialog({
      title: '导出本地报告',
      defaultPath: suggestedName,
      filters: [{ name: '文本文件', extensions: ['txt'] }]
    });
    if (selection.canceled || !selection.filePath) return null;
    await writeText(selection.filePath, text, 'utf8');
    return selection.filePath;
  });
}

export function registerTaskIpc(
  ipcMain: Pick<IpcMain, 'handle'>,
  tasks: TaskRepository,
  reminders?: ReminderRepository
): void {
  ipcMain.handle('tasks:listByDate', (_event, date: unknown) => {
    return tasks.findByDate(dateSchema.parse(date));
  });
  ipcMain.handle('tasks:listByRange', (_event, input: unknown) => {
    const { startDate, endDate } = rangeSchema.parse(input);
    return tasks.findByRange(startDate, endDate);
  });
  ipcMain.handle('tasks:create', (_event, input: unknown) => {
    const task = tasks.create(createTaskSchema.parse(input));
    reminders?.upsertForTask(task);
    return task;
  });
  ipcMain.handle('tasks:update', (_event, id: unknown, patch: unknown) => {
    const task = tasks.update(idSchema.parse(id), updateTaskSchema.parse(patch));
    reminders?.upsertForTask(task);
    return task;
  });
  ipcMain.handle('tasks:complete', (_event, id: unknown) => tasks.complete(idSchema.parse(id)));
  ipcMain.handle('tasks:restore', (_event, id: unknown) => tasks.restore(idSchema.parse(id)));
  ipcMain.handle('tasks:setManualStruck', (_event, id: unknown, struck: unknown) => (
    tasks.setManualStruck(idSchema.parse(id), z.boolean().parse(struck))
  ));
  ipcMain.handle('tasks:remove', (_event, id: unknown) => tasks.softDelete(idSchema.parse(id)));
}

export function registerReviewIpc(
  ipcMain: Pick<IpcMain, 'handle'>,
  tasks: TaskRepository,
  reviews: DailyReviewRepository,
  focus: FocusRepository
): void {
  ipcMain.handle('reviews:get', (_event, date: unknown) => reviews.findByDate(dateSchema.parse(date)));
  ipcMain.handle('reviews:listByRange', (_event, input: unknown) => {
    const { startDate, endDate } = rangeSchema.parse(input);
    return reviews.findByRange(startDate, endDate);
  });
  ipcMain.handle('reviews:save', (_event, date: unknown, input: unknown) => {
    const parsed = zReview.parse(input);
    return reviews.save(dateSchema.parse(date), parsed);
  });
  ipcMain.handle('statistics:forDate', (_event, date: unknown) => {
    const parsedDate = dateSchema.parse(date);
    return calculateStatistics(tasks.findByDate(parsedDate), [focus.totalForDate(parsedDate)]);
  });
}

export function registerFocusIpc(ipcMain: Pick<IpcMain, 'handle'>, timer: FocusTimer): void {
  ipcMain.handle('focus:current', () => timer.current());
  ipcMain.handle('focus:start', (_event, taskId: string | null) => timer.start(taskId));
  ipcMain.handle('focus:pause', (_event, id: string) => timer.pause(id));
  ipcMain.handle('focus:resume', (_event, id: string) => timer.resume(id));
  ipcMain.handle('focus:finish', (_event, id: string) => timer.finish(id));
}

const zReview = createReviewSchema();

function createReviewSchema() {
  const text = z.string().max(5000);
  return z.object({ wins: text, improvements: text, tomorrowFocus: text });
}
