# 四象日志 0.3.0 测试报告

日期：2026-07-13  
状态：源码验证、Windows 打包、目录版 E2E、单文件启动和产物校验通过

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

## Windows 发布验收

GitHub Actions 正式发布运行 `29220282286` 在 Windows runner 上完成，结论为 `success`；验证对象为提交 `b56835b1742153ce9fe4d877775993e342748ec3`。

- self-contained `desktop-host.exe` 编译成功，并位于 `resources/app.asar.unpacked/build/desktop-host.exe`。
- unpacked 目录版 E2E 通过：工作台可见、创建事项、一键切换皮肤、切换月份、关闭重启后数据仍可见。
- portable 单文件真实启动通过：进程启动后检测到标题为“四象日志”的可见主窗口。
- desktop mode 门禁严格调用真实 helper；托管 runner 返回“找不到 WorkerW 桌面层”，确认测试机没有交互式桌面层后按环境限制跳过。其他 helper 错误仍会导致发布失败。真实 WorkerW attach/detach 与透明度仍需在已登录的普通 Windows 桌面最终验收。
- 绿色目录准备和 GitHub artifact 上传通过。

发布前定向检查还包括：workflow 静态测试 7/7 通过，定向 typecheck 通过。

## 产物校验

GitHub artifact 摘要：`sha256:a481988502b864cf09173594f102ce94903c8500d023963d9ea66504035a83af`。

- `FourQuadrantJournal-0.3.0-green-folder.zip`：ZIP 完整性通过，198,942,946 bytes，SHA-256 `42cdf5ec703051da4d1d0cb7088f67725ccee2140a6ffcf3127ac222be77ab6c`。
- `FourQuadrantJournal-0.3.0-win-x64.exe`：76,283,904 bytes，SHA-256 `72515313007b0570b8b1504cf90df44d29eef39cab389cb57284a3c673bcea58`。
- 绿色 ZIP 具备顶层版本目录、主程序、`locales/zh-CN.pak`、`resources/app.asar`、`desktop-host.exe` 和使用说明。
- 未发现用户数据库、测试数据库、`.env` 或 API 密钥文件。

PR #4 已合并到 `main`，合并提交为 `d73454cba2c426a66ebf2ee939ea3ee5c6b5943e`。

## 已知限制

AI 功能目前仅保留入口，未提供在线能力；应用业务代码保持离线运行。系统托盘恢复、真实 WorkerW 嵌入及 40%/85%/100% 透明度需要在用户已登录的 Windows 桌面进行最终人工验收。

## 2026-07-17 六套皮肤任选与模板化周报验证

本轮只修改皮肤选择交互和本地周报生成逻辑，没有调整六套皮肤的名称、颜色令牌或渐变配置。

- 皮肤定向测试：3 个测试文件、13 项测试通过。
- 报告定向测试：2 个测试文件、14 项测试通过。
- TypeScript：`npm run typecheck` 退出码 0。
- 全量 Vitest：`npm test` 退出码 0，44 个测试文件、184 项测试通过，0 失败。
- 六皮肤一致性：`npm run verify:theme-parity` 退出码 0，输出“主题令牌一致：6 套皮肤”。
- 离线检查：`npm run verify:no-network` 退出码 0，输出“离线检查通过：未发现业务网络调用”。
- 生产构建：`npm run build` 退出码 0；Vite 与 tsup 均成功生成 renderer 和 Electron 产物。

功能断言包括：六套皮肤从任意当前状态直接选择、当前项标记、Escape 关闭、持久化失败重试和保存中防重复写入；周报六个固定栏目、260–340 汉字正常范围、真实事项与复盘引用、超长标题整项裁剪、空数据不虚构，以及原月报长度与结构回归。

## 2026-07-18 桌面模式恢复 0.3.3 验证

本轮针对“嵌入桌面后无法取消嵌入、无法进入设置和编辑事项”增加桌面层之外的独立恢复控制条，并统一所有外部唤醒入口。

- TypeScript：`npm run typecheck` 退出码 0。
- 全量 Vitest：`npm test` 退出码 0，47 个测试文件、205 项测试通过，0 失败。
- Renderer build：Vite 7.3.6 生产构建通过，49 个模块完成转换。
- Electron build：tsup 8.5.1 通过，生成主进程和 preload 产物。
- 六皮肤一致性：通过，六套原有皮肤令牌未改变。
- 离线扫描：通过，未新增业务网络调用或遥测。
- 定向回归：桌面窗口控制、恢复控制条、统一激活、托盘动作共 38 项测试通过。

功能断言包括：嵌入成功后创建唯一的外部“恢复并编辑”控制条；控制条创建失败立即回滚；连续恢复只解除一次原生挂载；托盘显示、托盘双击、快速添加、提醒通知、第二实例和 `Ctrl+Alt+J` 均先退出桌面模式再显示主窗口；快捷键冲突不影响程序启动；恢复失败时控制条保留以便重试。

Windows E2E 已改为从真实独立控制条退出 WorkerW，不再通过可能被桌面图标层拦截的主窗口按钮模拟恢复。Windows 构建运行编号、绿色版 ZIP 完整性和 SHA-256 将在发布流水线成功后补充。
