# Four-Quadrant Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a local-only Windows desktop application that combines four-quadrant tasks, a calendar, daily reflection, focus timing, reminders, backup/restore, and five weekday mood skins.

**Architecture:** Electron owns the secure desktop shell, SQLite access, notifications, tray, backup, and typed IPC. React owns the renderer UI and calls only the allow-listed preload API. Domain services are framework-light and receive clocks/filesystem/notifier dependencies so Vitest can verify behavior without a running desktop session.

**Tech Stack:** Electron 43.1.0, React 19.2.7, TypeScript, Vite 7.3.6, Vitest 4.1.10, Testing Library, better-sqlite3 12.11.1, Zod, date-fns, Playwright 1.61.1, electron-builder 26.15.3.

## Global Constraints

- Target Windows 10/11 64-bit; design baseline 1440×900 and minimum 1280×720.
- Store all business data locally; the application must make no business network request.
- Use `contextIsolation: true`, `nodeIntegration: false`, sandboxed renderer, and allow-listed typed IPC.
- The five weekday skins change design tokens only; layout, spacing, type scale, and component geometry remain identical.
- Monday through Friday select the matching skin automatically. Manual override supports “today only” and “keep using”. Weekend fallback is the persistent override, otherwise Tuesday.
- The managed workspace has read-only Git metadata. Commit commands remain documented for a normal checkout, but execution in this workspace must not claim commits succeeded.

---

## File Map

- `package.json`: scripts, dependencies, Windows build metadata.
- `src/shared/domain.ts`: persisted domain types and validation-safe DTOs.
- `src/shared/ipc.ts`: exact renderer/main API contract.
- `src/main/main.ts`: Electron lifecycle and single-instance behavior.
- `src/main/window.ts`: secure BrowserWindow construction.
- `src/main/preload.ts`: narrow `window.journalApi` bridge.
- `src/main/database.ts`: SQLite connection, migrations, transactions.
- `src/main/repositories/*.ts`: focused persistence units for tasks, reviews, focus, reminders, settings.
- `src/main/services/*.ts`: reminder scheduler, statistics, backup/restore.
- `src/main/ipc-handlers.ts`: Zod-validated IPC endpoints.
- `src/renderer/App.tsx`: routing shell and feature composition.
- `src/renderer/features/*`: task, calendar, review, focus, settings UI/state.
- `src/renderer/theme/*`: five token sets and weekday resolution.
- `src/renderer/styles/*`: global grid, components, responsive behavior.
- `tests/unit/*`: pure domain/service tests.
- `tests/integration/*`: in-memory SQLite and React integration tests.
- `tests/e2e/*`: packaged-app critical paths.

---

### Task 1: Secure Electron/React Foundation

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`
- Create: `src/shared/domain.ts`, `src/shared/ipc.ts`
- Create: `src/main/main.ts`, `src/main/window.ts`, `src/main/preload.ts`
- Create: `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/global.d.ts`
- Test: `tests/unit/window-options.test.ts`, `tests/integration/app-shell.test.tsx`

**Interfaces:**
- Produces `createWindowOptions(): BrowserWindowConstructorOptions`.
- Produces `window.journalApi` matching `JournalApi` from `src/shared/ipc.ts`.
- Later tasks extend `JournalApi` without exposing raw IPC or filesystem access.

- [ ] **Step 1: Add the failing security test**

```ts
import { describe, expect, it } from 'vitest';
import { createWindowOptions } from '../../src/main/window';

describe('desktop window security', () => {
  it('isolates and sandboxes the renderer', () => {
    const options = createWindowOptions();
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    });
  });
});
```

- [ ] **Step 2: Install dependencies and verify RED**

Run:
```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install
npm run test -- tests/unit/window-options.test.ts
```
Expected: FAIL because `src/main/window.ts` does not exist.

- [ ] **Step 3: Implement the minimal secure shell**

```ts
// src/main/window.ts
import type { BrowserWindowConstructorOptions } from 'electron';
import path from 'node:path';

export function createWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    backgroundColor: '#F4F7FA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
}
```

- [ ] **Step 4: Add the React smoke test and shell**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from '../../src/renderer/App';

it('renders the application identity', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: '今日工作台' })).toBeVisible();
  expect(screen.getByText('四象日志')).toBeVisible();
});
```

