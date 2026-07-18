import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('uses native recovery-window focus without renderer IPC or navigation hooks', () => {
  const source = readFileSync('src/main/electron-desktop-recovery-control.ts', 'utf8');
  expect(source).toContain("window.on('focus'");
  expect(source).not.toContain("on('ipc-message'");
  expect(source).not.toContain("on('did-navigate-in-page'");
});
