# LP-02 复核：空间判据可靠性与误报

Type: grilling
Status: resolved
Owner: amber · 2026-11-05
Blocked by: 04
Map: ../map.md

## Question

HITL 复核 [LP-02 空间可达性判据](04-lp02-spatial.md)（PRD §4.3 / §6.3 第二次强制复核）。本票由用户裁定。

### 必须裁定

1. 每条空间判据是否有确定性证据链：失败目标、几何输入、判定规则、为何足以证明阻断。
2. 冻结语料与 39 例矩阵的空间结果是否可解释？新增误报是否逐条根因分析？
3. 合法复杂布局是否存在被简单几何启发式误杀的情况？
4. 是否通过复核。**通过后允许创建 Draft PR**；不通过则硬停，裁定修复、缩小范围或放弃。

### 输出

- 本票 `## Answer`：逐条判据裁定 + 误报结论 + Draft PR 创建记录（若通过）。
- 更新 `../map.md` 的 Decisions so far；必要时调整后续票据。

### 通过标准

- 空间判据可靠、无明显误报；Draft PR 仅在通过后创建。

## Context

- 实现：`523881d`；票据 Answer 在 [04-lp02-spatial.md](04-lp02-spatial.md)。
- 生产夹具：`packages/contracts/tests/fixtures/playability-matrix.json`（23 例）；测试：`packages/contracts/tests/playability-spatial.test.ts`（42 例）。
- 语料证据：[evidence/04-lp02-spatial.json](../evidence/04-lp02-spatial.json)（20 唯一 config；0 阻断 / 2 gate-missing / 18 层内无阻断；对既有 reachability 新增 0、修复 0）。
- **必须逐项裁定的三处矩阵修正**（详见 LP-02 Answer）：#19 `spawn-deep-terrain` 按 LP-00 复核降级；#4 `wall-100` 的 `signal` 是 GATE 不是 PICKUP；#12 `chest-range-rescues` 的 gate 实际不可达，chest 才被 range 救回。
- **待裁定**：mid-air touch-only（只在不落地的弧线上碰到）目前可能被报 UNREACHABLE；是补降级、还是保留为已知限制。

## Answer

**2026-11-05 · 用户裁定 · 有条件通过 → 条件已满足。**

### 逐项裁定

| 问题 | 裁定 | 决策 |
|---|---|---|
| Q1 UNREACHABLE / BLOCKED | 接受 | 两者均可作为确定性阻断判据，但证明责任不同 |
| Q2 矩阵修正 | 接受 | 39 例按 17 PROVEN / 17 NO_PROVEN / 5 INSUFFICIENT 重新统计 |
| Q3 mid-air touch-only | 选择 (a) | 增加保守降级，不允许潜在可触达目标被判 UNREACHABLE |
| Q4 verdict 分层 | 确认 | 层内 verdict、coverage、整关 aggregate 三者分离 |
| Q5 语料规模 | 足够 | 20 份唯一 config 足以支撑本次复核；96 配对归 LP-06 |
| Q6 Draft PR | 有条件批准 | 条件满足后推送并创建 Draft PR |

### Q1：两条判据的证明责任

- **BLOCKED**：纯几何封闭证据，不依赖 BFS 是否完整。目标的「可重叠脚点矩形」内没有任何自由玩家位置 ⇒ 任何玩家盒都无法与它相交。
- **UNREACHABLE**：基于玩家能力上界模型。**BFS 没找到路径本身不是充分证据**；必须排除「搜索模型遗漏了可能改变结论的移动方式」。Q3 的 mid-air touch-only 正是这个边界的一部分。
- 本复核接受两条判据，但 UNREACHABLE 的适用范围以 Q3 补丁为界。

### Q2：39 例矩阵修正

批准修正后的统计口径：**17 PROVEN_UNPLAYABLE / 17 NO_PROVEN_BLOCKER / 5 INSUFFICIENT_EVIDENCE**。验收报告（LP-06）必须逐条解释：