- [ ] **Step 5: Run foundation tests**

Run: `npm run test -- tests/unit/window-options.test.ts tests/integration/app-shell.test.tsx`  
Expected: 2 test files PASS.

- [ ] **Step 6: Commit in a writable checkout**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html src tests
git commit -m "feat: scaffold secure desktop shell"
```

---

### Task 2: Five Weekday Theme Tokens and Fixed Dashboard Layout

**Files:**
- Create: `src/renderer/theme/themes.ts`, `src/renderer/theme/resolve-theme.ts`, `src/renderer/theme/ThemeProvider.tsx`
- Create: `src/renderer/styles/tokens.css`, `src/renderer/styles/layout.css`
- Create: `src/renderer/components/Sidebar.tsx`, `DashboardFrame.tsx`, `Panel.tsx`
- Modify: `src/renderer/App.tsx`
- Test: `tests/unit/resolve-theme.test.ts`, `tests/integration/theme-layout.test.tsx`

**Interfaces:**
- Produces `ThemeId = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'`.
- Produces `resolveTheme(date, override): ThemeId` and `THEMES: Record<ThemeId, ThemeTokens>`.
- `ThemeProvider` sets `data-theme` and CSS custom properties on the root shell.

- [ ] **Step 1: Write weekday mapping tests**

```ts
it.each([
  ['2026-07-06', 'monday'],
  ['2026-07-07', 'tuesday'],
  ['2026-07-08', 'wednesday'],
  ['2026-07-09', 'thursday'],
  ['2026-07-10', 'friday']
] as const)('maps %s to %s', (iso, expected) => {
  expect(resolveTheme(new Date(`${iso}T12:00:00`), null)).toBe(expected);
});

it('uses Tuesday on a weekend without an override', () => {
  expect(resolveTheme(new Date('2026-07-11T12:00:00'), null)).toBe('tuesday');
});

it('honors a persistent override', () => {
  expect(resolveTheme(new Date('2026-07-06T12:00:00'), { themeId: 'friday', mode: 'persistent' })).toBe('friday');
});
```

- [ ] **Step 2: Run RED**

Run: `npm run test -- tests/unit/resolve-theme.test.ts`  
Expected: FAIL because `resolveTheme` is missing.

- [ ] **Step 3: Implement exact theme resolution**

```ts
export function resolveTheme(date: Date, override: ThemeOverride | null): ThemeId {
  if (override?.mode === 'persistent') return override.themeId;
  if (override?.mode === 'today' && override.date === formatLocalDate(date)) return override.themeId;
  return ['tuesday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'tuesday'][date.getDay()] as ThemeId;
}
```

- [ ] **Step 4: Define all five token sets**

Each set must define `canvas`, `surface`, `surfaceMuted`, `text`, `textMuted`, `accent`, `accentSoft`, `microAccent`, `border`, `danger`; use the exact colors in the approved spec.

- [ ] **Step 5: Build the fixed dashboard grid**

Render sidebar, title, theme badge, task panel, calendar panel, overview panel, and the three-column review panel. Add a test that snapshots the ordered region names and verifies switching from Monday to Friday changes `data-theme` but not the region count or order.

- [ ] **Step 6: Verify themes and layout**

Run: `npm run test -- tests/unit/resolve-theme.test.ts tests/integration/theme-layout.test.tsx`  
Expected: all theme cases and layout invariance tests PASS.

- [ ] **Step 7: Commit in a writable checkout**

```bash
git add src/renderer tests/unit/resolve-theme.test.ts tests/integration/theme-layout.test.tsx
git commit -m "feat: add five weekday mood skins"
```

---

### Task 3: SQLite Schema and Typed Repositories

**Files:**
- Create: `src/main/database.ts`, `src/main/migrations.ts`
- Create: `src/main/repositories/tasks.ts`, `reviews.ts`, `focus.ts`, `reminders.ts`, `settings.ts`
- Modify: `src/shared/domain.ts`
- Test: `tests/integration/database.test.ts`, `tests/integration/task-repository.test.ts`, `tests/integration/review-repository.test.ts`

**Interfaces:**
- Produces `openDatabase(path: string): Database.Database` and `migrate(db): void`.
- Produces repository classes with `create`, `update`, `findByDate`, `list`, `softDelete`, and feature-specific methods.
- All writes run inside transactions and return domain DTOs, not raw SQLite rows.

