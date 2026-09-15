# 全局视觉工作流

视觉工具属于整个 MCP，不依赖 YSM、BetterModel、ModelEngine 或 CraftEngine。
它们向支持图片的 MCP 客户端返回原生 `image` 内容块；无需另一个视觉服务器。

## 公共工具

| 工具 | 用途 |
|---|---|
| `mc_visual_capabilities` | 查询能力和限制 |
| `mc_visual_capture` | 多方向 PNG，支持 current/textured/solid/wireframe |
| `mc_visual_detail` | 指定节点局部特写、骨骼叠加，或显式固定取景框 |
| `mc_visual_texture` | `kind: texture` 贴图或 `kind: uv` 带标签 UV 图 |
| `mc_visual_animation` | 指定动画和时刻，逐帧、多视角返回图片 |
| `mc_visual_compare` | 保存、对比、清除同工程修改前后的图片 |

```json
{"tool":"mc_visual_capture","arguments":{"views":["iso","north","east"],"render":"wireframe","max_edge":512}}
{"tool":"mc_visual_texture","arguments":{"kind":"uv","texture":"skin"}}
{"tool":"mc_visual_animation","arguments":{"animation":"walk","times":[0,0.25,0.5],"views":["iso"]}}
{"tool":"mc_visual_compare","arguments":{"operation":"save","key":"before"}}
{"tool":"mc_visual_compare","arguments":{"operation":"compare","key":"before"}}
{"tool":"mc_visual_compare","arguments":{"operation":"clear","key":"before"}}
```

对比基线保存在当前插件运行时内存，最多 4 份、每份 16 MiB，不覆盖已有 key，不跨工程复用。重新加载插件后失效。相同方向自动取景不等于锁定同机位：模型边界变化会改变取景比例，不能把图片差异直接当作模型变化量。

需要严格同机位时，先调用 `mc_visual_detail({focus:["head"],views:["north"],bones:true})`，保存返回的 `frame`；修改后用相同 `frame`、`views`、`max_edge` 再调用（不再传 focus）。`frame` 是世界坐标中心及取景跨度，显式固定后不会随新边界自动缩放。骨骼叠加为投影连线与关节点，不表示实际骨骼碰撞体。

动画必须先暂停播放，每次最多 8 个时刻、7 个视角，恢复原动画选择、时间和模式；工程切换时停止，不切回或修改另一个工程。截图恢复原显示模式，不写模型文件。

## 通用离线图册

```powershell
node --env-file=.env scripts/review-model.mjs D:/models/model.bbmodel D:/reviews/new-review --confirm-new-project
```

支持所有可以原生导入的、贴图内嵌的 bbmodel；只在需要图册时连接编辑器。
输出 HTML、PNG、源文件 SHA-256 和 JSON 报告。最多前三个非零时长动画的四个时刻，加静止姿态，共 39 张图。输出目录不覆盖。`review-ysm.mjs` 是兼容别名，共用同一实现。

## 验收边界

- 图片采集成功、AI/人工视觉验收、Minecraft 客户端验收是三个独立状态。
- 不自动宣布穿模消失、参考图相似或游戏内行为正确。参考图需另行交给视觉客户端对照。
- 常规模型截图按立方体边界自动取景，纯网格工程改用 `mc_visual_detail`（读取渲染顶点）。已支持局部特写、骨骼投影叠加与固定取景框；未实现自动像素差分评分。
- 静态骨骼/UV/引擎约束继续使用现有 `mc_inspect_nodes`、`craft_get_uv_layout`、`mc_audit_model` 等工具；静态诊断不是视觉诊断。
- Web 和 Desktop 复用同一工具实现；必须加载包含这些工具的新插件。代码/模拟测试通过不等于已在两个编辑器上实测。
