# 1.1.1 修复候选与验证范围

检查日期：2026-11-06。本页描述开发候选，不代表已创建 Release 或完成游戏客户端验收。

## 修复内容

- **YSM 初始化**：v0.3.6 的 Web WASM 不读取原来的 `Module.wasmBinary` 参数。
  worker 现在通过 `instantiateWasm` 显式加载固定的本地字节，不启用网络读取。
- **实际恢复门槛**：增加自制、可重复生成的最小 V1 容器，覆盖 WASM、资源提取、
  几何、贴图与关键帧。安装包验证通过真正的 `mc_ysm_recover` 调用检查这条链路。
  错误输入测试也要求到达解析阶段，初始化失败不能再冒充成功的拒绝测试。
- **箭矢绑定**：同时支持 `files.projectiles` 与直接 `files.arrow`，兼容 `texture.uv`，
  限制每个模型使用其配置指定的动画文件。
- **版本与来源**：恢复报告读取解析器 provenance；Jason 同步到 v1.10.1 的
  `97a8a80d3a37bf95c5e136d93d2c7da399fff753`。上游锁共 432 个文件，逐字节保留。
- **生产依赖**：MCP SDK 1.32.2、Zod 4.6.7，并更新间接依赖锁。集成工具使用
  Zod 4 原生 JSON Schema 生成和实际验证；适配器兼容旧的一参数 record 写法。
- **请求体大小**：升级后的 SDK 默认限制为 4 MiB，relay 显式设为 48 MiB，
  容纳原有 32 MiB YSM 输入经过 Base64 / JSON 包装后的大小，同时拒绝超限请求。

## 本次验证

环境：Windows、Node 24.22.1。所有操作位于独立修复目录或一次性测试环境。

| 项目 | 结果 |
| --- | --- |
| 类型检查与插件构建 | 通过 |
| 项目回归 | 91 项通过，包含有效容器恢复、箭矢隔离、Zod 4、全工具 JSON Schema 和 HTTP 大输入／超限检查 |
| SwagRee / sosadly 适配测试 | 117 项通过 |
| Jason 原样上游测试 | 78 个文件、1057 项通过 |
| 生产依赖审计 | `npm audit --omit=dev --audit-level=moderate`，0 告警 |
| 安装包检查 | 文件清单／许可证／校验和、独立 SDK 初始化，以及有效模型的完整恢复通过 |
| 本地真实 YSM 样本 | 阿罗娜和雷电将军两个版本，共 3 份完成解析与 bbmodel 生成 |
| 本地原始 ZIP 样本 | CatDad 箭矢绑定为自己的动画文件；不再混入挥剑等玩家动画 |

原样上游测试在字节相同的临时快照中运行，使用开发依赖中的 Zod 3 和 MCP SDK 1.30.0，
保持该上游测试的环境与断言；生产安装不包含这些测试专用别名依赖。它们不作为
Zod 4 集成兼容性的证据。当前集成的 Zod 4、真实 HTTP / WebSocket 通信及所有工具
schema 由本项目回归测试独立验证。第三方模型和用户数据未加入仓库或发布包。

## 仍未验证

- 本次 Web 编辑器实机脚本访问 `https://web.blockbench.net` 时连接被关闭，
  未完成编辑器流程。未沿用旧版本的通过结论。
- 本次未重新执行 Desktop、ModelEngine / BetterModel / CraftEngine 实机验收、
  升级回滚、多平台 CI 或长时间运行检查。
- 恢复出的模型仍可能含需要处理的配置、材质、Molang 和控制器差异。
  生成 `.bbmodel` 不代表已适配 ModelEngine，更不代表 Minecraft 客户端显示正确。

## 复现

```powershell
npm ci --ignore-scripts
npm run check
npm run test:upstream
npm run test:jason
npm audit --omit=dev --audit-level=moderate
node scripts/stage-release.mjs D:/releases/new-1.1.1-stage
npm ci --omit=dev --ignore-scripts --prefix D:/releases/new-1.1.1-stage
node scripts/verify-release.mjs D:/releases/new-1.1.1-stage
```

`test:jason` 另需 Bun；可通过 `BUN_EXECUTABLE` 指定实际二进制。
暂存目录须为仓库外的新目录。这里的检查不创建或发布 GitHub Release。
