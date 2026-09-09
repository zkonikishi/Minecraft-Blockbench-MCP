# Minecraft Blockbench MCP

让 AI 在 **Blockbench 桌面版和 Web 版**中制作 Minecraft 生物模型、贴图与骨骼动画，主要面向 **BetterModel / ModelEngine**。

**0.1.0-alpha.8 · GPL-3.0-only · 开发分支 Alpha**

Alpha 8 新增 [CraftEngine 物品蓝图、家具引用和发包配置接口](docs/CRAFTENGINE.md)；Alpha 7 新增原生 CEM/JEM 几何导入（见 [CEM 导入说明](docs/CEM-IMPORT.md)）；Alpha 6 新增原生 JSON 模型导入，修复断线重连、大模型导出、禁用面保留和动画截图取景，并校验 ModelEngine 的 animation.override。详见[更新说明](docs/ALPHA-6.md)与[验证记录及边界](docs/RUNTIME-ACCEPTANCE.md)。升级时更新插件并重启本地 relay。

这是三个开源 MCP 的实际代码整合：一个编辑器插件、一个本地 MCP 服务、一个共享执行队列。整合了近 200 个工具，数量和可用性以连接后的 `tools/list` 为准。

| 工具前缀 | 来源与用途 |
| --- | --- |
| `craft_*` | [SwagRee/BlockBenchMCP](https://github.com/SwagRee/BlockBenchMCP)：批量几何、UV 排布、像素绘制、多视角预览 |
| `studio_*` | [jasonjgardner/blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin)：建模、网格、材质、画笔、相机、动画、历史 |
| `anim_*` | [sosadly/blockbench-mcp](https://github.com/sosadly/blockbench-mcp)：关键帧、动画、纹理与编辑器操作 |
| `mc_*` | 本项目：双引擎规范、生物骨架、状态动画槽、骨骼标签、兼容性检查、内嵌纹理导出 |

复杂生物可以组合多层骨骼、翅膀、尾巴、下颚、分部贴图和多段动作。骨架模板只是可编辑草模；动画槽也需要继续编写关键帧。游戏内寻路、战斗逻辑和技能触发由服务器插件负责。

## 安装

需要 **Node.js 22+**、**Blockbench 5.1+**，以及支持 Streamable HTTP MCP 和 Bearer 请求头的本地 AI 客户端。Web 版同样需要本机运行 Node 服务。

```powershell
git clone https://github.com/zkonikishi/Minecraft-Blockbench-MCP.git
cd Minecraft-Blockbench-MCP
npm ci --ignore-scripts
npm run build
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

将生成的随机值作为自己的 token。复制 `.env.example` 为 `.env`，填入 token，然后启动：

```powershell
npm start
```

1. 在 Blockbench 打开 **文件 → 插件 → 从文件加载插件**，选择 `dist/minecraft_blockbench_mcp.js`。发布包中的同名文件也可直接使用。
2. 在 **设置 → 常规**中找到 **Minecraft MCP token**，填入与 `.env` 相同的值。
3. 保持 **Minecraft MCP bridge URL** 为 `ws://127.0.0.1:39800/bridge`。
4. 点击 **工具 → Connect Minecraft MCP**，看到 connected 后再连接 AI 客户端。
5. 升级前先断开连接并卸载旧插件，再加载新文件。不要重复加载同一个插件。

Web 安装同样使用“从文件加载”。Blockbench 不允许通过普通 HTTP URL 安装插件，即使 URL 指向本机。官方 Web 页面连接本机时，按浏览器提示允许该页面的本地网络连接；若浏览器阻止连接，查看开发者日志或使用桌面版。

在 AI 客户端配置中填写以下连接信息。不同客户端的字段名称可能不同，不要把示例 token 当作真实密钥：

```json
{
  "url": "http://127.0.0.1:39800/mcp",
  "headers": { "Authorization": "Bearer YOUR_RANDOM_TOKEN" }
}
```

服务仅监听本机回环地址。远程云端客户端不能直接访问你电脑的 `127.0.0.1`。同一服务只连接一个 Blockbench 窗口；多个窗口请使用不同端口和 token。断线或工具配置变更后重新连接，并刷新客户端的工具列表。

## 制作流程

先让 AI 调用 `mc_get_workflow` 和 `mc_engine_profile`，再开始编辑。例如：

> 为 BetterModel 和 ModelEngine 制作一个朝向 -Z 的翼龙草模。创建独立 Generic 项目，使用 mc_scaffold_creature 生成 dragon 骨架。细化翅膀、尾巴和下颚，排布面 UV、绘制贴图，给 idle 和 walk 写入真实骨骼关键帧。用多角度截图检查轮廓。最后运行 mc_audit_model，修复错误，再用 mc_export_bbmodel 导出内嵌纹理的文件。不要把空动画槽当作完成的动画。

主要操作顺序：

1. `mc_create_project` → `mc_scaffold_creature`，或自行创建完整几何。
2. `craft_apply_geometry_batch` / `studio_place_cube` 等工具细化。
3. `craft_ensure_texture` → `craft_pack_box_uv` → 绘制工具。
4. `mc_create_animation_set` → `anim_add_keyframes` / `craft_upsert_animation`。
5. `craft_capture_views` → `mc_audit_model`。
6. `mc_export_bbmodel` 返回模型 JSON；`download: true` 请求编辑器下载文件。

工具参数应以 `tools/list` 返回的 schema 为准。上游说明中的裸工具名称对应本项目的前缀名称。`craft_upsert_animation` 的 `replace: true` 会替换整段动画，请先读取已有内容。

## 引擎适配范围

| 能力 | BetterModel | ModelEngine |
| --- | --- | --- |
| Generic `.bbmodel`、骨骼、立方体、贴图、关键帧 | 共同工作流 | 共同工作流 |
| idle / walk / spawn / death | 创建缺失槽并保留已有动画 | 创建缺失槽并保留已有动画 |
| 引擎独有状态 | idle_fly / walk_fly / jump | jump_start / jump / jump_end |
| 主 hitbox、b_ / ob_ 子碰撞箱 | 标签助手与检查 | 标签助手与检查 |
| head / inherited head / mount / seat | 未提供同名映射 | h_ / hi_ / mount / p_ |
| 物品挂点、名字牌、牵引点、分段/尾巴、玩家肢体 | 未提供同名映射 | 标签助手及几何/ID 检查 |
| Bezier | 规范允许 | 检查提示线性回退 |
| Armature / spline / billboard | 检查报错 | 不作为共同基线 |
| 导入服务器、资源包生成、游戏内 AI | 需要独立验收 | 需要独立验收 |

`target: "both"` 采用保守交集；它不会同时模拟两个引擎，也不会自动转换所有引擎特性。骨骼预算默认 64 只是提醒阈值。完整差异与依据见 [兼容性说明](docs/COMPATIBILITY.md)。

Alpha 3 增加 **16 个工作流工具**：镜像动画与相位、原生碰撞盒转换、保持世界变换的换父级、Locator/NullObject 与 IK、Molang/Bezier 关键帧、ModelEngine 脚本关键帧、UV/FPS/Wrap、姿态预览、节点变换检查、AnimationCodec、Collections 与双引擎分别导出。完整参数、限制及调用示例见 [工作流工具](docs/WORKFLOW-TOOLS.md)。默认 Web 目录为 **211 个工具**。

`mc_script_keyframes` 现在能读、写、删除 Instructions 时间轴中的 MM 技能与已记录的 MEG 命令；它保存脚本数据，不在编辑器执行服务器技能。Wiki 没有锁定具体 ModelEngine Dev 构建号，因此不宣称所有 Dev 构建均通过验收。

## 测试与当前边界

本地 Windows 检查包含类型检查、**31 项整合/协议/回归测试**，以及 **69 项选定上游测试**。这些测试覆盖本项目与选定上游范围，不代表每个工具已实机验证。

实际 Web 验证使用官方 Blockbench **5.1.6 源码构建的本地页面**：加载插件、认证连接、三个工具家族协作、创建翼龙草模、贴图与 UV、idle 关键帧、PNG 预览、内嵌纹理 `.bbmodel` 导出均通过。官网 `https://web.blockbench.net/` 在测试主机连接失败，因此尚未验证官网 HTTPS 页面的完整连接流程。

Alpha 3 的 Web 验收另覆盖 44 次工具调用及截图：旋转父级下保持骨骼与子立方体变换、撤销/重做、镜像循环接缝、控制点与 IK、脚本增删、UV/FPS/Wrap、集合拆分与双引擎导出内容断言。插件提供加载时自动连接及重复加载时释放旧连接；从文件安装的 Web 插件仍受 Blockbench 本身的持久化行为限制。

**桌面版实际运行、BetterModel / ModelEngine 服务器导入、资源包和 Minecraft 客户端效果尚未验收。** 静态检查成功不代表游戏内完全兼容。

```powershell
npm run check
npm run test:upstream
# 连接专用测试编辑器后执行；会新建测试项目：
npm run test:live -- --confirm-disposable
node scripts/live-workflow.mjs --confirm-disposable
```

`BLOCKBENCH_BUILD_DIR` 可指定构建输出目录；`BLOCKBENCH_TEST_DIR` 可指定测试产物目录。TypeScript 检查针对自有 TypeScript，原始上游通过适配构建及选定测试验证。详细结构见 [架构说明](docs/ARCHITECTURE.md)。

高级脚本执行、通用 UI 控制与插件管理默认关闭；需要在编辑器设置启用并重新连接。启用后获得的是本机编辑器权限，不是受限沙箱。工具调用串行执行；长操作超时后可能继续运行，应先检查编辑器再决定是否重试。编辑期间避免手动切换项目。

## 来源与许可证

采用 GPL-3.0-only，保留三个上游的作者和许可信息。原始文件由 `upstream-lock.json` 锁定 SHA-256；适配修改位于 `src/` 和 `scripts/`，原始快照保持不变。分发插件时请一并提供许可证、第三方通知和对应源代码。

见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和 [LICENSE](LICENSE)。本项目并非 Blockbench、BetterModel 或 ModelEngine 官方产品。

---

**English:** A unified local MCP for Minecraft creature authoring in Blockbench desktop and Web, targeting BetterModel and ModelEngine. It integrates the original SwagRee, Jason J. Gardner and sosadly tool implementations with a serialized runtime, engine profiles, creature scaffolds, static audits and embedded-texture `.bbmodel` export. Install dependencies, build, start the loopback relay with a random token, load the plugin file, configure the same token in Blockbench and connect your MCP client. Alpha: local official-source Web workflow tested; desktop and Minecraft engine runtime acceptance remain pending.
