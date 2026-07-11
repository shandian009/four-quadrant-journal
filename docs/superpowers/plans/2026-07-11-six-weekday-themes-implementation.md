# Six Weekday Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing five palettes with six reference-matched Monday-to-Saturday skins, map Sunday to Saturday, and preserve all layout and behavior.

**Architecture:** Keep the current `ThemeId → ThemeTokens → CSS custom properties` flow. Extend the token model with dedicated gradient variables while retaining solid colors for controls and `color-mix()`, then apply the gradient variables through existing semantic panel classes. Add `saturday` to the resolver and settings without changing persisted keys or override precedence.

**Tech Stack:** React 19, TypeScript 5.9, CSS custom properties, Vitest, Testing Library, Vite 7, Electron 43.

## Global Constraints

- Delete the visual values of the current five themes; keep IDs `monday` through `friday` for stored-setting compatibility.
- Add exactly one new ID: `saturday`; Sunday resolves to `saturday`.
- Keep the page component tree, grid dimensions, text, feature entry points, database, reminders and backup behavior unchanged.
- Use six approved palettes: deep-sea blue, aurora blue, mint green, healing dark green, charcoal orange and blue-gray.
- Use gradients only for backgrounds, selected states and progress accents; long-form text remains solid.
- Preserve `today` and `persistent` override precedence.
- Replace all Electron application-menu labels with Chinese while preserving standard roles and shortcuts.
- Target WCAG AA 4.5:1 for primary text and at least 3:1 for secondary text.
- Final verification must include `npm run verify` and Windows packaged startup checks.

## File Map

- Modify `src/renderer/theme/resolve-theme.ts`: add `saturday` and Sunday mapping.
- Modify `src/renderer/theme/themes.ts`: replace all old palettes and expose solid plus gradient tokens.
- Modify `src/renderer/styles/layout.css`: consume gradient tokens by semantic application region.
- Modify `tests/unit/resolve-theme.test.ts`: verify Monday through Sunday and overrides.
- Modify `tests/integration/theme-layout.test.tsx`: verify six-theme layout parity and gradient variables.
- Modify `tests/integration/settings-page.test.tsx`: verify `saturday` can be selected and persisted.
- Modify `tests/unit/verification-tools.test.ts`: enforce six themes and token parity.
- Create `src/main/application-menu.ts`: define and install the Chinese Electron menu.
- Modify `src/main/main.ts`: install the menu after Electron becomes ready.
- Create `tests/unit/application-menu.test.ts`: verify all top-level and child labels and standard roles.
- Modify `package.json`, `package-lock.json`: bump the feature release to `0.2.0` after validation.
- Modify `docs/test-report.md`: record theme replacement and final counts.

---

### Task 1: Add Saturday and Sunday Resolution

**Files:**
- Modify: `src/renderer/theme/resolve-theme.ts`
- Test: `tests/unit/resolve-theme.test.ts`

**Interfaces:**
- Produces: `ThemeId = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'`
- Preserves: `resolveTheme(date: Date, override: ThemeOverride | null): ThemeId`

- [ ] **Step 1: Write the failing weekday mapping test**

Replace the weekday cases and weekend fallback test with:

```ts
it.each([
  ['2026-07-06', 'monday'],
  ['2026-07-07', 'tuesday'],
  ['2026-07-08', 'wednesday'],
  ['2026-07-09', 'thursday'],
  ['2026-07-10', 'friday'],
  ['2026-07-11', 'saturday'],
  ['2026-07-12', 'saturday']
] as const)('maps %s to %s', (isoDate, themeId) => {
  expect(resolveTheme(new Date(`${isoDate}T12:00:00`), null)).toBe(themeId);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
npm test -- tests/unit/resolve-theme.test.ts
```

Expected: FAIL because `saturday` is not a `ThemeId` and Saturday/Sunday currently resolve to `tuesday`.

- [ ] **Step 3: Extend `ThemeId` and the resolver**

Use:

```ts
export type ThemeId =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

const weekdayThemes: ThemeId[] = [
  'saturday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];
```

Do not change override checks above the weekday mapping.

- [ ] **Step 4: Run resolver tests and confirm GREEN**

Run:

```bash
npm test -- tests/unit/resolve-theme.test.ts
```

