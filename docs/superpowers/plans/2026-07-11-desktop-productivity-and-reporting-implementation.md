# Desktop Productivity and Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver version 0.3.0 with fast theme cycling, a recoverable Windows desktop-widget mode, desktop-only opacity, month navigation, color-coded and numbered quadrant tasks, independent completion/manual strike-through, and offline weekly/monthly reports while converting the repository to direct source tracking and incremental verification.

**Architecture:** Preserve the current Electron preload boundary and split new behavior into isolated renderer features, repository range queries, pure reporting functions, and a main-process window state machine. A minimal bundled C# helper owns only the Win32 `WorkerW` attach/detach calls. Development uses changed-file test selection; the full source and Windows packaging gates run once at the release checkpoint.

**Tech Stack:** Electron 43, React 19, TypeScript 5.9, SQLite/better-sqlite3, Zod, Vitest, Testing Library, Playwright, C# Win32 P/Invoke, GitHub Actions.

## Global Constraints

- Preserve the existing main layout, sidebar, six weekday themes, reminders, focus, reviews, statistics, backup, tray, startup, single-instance behavior, and Chinese application menu.
- Keep all business data local by default; version 0.3.0 must not add an AI SDK, API key storage, telemetry, or a report network call.
- Migrate existing 0.2.0 databases without data loss.
- Desktop opacity applies only in desktop-widget mode and is clamped to `0.40..1.00`, default `0.85`.
- Completion and manual strike-through remain independent states.
- Weekly reports contain 180–240 Chinese characters; monthly reports contain 540–660 Chinese characters.
- Use focused tests during implementation. Run the complete `npm run verify` and Windows packaging/startup suite only at the final release task.
- Store normal source files directly in GitHub; do not ship new source ZIPs as repository inputs.

## File Map

- Create `scripts/changed-tests.ts`: deterministic changed-file to test-file mapping.
- Create `tests/unit/changed-tests.test.ts`: mapping coverage and full-verification escalation.
- Modify `src/shared/domain.ts`, `src/shared/ipc.ts`: manual strike, ranges, reports and window contracts.
- Modify `src/main/migrations.ts`: schema version 2 and `manual_struck` migration.
- Modify `src/main/repositories/tasks.ts`, `reviews.ts`: range queries and manual strike persistence.
- Modify `src/main/ipc-handlers.ts`, `preload.ts`, `main.ts`: validated IPC and service wiring.
- Modify `src/renderer/features/tasks/*`: numbering, semantic colors, completion restore and manual strike.
- Modify `src/renderer/features/calendar/MonthCalendar.tsx`, `TaskWorkspace.tsx`: display-month navigation and range loading.
- Create `src/renderer/features/toolbar/WorkbenchToolbar.tsx`: theme cycle, desktop mode and report actions.
- Create `src/renderer/features/reports/report-generator.ts`, `ReportDialog.tsx`: pure local generation and preview/export UI.
- Create `src/main/window-control.ts`: desktop-window state machine.
- Create `native/desktop-host/Program.cs`: minimal WorkerW helper.
- Modify `src/main/electron-tray.ts`, `tray.ts`: recovery action.
- Modify `src/renderer/styles/layout.css`: toolbar, quadrant, report and desktop styles.
- Replace repository workflows with direct-source quick verification and release-only Windows packaging.

---

### Task 1: Add Changed-File Verification Selection

**Files:**
- Create: `scripts/changed-tests.ts`
- Create: `tests/unit/changed-tests.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `selectTests(changedFiles: string[]): { full: boolean; tests: string[] }`.
- Produces `npm run verify:changed`, used after Tasks 2–8 and in Pull Requests.

- [ ] **Step 1: Write the failing mapping tests**

```ts
import { describe, expect, it } from 'vitest';
import { selectTests } from '../../scripts/changed-tests';

describe('changed test selection', () => {
  it('selects calendar and task range tests for calendar changes', () => {
    expect(selectTests(['src/renderer/features/calendar/MonthCalendar.tsx'])).toEqual({
      full: false,
      tests: [
        'tests/integration/month-calendar.test.tsx',
        'tests/integration/task-repository.test.ts',
        'tests/integration/task-workspace.test.tsx'
      ]
    });
  });

  it('escalates shared IPC and migrations to full verification', () => {
    expect(selectTests(['src/shared/ipc.ts']).full).toBe(true);
    expect(selectTests(['src/main/migrations.ts']).full).toBe(true);
  });

  it('deduplicates tests for overlapping feature changes', () => {
    const result = selectTests([
      'src/renderer/features/tasks/QuadrantBoard.tsx',
      'src/renderer/features/tasks/QuadrantPage.tsx'
    ]);
    expect(new Set(result.tests).size).toBe(result.tests.length);
  });
});
```

- [ ] **Step 2: Confirm RED**

Run: `npm test -- tests/unit/changed-tests.test.ts`  
Expected: FAIL because `scripts/changed-tests.ts` does not exist.

- [ ] **Step 3: Implement the selector and CLI**

```ts
import { execFileSync } from 'node:child_process';

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