- [ ] **Step 1: Write migration and CRUD tests against `:memory:`**

```ts
it('creates and moves a task without losing identity', () => {
  const task = repo.create({ title: '提交项目报告', quadrant: 'urgent_important', plannedDate: '2026-07-10' });
  const moved = repo.update(task.id, { quadrant: 'important' });
  expect(moved).toMatchObject({ id: task.id, quadrant: 'important', status: 'active' });
});

it('keeps one review per date', () => {
  reviews.save('2026-07-10', { wins: '完成报告', improvements: '', tomorrowFocus: '复核图纸' });
  reviews.save('2026-07-10', { wins: '完成并发送报告', improvements: '', tomorrowFocus: '复核图纸' });
  expect(reviews.findByDate('2026-07-10')?.wins).toBe('完成并发送报告');
});
```

- [ ] **Step 2: Run RED**

Run: `npm run test -- tests/integration/database.test.ts tests/integration/task-repository.test.ts tests/integration/review-repository.test.ts`  
Expected: FAIL because repositories are missing.

- [ ] **Step 3: Implement schema version 1**

Create `schema_meta`, `tasks`, `daily_reviews`, `focus_sessions`, `reminders`, and `settings` with the columns and enums from the approved spec. Add indexes for `tasks(planned_date,status)`, `reminders(scheduled_at,status)`, and `focus_sessions(started_at)`.

- [ ] **Step 4: Implement repository mapping and validation**

Use UUIDs from `crypto.randomUUID()`, ISO timestamps, soft deletion, upsert for daily reviews/settings, and strict domain converters that reject unknown enum values.

- [ ] **Step 5: Run repository tests**

Run: `npm run test -- tests/integration/database.test.ts tests/integration/task-repository.test.ts tests/integration/review-repository.test.ts`  
Expected: schema initializes once, migration is idempotent, CRUD tests PASS.

- [ ] **Step 6: Commit in a writable checkout**

```bash
git add src/main src/shared tests/integration
git commit -m "feat: add local sqlite persistence"
```

---

### Task 4: Task IPC, Four Quadrants, and Calendar Synchronization

**Files:**
- Create: `src/main/ipc-handlers.ts`
- Modify: `src/main/preload.ts`, `src/shared/ipc.ts`
- Create: `src/renderer/features/tasks/TaskForm.tsx`, `TaskList.tsx`, `QuadrantBoard.tsx`, `task-store.ts`
- Create: `src/renderer/features/calendar/MonthCalendar.tsx`, `DayDetail.tsx`
- Test: `tests/unit/ipc-validation.test.ts`, `tests/integration/task-flow.test.tsx`, `tests/integration/calendar-sync.test.tsx`

**Interfaces:**
- Adds `tasks.list`, `tasks.create`, `tasks.update`, `tasks.complete`, `tasks.restore`, `tasks.remove` to `JournalApi`.
- Task DTO validation uses Zod in the main process before repository calls.
- Renderer state refreshes by date after each successful mutation.

- [ ] **Step 1: Write a failing full task-flow test**

```tsx
await user.click(screen.getByRole('button', { name: '添加事项' }));
await user.type(screen.getByLabelText('事项标题'), '提交项目报告');
await user.selectOptions(screen.getByLabelText('所属象限'), 'urgent_important');
await user.click(screen.getByRole('button', { name: '保存' }));
expect(await screen.findByText('提交项目报告')).toBeVisible();
expect(screen.getByTestId('calendar-day-2026-07-10')).toHaveAttribute('data-task-count', '1');
```

- [ ] **Step 2: Run RED**

Run: `npm run test -- tests/integration/task-flow.test.tsx tests/integration/calendar-sync.test.tsx`  
Expected: FAIL because task features do not exist.

- [ ] **Step 3: Implement validated IPC and preload methods**

Expose named methods only. Reject empty titles, titles over 120 characters, invalid local dates, unknown quadrants, and reminder times without a task date/time.

- [ ] **Step 4: Implement task form/list and four-quadrant board**

Use accessible dialog controls. Complete/move/delete actions update only after API success; on failure retain the previous UI and show a non-blocking error banner.

- [ ] **Step 5: Implement month calendar synchronization**

