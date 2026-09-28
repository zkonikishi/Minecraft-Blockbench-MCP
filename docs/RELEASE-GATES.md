# 发布收尾与验收门槛

**当前状态：`1.0.0-rc.1` 已发布（候选版）。** 代码与上述自动化门槛已冻结；下表的人工 /
实机门槛**全部通过之后**才发布 `1.0.0` 正式版。候选版不等于正式版：它表示功能与打包已
完成、等待实机验收，不代表渲染、游戏内效果或引擎兼容性已经验收。

`rc` 期间只接受缺陷修复与验收证据，不新增功能或扩展现有工具族。

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

打包使用明确白名单，包含 relay、预编译插件、YSM WASM/转换器、用户脚本、依赖锁、双语 README 和许可证；不复制工作区 `.env`、样本、node_modules 或缓存。目录必须是仓库外的新目录；失败时保留现场，使用新目录重跑。

`scripts/build.mjs` 生成到 `dist/`：`minecraft_blockbench_mcp.js`、`LICENSE`、`THIRD_PARTY_NOTICES.md`、`SHA256SUMS` 和 `licenses/`（98 个依赖许可证文件，含 `sosadly-MIT.txt` 与 `dependency-inventory.json`）。`scripts/stage-release.mjs` 暂存整个 `dist/` 目录，发布包因此包含上述全部文件（暂存结果共 155 个文件）；`scripts/verify-release.mjs` 断言发布包含有这些许可证与校验和产物，并核对 `dist/SHA256SUMS` 与暂存包一致。

`manifest.json` 记录各文件 SHA-256；校验脚本检查完整性后在随机 loopback 端口启动独立服务，使用包内依赖执行 SDK 初始化和离线工具调用。不连接或代替真实编辑器。这只是 staging，不会创建 GitHub Release。

## 人工 / 实机门槛

已通过（自动化，可复现）：

| 门槛 | 状态 |
|---|---|
| 类型检查、构建、85 项项目回归 | 已通过本地检查 |
| 上游适配测试（117 项） | 已通过本地检查 |
| 生产依赖审计 | 0 项告警 |
| 暂存包校验（155 个文件、许可证与校验和） | 已通过本地检查 |
| 上游锁定一致性（273 个文件逐个比对） | 已通过本地检查 |

**发布 `1.0.0` 正式版之前必须完成：**

| 门槛 | 当前状态 |
|---|---|
| Web 编辑器连接、重连、视觉及完整编辑流程 | **阻塞：编辑器桥接断开**。根因已定位：本地 Web 编辑器宿主是一个**仓库之外**的独立 Blockbench checkout，位于构建缓存目录下，已被缓存清理删除；编辑器因此从未启动，与 relay 是否健康无关。详见[本地 Web 生命周期](LOCAL-WEB-LIFECYCLE.md) |

> 编辑器桥接的三类失败（relay 不可达 / 编辑器宿主未服务 / 编辑器宿主正常但插件未连接）现在由
> `node --env-file=.env scripts/doctor.mjs` 分别报告，各有明确处置建议，不再只给出一行“断开”。
> 解除该阻塞有两条路：使用官方 Web 编辑器并每次从文件加载插件，或恢复本地 Web 宿主。
| Desktop 同等流程及撤销恢复 | 待实机验收 |
| BetterModel / ModelEngine / CraftEngine 引擎流程 | 待对应版本实机验收 |
| 图形 Minecraft 客户端效果与资源包上传 | 未验收 |
| 升级回滚、稳定运行与 CI 多平台矩阵 | 待本轮证据收齐 |

`1.0.0-rc.1` 同步了上游 Jason v1.9.3 与 YSMParser v0.3.6。上游代码使用了更多 Blockbench
原生 API，本仓库的自动化测试已按真实 API 形状更新，但**这批改动尚未在真实编辑器中运行
过**；实机验收之前不能据此宣称可用。

实验性 YSM 恢复、链式动画和视觉诊断与稳定编辑功能分开描述。完成代码不等于渲染或游戏验收。

升级前保存编辑器工程、备份 relay 配置和旧插件。停止本项目 relay 后更换整个版本目录、安装锁定依赖、重新启动并运行 doctor；最后加载匹配的新插件。回滚恢复旧目录、原配置与插件，不覆盖模型工程。不混用新版 relay 与旧版插件宣称新功能可用。
