# 18. 逐帧 66 张已生成：零付费复用 / 定向重生成 / 全量重跑

Type: grilling
Status: resolved
Owner: claude (2026-10-19 认领 · 人裁 A · 已施工、已关)
Blocked by: —
Map: ../map.md
> 派生自票 10 逐帧真跑的失败（2026-10-19）：
> [失败/抢救报告](../report-10-real-frames-failure-2026-10-19.md)。
> ⚠️ 本票只裁路线，不批准任何付费跑、不批准施工。

## Question

逐帧模式在结构上成功：**66 张全部生成**（61 帧 + 2 sprite + 3 背景；0 母版调用）；
失败只在 `office-debris` 的单帧碎片判据 —— 图是「桌子 + 椅子 + 弹簧」三个物体，
最大块 55.4% < 60%，属于**多部件道具被 0.6 判据误杀**。

内容观察：玩家 / 敌人一致性好；废料 / 净水 / 终端基本正确（standby3 画成人）；
潜伏者形象一致但倒挂 / 站立语义混用；多张图有地面线。

要裁：

- **A**：零付费复用现场 66 张 + 3 drawlist，新增 `reuseFrom` 与 `minLargestShare`，先出包。
- **B**：A 之后定向重生成（standby3 1 发；潜伏者按需 13 发以内）。
- **C**：全量重跑 66 发（≈$2.57）。
- **D**：范围收缩（先交已好的部分）。

## 验收

- 一条明确裁定。
- 若选 A：施工另立票（或本票记录）；零付费；出包后 `verifyPack` 与全帧数验收。
- 若选 B：先 A 出包，再另出小预算报告 + 逐字点头。
- 若选 C / D：明确范围与费用。

## 边界

- 不批准付费调用；不改 `game-maker.local.json`；不自动重跑 / 换模型 / 转码。
- 不悄悄放宽其他资源的判据；`minLargestShare` 只按资源显式设置。

## Answer

**人裁（2026-10-19 逐字）**：「裁 A：零付费复用 66 张 + minLargestShare，先出包。」

### 裁定 / 施工

- `BuildPackOptions.reuseFrom`：现场已有 `authoring/generated/*` / `authoring/drawlist/*` 就直接读，
  缺文件即抛，不重发；复用项不计入 ledger / imageCalls。
- `ImageSource.minLargestShare`：按资源显式设置；`office-debris` 用 0.5，其余仍 0.6。
- 测试：复用（0 调用 / 缺文件失败）、多部件阈值（默认拒 / 0.5 过）。
- 全量 **104 文件 / 1633 条**；build / deps / links 通过；typecheck 仅两条既有红。

### 结果

- 包：`runs/2026-10-19j-salvage/ruin-scavenger-extraction-assets/pack/v1/`
- `verifyPack` **ok** · **0 次上游调用** · 19 个资源 · 61 帧动画。
- 内容瑕疵：standby3 是人；潜伏者倒挂/站立语义混用；地面线；绿外套量化成棕。
- 成功报告：[`../report-10-salvage-success-2026-10-19.md`](../report-10-salvage-success-2026-10-19.md)
