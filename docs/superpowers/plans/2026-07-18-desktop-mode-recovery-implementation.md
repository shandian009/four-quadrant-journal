# Desktop Mode Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Windows desktop-embedded session recoverable and editable through an external recovery control, tray/notification activation, and `Ctrl+Alt+J`.

**Architecture:** Keep WorkerW embedding in `WindowController`, add lifecycle hooks that create or close a separate recovery BrowserWindow, and route every external activation through one deduplicated `WindowActivationController`. Electron-specific construction remains in small adapters, while state and sequencing are covered by unit tests.

**Tech Stack:** Electron 43, TypeScript 5.9, Vitest 4, Vite, tsup, C#/.NET 8 desktop helper, GitHub Actions Windows runner.

## Global Constraints

- Preserve all six themes, main layout, task data, report templates, month navigation, opacity range, and database schema.
- Do not add network services or telemetry.
- Enable WorkerW and the recovery control only on Windows; keep current normal-window behavior elsewhere.
- Existing settings and data require no migration.
- Target release version is `0.3.3`.

---

### Task 1: Desktop lifecycle and forced visibility

**Files:**
- Modify: `src/main/window-control.ts`
- Test: `tests/unit/window-control.test.ts`

**Interfaces:**
- Consumes: existing `WindowController`, `WindowPort`, and `DesktopHostPort`.
- Produces: `DesktopModeLifecycle` with `entered(): void | Promise<void>` and `exited(): void | Promise<void>`; `WindowController` accepts it as an optional fourth constructor argument.

- [ ] **Step 1: Write failing lifecycle tests**

Add tests proving `entered()` runs only after a successful attach, `exited()` runs after normal restoration, lifecycle creation failure rolls back the embedded window, and concurrent restores perform only one native detach.

```ts
const lifecycle = { entered: vi.fn(), exited: vi.fn() };
const controller = new WindowController(window, settings, host, lifecycle);
await controller.enter();
expect(lifecycle.entered).toHaveBeenCalledOnce();
await controller.restoreVisibleWindow();
expect(lifecycle.exited).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Verify the tests fail for the missing interface and callbacks**

Run: `npx vitest run tests/unit/window-control.test.ts`  
Expected: FAIL because the fourth constructor argument and lifecycle behavior do not exist.

- [ ] **Step 3: Implement lifecycle callbacks and recovery rollback**

Call `lifecycle.entered()` after attachment and opacity application. If it rejects, run the existing recovery path and return the existing safe error. Call `lifecycle.exited()` after successful local restoration. Keep transition serialization and ensure cleanup callbacks are idempotent.

- [ ] **Step 4: Verify window controller tests pass**

Run: `npx vitest run tests/unit/window-control.test.ts`  
Expected: all tests in the file PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/window-control.ts tests/unit/window-control.test.ts
git commit -m "fix: expose safe desktop lifecycle recovery"
```

### Task 2: External recovery control window

**Files:**
- Create: `src/main/desktop-recovery-control.ts`
- Create: `tests/unit/desktop-recovery-control.test.ts`
- Modify: `src/main/main.ts`

**Interfaces:**
- Consumes: Electron `BrowserWindow`, `screen`, main-window bounds, and an async restore action.
- Produces: `DesktopRecoveryControl` with `show(): Promise<void>`, `close(): void`, and `reposition(): void`.

- [ ] **Step 1: Write failing control state tests**

Test a port-driven controller so repeated `show()` creates one window, the restore navigation invokes the recovery action once, `close()` is idempotent, and creation failure rejects so the lifecycle can roll back.

```ts
await control.show();
await control.show();
expect(factory.create).toHaveBeenCalledOnce();
await created.triggerRestore();
expect(restore).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Verify the tests fail because the module is absent**

Run: `npx vitest run tests/unit/desktop-recovery-control.test.ts`  
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the frameless recovery control**

Create a fixed-size, frameless, skip-taskbar, non-resizable BrowserWindow with Chinese text “四象日志已嵌入桌面” and “恢复并编辑”. Position it at the current display work-area bottom right. Intercept only `fqj-recovery://restore`, prevent navigation, disable the button while awaiting restore, and close after success. Close it on lifecycle exit and app shutdown.

- [ ] **Step 4: Wire the control into `WindowController` lifecycle**

Create the control after the main BrowserWindow exists. Pass `show`/`close` callbacks as the controller lifecycle. A control creation failure must make `enter()` roll back instead of leaving an unrecoverable embedded window.

