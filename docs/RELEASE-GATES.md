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

`scripts/build.mjs` 生成到 `dist/`：`minecraft_blockbench_mcp.js`、`LICENSE`、`THIRD_PARTY_NOTICES.md`、`SHA256SUMS` 和 `licenses/`（98 个依赖许可证文件，含 `sosadly-MIT.txt` 与 `dependency-inventory.json`）。`scripts/stage-release.mjs` 暂存整个 `dist/` 目录，发布包因此包含上述全部文件（暂存结果共 156 个文件）；`scripts/verify-release.mjs` 断言发布包含有这些许可证与校验和产物，并核对 `dist/SHA256SUMS` 与暂存包一致。

`manifest.json` 记录各文件 SHA-256；校验脚本检查完整性后在随机 loopback 端口启动独立服务，使用包内依赖执行 SDK 初始化和离线工具调用。不连接或代替真实编辑器。这只是 staging，不会创建 GitHub Release。

## 人工 / 实机门槛

已通过：

| 门槛 | 证据 |
|---|---|
| 类型检查、构建、85 项项目回归 | `npm run check` |
| 上游适配测试（117 项） | `npm run test:upstream` |
| 生产依赖审计 | `npm audit --omit=dev --audit-level=moderate`，0 项告警 |
| 暂存包校验（156 个文件、许可证与校验和） | `scripts/stage-release.mjs` + `scripts/verify-release.mjs` |
| 上游锁定一致性（273 个文件逐个比对） | 与固定上游提交逐字节一致 |
| **Web 编辑器连接、重连、视觉及完整编辑流程** | **已实机通过**，证据见下表 |
| **Desktop 同等流程及撤销恢复** | **已实机通过**，证据见下表 |
| **BetterModel / ModelEngine / CraftEngine 引擎流程** | **已实机通过**，证据见下表 |

Web 实机验收记录：

| 项目 | 实测证据 |
|---|---|
| 编辑器 | Blockbench **5.2.1 Web**，来源 `https://web.blockbench.net`（HTTPS，`isSecureContext=true`） |
| 桥接 | `ws://127.0.0.1:39800/bridge` 在 **7 ms** 内 OPEN。loopback 属于“潜在可信来源”（Secure Contexts 规范：主机 `127.0.0.0/8`、`::1/128`、`localhost`），HTTPS 页面打开它不属于混合内容，浏览器不拦 |
| 连接 | `mc_status` → `mode: web`、`version: 1.0.0-rc.1`、**254** 个工具（`tools/list` 256） |
| 重连 | 停止并重启 relay 后，编辑器在约 **2 秒**内**自行重连**，编辑器侧无需任何操作 |
| 视觉 | `craft_capture_views` 返回 `image/png`（25,260 字节） |
| 完整编辑流程 | `scripts/live-workflow.mjs --confirm-disposable` 共 **44 次调用全部通过，退出码 0**：建模、贴图与 UV、关键帧与镜像、重连预览、撤销/重做、碰撞箱、控制节点、脚本关键帧、集合、引擎变体导出与截图 |

复现方式：`MINECRAFT_BLOCKBENCH_TOKEN=<token> node scripts/web-acceptance.mjs`（需要
`npm i playwright-core` 与一个 Chromium 系浏览器；见[本地 Web 生命周期](LOCAL-WEB-LIFECYCLE.md)）。

Desktop 实机验收记录（隔离 `--userData` 配置，未触碰真实编辑器数据）：

| 项目 | 实测证据 |
|---|---|
| 应用 | 已安装的 **Blockbench 5.1.6 Desktop**（Electron 40.10.6 / Node 24.15.0），CDP 上报 `isApp: true` |
| 桥接 Origin | WebSocket 握手 `Origin: file://` —— 与 Alpha 4 的验收项一致，安装版会发本地文件来源 |
| 连接 | 编辑器弹出 “Minecraft Blockbench MCP connected”；`mc_status` → 桌面模式、**269** 个工具（桌面默认 267 + 2 个 YSM） |
| 撤销恢复 | `live-workflow.mjs` 内的 `studio_undo` / `studio_redo` 断言全部通过（重父级后世界变换不变、脚本关键帧与集合的回滚/重做） |
| 完整编辑流程 | 同一次运行 **44 次调用全部通过，退出码 0** |
| 运行时异常 | **0** 个未捕获异常（4 条控制台日志为 Electron/Three.js/Blockbench 版本与更新提示） |

