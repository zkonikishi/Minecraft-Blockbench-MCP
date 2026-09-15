# 动画质量流程（Alpha 开发分支）

这套工具用于诊断、制作可撤销变体和连续预览，不宣称自动生成专业动画。九头龙应先精修一条脖子的动作，再为其他链设置有意图的延迟与幅度。

## 1. 诊断

`mc_animation_diagnose({animation:"idle"})` 只读检查：旋转跳变、相邻关键帧区间速度变化、循环首尾、重复时间、空轨道与相同轨道。

返回 `findings` 和 `skipped`。速度是数值关键帧之间的割线估计，不是曲线瞬时速度或世界坐标速度；预备停顿、完整旋转可能被标记，不自动修复。Molang、多 data point 的 pre/post 轨道明确标为未求值。不能据此判断脚掌接地或穿模。

## 2. 骨骼链 / 多头变体

```json
{
  "animation":"idle",
  "name":"idle_necks_v2",
  "source":"neck_source",
  "chains":[
    {"bones":["neck_1a","neck_1b","head_1"],"offset":0,"amplitude":1},
    {"bones":["neck_2a","neck_2b","head_2"],"offset":0.18,"amplitude":0.85}
  ],
  "delay":0.06,
  "gain":0.9,
  "fps":24,
  "dry_run":true
}
```

传给 `mc_animation_chain`。先查看 dry run 的诊断，再显式 `dry_run:false` 创建新动作。原动作不改；新名字不能覆盖；一次 Undo 可撤销。

- 最多 9 条链、每条 32 节；链必须按直接父子关系排列，目标不能重复。
- 每节采样源旋转，时间延迟为链 offset 加节点序号乘 delay；幅度为 amplitude 乘 gain 的节点序号次方。不是物理弹簧模拟或自动回弹。
- 只接受数值、单 data point、linear 的旋转轨道；拒绝 Molang、Bezier、catmullrom，不静默丢弃曲线语义。
- 循环源要求显式、相等的首尾关键帧；变体首尾使用完全相同采样值。非循环延迟会截断超出动作末尾的跟随过程，需要另行延长动作。
- 目标旋转在新动作中被替换，其他通道和效果保留；源动作完全保留。它复制的是局部旋转，骨骼轴向或基础姿态不同的链不能直接视为正确。
- 最长 60 秒、最多生成 20000 个旋转关键帧；烘焙采样近似源分段线性动作，采样点间仍可能存在误差。

## 3. 连续预览图册

```powershell
node --env-file=.env scripts/review-animation.mjs idle_necks_v2 D:/reviews/new-animation --confirm-preview
```

需要已连接的新插件，先暂停编辑器动画，运行时不要切换工程。输出目录不能已存在。

输出连续 PNG、诊断及 `review.json`，以及可播放/暂停/拖动进度的 `index.html`。默认按 24 fps 采样，最多 241 张（含末帧）；长动作自动降低采样率，实际值写入 `effectiveFps`。不是 MP4 编码器。

每批最多 8 帧，复用首个静止/当前姿态得到的固定取景框，减少自动缩放跳动；大幅伸展可能超出初始取景，需要使用 `mc_visual_detail` 的更大 frame 后配合 `mc_visual_animation` 自定义采样。每批恢复编辑器时间和模式，跨批校验工程 UUID，失败不自动重试，保留部分证据。

## 还不属于自动验收的部分

脚掌滑动需要支撑阶段和世界空间轨迹；穿模需要几何/碰撞检查；动作的力量感和节奏需要视觉评审。BetterModel/ModelEngine 的混合、控制器、Molang 与音效仍需要游戏客户端对照。现有代码/模拟测试不等于编辑器实测，更不等于九头龙动作已经修好。
