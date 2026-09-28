# Minecraft Blockbench MCP

[![Release](https://img.shields.io/github/v/release/zkonikishi/Minecraft-Blockbench-MCP?include_prereleases)](https://github.com/zkonikishi/Minecraft-Blockbench-MCP/releases)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

[English](README.md) | **简体中文**

**当前发布：`1.0.0`。** 所有自动化门槛均已通过，CI 为 **7 个任务的矩阵**（ubuntu /
windows / macos × Node 22、24，外加 ubuntu × Node 26）：类型检查、构建、85 项项目回归
测试、117 项上游测试、生产依赖审计无告警，以及发布包校验。
**编辑器、引擎、升级回滚与稳定运行均已验收**：连接、自动重连、视觉截图、撤销恢复与完整
编辑流程，在 Blockbench 5.2.1 Web 与已安装的 Blockbench 5.1.6 Desktop 上均通过；导出的
模型在 Paper + ModelEngine R4.2.0 / CraftEngine 26.9.2-SNAPSHOT / BetterModel 3.5.0 上
成功加载并生成资源包；从已发布的 `v0.1.0-alpha.10` 升级与回滚都保留了打开的工程与 token；
15 分钟浸泡 + 9 次 relay 重启无失败、无句柄泄漏、无内存增长。
**图形客户端观感不在 `1.0.0` 的验收范围内**，作为已知限制列出，见
[发布门槛](docs/RELEASE-GATES.md)。

让 AI 在 **Blockbench 桌面版与 Web 版**中制作 Minecraft 模型、贴图和骨骼动画，
并对接 **BetterModel、ModelEngine、CraftEngine**。

一个 Blockbench 插件、一个本地 MCP 服务，共用串行执行队列。当前 `Alpha` 分支提供
**254 个默认 Web 编辑器工具**（启用 Advanced 后 **261 个**），另有 **2 个离线 YSM
工具**，因此默认 Web 客户端 `tools/list` 看到 **256 个**；桌面版为 **267 个**
（启用 Advanced 后 **274 个**），并另有文件相关能力。实际可用工具以连接后的
`tools/list` 为准。

## 本次发布内容

- **上游同步。** Jason `blockbench-mcp-plugin` v1.9.3、sosadly `blockbench-mcp` 与
  OpenYSM/YSMParser v0.3.6 均固定在当前提交；SwagRee 已是最新。vendored 源码与这些
  提交逐字节一致。
- **可校验的发布包。** 暂存包现在包含 98 个依赖许可证文件、`SHA256SUMS`、GPL 正文与
  第三方通知；缺失任何一项，校验门禁都会失败。
- **可复现的上游锁定。** `upstream-lock.json` 记录上游源码自身的 SHA-256，覆盖 273 个
  文件，快照可随时与上游重新比对。
- **编辑器与引擎均已验收。** 连接、自动重连、视觉截图、撤销恢复与完整编辑流程，在
  Blockbench 5.2.1 Web 与已安装的 Blockbench 5.1.6 Desktop 上均通过；导出的模型在
  Paper + ModelEngine R4.2.0 / CraftEngine 26.9.2-SNAPSHOT / BetterModel 3.5.0 上成功
  加载并生成资源包。
- **版本单一来源。** 插件、relay 与 `mc_status` 的版本号全部来自 `package.json`。
- **YSM 离线恢复。** `mc_ysm_inspect` / `mc_ysm_recover` 与离线 CLI 可从 `.ysm` 容器
  恢复 `.bbmodel`、贴图与骨骼动画，无需启动 Minecraft、YSM Mod 或编辑器。
- **动画与视觉复核。** 只读动画诊断、带 dry-run 的骨骼链变体、可播放的连续帧图册，
  以及 6 个公共视觉工具（多视角、局部特写、贴图/UV、动画逐帧、前后对比）。

## 可以做什么

| 方向 | 当前能力 |
| --- | --- |
| 生物建模 | 立方体与网格编辑、多层骨骼、翅膀、尾巴、下颚、挂点和可编辑骨架草模 |
| 贴图与预览 | UV 排布、像素绘制、多视角截图、按当前动画姿态取景 |
| 骨骼动画 | 关键帧、镜像与相位、Molang/Bezier 数据、IK 控制点、姿态预览 |
| BetterModel / ModelEngine | 引擎规范检查、碰撞箱与眼高、骨骼标签、分别导出内嵌贴图的 `.bbmodel` |
| CraftEngine | 静态物品与家具蓝图、动态家具的引擎模型引用、资源包合并配置方案 |
| 模型导入 | 原生 `.bbmodel` JSON 导入；OptiFine CEM/JEM 几何与 UV 导入，保留已有工程 |
| 连接与大文件 | 自动重连、共享执行队列、128 MiB 桥接响应上限 |

骨架模板是制作起点，动画槽需要写入真实关键帧。寻路、战斗 AI 和技能逻辑仍由游戏或
服务器插件负责。

## 引擎支持范围

| 目标 | MCP 负责 | 运行时依赖与边界 |
| --- | --- | --- |
| BetterModel | 生物骨骼、动画制作、规范检查与模型导出 | 服务器安装 BetterModel；行为与技能由服务器侧实现 |
| ModelEngine | 生物骨骼、动画、碰撞箱、标签检查与模型导出 | 服务器安装 ModelEngine；具体特性按目标版本检查 |
| CraftEngine | 静态物品 / 家具蓝图、动态家具模型引用与资源包合并方案 | CE 负责生成与分发资源包；动态模型依赖 BetterModel / ModelEngine |
| YSM | 离线容器解析、bbmodel 恢复与差异报告 | 已验证三个容器族代表样本，运行时语义有边界 |
| 时装工坊 | 已登记离线恢复路线 | 当前没有转换器或可用导入接口 |

## 快速开始

需要 **Node.js 22+**、**Blockbench 5.1+**，以及支持 **Streamable HTTP MCP +
Bearer 请求头**的 AI 客户端。Web 编辑器同样需要本机运行 MCP 服务。

### 1. 安装并启动服务

```powershell
git clone --branch Alpha https://github.com/zkonikishi/Minecraft-Blockbench-MCP.git
cd Minecraft-Blockbench-MCP
npm.cmd ci --ignore-scripts
npm.cmd run build
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

将生成的随机值填入 `.env` 的 `MINECRAFT_BLOCKBENCH_TOKEN`，然后启动：

```powershell
npm.cmd start
```

也可使用发布页的运行 ZIP：解压、安装依赖并配置 `.env` 后启动，包内已有编译好的
`dist/minecraft_blockbench_mcp.js`。单独下载插件 JS 不能代替本地服务。

发布页会为每个产物列出 SHA-256 摘要，因此无需额外的校验文件即可核对下载。ZIP 包内的
`manifest.json` 记录了全部 156 个文件的 SHA-256，`dist/SHA256SUMS` 覆盖插件 bundle；
安装依赖后可执行 `node scripts/verify-release.mjs <解压目录>` 重新校验整份清单。

### 2. 连接 Blockbench

1. 打开 **文件 → 插件 → 从文件加载插件**，选择 `dist/minecraft_blockbench_mcp.js`。
2. 在设置中找到 **Minecraft MCP token**，填入与服务端相同的值。
3. 保持 bridge URL 为 `ws://127.0.0.1:39800/bridge`。
4. 点击 **工具 → Connect Minecraft MCP**。

Web 版使用相同的文件加载方式。Blockbench 的插件 URL 安装器不接受普通 HTTP 地址；
文件安装的插件也不会自动跨页面重载持久保存。本地 Web 主机可参考
[持久加载与重连说明](docs/LOCAL-WEB-LIFECYCLE.md)。

升级时更新插件和 relay 源码，并重启 relay；已有 token 可继续使用。修改工具设置后
重新连接并刷新客户端工具列表。

### 3. 配置 AI 客户端

以下是连接信息，不同客户端的配置字段可能不同：

```json
{
  "url": "http://127.0.0.1:39800/mcp",
  "headers": {
    "Authorization": "Bearer YOUR_RANDOM_TOKEN"
  }
}
```

连接后调用 `mc_status` 检查版本、当前工程和工具数量。服务仅监听本机回环地址，云端
客户端无法直接访问你电脑的 `127.0.0.1`。一个 relay 同时连接一个编辑器窗口。

### 4. 确认真正连通

MCP 服务启动、客户端发现工具、Blockbench 编辑器连接是三个独立环节。以 `mc_status`
成功返回编辑器状态为准，单纯看到工具列表不代表可以操作模型。

| 现象 | 检查方法 |
| --- | --- |
| 客户端无法连接 MCP | 确认本机服务正在运行、URL 与端口一致、Bearer token 正确 |
| 能列出工具，但提示编辑器未连接 | 在 Blockbench 加载插件，核对 bridge URL 与 token，再执行 Connect Minecraft MCP |
| Web 页面刷新后工具不可用 | 重新加载插件，或按本地 Web 主机说明配置持久加载 |
| 另一编辑器窗口连接失败 | 一个 relay 只连接一个编辑器；先断开原窗口，或继续使用原窗口 |
| 大模型操作超时 | 先检查编辑器中的工程与操作结果，避免重复导入或重复创建 |

## 示例请求

连接后可以直接对 AI 描述目标，例如：

- “制作一个用于 BetterModel 的四足生物，包含下颚、尾巴骨骼和 idle / walk 动画，
  检查后导出。”
- “检查当前模型是否符合 ModelEngine，列出骨骼、贴图和动画问题，修复后分别导出两个
  引擎版本。”
- “把当前 Java Block 模型导出为 CraftEngine 静态家具内容包，并生成资源包合并方案。”

这些是制作任务示例，最终结果仍需预览与引擎验证；AI 不会仅凭骨架模板自动获得完整
动作或战斗行为。

## 三条制作流程

### BetterModel / ModelEngine 生物

先调用 `mc_get_workflow`、`mc_engine_profile`，再创建或导入工程：

1. `mc_create_project` / `mc_import_bbmodel` → 建模与贴图。
2. 编写骨骼动画，使用预览工具检查动作。
3. `mc_audit_model` → 修复目标引擎的兼容性问题。
4. `mc_export_bbmodel` / `mc_export_engine_variants` → 导出。

`target: "both"` 使用保守的共同规则，不表示所有引擎特性都能互转。ModelEngine 的
`animation.override` 必须是布尔值；校验会报告错误，不会擅自补写。详见
[兼容性说明](docs/COMPATIBILITY.md)与[工作流工具](docs/WORKFLOW-TOOLS.md)。

### CraftEngine 物品与家具

调用 `mc_craftengine_profile` 查看范围，再用 `mc_craftengine_export` 生成 CE 内容包
文件清单：

- 静态模型使用 Java Block/Item 工程、逐面 UV 和内嵌 PNG，由 CE 蓝图功能生成资源包
  模型。
- 动态家具引用已安装的 BetterModel / ModelEngine 模型，动画仍由对应引擎负责。
- `mc_craftengine_pack_plan` 生成保留已有条目的合并方案，沿用 CE 的发包流程。

发布包附带内容包安装脚本，支持预检并拒绝覆盖已有目录。MCP 不会自动上传资源包或修改
服务器凭据。完整参数、安装与重载方法见 [CraftEngine 使用说明](docs/CRAFTENGINE.md)。

### 已有模型导入

- `mc_import_bbmodel`：传入解析后的模型 JSON，通过原生 codec 新建工程，要求内嵌
  PNG。[参数与限制](docs/JSON-IMPORT.md)
- `mc_import_cem`：传入 JEM JSON，恢复原生几何与 UV，移除纹理路径并拒绝外部 JPM
  引用；不转换 CEM 动画表达式。[参数与限制](docs/CEM-IMPORT.md)

工具参数以 `tools/list` 返回的 schema 为准。编辑期间避免切换工程；长操作超时后应先
检查编辑器状态再决定是否重试。

## 验证情况

当前可复现的自动化验证：

| 范围 | 通过内容 |
| --- | --- |
| 项目回归 | `npm run check` —— 类型检查、构建与 85 项测试 |
| 上游适配 | `npm run test:upstream` —— 117 项测试（69 项 shared/host/startup + 48 项 sosadly） |
| 依赖审计 | `npm audit --omit=dev --audit-level=moderate` —— 0 项告警 |
| 发布门禁 | `scripts/stage-release.mjs` + `scripts/verify-release.mjs` —— 暂存 156 个文件，断言许可证与校验和 |
| 上游锁定 | 每个 vendored 文件都与固定的上游提交一致（273 个文件） |
| Web 编辑器实机 | HTTPS 下的 Blockbench 5.2.1 Web：连接成功（`mode: web`，254 个工具）、relay 重启后约 2 秒自动重连、`craft_capture_views` 返回 PNG、`live-workflow` 44/44 次调用通过 |
| Desktop 编辑器实机 | 已安装的 Blockbench 5.1.6 Desktop（`isApp: true`，`Origin: file://`）：269 个工具、撤销恢复断言、`live-workflow` 44/44 次调用、0 未捕获异常 |
| 引擎实机 | 隔离 Paper 26.3 build 49 + ModelEngine R4.2.0 / CraftEngine 26.9.2-SNAPSHOT / BetterModel 3.5.0：ModelEngine 导入导出的 blueprint、BetterModel 把 13 个骨骼模型打进 `build.zip`、CraftEngine 生成的资源包含 `assets/mcp_ce/*` |
| CI 多平台矩阵 | 7 个任务全绿：ubuntu / windows / macos × Node 22、24，外加 ubuntu × Node 26 |
| 升级与回滚 | 从线上 `v0.1.0-alpha.10` 升级到 `1.0.0` 再回滚：打开的工程与 token 始终保留，模型形状完全一致，导入时返回 `previousProject` 不覆写 |
| 稳定运行 | 15 分钟浸泡：284 次调用 + 224 次并发调用 **0 失败**，9 次 relay 重启全部自愈，句柄 13→13、内存无增长 |

以下为历史验收记录，列出供参考：

| 范围 | 已完成的验证 |
| --- | --- |
| Alpha 8 本地 Web | 真实 SDK 连接、211 个工具、CE 导出与合并方案调用，当前工程保持不变 |
| CraftEngine 26.8.2 | 使用 Paper 26.2-121 在隔离环境完成内容加载、资源包生成、验证与压缩 |
| 桌面 Blockbench 5.1.6 | 先前版本已通过真实连接与 44 次制作流程调用 |
| BetterModel 3.4.1 / ModelEngine R4.1.1 | 先前隔离测试已通过模型导入、资源包生成与显示实体数据验证 |

这些记录不代表每个工具、每个模型或未来引擎版本均已验收。上表中的引擎流程是**服务端**验收
——在隔离 Paper 服务器上完成模型导入与资源包生成，并非在运行中的客户端里目视确认。
**图形 Minecraft 客户端效果与实际 Beta 上传尚未验收。** 详见
[引擎运行记录](docs/RUNTIME-ACCEPTANCE.md)与
[CE 验收范围](docs/CRAFTENGINE.md#acceptance-and-boundaries)。

## 开发与工具来源

```powershell
npm.cmd run check
npm.cmd run test:upstream
# 以下操作会在专用测试编辑器中新建工程：
npm.cmd run test:live -- --confirm-disposable
node scripts/live-workflow.mjs --confirm-disposable
# Web 编辑器实机验收，在无头浏览器中运行（一次性安装：npm i playwright-core）：
$env:MINECRAFT_BLOCKBENCH_TOKEN = '<你的 relay token>'
npm.cmd run test:web
```

`BLOCKBENCH_BUILD_DIR` 与 `BLOCKBENCH_TEST_DIR` 可分别指定构建及测试产物目录。原始
上游快照由 `upstream-lock.json` 锁定，适配代码位于 `src/` 和 `scripts/`。详见
[架构说明](docs/ARCHITECTURE.md)。

| 工具前缀 | 来源 |
| --- | --- |
| `craft_*` | [SwagRee/BlockBenchMCP](https://github.com/SwagRee/BlockBenchMCP) |
| `studio_*` | [jasonjgardner/blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin) |
| `anim_*` | [sosadly/blockbench-mcp](https://github.com/sosadly/blockbench-mcp) |
| `mc_*` | 本项目的 Minecraft 工作流、引擎适配、导入与导出工具 |

高级脚本执行、通用 UI 控制与插件管理默认关闭，需在本地编辑器设置中启用。启用后获得
的是本机编辑器权限，不是受限沙箱。

## 后续计划

YSM 离线恢复已在本发布线实现，**时装工坊（AM/AW）仍未实现。** 后续完善 YSM 更多
格式与样本覆盖、动画控制器和复杂材质映射。见 [YSM 范围](docs/YSM.md)与
[开发路线](docs/ROADMAP.md)。

## 许可证

**GPL-3.0-only**。保留四个上游的作者与许可信息，分发时请同时提供对应源码、许可证与
[第三方通知](THIRD_PARTY_NOTICES.md)。详见 [LICENSE](LICENSE)。

本项目并非 Blockbench、BetterModel、ModelEngine 或 CraftEngine 官方产品。
