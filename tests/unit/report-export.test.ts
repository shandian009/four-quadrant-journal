import { describe, expect, it, vi } from 'vitest';
import { registerReportIpc } from '../../src/main/ipc-handlers';

describe('report TXT export IPC', () => {
  it('validates exact report filenames and text length before opening the dialog', async () => {
    let handler: (...args: unknown[]) => unknown = () => undefined;
    const showSaveDialog = vi.fn();
    registerReportIpc({ handle: (_channel, registered) => { handler = registered as typeof handler; } }, { showSaveDialog }, vi.fn());

    await expect(handler({}, { suggestedName: '../evil.txt', text: '内容' })).rejects.toThrow();
    await expect(handler({}, { suggestedName: '四象日志-周报-2026-07-06.txt', text: '文'.repeat(30_001) })).rejects.toThrow();
    expect(showSaveDialog).not.toHaveBeenCalled();
  });

  it('returns null on cancellation without writing and writes accepted text as UTF-8', async () => {
    let handler: (...args: unknown[]) => unknown = () => undefined;
    const showSaveDialog = vi.fn().mockResolvedValueOnce({ canceled: true }).mockResolvedValueOnce({ canceled: false, filePath: '/tmp/report.txt' });
    const writeText = vi.fn().mockResolvedValue(undefined);
    registerReportIpc({ handle: (_channel, registered) => { handler = registered as typeof handler; } }, { showSaveDialog }, writeText);

    const input = { suggestedName: '四象日志-月报-2026-07.txt', text: '真实报告内容' };
    await expect(handler({}, input)).resolves.toBeNull();
    expect(writeText).not.toHaveBeenCalled();
    await expect(handler({}, input)).resolves.toBe('/tmp/report.txt');
    expect(writeText).toHaveBeenCalledWith('/tmp/report.txt', input.text, 'utf8');
    expect(showSaveDialog).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: input.suggestedName }));
  });
});