复现方式：`BLOCKBENCH_TEST_DIR=<输出目录> MINECRAFT_BLOCKBENCH_PLUGIN_FILE=<构建产物>
node scripts/desktop-acceptance.mjs --confirm-isolated-desktop`，并先用隔离配置把编辑器拉起：

```powershell
# 关键：Electron 程序若继承了 ELECTRON_RUN_AS_NODE=1 会退化成纯 Node 并立刻退出
Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
& 'C:\Path\To\Blockbench.exe' --userData D:\temp\bb-profile --remote-debugging-port=39803
```

三个引擎实机验收记录（隔离 Paper 服务器，未触碰生产服务与真实编辑器数据）：

| 项目 | 实测证据 |
|---|---|
| 服务端环境 | **Paper 26.3 build 49** + **ModelEngine R4.2.0** + **CraftEngine 26.9.2-SNAPSHOT** + **BetterModel 3.5.0**（官方 paper 构建，下载后 sha256 与 GitHub 公布值一致），JDK 25.0.4.1 |
| 导出物来源 | 通过 MCP 在**真实连接的 Blockbench Web 编辑器**上生成：`mc_export_engine_variants` 产出 BetterModel / ModelEngine 两个 `.bbmodel`（16 元素、17 骨骼、6 个动画、内嵌 PNG）；`mc_craftengine_export` 产出 CraftEngine 内容包清单 |
| ModelEngine | 日志 `[ModelEngine] [A] Importing mcp_acceptance.bbmodel.` → `Resource pack zipped.` → `Generator Profiled:` —— blueprint 被导入并打包 |
| BetterModel | `plugins/BetterModel/build.zip`（2,157,380 字节 / 5,912 条目）中含 **13 个** `assets/bettermodel/items/c/mcp_acceptance_<骨骼>.json`（body / head / jaw / 双翼 / 四足全部展开） |
| CraftEngine | 启动日志 `已加载的包：blockbench_mcp。默认命名空间：mcp_ce`；执行 `ce reload all` 后完成 **生成 → 验证 → 压缩 → 上传** 四个阶段；`generated/resource_pack.zip`（2,572,112 字节 / 6,591 条目）内含 `assets/mcp_ce/{items/acceptance_cube.json, models/item/acceptance_cube.json, textures/item/acceptance_cube.png}` |
| 错误 | 三引擎加载与资源包生成过程**零错误、零异常** |

**发布 `1.0.0` 正式版之前仍需完成：**

| 门槛 | 当前状态 |
|---|---|
| 图形 Minecraft 客户端效果与资源包上传 | 未验收（需要图形客户端实际观感确认） |
| 升级回滚、稳定运行与 CI 多平台矩阵 | 待本轮证据收齐（CI 多平台部分已在 4 个矩阵任务上通过） |

`1.0.0-rc.1` 同步了上游 Jason v1.9.3 与 YSMParser v0.3.6，此前这批改动从未在真实编辑器中
运行过。**Web、Desktop 与三个引擎的实机验收都在同步后的构建上完成**：连接、重连、撤销恢复、
完整编辑流程、截图、引擎模型导入与资源包生成全部通过。图形客户端观感仍未验收。

实验性 YSM 恢复、链式动画和视觉诊断与稳定编辑功能分开描述。完成代码不等于渲染或游戏验收。

升级前保存编辑器工程、备份 relay 配置和旧插件。停止本项目 relay 后更换整个版本目录、安装锁定依赖、重新启动并运行 doctor；最后加载匹配的新插件。回滚恢复旧目录、原配置与插件，不覆盖模型工程。不混用新版 relay 与旧版插件宣称新功能可用。