if (process.argv[1]?.endsWith('changed-tests.ts')) {
  const base = process.env.CHANGED_BASE ?? 'HEAD~1';
  const changed = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean);
  const selected = selectTests(changed);
  if (selected.full || selected.tests.length === 0) {
    execFileSync('npm', ['run', 'verify:source'], { stdio: 'inherit' });
  } else {
    execFileSync('npm', ['run', 'typecheck'], { stdio: 'inherit' });
    execFileSync('npm', ['test', '--', ...selected.tests], { stdio: 'inherit' });
    execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
  }
}
```

- [ ] **Step 4: Add scripts without changing the final release gate**

```json
{
  "verify:source": "npm run typecheck && npm run test && npm run build && npm run verify:theme-parity && npm run verify:no-network",
  "verify:changed": "node --import tsx scripts/changed-tests.ts",
  "verify": "npm run verify:source"
}
```

- [ ] **Step 5: Confirm GREEN**

Run: `npm test -- tests/unit/changed-tests.test.ts`  
Expected: all selector tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/changed-tests.ts tests/unit/changed-tests.test.ts package.json
git commit -m "build: add incremental verification selector"
```

---

### Task 2: Migrate Manual Strike and Add Range APIs

**Files:**
- Modify: `src/shared/domain.ts`
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/migrations.ts`
- Modify: `src/main/repositories/tasks.ts`
- Modify: `src/main/repositories/reviews.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/preload.ts`
- Test: `tests/integration/database.test.ts`
- Test: `tests/integration/task-repository.test.ts`
- Test: `tests/integration/review-repository.test.ts`
- Test: `tests/unit/ipc-validation.test.ts`

**Interfaces:**
- Adds `Task.manualStruck: boolean`.
- Produces `TaskApi.listByRange`, `TaskApi.setManualStruck`, `ReviewApi.listByRange`.
- Preserves all current APIs.

- [ ] **Step 1: Write migration and repository failures first**

Add tests that create a version-1 schema, run `migrate`, and assert:

```ts
expect(db.prepare('SELECT version FROM schema_meta').pluck().get()).toBe(2);
expect(db.prepare("PRAGMA table_info(tasks)").all()).toEqual(
  expect.arrayContaining([expect.objectContaining({ name: 'manual_struck', dflt_value: '0' })])
);
```

Add repository assertions:

```ts
expect(repo.setManualStruck(task.id, true).manualStruck).toBe(true);
expect(repo.setManualStruck(task.id, false).manualStruck).toBe(false);
expect(repo.findByRange('2026-07-01', '2026-07-31').map((item) => item.id)).toContain(task.id);
```

- [ ] **Step 2: Confirm RED**

Run:

```bash
npm test -- tests/integration/database.test.ts tests/integration/task-repository.test.ts tests/integration/review-repository.test.ts
```

Expected: FAIL for missing version 2, range methods and manual strike.

- [ ] **Step 3: Implement a real sequential migration**

Set `VERSION = 2`. After creating the version-1 tables, use:

```ts
let current = db.prepare('SELECT version FROM schema_meta LIMIT 1').get() as { version: number } | undefined;
if (!current) {
  db.prepare('INSERT INTO schema_meta(version) VALUES (1)').run();
  current = { version: 1 };
}
if (current.version < 2) {
  db.exec(`ALTER TABLE tasks ADD COLUMN manual_struck INTEGER NOT NULL DEFAULT 0 CHECK (manual_struck IN (0, 1));`);
  db.prepare('UPDATE schema_meta SET version = 2').run();
}
```

Keep `manual_struck` out of the original version-1 `CREATE TABLE`. A fresh database is initialized at version 1 inside the same transaction and then follows the exact same version-2 `ALTER TABLE` path as an existing database. This guarantees the column is added exactly once in both cases.

- [ ] **Step 4: Map and persist the new field**

Add `manual_struck: number` to `TaskRow` and map it with:

```ts
manualStruck: row.manual_struck === 1
```

Add the update column and methods:

```ts
manualStruck: 'manual_struck'

setManualStruck(id: string, struck: boolean): Task {
  return this.update(id, { manualStruck: struck });
}

