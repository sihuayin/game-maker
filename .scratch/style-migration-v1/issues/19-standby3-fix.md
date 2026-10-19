# 19. standby3 定向修复（1 发）

Type: task
Status: resolved
Owner: claude (2026-10-19 认领 · 已施工、已关)
Blocked by: —
Map: ../map.md
> 派生自票 18 的抢救出包：`extraction-point.standby3` 被画成了一个人。
> ⚠️ 只发 **1 张**；不重跑、不自动修复。

## Question

用 **单物体模板**（`singleObjectPrompt`）重新生成 `extraction-point` 的 standby 帧，
替换失败现场的 `extraction-point.standby3.png`，再用 `reuseFrom` 零付费重建整包。

## 授权 / 预算

- 人裁逐字：「修 standby3：1 发 / ≤4 发 / 15 分钟，修完复用重建」
- 1 次生图调用 / ≤4 发 HTTP / 0 文本 / 15 分钟；正常 ≈ $0.039，最坏 ≈ $0.156。
- 输出：`runs/2026-10-19k-standby3-fix/standby3-fix/pack/v1/`
- 重建：patch 目录复用 66 张 + 3 drawlist，只替换 standby3；0 上游。

## 验收

- 新图是**终端**（不是人）。
- 单帧判据通过；替换后整包 `verifyPack` ok；61 帧不变。

## 执行记录

- 修复报告：[`../report-19-standby3-fix-2026-10-19.md`](../report-19-standby3-fix-2026-10-19.md)
- runner：`runs/2026-10-19k-standby3-fix/run-fix.mjs`（`RUN_APPROVED=1`）
- 1 发 / ≤4 发 / 0 文本 / 15 分钟；失败即停。

## Answer

**结果**：1 发成功；新图是**撤离终端**（EVAC 屏幕 + 天线 + 线缆），`verifyPack` ok；≈$0.039。

- 修复包：`runs/2026-10-19k-standby3-fix/standby3-fix/pack/v1/`
- 用 patch 目录复用其余 65 张 + 3 drawlist，**0 上游调用**重建整包：
  `runs/2026-10-19l-salvage-standby3/ruin-scavenger-extraction-assets/pack/v1/`
- 重建 `verifyPack` **ok** · `imageCalls 0` · 19 资源 / 61 帧。
- standby 三帧现在都是终端（standby3 已替换）。
- 修复报告：[`../report-19-standby3-fix-2026-10-19.md`](../report-19-standby3-fix-2026-10-19.md)
