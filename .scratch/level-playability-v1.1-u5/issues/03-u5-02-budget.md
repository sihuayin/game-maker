# U5-02 预算闭合与降级硬化

Type: task
Status: open
Owner: —
Blocked by: 02
Map: ../map.md
Class: U5 / IMPLEMENTATION

## Task

按 D5 / D5B 硬化预算与降级语义：工作预算是唯一语义预算，墙钟 abort-only，累计 cut 按 segments。**不扩 `BudgetProfile` 闭集。**

### 允许文件

- `packages/contracts/src/playability/temporal-budget.ts` / `temporal.ts` / `temporal-witness.ts` / `temporal-evasion.ts`（仅缺口）
- `packages/contracts/tests/playability-temporal-budget.test.ts` / `playability-temporal.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`

### 必须完成

1. 核对并补齐：`maxStates 500k/1M`、`timeBudgetMs 2s/10s`、`maxCutsPerCheck 1M`、`maxCutsPerBranch 5M/10M`（segments = cutPoints + 1）、`maxWitnessTransitions 1M`、`maxWitnessBytes 64 MiB`、`maxHopSamples 240/arc`、`timeBudgetCheckpointWork 1024`、`maxEdges` 防溢出。
2. 触发顺序与降级原因：状态 / edge 预算不得被累计 cut 先触发而改写原因；触顶 ⇒ `INSUFFICIENT_EVIDENCE` + 对应 `budgetKind`；不得提升部分结果。
3. 非法预算：非有限、`timeBudgetMs ≤ 0`、`maxStates < 1`、派生上界溢出 ⇒ `invalid-budget` / `budget-bound-overflow`；不得回退默认值。
4. `phaseGridCapped` 只作诊断，不是降级 Verdict；`N < 2` ⇒ `grid-resolution-infeasible`。
5. Witness 体积：`1M` 转移或 `64 MiB` 任一超限 ⇒ `witness-volume`。
6. 双档「不完整」与「不一致」使用不同原因（`wall-clock-abort` / `budgetKind` vs `lag-disagreement`）；不得伪装。
7. 测试：刚好达上限 / 刚好超限、累计 cut、体积、非法预算、上界溢出、原因优先级；标题带 `[I02-0x][AC-08]` 编号。
8. 复跑 build / typecheck / budget + 全量测试。

### 禁止

- 扩 `BudgetProfile` / `DegradationReason` 闭集（需要 ⇒ STOP + HITL）；
- 按关卡配置预算；
- 重跑 / 扩预算 / 换算法掩盖失败；
- 新增依赖或白名单外文件。

### 验收

预算语义与 D5 / D5B 逐项一致；AC-08 测试通过；全量测试绿；diff 仅白名单文件。

## Answer

（resolved 时填写）
