import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('GitHub workflow configuration', () => {
  it('runs direct-source changed verification for pull requests and main pushes', () => {
    const workflow = read('.github/workflows/quick-verify.yml');

    expect(workflow).toMatch(/pull_request:/);
    expect(workflow).toMatch(/push:\s*\n\s+branches:\s*\[main\]/);
    expect(workflow).toMatch(/uses:\s*actions\/checkout@v4/);
    expect(workflow).toMatch(/fetch-depth:\s*0/);
    expect(workflow).toContain("github.event.pull_request.base.sha");
    expect(workflow).toContain("github.event.before");
    expect(workflow).toMatch(/CHANGED_BASE:\s*\$\{\{/);
    expect(workflow).not.toMatch(/HEAD~1/);
    expect(workflow.match(/npm run verify:changed/g)).toHaveLength(1);
    expect(workflow).not.toMatch(/electron-builder|Expand-Archive|source\.zip|npm run verify(?:\s|$)/m);
  });

  it('limits the Windows release to manual dispatch, tags and explicit release branches', () => {
    const workflow = read('.github/workflows/release-windows.yml');

    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).toMatch(/push:\s*\n\s+tags:\s*\['v\*'\]/);
    expect(workflow).toMatch(/pull_request:\s*\n\s+branches:\s*\[main\]/);
    expect(workflow).toContain("startsWith(github.head_ref, 'release/')");
  });

  it('orders install, helper compile, one full gate, portable build and three Windows E2E gates before upload', () => {
    const workflow = read('.github/workflows/release-windows.yml');
    const orderedMarkers = [
      'npm ci',
      'npm run build:desktop-host:win',
      'npm run verify',
      'electron-builder --win portable --x64',
      'name: Run unpacked E2E',
      'name: Verify portable single-file launch',
      'name: Run desktop-mode E2E',
      'actions/upload-artifact@v4'
    ];
    const positions = orderedMarkers.map((marker) => workflow.indexOf(marker));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(workflow.match(/npm run verify(?!:)/g)).toHaveLength(1);
    expect(workflow.match(/tests\/e2e\/packaged-smoke\.spec\.ts/g)).toHaveLength(1);
    expect(workflow).toMatch(/scripts\/verify-portable-launch\.ps1/);
    expect(existsSync('scripts/verify-portable-launch.ps1')).toBe(true);
    expect(read('scripts/verify-portable-launch.ps1')).not.toMatch(/[“”]/);
    expect(workflow.match(/tests\/e2e\/desktop-mode\.spec\.ts/g)).toHaveLength(1);
    expect(workflow).toMatch(/Start-Process[^\n]*explorer\.exe/i);
    expect(workflow).toMatch(/Get-Process[^\n]*explorer/i);
    expect(existsSync('tests/e2e/desktop-mode.spec.ts')).toBe(true);
    expect(workflow).not.toMatch(/E2E_DESKTOP_STATE/);
  });

  it('desktop-mode E2E observes the real packaged window and helper without a preload test API', () => {
    const e2e = read('tests/e2e/desktop-mode.spec.ts');
    const preload = read('src/main/preload.ts');

    expect(e2e).toMatch(/existsSync\(executablePath\)/);
    expect(e2e).toMatch(/getByRole\('button', \{ name: '嵌入桌面' \}\)\.click\(\)/);
    expect(e2e).toMatch(/application\.evaluate/);
    expect(e2e).toMatch(/BrowserWindow\.getAllWindows/);
    expect(e2e).toMatch(/getNativeWindowHandle/);
    expect(e2e).toMatch(/getOpacity/);
    expect(e2e).toMatch(/desktop-host\.exe/);
    expect(e2e).toMatch(/['"]status['"]/);
    expect(e2e).toContain("getByText('桌面兼容模式')");
    expect(e2e).toContain('0x40000000n');
    expect(e2e).toContain('compatibility window remains top-level');
    expect(e2e).not.toMatch(/test\.skip\(true/);
    expect(e2e).toContain("['0.4', '0.85', '1']");
    expect(e2e).toMatch(/parent\)\.not\.toBe\('0'\)/);
    expect(e2e).toMatch(/parent\)\.toBe\('0'\)/);
    expect(e2e).toContain('initialHostState.style');
    expect(preload).not.toMatch(/E2E_DESKTOP_STATE|testOnly|desktopStatus/i);
  });

  it('publishes a self-contained single-file win-x64 helper named desktop-host and copies it for packaging', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
      build: { files: string[]; asarUnpack: string[] };
    };
    const command = packageJson.scripts['build:desktop-host:win'];

    expect(command).toMatch(/dotnet publish/);
    expect(command).toMatch(/-r win-x64/);
    expect(command).toMatch(/--self-contained true/);
    expect(command).toMatch(/PublishSingleFile=true/);
    expect(command).toMatch(/AssemblyName=desktop-host/);
    expect(command).toMatch(/build[\\/]desktop-host\.exe/);
    expect(packageJson.build.files).toContain('build/desktop-host.exe');
    expect(packageJson.build.asarUnpack).toContain('build/desktop-host.exe');
  });

  it('retires duplicate Windows workflows and ignores generated release bundles', () => {
    const gitignore = read('.gitignore');

    expect(existsSync('.github/workflows/windows-build.yml')).toBe(false);
    expect(existsSync('.github/workflows/build-portable.yml')).toBe(false);
    expect(gitignore).toMatch(/^build\/desktop-host\.exe$/m);
    expect(gitignore).toMatch(/^FourQuadrantJournal-\*-source\.zip$/m);
    expect(gitignore).toMatch(/^FourQuadrantJournal-\*-portable\.zip$/m);
    expect(gitignore).toMatch(/^FourQuadrantJournal-\*-artifact\.zip$/m);
    expect(gitignore).toMatch(/^FourQuadrantJournal-\*-green-folder\.zip$/m);
    expect(gitignore).toMatch(/^FourQuadrantJournal-\*-win-x64\.exe$/m);
  });

  it('builds a versioned top-level green folder with UTF-8 Chinese instructions before upload', () => {
    const workflow = read('.github/workflows/release-windows.yml');

    expect(workflow).toMatch(/FourQuadrantJournal-\$version-green/);
    expect(workflow).toMatch(/Copy-Item[^\n]*win-unpacked[^\n]*\$greenFolder/s);
    expect(workflow).toContain('使用说明.txt');
    expect(workflow).toMatch(/Set-Content[^\n]*-Encoding utf8/i);
    expect(workflow).toMatch(/完整解压/);
    expect(workflow).toMatch(/不要单独移动|不要只移动/);
    expect(workflow).toMatch(/桌面模式/);
    expect(workflow).toMatch(/托盘/);
    expect(workflow).toMatch(/Compress-Archive[^\n]*\$greenFolder/);
    expect(workflow).toMatch(/release\/FourQuadrantJournal-\*-green-folder\.zip/);
  });

  it('uploads the verified green ZIP separately instead of a 500 MB mixed bundle', () => {
    const workflow = read('.github/workflows/release-windows.yml');
    const upload = workflow.slice(workflow.indexOf('name: Upload verified Windows artifacts'));

    expect(upload).toContain('name: four-quadrant-journal-green');
    expect(upload).toContain('release/FourQuadrantJournal-*-green-folder.zip');
    expect(upload).not.toContain('release/win-unpacked');
    expect(upload).not.toContain('release/FourQuadrantJournal-*-win-x64.exe');
  });
});