findByRange(startDate: string, endDate: string): Task[] {
  const rows = this.db.prepare(`
    SELECT * FROM tasks
    WHERE planned_date BETWEEN ? AND ? AND status != 'deleted'
    ORDER BY planned_date, status = 'completed', quadrant, sort_order, created_at
  `).all(startDate, endDate) as TaskRow[];
  return rows.map(toTask);
}
```

Before binding update values, convert this one boolean field explicitly:

```ts
const values = entries.map(([key, value]) => key === 'manualStruck' ? (value ? 1 : 0) : value);
```

Add the equivalent review method ordered by `review_date`.

- [ ] **Step 5: Validate inclusive ranges and IPC IDs**

Define one schema:

```ts
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, '日期格式无效');

const rangeSchema = z.object({ startDate: dateSchema, endDate: dateSchema })
  .refine(({ startDate, endDate }) => startDate <= endDate, '起始日期不能晚于结束日期');
```

Register `tasks:listByRange`, `tasks:setManualStruck`, and `reviews:listByRange`, then expose them through preload.

- [ ] **Step 6: Confirm GREEN using focused tests**

Run:

```bash
npm test -- tests/integration/database.test.ts tests/integration/task-repository.test.ts tests/integration/review-repository.test.ts tests/unit/ipc-validation.test.ts
```

Expected: version 1 upgrades once, fresh DB reports version 2, ranges are inclusive, invalid ranges are rejected.

- [ ] **Step 7: Commit**

```bash
git add src/shared src/main/migrations.ts src/main/repositories src/main/ipc-handlers.ts src/main/preload.ts tests
git commit -m "feat: persist manual strike and range queries"
```

---

### Task 3: Add Quadrant Colors, Independent Numbering and Two Strike States

**Files:**
- Modify: `src/renderer/features/tasks/QuadrantBoard.tsx`
- Modify: `src/renderer/features/tasks/QuadrantPage.tsx`
- Modify: `src/renderer/features/tasks/TaskWorkspace.tsx`
- Modify: `src/renderer/styles/layout.css`
- Test: `tests/integration/quadrant-board.test.tsx`
- Create: `tests/integration/quadrant-page.test.tsx`
- Modify: `tests/integration/task-flow.test.tsx`

**Interfaces:**
- `QuadrantBoard` consumes `onMove`, `onToggleComplete`, `onToggleManualStrike`.
- Class rules: `quadrant-task--completed`, `quadrant-task--manual-struck`, and `quadrant-task__number`.

- [ ] **Step 1: Write interaction tests**

Render two tasks in one quadrant and one in another. Assert independent numbering:

```tsx
expect(within(screen.getByRole('region', { name: '重要且紧急' })).getByText('1')).toBeVisible();
expect(within(screen.getByRole('region', { name: '重要且紧急' })).getByText('2')).toBeVisible();
expect(within(screen.getByRole('region', { name: '重要不紧急' })).getByText('1')).toBeVisible();
```

Click completion and manual strike separately and assert their callbacks receive the exact task and target boolean.

- [ ] **Step 2: Confirm RED**

Run: `npm test -- tests/integration/quadrant-board.test.tsx tests/integration/quadrant-page.test.tsx`  
Expected: FAIL because the controls and classes do not exist.

- [ ] **Step 3: Implement explicit board callbacks**

```tsx
export function QuadrantBoard({ tasks, onMove, onToggleComplete, onToggleManualStrike }: {
  tasks: Task[];
  onMove(id: string, quadrant: Quadrant): Promise<void>;
  onToggleComplete(task: Task): Promise<void>;
  onToggleManualStrike(task: Task): Promise<void>;
}) {
  return <div className="quadrant-board">{quadrants.map(([quadrant, label]) => {
    const visible = tasks.filter((task) => task.quadrant === quadrant && task.status !== 'deleted');
    return <section key={quadrant} aria-label={label} className={`quadrant quadrant--${quadrant}`}>
      <h3>{label}<small>{visible.length} 项</small></h3>
      {visible.map((task, index) => <article key={task.id} className={[
        'quadrant-task',
        task.status === 'completed' ? 'quadrant-task--completed' : '',
        task.manualStruck ? 'quadrant-task--manual-struck' : ''
      ].filter(Boolean).join(' ')}>
        <span className="quadrant-task__number">{index + 1}</span>
        <button type="button" className="checkbox" aria-pressed={task.status === 'completed'}
          aria-label={`${task.status === 'completed' ? '恢复' : '完成'}“${task.title}”`}
          onClick={() => void onToggleComplete(task)} />
        <strong>{task.title}</strong>
        <button type="button" aria-pressed={task.manualStruck}
          aria-label={`${task.manualStruck ? '取消划线' : '划线'}“${task.title}”`}
          onClick={() => void onToggleManualStrike(task)}>划线</button>
      </article>)}
    </section>;
  })}</div>;
}
```

Keep the existing move `<select>` in each article after the title.

- [ ] **Step 4: Wire optimistic-safe page updates**

Use the API result as the only state update:

```ts
async function toggleComplete(task: Task) {
  const updated = task.status === 'completed'
    ? await api.restore(task.id)
    : await api.complete(task.id);
  setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
}