Expected: all resolver tests pass, including existing `today` and `persistent` override cases.

- [ ] **Step 5: Commit the resolver change**

```bash
git add src/renderer/theme/resolve-theme.ts tests/unit/resolve-theme.test.ts
git commit -m "feat: map six weekday themes"
```

---

### Task 2: Replace Theme Tokens with Six Approved Palettes

**Files:**
- Modify: `src/renderer/theme/themes.ts`
- Test: `tests/unit/verification-tools.test.ts`

**Interfaces:**
- Consumes: `ThemeId` from Task 1.
- Produces: `ThemeTokens` with solid colors plus `canvasGradient`, `sidebarGradient`, `surfaceGradient`, `calendarGradient`, `overviewGradient`, `reviewGradient`, and `activeGradient`.
- Produces CSS variables with matching kebab-case names from `themeStyle(themeId)`.

- [ ] **Step 1: Write failing token-count and parity assertions**

Add to the existing verification test:

```ts
expect(Object.keys(THEMES)).toEqual([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
]);

for (const theme of Object.values(THEMES)) {
  expect(theme).toEqual(expect.objectContaining({
    canvasGradient: expect.stringContaining('linear-gradient'),
    sidebarGradient: expect.stringContaining('linear-gradient'),
    surfaceGradient: expect.stringContaining('linear-gradient'),
    calendarGradient: expect.stringContaining('linear-gradient'),
    overviewGradient: expect.stringContaining('linear-gradient'),
    reviewGradient: expect.stringContaining('linear-gradient'),
    activeGradient: expect.stringContaining('linear-gradient')
  }));
}
```

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
npm test -- tests/unit/verification-tools.test.ts
```

Expected: FAIL because only five themes and no gradient tokens exist.

- [ ] **Step 3: Extend the token interface**

Add these properties to `ThemeTokens`:

```ts
canvasGradient: string;
sidebarGradient: string;
surfaceGradient: string;
calendarGradient: string;
overviewGradient: string;
reviewGradient: string;
activeGradient: string;
```

- [ ] **Step 4: Replace `THEMES` with the six approved palettes**

Keep solid `canvas`, `surface`, `surfaceMuted`, `text`, `textMuted`, `accent`, `accentSoft`, `microAccent`, `border`, and `danger` values for controls. Use these exact labels and gradient anchors:

```ts
const palette = {
  monday: {
    label: '周一 · 冷启动',
    canvas: '#07111F', surface: '#102137', surfaceMuted: '#1B3048',
    text: '#F3F7FC', textMuted: '#9AAEC4', accent: '#2688FF',
    accentSoft: '#17375A', microAccent: '#43D6D1', border: '#2A4562', danger: '#FF6B61',
    canvasGradient: 'linear-gradient(135deg, #07111F 0%, #0D1B2E 100%)',
    sidebarGradient: 'linear-gradient(180deg, #0B1728 0%, #13233A 100%)',
    surfaceGradient: 'linear-gradient(145deg, #102137 0%, #162B45 100%)',
    calendarGradient: 'linear-gradient(145deg, #132137 0%, #1B2E4A 100%)',
    overviewGradient: 'linear-gradient(145deg, #0C2B36 0%, #12394A 100%)',
    reviewGradient: 'linear-gradient(110deg, #17243D 0%, #1A3151 100%)',
    activeGradient: 'linear-gradient(90deg, #174E91 0%, #1D78B5 100%)'
  },
  tuesday: {
    label: '周二 · 渐入状态',
    canvas: '#F5FAFF', surface: '#FFFFFF', surfaceMuted: '#E7F1FF',
    text: '#12254A', textMuted: '#617493', accent: '#2676E8',
    accentSoft: '#DDEBFF', microAccent: '#20B8C1', border: '#C9DDF4', danger: '#E95E55',
    canvasGradient: 'linear-gradient(135deg, #F5FAFF 0%, #DDEEFF 100%)',
    sidebarGradient: 'linear-gradient(180deg, #F8FBFF 0%, #E7F1FF 100%)',
    surfaceGradient: 'linear-gradient(145deg, #FFFFFF 0%, #F0F7FF 100%)',
    calendarGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EAF3FF 100%)',
    overviewGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EDF9F8 100%)',
    reviewGradient: 'linear-gradient(110deg, #FFFFFF 0%, #E8F2FF 100%)',
    activeGradient: 'linear-gradient(90deg, #D7E8FF 0%, #BFDDFB 100%)'
  },
  wednesday: {
    label: '周三 · 舒缓续航',
    canvas: '#F5FFFB', surface: '#FFFFFF', surfaceMuted: '#E4F6F0',
    text: '#173B34', textMuted: '#66847D', accent: '#20A77A',
    accentSoft: '#D9F2E8', microAccent: '#17AEC4', border: '#C7E6DC', danger: '#EB6659',
    canvasGradient: 'linear-gradient(135deg, #F5FFFB 0%, #DEF5EE 100%)',
    sidebarGradient: 'linear-gradient(180deg, #F7FFFC 0%, #E4F6F0 100%)',
    surfaceGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EEF9F5 100%)',
    calendarGradient: 'linear-gradient(145deg, #FFFFFF 0%, #F1FBF7 100%)',
    overviewGradient: 'linear-gradient(145deg, #FFFDF4 0%, #F0FAF5 100%)',
    reviewGradient: 'linear-gradient(110deg, #FFFFFF 0%, #E9F8F3 100%)',
    activeGradient: 'linear-gradient(90deg, #D7F1E7 0%, #BDE8DA 100%)'
  },
  thursday: {
    label: '周四 · 沉稳推进',
    canvas: '#071B17', surface: '#0E2C25', surfaceMuted: '#183E34',
    text: '#F1F8F5', textMuted: '#A1BEB5', accent: '#48D29B',
    accentSoft: '#173F34', microAccent: '#27B8C8', border: '#2F5A4D', danger: '#FF765F',
    canvasGradient: 'linear-gradient(135deg, #071B17 0%, #10362D 100%)',
    sidebarGradient: 'linear-gradient(180deg, #09221C 0%, #123B31 100%)',
    surfaceGradient: 'linear-gradient(145deg, #0E2C25 0%, #17463A 100%)',
    calendarGradient: 'linear-gradient(145deg, #102E28 0%, #173F37 100%)',
    overviewGradient: 'linear-gradient(145deg, #123228 0%, #1B4A3D 100%)',
    reviewGradient: 'linear-gradient(110deg, #10352C 0%, #175146 100%)',
    activeGradient: 'linear-gradient(90deg, #245E4D 0%, #317A64 100%)'
  },
  friday: {
    label: '周五 · 冲刺收官',
    canvas: '#101214', surface: '#1B1D20', surfaceMuted: '#292C2F',
    text: '#F5F4F1', textMuted: '#ACA8A1', accent: '#FF8A3D',
    accentSoft: '#3B2A20', microAccent: '#FFC44D', border: '#3B3D40', danger: '#FF6654',
    canvasGradient: 'linear-gradient(135deg, #101214 0%, #1A1D20 100%)',
    sidebarGradient: 'linear-gradient(180deg, #141618 0%, #202326 100%)',
    surfaceGradient: 'linear-gradient(145deg, #1B1D20 0%, #25282B 100%)',
    calendarGradient: 'linear-gradient(145deg, #191B1D 0%, #222426 100%)',
    overviewGradient: 'linear-gradient(145deg, #1A1B1C 0%, #28231E 100%)',
    reviewGradient: 'linear-gradient(110deg, #1D1E20 0%, #2A2825 100%)',
    activeGradient: 'linear-gradient(90deg, #3B3028 0%, #4B3B2F 100%)'
  },
  saturday: {
    label: '周六 · 松弛复盘',
    canvas: '#F3F9FD', surface: '#FFFFFF', surfaceMuted: '#E2F0F7',
    text: '#17384A', textMuted: '#6C8795', accent: '#2B8EAF',
    accentSoft: '#D9ECF5', microAccent: '#24B7AF', border: '#C4DBE7', danger: '#E66158',
    canvasGradient: 'linear-gradient(135deg, #F3F9FD 0%, #DCECF5 100%)',
    sidebarGradient: 'linear-gradient(180deg, #F4FAFD 0%, #E2F0F7 100%)',
    surfaceGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EAF4F9 100%)',
    calendarGradient: 'linear-gradient(145deg, #FFFFFF 0%, #EDF6FA 100%)',
    overviewGradient: 'linear-gradient(145deg, #F8FDFF 0%, #E6F5F4 100%)',
    reviewGradient: 'linear-gradient(110deg, #FFFFFF 0%, #E4F1F7 100%)',
    activeGradient: 'linear-gradient(90deg, #D4EAF4 0%, #B8DDEB 100%)'
  }
} satisfies Record<ThemeId, ThemeTokens>;
```

Assign `export const THEMES = palette;`.

- [ ] **Step 5: Export gradient CSS variables**

Add to `themeStyle`:

```ts
'--canvas-gradient': theme.canvasGradient,
'--sidebar-gradient': theme.sidebarGradient,
'--surface-gradient': theme.surfaceGradient,
'--calendar-gradient': theme.calendarGradient,
'--overview-gradient': theme.overviewGradient,
'--review-gradient': theme.reviewGradient,
'--active-gradient': theme.activeGradient
```

- [ ] **Step 6: Run token tests and parity script**

```bash
npm test -- tests/unit/verification-tools.test.ts
npm run verify:theme-parity
```

Expected: tests pass and output `主题令牌一致：6 套皮肤`.

- [ ] **Step 7: Commit token replacement**

```bash
git add src/renderer/theme/themes.ts tests/unit/verification-tools.test.ts
git commit -m "feat: replace weekday theme palettes"
```

---

### Task 3: Apply Coordinated Region Gradients Without Layout Changes

**Files:**
- Modify: `src/renderer/styles/layout.css`
- Test: `tests/integration/theme-layout.test.tsx`

**Interfaces:**
- Consumes CSS variables from Task 2.
- Preserves existing classes `.application-shell`, `.sidebar`, `.panel`, `.priority-panel`, `.calendar-panel`, `.overview-panel`, `.review-panel`.

- [ ] **Step 1: Expand the layout-parity test to Saturday and gradients**

Use Monday as the baseline and rerender all other IDs:

```tsx
const themeIds = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const { rerender } = render(<DashboardFrame themeId="monday" />);
const baseline = screen.getAllByTestId(/^dashboard-region-/).map((node) => node.dataset.testid);

