import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { loadRenderer } from '../../src/main/window';

describe('renderer loading', () => {
  it('uses the development URL when present', async () => {
    const window = { loadURL: vi.fn(), loadFile: vi.fn() };
    await loadRenderer(window, '/app', 'http://localhost:5173');
    expect(window.loadURL).toHaveBeenCalledWith('http://localhost:5173');
    expect(window.loadFile).not.toHaveBeenCalled();
  });

  it('loads the packaged renderer from disk', async () => {
    const window = { loadURL: vi.fn(), loadFile: vi.fn() };
    await loadRenderer(window, '/app');
    expect(window.loadFile).toHaveBeenCalledWith(path.join('/app', 'dist', 'renderer', 'index.html'));
  });
});