async function toggleManualStrike(task: Task) {
  const updated = await api.setManualStruck(task.id, !task.manualStruck);
  setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
}
```

Apply the same complete/restore behavior to `TaskWorkspace`; never call `complete` on an already-completed item.

- [ ] **Step 5: Add semantic styles**

```css
.quadrant--urgent_important { --quadrant-color: #e45858; }
.quadrant--important { --quadrant-color: #3b7ddd; }
.quadrant--urgent { --quadrant-color: #e9903d; }
.quadrant--neither { --quadrant-color: #6f9285; }
.quadrant-task { border-inline-start: 3px solid var(--quadrant-color); }
.quadrant-task__number { background: var(--quadrant-color); color: #fff; }
.quadrant-task--completed { color: var(--text-muted); filter: saturate(.25); }
.quadrant-task--completed strong,
.quadrant-task--manual-struck strong { text-decoration: line-through; }
```

- [ ] **Step 6: Confirm GREEN**

Run:

```bash
npm test -- tests/integration/quadrant-board.test.tsx tests/integration/quadrant-page.test.tsx tests/integration/task-flow.test.tsx
```

Expected: numbering resets in every quadrant, completed items restore, and manual strike does not call completion.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/features/tasks src/renderer/styles/layout.css tests/integration
git commit -m "feat: distinguish and number quadrant tasks"
```

---

### Task 4: Add Month Navigation and Range Loading

**Files:**
- Modify: `src/renderer/features/calendar/MonthCalendar.tsx`
- Modify: `src/renderer/features/tasks/TaskWorkspace.tsx`
- Modify: `src/renderer/components/DashboardFrame.tsx`
- Create: `tests/integration/month-calendar.test.tsx`
- Create: `tests/integration/task-workspace.test.tsx`

**Interfaces:**
- `MonthCalendar` consumes `displayMonth: string` (`YYYY-MM`), `onDisplayMonthChange(month)` and `onToday()`.
- `TaskWorkspace` calls `listByRange` exactly once per displayed month.

- [ ] **Step 1: Write cross-year and query-count tests**

Assert November/December/January transitions, leap-year February, and:

```tsx
expect(api.listByRange).toHaveBeenCalledWith('2026-07-01', '2026-07-31');
expect(api.listByRange).toHaveBeenCalledTimes(1);
await user.click(screen.getByRole('button', { name: '下个月' }));
expect(api.listByRange).toHaveBeenLastCalledWith('2026-08-01', '2026-08-31');
```

- [ ] **Step 2: Confirm RED**

Run: `npm test -- tests/integration/month-calendar.test.tsx tests/integration/task-workspace.test.tsx`  
Expected: FAIL because navigation props and range loading are absent.

- [ ] **Step 3: Add pure month helpers**

Create inside `MonthCalendar.tsx` and export for tests:

```ts
export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split('-').map(Number);
  const shifted = new Date(year, value - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(month: string) {
  const [year, value] = month.split('-').map(Number);
  const end = new Date(year, value, 0).getDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(end).padStart(2, '0')}` };
}
```

- [ ] **Step 4: Render accessible navigation**

```tsx
<header className="panel__header calendar-toolbar">
  <button type="button" aria-label="上个月" onClick={() => onDisplayMonthChange(shiftMonth(displayMonth, -1))}>‹</button>
  <h2>{year}年{month}月</h2>
  <button type="button" onClick={onToday}>今天</button>
  <button type="button" aria-label="下个月" onClick={() => onDisplayMonthChange(shiftMonth(displayMonth, 1))}>›</button>
</header>
```

- [ ] **Step 5: Separate selected date and displayed month**

`TaskWorkspace` owns both states. The range effect depends on `displayMonth`; clicking a day changes only `selectedDate`. “今天” changes both to today and selects today. Filter the returned monthly tasks for the selected-date list instead of requesting the day again.

- [ ] **Step 6: Replace the static dashboard calendar**

Render the shared `MonthCalendar` in the workbench when an API exists. For preview-only rendering, derive a deterministic month from the injected date rather than retaining `2026年7月` literals.

- [ ] **Step 7: Confirm GREEN**

Run: `npm test -- tests/integration/month-calendar.test.tsx tests/integration/task-workspace.test.tsx tests/integration/navigation-modes.test.tsx`  
Expected: all navigation, cross-year and single-range-query tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/features/calendar src/renderer/features/tasks/TaskWorkspace.tsx src/renderer/components/DashboardFrame.tsx tests/integration
git commit -m "feat: navigate calendar months"
```

---

### Task 5: Add One-Click Theme Cycling and Toolbar Shell

**Files:**
- Create: `src/renderer/features/toolbar/theme-cycle.ts`
- Create: `src/renderer/features/toolbar/WorkbenchToolbar.tsx`
- Modify: `src/renderer/components/DashboardFrame.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles/layout.css`
- Create: `tests/unit/theme-cycle.test.ts`
- Create: `tests/integration/workbench-toolbar.test.tsx`

**Interfaces:**
- Produces `ThemeSelection = ThemeId | 'auto'` and `nextThemeSelection(current): ThemeSelection`.
- `WorkbenchToolbar` receives theme, window state callbacks and report callbacks; window/report controls may initially be disabled until Tasks 6–7.

- [ ] **Step 1: Write seven-state cycle tests**

```ts
expect(nextThemeSelection('monday')).toBe('tuesday');
expect(nextThemeSelection('saturday')).toBe('auto');
expect(nextThemeSelection('auto', new Date('2026-07-06T12:00:00'))).toBe('tuesday');
```

The auto case first resolves today's theme, then advances once, so one click always produces a visible change.

- [ ] **Step 2: Confirm RED**

Run: `npm test -- tests/unit/theme-cycle.test.ts tests/integration/workbench-toolbar.test.tsx`  
Expected: FAIL because toolbar and cycle functions are missing.

- [ ] **Step 3: Implement the cycle**

```ts
const order: ThemeId[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function nextThemeSelection(current: ThemeSelection, now = new Date()): ThemeSelection {
  const resolved = current === 'auto' ? resolveTheme(now, null) : current;
  const index = order.indexOf(resolved);
  return index === order.length - 1 ? 'auto' : order[index + 1];
}
```

- [ ] **Step 4: Persist the main-button result**

When the next selection is `auto`, store `themeOverride = null` and notify `App`. Otherwise store `{ themeId: next, mode: 'persistent' }`. Extend the callback type to accept `ThemeOverride | null`, and keep SettingsPage's today/persistent behavior unchanged.

- [ ] **Step 5: Render the toolbar in the approved location**

Place it after the page `<h1>` and before the content. Keep `data-testid="workbench-toolbar"`; theme button accessible name must be `切换皮肤，当前：<label>`.

- [ ] **Step 6: Confirm GREEN**

Run: `npm test -- tests/unit/theme-cycle.test.ts tests/integration/workbench-toolbar.test.tsx tests/integration/app-theme-settings.test.tsx tests/integration/theme-layout.test.tsx`  
Expected: cycle, persistence, auto restoration and layout parity pass.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/features/toolbar src/renderer/components/DashboardFrame.tsx src/renderer/App.tsx src/renderer/styles/layout.css tests
git commit -m "feat: add one-click workbench theme switcher"
```

---

### Task 6: Build Offline Weekly and Monthly Reports

**Files:**
- Create: `src/renderer/features/reports/report-period.ts`
- Create: `src/renderer/features/reports/report-generator.ts`
- Create: `src/renderer/features/reports/ReportDialog.tsx`
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/features/toolbar/WorkbenchToolbar.tsx`
- Modify: `src/renderer/components/DashboardFrame.tsx`
- Create: `tests/unit/report-generator.test.ts`
- Create: `tests/integration/report-dialog.test.tsx`

**Interfaces:**
- Produces `reportPeriod(kind, anchorDate)` and `generateLocalReport(input): GeneratedReport`.
- Adds `JournalApi.reports.exportText(suggestedName, text): Promise<string | null>`.

- [ ] **Step 1: Write period, truthfulness and length tests**

Use fixture tasks across a Monday–Sunday week and a full month. Assert exact inclusive periods, completion numbers, real task titles, “本周期记录较少” for empty data, and:

```ts
expect(countChineseCharacters(weekly.text)).toBeGreaterThanOrEqual(180);
expect(countChineseCharacters(weekly.text)).toBeLessThanOrEqual(240);
expect(countChineseCharacters(monthly.text)).toBeGreaterThanOrEqual(540);
expect(countChineseCharacters(monthly.text)).toBeLessThanOrEqual(660);
```

- [ ] **Step 2: Confirm RED**

Run: `npm test -- tests/unit/report-generator.test.ts`  
Expected: FAIL because the report modules do not exist.

- [ ] **Step 3: Implement pure periods**

Use local noon dates to avoid UTC rollover. Week start is Monday; month start/end use calendar boundaries. Return `{ startDate, endDate, title, suggestedName }`.

- [ ] **Step 4: Implement bounded paragraphs**

Build named paragraphs in priority order: overview, achievements, quadrant distribution, unfinished risks, review insights, next focus. Use a `fitReport(paragraphs, min, max)` function that removes the lowest-priority optional paragraph first, then shortens list items at comma boundaries. If below minimum, append factual neutral sentences derived from counts; never invent a task title or outcome.

The generator signature is:

```ts
export interface ReportInput {
  kind: 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  tasks: Task[];
  reviews: DailyReview[];
}

export interface GeneratedReport {
  title: string;
  periodLabel: string;
  text: string;
  generatedAt: string;
}
```

- [ ] **Step 5: Add the report dialog**

On open, fetch tasks and reviews with one range call each, generate locally, and display readonly text. Copy uses `navigator.clipboard.writeText`. Export invokes `reports.exportText`. AI button sets the status text `尚未配置 AI 服务，本地报告不受影响` and never calls `fetch`.

- [ ] **Step 6: Add validated TXT export**

Main IPC accepts a basename matching `/^四象日志-(周报|月报)-[0-9-]+\.txt$/` and text up to 30,000 characters, opens a save dialog, and writes UTF-8 using `writeFile`. Cancellation returns `null`.

- [ ] **Step 7: Confirm GREEN**

Run: `npm test -- tests/unit/report-generator.test.ts tests/integration/report-dialog.test.tsx tests/unit/verification-tools.test.ts`  
Expected: report ranges and lengths pass, empty data is honest, export cancellation is non-error, and no-network verification still passes.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/features/reports src/renderer/features/toolbar src/renderer/components/DashboardFrame.tsx src/shared/ipc.ts src/main tests
git commit -m "feat: generate local weekly and monthly reports"
```

---

### Task 7: Implement Recoverable Windows Desktop Mode and Opacity

**Files:**
- Create: `native/desktop-host/Program.cs`
- Create: `src/main/window-control.ts`
- Modify: `package.json`
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/tray.ts`
- Modify: `src/main/electron-tray.ts`
- Modify: `src/renderer/features/toolbar/WorkbenchToolbar.tsx`
- Create: `tests/unit/window-control.test.ts`
- Modify: `tests/unit/tray-menu.test.ts`
- Create: `tests/integration/desktop-toolbar.test.tsx`

**Interfaces:**
- Produces `DesktopWindowState` and `WindowApi` exactly as specified.
- Produces `WindowController` with `enter`, `exit`, `setOpacity`, `restoreVisibleWindow`.
- Native helper commands: `attach <hwnd>`, `detach <hwnd>`, `status <hwnd>`.

- [ ] **Step 1: Write state-machine failures**

Use fake window, settings and helper ports. Assert enter ordering, clamp behavior, opacity only in desktop mode, exit restoration, and that helper failure calls restoration before rejecting.

```ts
await expect(controller.enter()).rejects.toThrow('未能嵌入桌面');
expect(window.setSkipTaskbar).toHaveBeenLastCalledWith(false);
expect(window.setOpacity).toHaveBeenLastCalledWith(1);
expect(window.show).toHaveBeenCalled();
```

- [ ] **Step 2: Confirm RED**

Run: `npm test -- tests/unit/window-control.test.ts tests/unit/tray-menu.test.ts`  
Expected: FAIL because the controller and recovery tray item are absent.

- [ ] **Step 3: Implement the native helper**

`Program.cs` imports only `user32.dll`: `FindWindow`, `FindWindowEx`, `EnumWindows`, `SendMessageTimeout`, `SetParent`, `GetParent`, `GetWindowLongPtr`, `SetWindowLongPtr`, and `SetWindowPos`. It spawns the WorkerW layer through message `0x052C`, finds the WorkerW sibling behind `SHELLDLL_DefView`, stores the original style supplied by the controller, removes `WS_CAPTION` and `WS_THICKFRAME`, attaches the supplied HWND, prints a JSON object with `success`, `parent`, and `message`, and exits nonzero on failure. `detach` sets parent to zero and restores the exact saved window style rather than assuming one fixed style.

Reject non-numeric, zero or negative handles before any Win32 call. The helper must not accept paths, shell commands or environment-controlled DLL names.

- [ ] **Step 4: Implement the controller with dependency ports**

Define `WindowPort`, `SettingsPort`, and `DesktopHostPort` so unit tests do not launch Electron or the helper. Save normal bounds before attach. In desktop mode call `setSkipTaskbar(true)`, call `setMenuBarVisibility(false)`, then let the native helper remove the Windows caption/frame and attach the HWND before applying saved opacity. On exit detach and restore the native style first, call `setSkipTaskbar(false)` and `setMenuBarVisibility(true)`, restore bounds, set opacity 1, show and focus.

Clamp with:

```ts
export function clampDesktopOpacity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(.4, Math.round(value * 20) / 20))
    : .85;
}
```

Add `build/desktop-host.exe` to Electron Builder `files` and verify it is outside ASAR so the main process can execute it. Extend `tests/unit/package-config.test.ts` to assert the helper is included and not referenced through a network download.

- [ ] **Step 5: Register validated IPC after the main window exists**

Handlers call the controller; never accept a renderer-supplied window handle. Startup always creates a normal visible window even if settings say the last mode was desktop. Keep only saved opacity and bounds across restarts.

- [ ] **Step 6: Add renderer controls and recovery behavior**

The toolbar disables the mode button while a request is pending. Show the slider only when `state.mode === 'desktop'`; debounce persistence 150 ms. On IPC error, refresh state and display the returned Chinese recovery message.

- [ ] **Step 7: Add tray recovery**

Insert `{ id: 'restoreWindow', label: '恢复主窗口' }` before the separator. Its click calls `controller.restoreVisibleWindow()` rather than only `window.show()`.

- [ ] **Step 8: Confirm GREEN**

Run:

```bash
npm test -- tests/unit/window-control.test.ts tests/unit/tray-menu.test.ts tests/integration/desktop-toolbar.test.tsx tests/unit/window-options.test.ts
```

Expected: state machine, opacity clamp, failed-attach recovery, toolbar and tray tests pass.

- [ ] **Step 9: Commit**

```bash
git add native/desktop-host src/main src/shared/ipc.ts src/renderer/features/toolbar tests
git commit -m "feat: add recoverable Windows desktop mode"
```

---

### Task 8: Integrate Layout, Restore Regressions and Prepare 0.3.0

**Files:**
- Modify: `src/renderer/styles/layout.css`
- Modify: `src/main/main.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/test-report.md`
- Test: `tests/integration/app-shell.test.tsx`
- Test: `tests/unit/application-menu.test.ts`

**Interfaces:**
- Produces release-ready 0.3.0 source without running the final full suite yet.
- Preserves all 0.2.0 behavior listed in Global Constraints.

- [ ] **Step 1: Add responsive layout regression tests**

Assert the toolbar exists once, dashboard region order is unchanged, report dialog is modal, six themes render the same regions, and desktop controls do not remove navigation.

- [ ] **Step 2: Restore and test the Chinese application menu wiring**

Ensure `main.ts` imports and invokes `installApplicationMenu()` as the first operation inside `app.whenReady()`. Run the existing menu-label test; no English visible label may return.

- [ ] **Step 3: Finish approved styles**

Add only feature styles: compact toolbar, 40–100% slider, month buttons, quadrant semantic accents, strike states and report dialog. Preserve existing grid templates and current responsive breakpoints. At 1280×720 the toolbar may wrap but must not overlap content.

- [ ] **Step 4: Bump version without tagging**

Change root package and lockfile versions from `0.2.0` to `0.3.0`. Do not create a Git tag until Task 10.

- [ ] **Step 5: Run focused integration only**

Run:

```bash
npm test -- tests/integration/app-shell.test.tsx tests/integration/theme-layout.test.tsx tests/unit/application-menu.test.ts tests/integration/navigation-modes.test.tsx
npm run typecheck
```

Expected: focused regressions and typecheck pass. Do not run Windows packaging.

- [ ] **Step 6: Commit**

```bash
git add src package.json package-lock.json docs/test-report.md tests
git commit -m "release: prepare desktop productivity version 0.3.0"
```

---

### Task 9: Normalize GitHub Source and Split Quick/Release Workflows

**Files:**
- Create: `.github/workflows/quick-verify.yml`
- Replace: `.github/workflows/build-portable.yml` with `.github/workflows/release-windows.yml`
- Modify: `.gitignore`
- Remove from repository: versioned source ZIPs, installers and workflow artifact ZIPs

**Interfaces:**
- Pull Requests and normal main commits use direct source and quick validation.
- Tags `v*` and manual dispatch run the full release exactly once.

- [ ] **Step 1: Add direct-source quick verification**

```yaml
name: Quick source verification
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  quick:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 2 }
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run verify:changed
        env:
          CHANGED_BASE: HEAD~1
```

- [ ] **Step 2: Add release-only Windows workflow**

Trigger only on `workflow_dispatch` and tags `v*`. Checkout direct source, cache npm, Electron and electron-builder directories by `package-lock.json` hash, run `npm ci`, compile `native/desktop-host/Program.cs`, run `npm run verify`, build portable x64, then run unpacked, single-file and desktop-mode Playwright tests.

Compile with the installed Windows .NET SDK:

```powershell
dotnet new console --force --output native/desktop-host/build --framework net8.0
Copy-Item native/desktop-host/Program.cs native/desktop-host/build/Program.cs -Force
dotnet publish native/desktop-host/build -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -p:AssemblyName=desktop-host
Copy-Item native/desktop-host/build/bin/Release/net8.0/win-x64/publish/desktop-host.exe build/desktop-host.exe
```

- [ ] **Step 3: Keep binaries out of source history**

Add:

```gitignore
release/
build/desktop-host.exe
FourQuadrantJournal-*-source.zip
FourQuadrantJournal-*-artifact.zip
FourQuadrantJournal-*-green-folder.zip
FourQuadrantJournal-*-win-x64.exe
```

Remove already tracked binary bundles in the publication commit while retaining GitHub Release artifacts.

- [ ] **Step 4: Verify workflow references**

Run a YAML syntax check and `rg 'Expand-Archive|source.zip' .github`.  
Expected: no workflow expands a source ZIP; quick workflow never invokes electron-builder; release workflow invokes the full gate once.

- [ ] **Step 5: Commit**

```bash
git add .github .gitignore package.json scripts
git rm --cached 'FourQuadrantJournal-*-source.zip' 'FourQuadrantJournal-*-win-x64.exe'
git commit -m "build: track source directly and separate release verification"
```

---

### Task 10: Run the Single Full Release Gate and Deliver Windows Artifacts

**Files:**
- Modify: `tests/e2e/packaged-smoke.spec.ts`
- Create: `tests/e2e/desktop-mode.spec.ts`
- Modify: `docs/test-report.md`
- Verify: `.github/workflows/release-windows.yml`

**Interfaces:**
- Produces `FourQuadrantJournal-0.3.0-green-folder.zip` and `FourQuadrantJournal-0.3.0-win-x64.exe`.
- This is the only task that runs the complete source and Windows packaging gates.

- [ ] **Step 1: Extend packaged smoke coverage**

The unpacked test must create one task, verify it appears, cycle a theme, switch month and reopen the window. The desktop-mode test must:

1. click “嵌入桌面”;
2. query the native helper `status` and assert the parent is a WorkerW handle;
3. set 40%, 85%, 100% and verify `BrowserWindow.getOpacity()` through test-only IPC enabled only by `E2E_DESKTOP_STATE=1`;
4. invoke tray/controller restore and assert the visible main window has opacity 1;
5. restart and assert the normal window is visible.

- [ ] **Step 2: Run the fresh full local source gate once**

Run: `npm run verify`  
Expected: TypeScript, all Vitest tests, renderer/main builds, six-theme parity and offline scan pass with zero failures.

- [ ] **Step 3: Trigger the Windows release workflow once**

Use manual dispatch for version `0.3.0`. Expected successful steps:

- direct source checkout;
- dependency/cache restore;
- C# helper compilation;
- full verification;
- portable build;
- unpacked visible-window smoke;
- single-file visible-window smoke;
- desktop WorkerW attach/opacity/restore/restart smoke;
- artifact upload.

- [ ] **Step 4: Validate the delivered folder ZIP**

```bash
unzip -t FourQuadrantJournal-0.3.0-green-folder.zip
sha256sum FourQuadrantJournal-0.3.0-green-folder.zip FourQuadrantJournal-0.3.0-win-x64.exe
```

Expected: every entry is valid and both SHA-256 values are recorded in `docs/test-report.md`.

- [ ] **Step 5: Inspect required payload**

The folder ZIP must contain `四象日志.exe`, `resources`, `locales`, required DLLs, `desktop-host.exe`, and a Chinese `使用说明.txt`. It must not contain source code, API keys, user data or test databases.

- [ ] **Step 6: Finalize release documentation and tag**

Record actual test counts, Windows checks, artifact hashes, incremental workflow behavior and known limitation that AI is only a reserved entry. Create tag `v0.3.0` only after artifact verification.

- [ ] **Step 7: Commit/tag release**

```bash
git add docs/test-report.md
git commit -m "release: verify four quadrant journal 0.3.0"
git tag v0.3.0
git push origin main v0.3.0
```

Expected: source is directly browsable on GitHub, the release workflow is green, and both downloadable Windows artifacts are attached.