for (const themeId of themeIds) {
  rerender(<DashboardFrame themeId={themeId} />);
  expect(screen.getAllByTestId(/^dashboard-region-/).map((node) => node.dataset.testid)).toEqual(baseline);
  expect(screen.getByTestId('application-shell')).toHaveAttribute('data-theme', themeId);
}

expect(screen.getByTestId('application-shell').getAttribute('style')).toContain('--canvas-gradient:');
```

- [ ] **Step 2: Run the focused integration test and confirm RED**

```bash
npm test -- tests/integration/theme-layout.test.tsx
```

Expected: FAIL before `saturday` and gradient variables exist.

- [ ] **Step 3: Apply gradients through existing semantic classes**

Change only background declarations and selected-state styling:

```css
.application-shell { background: var(--canvas-gradient); }
.sidebar { background: var(--sidebar-gradient); }
.nav-item--active { background: var(--active-gradient); }
.panel, .settings-card, .task-dialog, .quadrant { background: var(--surface-gradient); }
.calendar-panel { background: var(--calendar-gradient); }
.overview-panel { background: var(--overview-gradient); }
.review-panel { background: var(--review-gradient); }
.progress i { background: linear-gradient(90deg, var(--accent), var(--micro-accent)); }
```

Keep every width, height, padding, grid template, gap, border radius and media query unchanged.

- [ ] **Step 4: Differentiate review columns with existing theme accents**

Add:

```css
.review-column:nth-child(1) { --column-accent: var(--accent); }
.review-column:nth-child(2) { --column-accent: var(--micro-accent); }
.review-column:nth-child(3) { --column-accent: color-mix(in srgb, var(--accent) 58%, var(--micro-accent)); }
.review-column h3,
.review-column__title { color: var(--column-accent, var(--accent)); }
.review-column h3 span,
.review-column__title i { border-color: var(--column-accent, var(--accent)); }
```

- [ ] **Step 5: Run layout tests and full renderer build**

```bash
npm test -- tests/integration/theme-layout.test.tsx
npm run build:renderer
```

Expected: integration tests pass and Vite builds without invalid CSS warnings.

- [ ] **Step 6: Commit the CSS application**

```bash
git add src/renderer/styles/layout.css tests/integration/theme-layout.test.tsx
git commit -m "feat: apply coordinated theme gradients"
```

---

### Task 4: Expose and Persist the Saturday Skin

**Files:**
- Modify: `tests/integration/settings-page.test.tsx`
- Verify: `src/renderer/features/settings/SettingsPage.tsx`

**Interfaces:**
- Consumes `Object.entries(THEMES)`; no production component change is expected if Task 2 is correct.
- Produces persisted override `{ themeId: 'saturday', mode: 'persistent' }`.

- [ ] **Step 1: Change the settings integration test to select Saturday**

Use:

```tsx
await user.selectOptions(screen.getByLabelText('皮肤'), 'saturday');
await user.selectOptions(screen.getByLabelText('应用方式'), 'persistent');
await user.click(screen.getByRole('button', { name: '应用皮肤' }));