Group tasks by `plannedDate`, add status dots and counts, and make date selection update both the task list and review date.

- [ ] **Step 6: Verify task lifecycle and calendar**

Run: `npm run test -- tests/unit/ipc-validation.test.ts tests/integration/task-flow.test.tsx tests/integration/calendar-sync.test.tsx`  
Expected: create, move, complete, restore, delete, and date synchronization PASS.

- [ ] **Step 7: Commit in a writable checkout**

```bash
git add src/main src/shared src/renderer/features tests
git commit -m "feat: implement quadrant tasks and calendar"
```

---

### Task 5: Daily Review Autosave and Dashboard Statistics

**Files:**
- Create: `src/main/services/statistics.ts`
- Modify: `src/main/ipc-handlers.ts`, `src/main/preload.ts`, `src/shared/ipc.ts`
- Create: `src/renderer/features/review/DailyReview.tsx`, `use-review-autosave.ts`
- Create: `src/renderer/features/dashboard/Overview.tsx`, `PriorityTasks.tsx`
- Test: `tests/unit/statistics.test.ts`, `tests/integration/review-autosave.test.tsx`, `tests/integration/dashboard.test.tsx`

**Interfaces:**
- Adds `reviews.get/save` and `statistics.forDate` to `JournalApi`.
- Produces `DailyStatistics { planned, completed, pending, completionRate, focusSeconds }`.
- Autosave waits 500 ms after the last edit and exposes `idle | saving | saved | error`.

- [ ] **Step 1: Write failing statistics and autosave tests**

```ts
expect(calculateStatistics(tasks, sessions)).toEqual({
  planned: 8,
  completed: 6,
  pending: 2,
  completionRate: 75,
  focusSeconds: 22_320
});
```