- **#4 `wall-100`**：矩阵把 goal `signal` 记成 `PICKUP_UNREACHABLE`，是 SUBJECT 命名问题；按 framework §5.1 应为 `GATE_UNREACHABLE`。同一堵墙也封死 `suitcase-2/3`。
- **#12 `chest-range-rescues`**：原研究用例只检查了 chest，遗漏同关 gate；gate 在 100px 沟对面（同高跳跃上界 66px），既有 `auditReachability` 同样报 gate。chest 确实被 `range` 救回。
- **#19 `spawn-deep-terrain`**：已被 LP-00 复核覆盖（P4 被源码推翻 ⇒ `SPAWN_IN_TERRAIN` 只诊断，`INSUFFICIENT_EVIDENCE`）。

保留原研究记录与修正后生产预期之间的区别；不得为了保留旧统计回退正确判据。

### Q3：mid-air touch-only 保守降级（LP-02a）

已实现，commit `cbc93a8`。对每个未覆盖、且不被 BLOCKED 封死的目标：

1. 从每个可达落脚点扫 `vy = jumpVelocity` 的跳跃弧；
2. 从每个 walk-off 悬崖点扫 `vy = 0`、可水平漂移的下落弧；
3. 弧线按 60Hz 采样，逐点查共享 `blocked` 栅格；世界外采样点当自由空间；
4. 只要存在一条不撞实心体、玩家盒与目标盒**严格相交**的弧（不要求相交前后落到任何落脚点），目标降级为 `INSUFFICIENT_EVIDENCE`，判据 id `PLAYABILITY_SPATIAL_MIDAIR_TOUCH_UNPROVEN`，同时记 coverage-gap `mid-air-touch-only`。

边界：这些弧线**不**写进可达集、**不**作为正式可达路径；只是停止确定性拒绝的保护。BLOCKED 仍然优先（纯几何封闭与 mid-air 触达互斥）。

### Q4：层内 verdict / coverage / aggregate

确认 plan R21(a)。允许 `NO_PROVEN_BLOCKER + coverage.spatial = partial`，但**不得**解释为 `PROVEN_PLAYABLE`。LP-06 测试必须同时断言层内 verdict 与 coverage。

### Q5：语料规模

20 份唯一 config 足以支持本次判据可靠性复核；完整 96 个唯一配对属于 LP-06。当前 `0 新增 / 0 修复` 如实记录，不解释为已完成全量历史语料验收。

### Q6：条件完成与 Draft PR

| 条件 | 状态 |
|---|---|
| 1. mid-air 保守降级 | ✅ `cbc93a8` |
| 2. 针对性正反例测试 | ✅ 4 例（存在触达弧 / 被实心墙挡住 / 正常落地可达 / 高过跳跃顶点） |
| 3. 重跑 LP-02 测试 | ✅ 空间测试 46 例、契约 904 例、全仓 2491 例、typecheck 0 |
| 4. 重跑 20 份唯一 config | ✅ 0 阻断 / 2 gate-missing / 18 层内无阻断；0 新增 / 0 修复；无 mid-air 降级触发 |
| 5. 无新增不可解释误报 | ✅ 语料与矩阵全部可解释 |
| 6. 更新复核记录 | ✅ 本 Answer |

**Draft PR：本次记录提交后创建；URL 在后续记录 commit 中补。** 不合并、不推送 `main`、不启动 LP-03。

### 残余观察（不阻塞本次复核）

- mid-air 扫描是**有限采样**（每个起点 33 个水平速度、60Hz），不是对连续控制空间的穷举；它只会减少硬拒，不会新增硬拒。残余漏降级风险记入 LP-06。
- `graph.ts` 的 `movementNeighbors` 对 standable 格子也发 `fall` 边（理论上会穿过脚下的实心体）。这是**可达性过近似**，只可能漏报阻断、不会造成误拒绝；与本次复核的「宁可降覆盖、不可错拒」方向一致，留给后续 effort 处理。
