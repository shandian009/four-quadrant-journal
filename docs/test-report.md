# 四象日志 0.3.0 测试报告

日期：2026-07-12  
状态：本地完整源码验证通过；Windows 发布验收待主控在 Windows runner 执行

## 本地完整发布门禁

本轮按发布计划唯一一次正式执行：

```text
npm run verify
```

结果：退出码 0，所有本地源码门禁通过。

- TypeScript：`tsc --noEmit` 通过。
- Vitest：44 个测试文件、190 项测试全部通过，0 失败。
- Renderer build：Vite 7.3.6 生产构建通过，49 个模块完成转换；生成 `index.html`、CSS 与 JS 产物。
- Electron build：tsup 8.5.1 通过；生成 `dist-electron/main.cjs` 与 `dist-electron/preload.cjs` 及 source map。
- 六皮肤一致性：通过，输出“主题令牌一致：6 套皮肤”。
- 离线扫描：通过，输出“离线检查通过：未发现业务网络调用”。

## 发布 E2E 准备

`tests/e2e/packaged-smoke.spec.ts` 与 `tests/e2e/desktop-mode.spec.ts` 已由 Playwright 成功发现，共 2 个文件、2 项测试；两者仅在 `PACKAGED_APP_PATH` 指向真实产物时运行，并在结束时关闭应用、删除临时 `userData`。

- packaged smoke：验证工作台可见、创建并看到事项、一键切换皮肤、切换月份，以及使用同一 `userData` 关闭重启后事项仍可见。
- desktop mode：验证真实打包 helper 存在，以 `status` 查询真实窗口且嵌入后 `parent != 0`；验证 `BrowserWindow.getOpacity()` 依次为 0.4、0.85、1；恢复后 helper `parent = 0` 且 opacity 为 1；关闭后以同一 `userData` 重启，普通窗口可见且 opacity 为 1。
- 系统托盘菜单不在 Playwright 中强行自动点击。托盘菜单/controller 恢复路径已有单元测试覆盖；真实托盘“恢复主窗口”仍列入 Windows 人工/runner 验收。

发布前定向检查还包括：相关源码回归 6 个文件、41 项测试通过；workflow 静态测试 7/7 通过；Playwright `--list` 发现上述 2/2；定向 typecheck 通过。

## Windows 发布验收（待主控）

当前 Linux 工作区没有运行 Windows helper 编译、Electron Windows 打包或 Windows 实机 E2E，也没有产出 0.3.0 发布文件。因此下列项目不得标记为通过：

- self-contained `desktop-host.exe` 在干净 Windows runner 编译、打包并从 `app.asar.unpacked/build/desktop-host.exe` 执行；
- unpacked 文件夹版与 portable 单文件版主窗口 smoke；
- 真实 WorkerW attach/detach、40%/85%/100% 透明度、普通窗口覆盖、托盘恢复与重启恢复；
- 100%、125%、150% Windows 缩放下的工具条、月历和四象限无截断；
- `FourQuadrantJournal-0.3.0-green-folder.zip` 完整性、必需 payload、中文 `使用说明.txt` 与敏感内容排除；
- 绿色版 ZIP 与单文件 EXE 的 SHA-256；
- release workflow、artifact upload、release/tag 最终状态。

以上 Windows 项由主控远程执行并回填真实结果与哈希。在它们通过前，0.3.0 不满足最终发布完成标准。

## 已知限制

AI 功能目前仅保留入口，未提供在线能力；应用业务代码保持离线运行。
