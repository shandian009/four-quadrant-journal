import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop package configuration', () => {
  it('points Electron at the CommonJS main-process bundle emitted by tsup', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { main?: string };
    expect(packageJson.main).toBe('dist-electron/main.cjs');
  });

  it('packages the native helper outside asar without a download hook', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      build: { files: string[]; asarUnpack: string[] };
      scripts: Record<string, string>;
    };
    expect(packageJson.build.files).toContain('build/desktop-host.exe');
    expect(packageJson.build.asarUnpack).toContain('build/desktop-host.exe');
    expect(JSON.stringify(packageJson)).not.toMatch(/https?:\/\/.*desktop-host/i);
  });

  it('keeps the native helper limited to fixed user32 calls and numeric arguments', () => {
    const source = readFileSync('native/desktop-host/Program.cs', 'utf8');
    expect(source).toMatch(/args\[0\] != "inspect".*args\[0\] != "attach".*args\[0\] != "detach".*args\[0\] != "status"/s);
    expect(source).toMatch(/long\.TryParse\(value/);
    expect(source).toMatch(/NumberStyles\.None/);
    expect(source).toMatch(/CultureInfo\.InvariantCulture/);
    expect(source).toMatch(/originalStyle/);
    expect(source.match(/DllImport\("user32\.dll"/g)).toHaveLength(9);
    expect(source).not.toMatch(/HttpClient|WebClient|Process\.Start|File\.|Directory\.|cmd\.exe|powershell|\/bin\/sh/i);
  });

  it('requires an inspect token and exact detach parent/style arguments', () => {
    const source = readFileSync('native/desktop-host/Program.cs', 'utf8');
    expect(source).toMatch(/"inspect" when args\.Length == 2 => Inspect\(hwnd\)/);
    expect(source).toMatch(/"detach" when args\.Length == 4 => Detach\(hwnd, args\[2\], args\[3\]\)/);
    expect(source).toMatch(/originalParent/);
    expect(source).toMatch(/originalStyle/);
  });

  it('checks Win32 errors and verifies final parent, style and frame update', () => {
    const source = readFileSync('native/desktop-host/Program.cs', 'utf8');
    expect(source).toMatch(/Marshal\.SetLastPInvokeError\(0\)/);
    expect(source).toMatch(/Marshal\.GetLastPInvokeError\(\)/);
    expect(source).toMatch(/GetParentChecked/);
    expect(source).toMatch(/GetStyleChecked/);
    expect(source).toMatch(/SetParentChecked/);
    expect(source).toMatch(/SetStyleChecked/);
    expect(source).toMatch(/SetWindowPosChecked/);
    expect(source).toMatch(/GetParentChecked\(hwnd\) != originalParent/);
    expect(source).toMatch(/GetStyleChecked\(hwnd\) != originalStyle/);
  });

  it('uses correct child styles, retries Explorer discovery and has a bottom-layer fallback', () => {
    const source = readFileSync('native/desktop-host/Program.cs', 'utf8');
    expect(source).toMatch(/WsChild/);
    expect(source).toMatch(/WsPopup/);
    expect(source).toMatch(/Thread\.Sleep/);
    expect(source).toMatch(/FindDesktopTarget/);
    expect(source).toMatch(/HwndBottom/);
    expect(source).toMatch(/placement = "compatible"/);
  });
});
