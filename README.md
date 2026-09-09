# Minecraft Blockbench MCP

让 AI 在 **Blockbench 桌面版与 Web 版**中制作 Minecraft 模型、贴图和骨骼动画，并对接 **BetterModel、ModelEngine、CraftEngine**。

**Alpha 8 · GPL-3.0-only · 开发分支 `Alpha`**

[下载发布包](https://github.com/zkonikishi/Minecraft-Blockbench-MCP/releases) · [Alpha 8 发布页](https://github.com/zkonikishi/Minecraft-Blockbench-MCP/releases/tag/v0.1.0-alpha.8) · [CraftEngine 接入](docs/CRAFTENGINE.md) · [开发路线](docs/ROADMAP.md)

一个 Blockbench 插件、一个本地 MCP 服务，共用串行执行队列。当前 Alpha 8 已实测 **211 个默认 Web 工具**；桌面版另有文件相关能力，实际可用工具以连接后的 `tools/list` 为准。

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

骨架模板是制作起点，动画槽需要写入真实关键帧。寻路、战斗 AI 和技能逻辑仍由游戏或服务器插件负责。

## 快速开始

需要 **Node.js 22+**、**Blockbench 5.1+**，以及支持 **Streamable HTTP MCP + Bearer 请求头**的 AI 客户端。Web 编辑器同样需要本机运行 MCP 服务。

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

也可使用发布页的运行 ZIP：解压、安装依赖并配置 `.env` 后启动，包内已有编译好的 `dist/minecraft_blockbench_mcp.js`。单独下载插件 JS 不能代替本地服务。

### 2. 连接 Blockbench

1. 打开 **文件 → 插件 → 从文件加载插件**，选择 `dist/minecraft_blockbench_mcp.js`。
2. 在设置中找到 **Minecraft MCP token**，填入与服务端相同的值。
3. 保持 bridge URL 为 `ws://127.0.0.1:39800/bridge`。
4. 点击 **工具 → Connect Minecraft MCP**。

Web 版使用相同的文件加载方式。Blockbench 的插件 URL 安装器不接受普通 HTTP 地址；文件安装的插件也不会自动跨页面重载持久保存。本地 Web 主机可参考[持久加载与重连说明](docs/LOCAL-WEB-LIFECYCLE.md)。

升级时更新插件和 relay 源码，并重启 relay；已有 token 可继续使用。修改工具设置后重新连接并刷新客户端工具列表。

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

连接后调用 `mc_status` 检查版本、当前工程和工具数量。服务仅监听本机回环地址，云端客户端无法直接访问你电脑的 `127.0.0.1`。一个 relay 同时连接一个编辑器窗口。

## 三条制作流程

### BetterModel / ModelEngine 生物

先调用 `mc_get_workflow`、`mc_engine_profile`，再创建或导入工程：

1. `mc_create_project` / `mc_import_bbmodel` → 建模与贴图。
2. 编写骨骼动画，使用预览工具检查动作。
3. `mc_audit_model` → 修复目标引擎的兼容性问题。
4. `mc_export_bbmodel` / `mc_export_engine_variants` → 导出。

`target: "both"` 使用保守的共同规则，不表示所有引擎特性都能互转。ModelEngine 的 `animation.override` 必须是布尔值；校验会报告错误，不会擅自补写。详见[兼容性说明](docs/COMPATIBILITY.md)与[工作流工具](docs/WORKFLOW-TOOLS.md)。

### CraftEngine 物品与家具

调用 `mc_craftengine_profile` 查看范围，再用 `mc_craftengine_export` 生成 CE 内容包文件清单：

- 静态模型使用 Java Block/Item 工程、逐面 UV 和内嵌 PNG，由 CE 蓝图功能生成资源包模型。
- 动态家具引用已安装的 BetterModel / ModelEngine 模型，动画仍由对应引擎负责。
- `mc_craftengine_pack_plan` 生成保留已有条目的合并方案，沿用 CE 的发包流程。

发布包附带内容包安装脚本，支持预检并拒绝覆盖已有目录。MCP 不会自动上传资源包或修改服务器凭据。完整参数、安装与重载方法见 [CraftEngine 使用说明](docs/CRAFTENGINE.md)。

### 已有模型导入

- `mc_import_bbmodel`：传入解析后的模型 JSON，通过原生 codec 新建工程，要求内嵌 PNG。[参数与限制](docs/JSON-IMPORT.md)
- `mc_import_cem`：传入 JEM JSON，恢复原生几何与 UV，移除纹理路径并拒绝外部 JPM 引用；不转换 CEM 动画表达式。[参数与限制](docs/CEM-IMPORT.md)

工具参数以 `tools/list` 返回的 schema 为准。编辑期间避免切换工程；长操作超时后应先检查编辑器状态再决定是否重试。

## 验证情况

| 范围 | 已完成的验证 |
| --- | --- |
| Alpha 8 自动检查 | 类型检查、47 项整合/协议/回归测试、构建通过 |
| Alpha 8 本地 Web | 真实 SDK 连接、211 个工具、CE 导出与合并方案调用，当前工程保持不变 |
| CraftEngine 26.8.2 | 使用与 Beta 相同的 Paper 26.2-121 / CE 版本，在隔离环境完成内容加载、资源包生成、验证与压缩 |
| 桌面 Blockbench 5.1.6 | 先前版本已通过真实连接与 44 次制作流程调用 |
| BetterModel 3.4.1 / ModelEngine R4.1.1 | 先前隔离测试已通过模型导入、资源包生成与显示实体数据验证 |

这些记录不代表每个工具、每个模型或未来引擎版本均已验收。**图形 Minecraft 客户端效果、Alpha 8 的实际 Beta 上传，以及 CE 动态家具的外部引擎渲染尚未完成本次验收。** 详见[引擎运行记录](docs/RUNTIME-ACCEPTANCE.md)与[CE 验收范围](docs/CRAFTENGINE.md#acceptance-and-boundaries)。

## 开发与工具来源

```powershell
npm.cmd run check
npm.cmd run test:upstream
# 以下操作会在专用测试编辑器中新建工程：
npm.cmd run test:live -- --confirm-disposable
node scripts/live-workflow.mjs --confirm-disposable
```

`BLOCKBENCH_BUILD_DIR` 与 `BLOCKBENCH_TEST_DIR` 可分别指定构建及测试产物目录。原始上游快照由 `upstream-lock.json` 锁定，适配代码位于 `src/` 和 `scripts/`。详见[架构说明](docs/ARCHITECTURE.md)。

| 工具前缀 | 来源 |
| --- | --- |
| `craft_*` | [SwagRee/BlockBenchMCP](https://github.com/SwagRee/BlockBenchMCP) |
| `studio_*` | [jasonjgardner/blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin) |
| `anim_*` | [sosadly/blockbench-mcp](https://github.com/sosadly/blockbench-mcp) |
| `mc_*` | 本项目的 Minecraft 工作流、引擎适配、导入与导出工具 |

高级脚本执行、通用 UI 控制与插件管理默认关闭，需在本地编辑器设置中启用。启用后获得的是本机编辑器权限，不是受限沙箱。

## 后续计划

**YSM / 时装工坊（AM/AW）离线模型恢复已列入计划，尚未实现、尚未验证。** 目标是独立离线转换核心、CLI、恢复报告及可选 Blockbench 导入；需要先完成版本样本、格式和许可核实，不承诺无损还原。见[开发路线](docs/ROADMAP.md)。

## 许可证

**GPL-3.0-only**。保留三个上游的作者与许可信息，分发时请同时提供对应源码、许可证与[第三方通知](THIRD_PARTY_NOTICES.md)。详见 [LICENSE](LICENSE)。

本项目并非 Blockbench、BetterModel、ModelEngine 或 CraftEngine 官方产品。

---

**English:** A local MCP for Minecraft modeling, texturing and animation in Blockbench Desktop and Web. Supports BetterModel / ModelEngine creature workflows, CraftEngine item blueprints and furniture references, and native bbmodel / CEM JSON import. Alpha 8 has 211 verified default Web tools and 47 passing regression tests. Engine and resource-pack acceptance is documented separately from graphical client validation. Offline YSM / Armourer's Workshop recovery is planned, not implemented.