- [ ] **Step 5: Verify focused tests pass**

Run: `npx vitest run tests/unit/desktop-recovery-control.test.ts tests/unit/window-control.test.ts`  
Expected: both files PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/desktop-recovery-control.ts src/main/main.ts tests/unit/desktop-recovery-control.test.ts
git commit -m "feat: add desktop recovery control"
```

### Task 3: Unified activation, tray, notification, and shortcut

**Files:**
- Create: `src/main/window-activation.ts`
- Create: `tests/unit/window-activation.test.ts`
- Modify: `src/main/electron-tray.ts`
- Create: `tests/unit/electron-tray-actions.test.ts`
- Modify: `src/main/main.ts`

**Interfaces:**
- Consumes: `WindowController.restoreVisibleWindow()`, main-window show/focus/send, Electron `globalShortcut`.
- Produces: `WindowActivationController.restoreAndShow(afterRestore?: () => void | Promise<void>): Promise<void>` and `registerRecoveryShortcut()` cleanup.

- [ ] **Step 1: Write failing activation sequencing tests**

Cover deduplication, restore-before-follow-up ordering, rejection handling, and shortcut registration failure.

```ts
await activation.restoreAndShow(() => calls.push('quick-add'));
expect(calls).toEqual(['restore', 'show', 'focus', 'quick-add']);
```

- [ ] **Step 2: Write failing tray action tests**

Mock the Electron tray template and prove “显示四象日志”, “快速添加事项”, “恢复主窗口”, and tray double-click invoke supplied actions instead of directly calling `window.show()`.

- [ ] **Step 3: Verify both new test files fail**

Run: `npx vitest run tests/unit/window-activation.test.ts tests/unit/electron-tray-actions.test.ts`  
Expected: FAIL because the activation module and action-only tray contract do not exist.

- [ ] **Step 4: Implement and wire unified activation**

Route second-instance, tray show, tray restore, tray double-click, reminder click, recovery-control click, and `Ctrl+Alt+J` through `restoreAndShow()`. For quick add, await restore before sending `ui:quickAdd`. Register the shortcut after app readiness and unregister it during shutdown; registration failure must not abort startup.

- [ ] **Step 5: Verify activation and tray tests pass**

Run: `npx vitest run tests/unit/window-activation.test.ts tests/unit/electron-tray-actions.test.ts tests/unit/tray-menu.test.ts`  
Expected: all listed tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/window-activation.ts src/main/electron-tray.ts src/main/main.ts tests/unit/window-activation.test.ts tests/unit/electron-tray-actions.test.ts
git commit -m "fix: restore desktop mode before external activation"
```

### Task 4: Version, complete verification, and Windows green build

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/test-report.md`

**Interfaces:**
- Consumes: all implementation from Tasks 1–3.
- Produces: verified `0.3.3` source and Windows green-folder artifact.

- [ ] **Step 1: Set the release version to 0.3.3**

Run: `npm version 0.3.3 --no-git-tag-version`  
Expected: `package.json` and `package-lock.json` both report `0.3.3`.

- [ ] **Step 2: Run focused desktop recovery verification**

Run: `npx vitest run tests/unit/window-control.test.ts tests/unit/desktop-recovery-control.test.ts tests/unit/window-activation.test.ts tests/unit/electron-tray-actions.test.ts tests/unit/tray-menu.test.ts`  
Expected: 0 failed tests.

- [ ] **Step 3: Run the full source quality gate**

Run: `npm run verify:source`  
Expected: typecheck, all Vitest tests, renderer/electron builds, theme parity, and no-network verification all exit 0.

- [ ] **Step 4: Update the test report with exact command results**

Record test counts, build outcome, remaining limitation that WorkerW interaction itself is owned by Explorer, and the four external recovery routes.

- [ ] **Step 5: Commit the verified source**

```bash
git add package.json package-lock.json docs/test-report.md
git commit -m "release: prepare desktop recovery 0.3.3"
```

- [ ] **Step 6: Push and run Windows release workflow**

Push the existing release branch and dispatch the repository’s Windows release workflow for version `0.3.3`. Verify the native helper build, packaged app launch test, artifact structure, and checksum job all succeed.

- [ ] **Step 7: Download and independently inspect the green artifact**

Confirm the ZIP opens, contains `四象日志.exe`, `resources`, locales, Electron runtime files, and the unpacked `desktop-host.exe`; calculate SHA-256 and record it in the delivery note.

