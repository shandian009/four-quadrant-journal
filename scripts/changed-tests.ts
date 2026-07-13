import { execFileSync } from 'node:child_process';

type GitRunner = (file: string, args: readonly string[]) => string;

const runGit: GitRunner = (file, args) => execFileSync(file, [...args], { encoding: 'utf8' });

const fullPatterns = [
  /^src\/shared\//,
  /^src\/main\/migrations\.ts$/,
  /^(package|package-lock)\.json$/,
  /^(vite|vitest|tsup|playwright)\.config\.ts$/
];

const groups: Array<[RegExp, string[]]> = [
  [/renderer\/features\/calendar|TaskWorkspace/, [
    'tests/integration/month-calendar.test.tsx',
    'tests/integration/task-workspace.test.tsx',
    'tests/integration/task-repository.test.ts'
  ]],
  [/renderer\/features\/tasks|repositories\/tasks/, [
    'tests/integration/quadrant-board.test.tsx',
    'tests/integration/quadrant-page.test.tsx',
    'tests/integration/task-repository.test.ts'
  ]],
  [/renderer\/features\/reports|report-generator/, [
    'tests/unit/report-generator.test.ts',
    'tests/integration/report-dialog.test.tsx',
    'tests/integration/review-repository.test.ts'
  ]],
  [/window-control|desktop-host|electron-tray|preload/, [
    'tests/unit/window-control.test.ts',
    'tests/unit/tray-menu.test.ts',
    'tests/unit/window-options.test.ts'
  ]],
  [/renderer\/theme|WorkbenchToolbar/, [
    'tests/unit/theme-cycle.test.ts',
    'tests/integration/workbench-toolbar.test.tsx',
    'tests/integration/theme-layout.test.tsx'
  ]]
];

export function selectTests(changedFiles: string[]) {
  if (changedFiles.some((file) => fullPatterns.some((pattern) => pattern.test(file)))) {
    return { full: true, tests: [] };
  }
  const tests = groups.flatMap(([pattern, files]) =>
    changedFiles.some((file) => pattern.test(file)) ? files : []
  );
  return { full: false, tests: [...new Set(tests)].sort() };
}

export function changedFilesSince(base: string | undefined, git: GitRunner = runGit): string[] | null {
  if (!base || /^0+$/.test(base)) return null;
  try {
    git('git', ['cat-file', '-e', `${base}^{commit}`]);
    return git('git', ['diff', '--name-only', base, 'HEAD'])
      .trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return null;
  }
}

if (process.argv[1]?.endsWith('changed-tests.ts')) {
  const changed = changedFilesSince(process.env.CHANGED_BASE);
  const selected = changed === null ? { full: true, tests: [] } : selectTests(changed);
  if (selected.full || selected.tests.length === 0) {
    execFileSync('npm', ['run', 'verify:source'], { stdio: 'inherit' });
  } else {
    execFileSync('npm', ['run', 'typecheck'], { stdio: 'inherit' });
    execFileSync('npm', ['test', '--', ...selected.tests], { stdio: 'inherit' });
    execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
  }
}
