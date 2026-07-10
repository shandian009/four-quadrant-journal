# 四象日志

四象日志是一款纯本地 Windows 桌面效率软件，将四象限事项、月历、每日复盘、专注计时和系统提醒整合到同一个工作台。周一至周五会根据工作情绪自动切换五套皮肤，用户也可以手动覆盖。

## 功能

- 四象限事项管理：添加、完成、恢复、删除和跨象限移动
- 月历选日与当天事项联动
- 今日收获、待改进、明日重点三栏复盘，500ms 自动保存
- 可暂停、可恢复的专注计时
- Windows 通知、稍后 10 分钟和系统托盘
- 五套工作日情绪皮肤及手动覆盖
- SQLite 纯本地数据、完整备份、哈希校验和恢复快照

## 开发

要求 Node.js 22 或更高版本。Node.js 只用于开发和打包，最终安装版不要求用户安装 Node.js。

```bash
npm install
npm run verify
npm start
```

## Windows 安装包

在 Windows 10/11 64 位环境运行：

```bash
npm run dist:win
```

输出文件位于 `release/FourQuadrantJournal-0.1.0-win-x64.exe`。

## 数据位置

业务数据保存在 Electron 的 Windows 用户数据目录中，主数据库名为 `journal.db`。软件不需要账号，不进行云同步，也不发起业务网络请求。

## 测试

- `npm test`：单元与集成测试
- `npm run test:e2e`：Electron 端到端重启持久化测试
- `npm run verify`：类型、测试、构建、主题令牌与离线检查