expect(screen.getByRole('option', { name: '周六 · 松弛复盘' })).toBeVisible();
expect(settings.set).toHaveBeenCalledWith('themeOverride', {
  themeId: 'saturday',
  mode: 'persistent'
});
expect(onThemeChange).toHaveBeenCalledWith({
  themeId: 'saturday',
  mode: 'persistent'
});
```

- [ ] **Step 2: Run the focused test**

```bash
npm test -- tests/integration/settings-page.test.tsx
```

Expected: PASS because `SettingsPage` already renders `Object.entries(THEMES)`; if it fails, fix only the typed iteration in `SettingsPage.tsx` without hard-coding options.

- [ ] **Step 3: Confirm old IDs remain selectable**

Add:

```tsx
for (const id of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']) {
  expect(screen.getByRole('option', { name: THEMES[id as ThemeId].label })).toHaveValue(id);
}
```

Import `THEMES` and `ThemeId` into the test.

- [ ] **Step 4: Run settings and theme-override tests**

```bash
npm test -- tests/integration/settings-page.test.tsx tests/integration/app-theme-settings.test.tsx tests/unit/resolve-theme.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit settings coverage**

```bash
git add tests/integration/settings-page.test.tsx src/renderer/features/settings/SettingsPage.tsx
git commit -m "test: cover Saturday theme settings"
```

