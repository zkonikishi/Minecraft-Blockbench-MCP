# 发布收尾与验收门槛

**当前状态：`1.1.0` 已发布。** 下表的人工 / 实机门槛中，Web、Desktop、三个引擎、升级
与回滚、稳定运行、CI 多平台矩阵均已通过。**图形 Minecraft 客户端观感未纳入本版本的
验收范围**，作为已知限制写在下方；它不是服务端或编辑器侧的缺陷。

验收证据中出现的 `1.0.0-rc.1` 是本次实机验收所用的构建。`1.0.0` 与该构建**仅差版本
常量** —— 把版本串还原后两者逐字节相同 —— 因此这些结论同样适用于 `1.0.0`。

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
| 暂存包校验（158 个文件、许可证与校验和） | `scripts/stage-release.mjs` + `scripts/verify-release.mjs` |
| 上游锁定一致性（428 个文件逐个比对） | 与固定上游提交逐字节一致 |
| **Vendored Jason 上游测试套件** | **1035/1035 通过**（76 个文件），用 `bun test` 原样运行 |
| **CI 多平台矩阵** | **10 个任务**：7 个平台/Node 检查 + 3 个上游套件任务，全部通过 |
| **Web 编辑器连接、重连、视觉及完整编辑流程** | **已实机通过**，证据见下表 |
| **Desktop 同等流程及撤销恢复** | **已实机通过**，证据见下表 |
| **BetterModel / ModelEngine / CraftEngine 引擎流程** | **已实机通过**，证据见下表 |
| **CI 多平台矩阵** | **7 个任务全部通过**：ubuntu / windows / macos × Node 22、24，外加 ubuntu × Node 26 |
| **升级与回滚** | **已实机通过**，证据见下表 |
| **稳定运行（15 分钟浸泡）** | **已通过**：284 次调用 + 224 次并发压测 **0 失败**，9 次 relay 重启全部自愈，句柄 +0、内存无增长 |

Web 实机验收记录：

| 项目 | 实测证据 |
|---|---|
| 编辑器 | Blockbench **5.2.1 Web**，来源 `https://web.blockbench.net`（HTTPS，`isSecureContext=true`） |
| 桥接 | `ws://127.0.0.1:39800/bridge` 在 **7 ms** 内 OPEN。loopback 属于“潜在可信来源”（Secure Contexts 规范：主机 `127.0.0.0/8`、`::1/128`、`localhost`），HTTPS 页面打开它不属于混合内容，浏览器不拦 |
| 连接 | `mc_status` → `mode: web`、`version: 1.1.0`、**264** 个工具（`tools/list` 266，Advanced 273） |
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
| 连接 | 编辑器弹出 “Minecraft Blockbench MCP connected”；`mc_status` → 桌面模式、**279** 个工具（桌面默认 277 + 2 个 YSM） |
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

升级与回滚实机验收记录（旧版 = 线上发布的 `v0.1.0-alpha.10` 产物；新版 = 本次暂存包）：

| 阶段 | 版本 | 工具数 | 打开工程 | 模型形状 |
|---|---|---|---|---|
| 基线（旧版，已建好的工程） | `0.1.0-alpha.10` | 235（`tools/list` 237） | `41ebf0f4…` | 10 元素 / 12 骨骼 / 6 动画 / 1 贴图 |
| **升级后（换 relay + 换插件）** | `1.0.0-rc.1` | 254（256） | **同一个工程** ✅ | **完全一致** ✅ |
| 旧版导出 → 新版导入 | `1.0.0-rc.1` | 254 | 新工程，并返回 `previousProject` 保留原工程 | 一致 |
| **回滚后（换回旧 relay + 旧插件）** | `0.1.0-alpha.10` | 235（237） | 工程完好 ✅ | 一致 |

- 同一个 token 跨越升级与回滚**始终有效**，无需重新配置
- 新版本导入时返回 `previousProject`，**不覆写**当前工程 —— 与文档规定一致
- 混合搭配（新 relay + 旧插件）不报错，但 `mc_status` 报告的是**插件**的版本与工具集（235 个），
  印证“不混用新版 relay 与旧版插件宣称新功能可用”这一条
- 旧版依赖树有 **3 项告警（1 中 2 高）**，新版本为 **0** —— 升级本身即是一次安全修复
- 已安装的旧版不支持“保存设置后自动重连”（该修复在 `f020f56`），升级后的版本支持；
  这也是升级前后需要手动点一次 Connect 的原因

稳定运行验收记录（15 分钟浸泡，真实 Blockbench Web 编辑器全程连接，本地 relay 同进程）：

| 指标 | 实测 |
|---|---|
| 时长与负载 | 902 秒内 **284 次** `mc_status` 调用；另有 28 轮 × 8 并发调用，压测共享串行执行队列 |
| 失败数 | **0** |
| relay 重启 + 自动重连 | **9 次重启，9 次由插件自行重连，0 失败**（每次约 2 秒内恢复） |
| 内存 | RSS 123.8 MB → 129.8 MB，全程在 124–135 MB 区间波动，**无单调增长** |
| 活跃句柄 | 13 → 13（**+0**，无句柄泄漏） |
| 结束时状态 | 编辑器仍处于连接状态 |

**本版本的已知限制**（不阻塞发布，但用户应当知道）：

| 项目 | 状态 |
|---|---|
| 图形 Minecraft 客户端观感与资源包上传 | **未验收** —— 需要真实图形客户端实际观看。服务端已确认模型被正确导入并生成了含目标资产的资源包，但“生成的资源包正确”不等于“屏幕上好看” |
| 小时级 / 天级长跑 | 未验证 —— 本轮为 15 分钟浸泡，见上表 |

`1.0.0` 同步了上游 Jason v1.9.3 与 YSMParser v0.3.6，此前这批改动从未在真实编辑器中
运行过。**Web、Desktop 与三个引擎的实机验收都在同步后的构建上完成**：连接、重连、撤销恢复、
完整编辑流程、截图、引擎模型导入与资源包生成全部通过，升级与回滚亦已完成。

实验性 YSM 恢复、链式动画和视觉诊断与稳定编辑功能分开描述。完成代码不等于渲染或游戏验收。

升级前保存编辑器工程、备份 relay 配置和旧插件。停止本项目 relay 后更换整个版本目录、安装锁定依赖、重新启动并运行 doctor；最后加载匹配的新插件。回滚恢复旧目录、原配置与插件，不覆盖模型工程。不混用新版 relay 与旧版插件宣称新功能可用。
