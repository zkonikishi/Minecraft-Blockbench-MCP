# YSM 离线恢复（Alpha 10）

将 `.ysm` 恢复为可编辑 `.bbmodel`，同时保留解析得到的 JSON、PNG、控制器等原始资源及恢复报告。无需启动 Minecraft、YSM Mod 或 Blockbench。只在可选导入编辑器时需要 Blockbench。

## 2026-09-15 兼容性补充

- 读取 spec-2 `ysm.json`，按主模型、手臂与箭矢绑定动画文件和贴图；报告逐模型绑定和缺失引用。
- 负尺寸立方体按原始有向边界保留，不再导致整份恢复失败；此类几何仍需要视觉核对。
- 恢复 sound / particle / timeline 事件关键帧，保留粒子脚本和定位点。事件数据恢复不代表音效文件绑定、粒子渲染或游戏执行已验证。
- PNG 像素尺寸与几何 UV 尺寸分开保存；支持 JSON UTF-8 BOM。
- 按文件大小分位选取 12 个本地样本，范围 14,564–16,019,822 字节；修复前 11/12 转换成功，修复后 12/12。不是全库验收，未上传样本或本地路径清单。

可复现抽样（报告包含输入文件路径，应留在本地）：

```powershell
node scripts/ysm-sample-check.mjs "D:/models/ysm" "D:/reports/ysm-sample-new.json"
```

## CLI

```powershell
node scripts/convert-model.mjs --identify "D:/models/example.ysm"
node scripts/convert-model.mjs "D:/models/example.ysm" "D:/models/recovered-example"
# 指定解析资源中的贴图路径；不指定时优先 normal.png
node scripts/convert-model.mjs "D:/models/example.ysm" "D:/models/recovered-alt" "textures/alternate.png"
```

输出目录必须不存在，父目录须已存在。每个几何文件单独输出 bbmodel，`assets/` 保留全部提取资源，`recovery-report.json` 记录输入 SHA-256、数量、贴图选择和遗漏。失败时不会覆盖旧输出或修改源文件；写入阶段失败可能留下部分新目录，应先检查报告和文件。

## MCP

- `mc_ysm_inspect({data})`：传入 `.ysm` 字节的 Base64，返回容器头、大小和 SHA-256；不是完整有效性验证。
- `mc_ysm_recover({data, texture?})`：返回 `models`（filename/model）、`assets`（path/Base64 data）与 `report`。纯计算，不自动写文件。
- 可选调用 `mc_import_bbmodel({model: result.models[0].model})` 导入一个恢复工程。

两个 YSM 工具由本地 relay 提供，即使编辑器断开也可以使用。工具数量以 `tools/list` 为准，编辑器 `mc_status.toolCount` 不包含这两个离线工具。

## 范围与限制

- 使用 MIT 许可 OpenYSM/YSMParser v0.3.5 的原始 Web WASM 发行文件；源码版本和文件 SHA-256 见 `vendor/ysmparser/provenance.json`。没有复制其他 AGPL 恢复器。
- WASM 在独立 worker 的内存文件系统解析；每次调用单独初始化，不加载模型中的脚本，也不通过模型路径读写主机文件。单文件输入最多 32 MiB，提取资源最多 128 MiB / 2048 项，解析最长 30 秒；relay 同时只接受一个恢复请求。这不是操作系统级沙箱。
- 转换 Bedrock 1.12+ 立方体几何、层级、定位点、逐面/箱式 UV、内嵌 PNG，以及骨骼关键帧、pre/post、插值和非均匀缩放。源描述信息随工程保留。
- 每个工程仍只选择一张贴图，优先使用支持的 spec-2 配置绑定，其他贴图保留为资源；复杂材质、网格、未支持的配置绑定、控制器及事件运行时行为不能保证等价重建。遗漏写入报告。Molang 保留表达式，不在离线阶段求值。
- 动画按骨骼名字匹配到每个工程，未匹配骨骼明确报告，完整动画源文件保留。不能把动作数当成行为已全部复原。
- 首版验证了本地 V1、V2、BOM V3 各一个代表样本，后续增加了 12 份大小分位抽样，不宣称覆盖所有版本或全部模型。源于顶点数据的重建不保证恢复作者原始参数，不承诺无损。
- 样本没有打包到 GitHub 或发布资产中。请自行确认模型的使用和分发授权。

## 验证

三类容器各一个样本通过解析和 bbmodel 生成。一个 V2 样本在 Blockbench Web 5.1.6 原生导入成功：9 个元素、1 张贴图、12 个动画、436 个关键帧，编辑器中可见带贴图的模型。此记录不代表 Minecraft 客户端、YSM 游戏内行为或所有动画已验收。

整合测试覆盖坐标/UV、隐藏面、关键帧 pre/post、非均匀缩放、错误层级、坏输入、制品哈希，以及已有 MCP/引擎工具回归。另用无编辑器连接的隔离 MCP 服务实测 `mc_ysm_recover` 成功。
