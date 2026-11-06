# LP-03 复核：机制判据语义一致性

Type: grilling
Status: resolved
Owner: amber · 2026-11-06
Blocked by: 06
Map: ../map.md

## Question

HITL 复核 [LP-03 机制可通行性判据](06-lp03-mechanic.md)（PRD §4.4 / §6.3 第三次强制复核）。本票由用户裁定。

### 必须裁定

1. 判据是否基于已核实的真实机制语义？是否存在把「危险存在」等同于「不可通行」的情况？
2. 安全窗口判定的时间 / 空间证据是否充分？巡逻 hazard 等未建模情况是否保持 `INSUFFICIENT_EVIDENCE`？
3. 合法危险机制是否被误阻断？阻断结果是否可解释、可复现？
4. 是否通过复核。**通过后进入完成性分析**；不通过则硬停，裁定修复、缩小范围或放弃。

### 输出

- 本票 `## Answer`：逐条判据裁定 + 机制语义结论 + 后续约束。
- 更新 `../map.md` 的 Decisions so far。

### 通过标准

- 机制判据符合真实机制语义；无误伤；通过后允许进入 LP-04。

## Context

- 实现：`1a5c369`；票据 Answer 在 [06-lp03-mechanic.md](06-lp03-mechanic.md)。
- 生产夹具：`packages/contracts/tests/fixtures/playability-mechanic-matrix.json`（6 例）；测试：`packages/contracts/tests/playability-mechanic.test.ts`（25 例）。
- 语料证据：[evidence/05-lp03-mechanic.json](../evidence/05-lp03-mechanic.json)（20 唯一 config；4 个历史/probe 命中、14 证据不足、2 层内无阻断）。
- **必须裁定**：`pickup-in-static-hazard`（#28）的生产层 verdict 是 `PROVEN_UNPLAYABLE` —— 被包住的 pickup 本身仍是 gap，但同一 hazard 封死其后的 suitcase-3/gate。39 例机制分布因此为 **18/17/4**，而不是 LP-02 复核时的 17/17/5。
- **已按 V1 边界降级**：巡逻 hazard、moving-platform、被 hazard/danger 包住的目标、多 danger、非全列 danger、mid-air touch-only。

## Answer

**2026-11-06 · 用户裁定 · 通过。**

### 逐项裁定

| 问题 | 裁定 | 决策 |
|---|---|---|
| Q1 A 的机制语义与证明 | 接受 | 静止 hazard 当非支撑禁区 + 反事实；不把危险存在本身当不可通行 |
| Q2 B 的安全窗口 | 接受 | 单全高 danger 闭式下界 + 1 帧余量；多 danger / 非全列保持证据不足 |
| Q3 矩阵 #28 | 接受修正 | 39 例分布定为 **18 PROVEN / 17 NO_PROVEN / 4 INSUFFICIENT** |
| Q4 语料 4 命中与 gap 政策 | 接受 | 3 历史 + 1 probe；probe 不计入关卡；16 份巡逻 hazard 保持证据不足 |
| Q5 fall 边过近似 | 选择 (b) | 记为残余风险；**LP-05 把 A 接成硬拒之前**修掉并单独回归 |
| Q6 后续 | 通过 | 推送 LP-03 更新 Draft PR #28；随后进入 LP-04；不合并、不推 `main` |

### 判据语义确认

- **A `PLAYABILITY_MECHANIC_PATH_BLOCKED`**：只回答「因为静止 hazard 所以过不去」。hazard 用运行时帧几何、忽略 `body`；禁区不提供支撑；`base` 可达 && `mask` 不可达才报。薄 hazard、目标在 hazard 内、出生点在 hazard 内、巡逻 hazard、mid-air touch-only 一律降级。
- **B `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW`**：只用「速度上界 + idle 下界」；单 danger、全列切面、远侧目标，`requiredMs > idle + 1 帧` 才报。近侧不报；目标在 danger 内、非全列、多 danger 一律 gap。
- 同一目标 A/B 只留一条（A 优先），另一条并入 `detail`。

### 矩阵与语料

- `pickup-in-static-hazard`（#28）：被包住的 pickup 仍是 `target-inside-hazard` gap，不硬拒；同一 hazard 封死其后的 `suitcase-3` / `gate` ⇒ 层内 `PROVEN_UNPLAYABLE`。**接受 18/17/4**。
- LP-06 必须逐条解释 **#4 / #12 / #19 / #28**：
  - #4 `wall-100`：SUBJECT 由 PICKUP 修正为 GATE；
  - #12 `chest-range-rescues`：原用例遗漏同关 gate；
  - #19 `spawn-deep-terrain`：LP-00 复核覆盖 P4；
  - #28 `pickup-in-static-hazard`：原用例只检查被包住的 pickup。
- 语料 20 唯一 config：4 个机制阻断（3 历史 + 1 probe）、14 INSUFFICIENT、2 NO_PROVEN；与 04 研究一致。probe 不计入关卡统计；3 条历史缺陷按已知缺陷记录，不重发布旧 run/pack。

### 条件与后续

- **Q5(b) 条件**：LP-05 接线前必须修复 `graph.ts` `movementNeighbors` 对 standable 格子发 `fall` 边的过近似，并重跑 LP-01/02/03 全量回归；该修复单独 commit。条件已写入 [LP-05 票据](09-lp05-pipeline.md)。
- LP-06 的测试必须**同时**断言层内 verdict 与 `coverage`，不得只检查 verdict；`NO_PROVEN_BLOCKER` 不得写成 `PROVEN_PLAYABLE`。
- 本复核通过后推送 LP-03 到 `wayfinder/level-playability-v1`，更新 Draft PR [#28](https://github.com/sihuayin/game-maker/pull/28)；之后进入 LP-04。不合并、不推 `main`、不启动 LP-05。
