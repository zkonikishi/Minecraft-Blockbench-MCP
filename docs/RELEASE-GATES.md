# 发布收尾与验收门槛

当前冻结新功能，保持 Alpha；未满足以下门槛之前不标 RC 或正式版。

## 自动检查

- `npm run check`：类型检查、集成回归、构建。
- `npm run test:upstream`：上游适配回归。
- `npm audit --omit=dev --audit-level=moderate`：生产依赖安全检查。无告警不等于没有漏洞。
- `node --env-file=.env scripts/doctor.mjs`：实际 MCP 初始化、目录检查、编辑器只读调用。未连接不能显示 ready。

## 可复现安装包验收

```powershell
node scripts/stage-release.mjs D:/releases/new-stage D:/builds/current
npm ci --omit=dev --ignore-scripts --prefix D:/releases/new-stage
node scripts/verify-release.mjs D:/releases/new-stage
```

打包使用明确白名单，包含 relay、预编译插件、YSM WASM/转换器、用户脚本、依赖锁和许可证；不复制工作区 `.env`、样本、node_modules 或缓存。目录必须是仓库外的新目录；失败时保留现场，使用新目录重跑。

`manifest.json` 记录各文件 SHA-256；校验脚本检查完整性后在随机 loopback 端口启动独立服务，使用包内依赖执行 SDK 初始化和离线工具调用。不连接或代替真实编辑器。这只是 staging，不会创建 GitHub Release。

## 人工 / 实机门槛

| 门槛 | 当前状态 |
|---|---|
| 类型、构建、83 项项目回归 | 已通过本地检查 |
| 上游适配测试 | 已通过本地检查 |
| 生产依赖审计 | 更新 SDK/AJV/ws 后 0 项告警 |
| Web 编辑器连接、重连、视觉及完整编辑流程 | 阻塞：编辑器桥接断开 |
| Desktop 同等流程及撤销恢复 | 待实机验收 |
| BetterModel / ModelEngine / CraftEngine 引擎流程 | 待对应版本实机验收 |
| 升级回滚、稳定运行与 CI 多平台矩阵 | 待本轮证据收齐 |

实验性 YSM 恢复、链式动画和视觉诊断与稳定编辑功能分开描述。完成代码不等于渲染或游戏验收。

升级前保存编辑器工程、备份 relay 配置和旧插件。停止本项目 relay 后更换整个版本目录、安装锁定依赖、重新启动并运行 doctor；最后加载匹配的新插件。回滚恢复旧目录、原配置与插件，不覆盖模型工程。不混用新版 relay 与旧版插件宣称新功能可用。
