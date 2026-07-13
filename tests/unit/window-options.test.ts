import { describe, expect, it } from 'vitest';
import { createWindowOptions } from '../../src/main/window';

describe('desktop window security', () => {
  it('isolates and sandboxes the renderer', () => {
    const options = createWindowOptions();

    expect(options).toMatchObject({
      width: 1440,
      height: 900,
      minWidth: 1280,
      minHeight: 720,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    expect(options.webPreferences?.preload).toMatch(/preload\.cjs$/);
  });
});