```tsx
vi.useFakeTimers();
await user.type(screen.getByLabelText('今日收获'), '完成报告');
await vi.advanceTimersByTimeAsync(499);
expect(api.reviews.save).not.toHaveBeenCalled();
await vi.advanceTimersByTimeAsync(1);
expect(api.reviews.save).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run RED**

Run: `npm run test -- tests/unit/statistics.test.ts tests/integration/review-autosave.test.tsx`  
Expected: FAIL because services/components are missing.

- [ ] **Step 3: Implement statistics and top-five priority ordering**

Order active tasks by quadrant rank, overdue state, due time, then `sortOrder`. Completion rate is `0` when no tasks exist.

- [ ] **Step 4: Implement resilient review autosave**

Keep the current text in component state. On save failure show `未保存，点击重试`; never clear or replace the user's text.

- [ ] **Step 5: Verify dashboard and persistence behavior**

Run: `npm run test -- tests/unit/statistics.test.ts tests/integration/review-autosave.test.tsx tests/integration/dashboard.test.tsx`  
Expected: calculation, ordering, debounce, retry, and date switching PASS.

- [ ] **Step 6: Commit in a writable checkout**

```bash
git add src tests
git commit -m "feat: add review autosave and daily statistics"
```

---

### Task 6: Recoverable Focus Timer

**Files:**
- Create: `src/main/services/focus-timer.ts`
- Modify: `src/main/repositories/focus.ts`, `src/main/ipc-handlers.ts`, `src/main/preload.ts`, `src/shared/ipc.ts`
- Create: `src/renderer/features/focus/FocusControl.tsx`
- Test: `tests/unit/focus-timer.test.ts`, `tests/integration/focus-control.test.tsx`

**Interfaces:**
- Adds `focus.current/start/pause/resume/finish/recover` to `JournalApi`.
- `FocusTimer` receives `now(): Date` and persists each transition transactionally.
- Only one `running` or `paused` session can exist.

- [ ] **Step 1: Write the failing injected-clock test**

```ts
const clock = fakeClock('2026-07-10T09:00:00');
const timer = new FocusTimer(repo, clock.now);
const session = timer.start('task-1');
clock.advanceMinutes(25);
const finished = timer.finish(session.id);
expect(finished.durationSeconds).toBe(1500);
```

- [ ] **Step 2: Run RED**

Run: `npm run test -- tests/unit/focus-timer.test.ts`  
Expected: FAIL because `FocusTimer` is missing.

- [ ] **Step 3: Implement state transitions and recovery**

Reject a second active session; accumulate elapsed time across pause/resume; after restart return the unfinished session and require an explicit resume or finish choice.

- [ ] **Step 4: Implement compact controls and stats refresh**

Controls show the related task, elapsed time, pause/resume, and finish. Finishing refreshes the daily overview.

- [ ] **Step 5: Verify focus behavior**

Run: `npm run test -- tests/unit/focus-timer.test.ts tests/integration/focus-control.test.tsx`  
Expected: start, pause, resume, finish, exclusivity, and restart recovery PASS.

- [ ] **Step 6: Commit in a writable checkout**

```bash
git add src tests
git commit -m "feat: add recoverable focus timing"
```

---

### Task 7: Persistent Reminders, Notifications, and Tray

**Files:**
- Create: `src/main/services/reminder-scheduler.ts`, `src/main/tray.ts`
- Modify: `src/main/repositories/reminders.ts`, `src/main/main.ts`, `src/main/ipc-handlers.ts`
- Test: `tests/unit/reminder-scheduler.test.ts`, `tests/unit/tray-menu.test.ts`

**Interfaces:**
- `ReminderScheduler` receives repository, `now`, timer adapter, and notifier adapter.
- `start()` reloads pending reminders; `snooze(id, 10)` writes the new schedule before setting a timer.
- Tray actions are `show`, `quickAdd`, `pauseReminders`, `quit`.

- [ ] **Step 1: Write late-start and snooze tests**

```ts
it('fires a missed reminder once when it is less than 24 hours late', async () => {
  repo.insert(pendingReminder('2026-07-10T08:00:00'));
  const scheduler = createSchedulerAt('2026-07-10T09:00:00');
  await scheduler.start();
  expect(notifier.show).toHaveBeenCalledTimes(1);
  expect(repo.get(id)?.status).toBe('fired');
});
```

- [ ] **Step 2: Run RED**

Run: `npm run test -- tests/unit/reminder-scheduler.test.ts tests/unit/tray-menu.test.ts`  
Expected: FAIL because scheduler/tray modules are missing.

- [ ] **Step 3: Implement restart-safe scheduling**

Schedule only the next pending reminders, reschedule on system resume/time change, mark reminders older than 24 hours as missed without notification, and prevent duplicate firing in one process.

- [ ] **Step 4: Implement Windows notification actions and tray menu**

Click opens the task. “稍后 10 分钟” persists before rearming. Default tray close behavior hides the window; explicit tray quit closes the database and application.

- [ ] **Step 5: Verify scheduler and tray**

Run: `npm run test -- tests/unit/reminder-scheduler.test.ts tests/unit/tray-menu.test.ts`  
Expected: on-time, late, stale, snooze, pause, and menu action tests PASS.

- [ ] **Step 6: Commit in a writable checkout**

```bash
git add src/main tests/unit
git commit -m "feat: add reminders notifications and tray"
```

---

### Task 8: Settings, Backup, Restore, and Rollback

**Files:**
- Create: `src/main/services/backup-service.ts`
- Modify: `src/main/repositories/settings.ts`, `src/main/ipc-handlers.ts`, `src/main/preload.ts`, `src/shared/ipc.ts`
- Create: `src/renderer/features/settings/SettingsPage.tsx`, `ThemeSettings.tsx`, `DataSettings.tsx`
- Test: `tests/unit/backup-service.test.ts`, `tests/integration/settings.test.tsx`

**Interfaces:**
- Adds `settings.get/set`, `backup.export`, `backup.restore`, `app.setLoginOpen`.
- Backup manifest contains `formatVersion`, `createdAt`, `databaseSha256`, and the database payload.
- Restore validates the manifest/hash, snapshots current data, swaps atomically, migrates, and rolls back on any failure.

- [ ] **Step 1: Write corruption and rollback tests**

```ts
await expect(service.restore(corruptBackupPath)).rejects.toThrow('备份文件校验失败');
expect(await sha256(activeDatabasePath)).toBe(originalHash);