---

### Task 5: Localize the Electron Application Menu

**Files:**
- Create: `src/main/application-menu.ts`
- Modify: `src/main/main.ts`
- Create: `tests/unit/application-menu.test.ts`

**Interfaces:**
- Produces: `buildApplicationMenuTemplate(appVersion: string): MenuItemConstructorOptions[]`
- Produces: `installApplicationMenu(appVersion: string): void`
- Consumes Electron `Menu`, `dialog`, `app.getVersion()` and standard menu roles.

- [ ] **Step 1: Write the failing menu-template test**

Create `tests/unit/application-menu.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildApplicationMenuTemplate } from '../../src/main/application-menu';

describe('Chinese application menu', () => {
  it('uses Chinese labels for every visible menu item', () => {
    const template = buildApplicationMenuTemplate('0.2.0');
    expect(template.map((item) => item.label)).toEqual(['文件', '编辑', '视图', '窗口', '帮助']);

    const labels = template.flatMap((item) =>
      Array.isArray(item.submenu)
        ? item.submenu.flatMap((child) => typeof child === 'object' && child.label ? [child.label] : [])
        : []
    );

    expect(labels).toEqual(expect.arrayContaining([
      '退出', '撤销', '重做', '剪切', '复制', '粘贴', '全选',
      '重新加载', '强制重新加载', '开发者工具', '实际大小', '放大', '缩小',
      '切换全屏', '最小化', '关闭', '关于四象日志'
    ]));
    expect(JSON.stringify(template)).not.toMatch(/File|Edit|View|Window|Help/);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
npm test -- tests/unit/application-menu.test.ts
```

Expected: FAIL because `src/main/application-menu.ts` does not exist.

- [ ] **Step 3: Implement the menu template and installer**

Create `src/main/application-menu.ts` with this structure:

```ts
import { dialog, Menu, type MenuItemConstructorOptions } from 'electron';

export function buildApplicationMenuTemplate(appVersion: string): MenuItemConstructorOptions[] {
  return [
    { label: '文件', submenu: [{ label: '退出', role: 'quit' }] },
    { label: '编辑', submenu: [
      { label: '撤销', role: 'undo' },
      { label: '重做', role: 'redo' },
      { type: 'separator' },
      { label: '剪切', role: 'cut' },
      { label: '复制', role: 'copy' },
      { label: '粘贴', role: 'paste' },
      { label: '全选', role: 'selectAll' }
    ] },
    { label: '视图', submenu: [
      { label: '重新加载', role: 'reload' },
      { label: '强制重新加载', role: 'forceReload' },
      { label: '开发者工具', role: 'toggleDevTools' },
      { type: 'separator' },
      { label: '实际大小', role: 'resetZoom' },
      { label: '放大', role: 'zoomIn' },
      { label: '缩小', role: 'zoomOut' },
      { type: 'separator' },
      { label: '切换全屏', role: 'togglefullscreen' }
    ] },
    { label: '窗口', submenu: [
      { label: '最小化', role: 'minimize' },
      { label: '关闭', role: 'close' }
    ] },
    { label: '帮助', submenu: [{
      label: '关于四象日志',
      click: () => void dialog.showMessageBox({
        type: 'info',
        title: '关于四象日志',
        message: '四象日志',
        detail: `版本 ${appVersion}`,
        buttons: ['确定']
      })
    }] }
  ];
}

export function installApplicationMenu(appVersion: string): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildApplicationMenuTemplate(appVersion)));
}
```

- [ ] **Step 4: Install the menu during startup**

In `src/main/main.ts`, import `installApplicationMenu` and call it as the first operation inside `app.whenReady().then(...)`:

```ts
installApplicationMenu(app.getVersion());
```

- [ ] **Step 5: Run menu, main-process and type tests**

```bash
npm test -- tests/unit/application-menu.test.ts tests/unit/window-options.test.ts
npm run typecheck
```

Expected: both tests and typecheck pass.

- [ ] **Step 6: Commit menu localization**

```bash
git add src/main/application-menu.ts src/main/main.ts tests/unit/application-menu.test.ts
git commit -m "feat: localize application menu"
```

---

### Task 6: Release, Full Verification and Windows Packaging

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/test-report.md`
- Verify: `.github/workflows/build-portable.yml`

**Interfaces:**
- Produces release version `0.2.0` and Windows artifacts with six themes.

- [ ] **Step 1: Bump the feature release version**

```bash
npm version 0.2.0 --no-git-tag-version
```

Expected: `package.json` and root package-lock version both become `0.2.0`.

- [ ] **Step 2: Run the full local verification gate**

```bash
npm run verify
```

Expected:

- TypeScript exits 0.
- All Vitest files and tests pass.
- Renderer and Electron bundles build.
- Theme parity reports six skins.
- Offline scan passes.

- [ ] **Step 3: Verify exact production asset and theme output**

```bash
rg 'data-theme|--canvas-gradient|saturday' src tests
sed -n '1,30p' dist/renderer/index.html
```

Expected: Saturday appears in resolver/tests, gradient variables appear in theme/CSS code, and renderer assets remain relative `./assets/...` paths.

- [ ] **Step 4: Update the test report**

Record:

```markdown
- 原五套配色已替换为六套参考图风格皮肤。
- 周一至周六分别自动匹配，周日跟随周六。
- 设置页可持久化周六皮肤。
- 六套皮肤布局一致性与令牌一致性通过。
```

Use the actual final test counts from Step 2; do not copy stale counts.

- [ ] **Step 5: Commit the verified release**

```bash
git add package.json package-lock.json docs/test-report.md
git commit -m "release: prepare six-theme version 0.2.0"
```

- [ ] **Step 6: Run the Windows workflow**

Update the workflow bundle to source version `0.2.0`, then run the established Windows job. It must execute:

```text
npm ci
npm run verify
npx electron-builder --win portable --x64
Playwright unpacked executable smoke test
single-file portable launcher window check
upload unpacked green folder
```

Expected: every job step is `success`, and both Windows artifacts are present.

- [ ] **Step 7: Validate the delivered green-folder ZIP**

```bash
unzip -t FourQuadrantJournal-0.2.0-green-folder.zip
sha256sum FourQuadrantJournal-0.2.0-green-folder.zip
```

Expected: no ZIP errors and a recorded SHA-256 digest.
