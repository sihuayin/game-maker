# 03. 动画帧底部地面线 / 细虚线清理（零付费）

Type: task
Status: resolved
Owner: claude (2026-10-20 认领 · 已施工、已关)
Blocked by: —
Map: ../map.md
> 派生自最终包的内容验收：多张动画帧脚下有地面线 / 细虚线。

## Question

去掉动画帧底部的非角色线条，同时保住脚部像素：

- 先比较两条路：① 提示词约束（下次生成）；② 零付费后处理（在 `importFrames` / 单帧裁切前，
  识别底部孤立的细横线并去掉）。
- 选定后施工 + 测试；用 `reuseFrom` 从最终包的 raw 图重建，0 上游调用。
- 注意：`importFrames` 是共用裁框的；不要切到脚。

## 验收

- 联系表上不再有地面线 / 细虚线；脚部完整。
- 全量测试绿；重建包 `verifyPack` ok；61 帧数不变；0 上游调用。

## 边界

- 零付费；不改其他判据；不放宽单帧碎片阈值。

## Comments

### 2026-10-20 · 06 收口后的色板约束

- 本票零付费重建必须使用 v4 的 `stylespec.json`（34 色，
  `.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/stylespec.json`）；
  raw 可继续复用 `2026-10-19k-patch`。
- 否则重建会把橄榄外套退回棕色 —— `pack/v4` 的色板修复会丢。

### 2026-10-20 · 施工完成（未收口 / 未提交）

- **路线 = ② 零付费后处理**。① 提示词只能救未来付费跑、现在这 61 张 raw 一张都救不了，
  且效果无法在不花钱的前提下验证。比较与实测写在
  [`runs/2026-10-20d-groundline/groundline-report.md`](../runs/2026-10-20d-groundline/groundline-report.md)。
- **实测**：61 张动画 raw 里 **30 张**有贴脚地面线（scavenger 15 = 除 jump2 外全部；enemy 15 = 全部）；
  线高 5px、所在行覆盖 0.30–0.77×宽，脚所在行 0.16–0.25×宽。线常与脚 4 连通 ⇒ `dropSpecks` 丢不掉。
- **施工**：`image.ts` 新增 `dropBottomGroundLines()`（行覆盖「突然跳高 + 薄」判据，逐行保护「正上方有墨」的脚）；
  `ImportOptions.dropBottomLines`（默认 false）；`importFrames` 在碎点与并集裁框**之前**执行；
  `pack.ts` 只对非背景动画开启。**没有放宽** `dropSpecks` 阈值。
- **测试**：新增 `tests/groundline.test.ts` 6 条；全量 **105 文件 / 1640 条全绿**。
- **零付费重建**：`runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6/`（v5 是被替换的候选，只差 idle4 一个像素）——
  `verifyPack` ok · 19 资源 · 61 动画帧 · 34 色 · `imageCalls=0` · `ledgerCalls=0`。
- ⚠️ **副作用待看**：线从并集框里去掉后，idle / enemy 的裁框变紧，身体在 48 宽里从 34–44px 变成 47–48px
  （run 本来就是 48）。v4 的 idle 帧间缩放本来就不一致；v6 让同角色所有动画一致；v4→v6 共 27 帧变、34 帧逐字节相同。
  若必须保留 v4 的横向比例，需另裁「只删像素、不缩裁框」。

### 2026-10-20 · 比例裁定：保留 v6

- 地面线与头顶碎点（票 107）同属上游瑕疵 —— **瑕疵不参与裁框**。
- v4 的 idle 帧间缩放不一致（34 vs 42px）正是线参与裁框的后果；v6 让 idle / enemy 与 run / jump 统一填满目标框。
- 横向比例的变化是「按 spec 尺寸拉伸」的既有行为；若将来要保比例，应改 `importFrames` 的缩放策略（letterbox），
  而不是把线重新算进裁框。本票不扩范围。


## Answer（2026-10-20 · 施工完成）

- **路线 = ② 零付费后处理**。① 提示词只能救未来付费跑、现有 61 张 raw 一张都救不了，
  效果也无法在不花钱的前提下验证。
- 实测：61 张动画 raw 里 **30 张**有贴脚地面线（scavenger 15 = 除 `jump2` 外全部；enemy 15 = 全部）；
  线高 5px、所在行覆盖 0.30–0.77×宽，脚所在行 0.16–0.25×宽。线常与脚 4 连通 ⇒ `dropSpecks` 丢不掉。
- 施工：`packages/assets/src/image.ts` 新增 `dropBottomGroundLines()`（「行覆盖突然跳高 + 薄」判据；
  逐行只删「正上方没有墨」的像素 ⇒ 脚部结构性保护）；`ImportOptions.dropBottomLines`（默认 false）；
  `importFrames` 在碎点与并集裁框**之前**执行；`pack.ts` 只对非背景动画开启。
  **没有放宽** `dropSpecks` 阈值，也没有改其他判据。
- 测试：新增 `packages/assets/tests/groundline.test.ts` 6 条；
  全量 **105 文件 / 1640 条全绿**。
- 零付费重建：`runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6/` ——
  `verifyPack` **ok**（0 problems）· 19 资源 · **61 动画帧**（总 76，与 v4 同）· 34 色 ·
  `imageCalls = 0` · `ledgerCalls = 0`。
- 联系表无地面线 / 虚线；v4 → v6 **27 帧变化、34 帧逐字节相同**（jump / lurker / 水 / 废料 /
  撤离点 / 道具完全不变）。
- 比例裁定：**保留 v6** —— 瑕疵不参与裁框；v4 的 idle 帧间缩放不一致（34 vs 42px）正是线参与裁框的后果，
  v6 让 idle / enemy 与 run / jump 统一填满目标框。若将来要保比例，应改 `importFrames` 的缩放策略
  （letterbox），而不是把线重新算回裁框。
- 完整报告与证据：[`runs/2026-10-20d-groundline/groundline-report.md`](../runs/2026-10-20d-groundline/groundline-report.md)。