await expect(service.restore(validButMigrationFailingBackup)).rejects.toThrow();
expect(await sha256(activeDatabasePath)).toBe(originalHash);
```

- [ ] **Step 2: Run RED**

Run: `npm run test -- tests/unit/backup-service.test.ts`  
Expected: FAIL because `BackupService` is missing.

- [ ] **Step 3: Implement deterministic export and atomic restore**

Checkpoint WAL before export, hash bytes, write through a temporary file, use atomic rename, and create a timestamped pre-restore snapshot.

- [ ] **Step 4: Implement settings UI**

Include automatic theme/manual override mode, reminder pause, tray close behavior, startup toggle, export, and restore. Restore requires explicit confirmation and shows success/failure without exposing internal paths unnecessarily.

- [ ] **Step 5: Verify settings and data safety**

Run: `npm run test -- tests/unit/backup-service.test.ts tests/integration/settings.test.tsx`  
Expected: export, hash validation, rollback, theme override, and settings persistence PASS.

- [ ] **Step 6: Commit in a writable checkout**

```bash
git add src tests
git commit -m "feat: add settings backup and safe restore"
```

---

### Task 9: E2E, Accessibility, Windows Build, and Final Verification

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/app.spec.ts`
- Create: `scripts/verify-no-network.mjs`, `scripts/verify-theme-parity.mjs`
- Create: `.github/workflows/windows-build.yml`
- Modify: `package.json`, `README.md`

**Interfaces:**
- `npm run verify` executes typecheck, lint, unit/integration tests, production renderer build, no-network scan, and theme parity validation.
- Windows CI rebuilds native modules for Electron, runs tests, packages NSIS x64, and uploads the installer artifact.

- [ ] **Step 1: Add failing E2E critical path**

```ts
test('persists a task and review across restart', async ({ electronApp }) => {
  const window = await electronApp.firstWindow();
  await window.getByRole('button', { name: '添加事项' }).click();
  await window.getByLabel('事项标题').fill('提交项目报告');
  await window.getByRole('button', { name: '保存' }).click();
  await window.getByLabel('今日收获').fill('完成报告');
  await electronApp.close();
  const relaunched = await launchTestApp();
  const nextWindow = await relaunched.firstWindow();
  await expect(nextWindow.getByText('提交项目报告')).toBeVisible();
  await expect(nextWindow.getByLabel('今日收获')).toHaveValue('完成报告');
});
```

- [ ] **Step 2: Add deterministic non-GUI verification scripts**

`verify-theme-parity` asserts every theme has the same token keys. `verify-no-network` scans production code for `fetch`, `XMLHttpRequest`, `http://`, `https://`, WebSocket, and remote BrowserWindow URLs, with an explicit allow-list limited to Vite development mode.

- [ ] **Step 3: Configure Windows CI and electron-builder**

Use NSIS x64, per-user install by default, app id `com.fourquadrant.journal`, product name `四象日志`, and artifact name `FourQuadrantJournal-${version}-win-x64.${ext}`. CI runs on `windows-latest` with Node 22.

- [ ] **Step 4: Run the full local verification suite**

Run:
```bash
npm run typecheck
npm run test
npm run build
npm run verify:theme-parity
npm run verify:no-network
```
Expected: all commands exit 0; no failing tests; renderer production build succeeds; all five token sets match; no business network call is found.

- [ ] **Step 5: Run Windows-specific verification**

Run in Windows CI: `npm run verify && npm run test:e2e && npm run dist:win`  
Expected: tests PASS and an NSIS x64 installer artifact is produced. Verify manually at 100%, 125%, and 150% scaling and record results in `docs/test-report.md`.

- [ ] **Step 6: Final commit in a writable checkout**

```bash
git add .github package.json package-lock.json playwright.config.ts scripts tests README.md docs/test-report.md
git commit -m "test: verify and package windows desktop app"
```

---

## Plan Self-Review

- Every approved feature is assigned to a task: fixed layout and five skins (Task 2), local data (Task 3), task/calendar (Task 4), review/stats (Task 5), focus timing (Task 6), reminders/tray (Task 7), backup/settings (Task 8), packaging and Windows QA (Task 9).
- All renderer-to-main operations use the `JournalApi` contract and allow-listed IPC.
- Domain names remain consistent with the approved spec: `plannedDate`, `dueAt`, `remindAt`, `estimatedMinutes`, `tomorrowFocus`, and `focusSeconds`.
- No implementation step depends on cloud services or a user account.
- Local verification can prove business logic, data, React integration, build, theme parity, and network isolation. Windows notifications, tray integration, scaling, and the NSIS installer require the Windows CI/manual gate in Task 9.
