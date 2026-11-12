# U1-01 内部结果类型与预算骨架

Type: task
Status: resolved
Owner: claude (wayfinder session 2026-11-11)
Blocked by: 01
Map: ../map.md
Class: U1 / IMPLEMENTATION

## Task

实现 U1 的内部结果类型与预算接口骨架。**不实现 `analyzeTemporalInternal`。**

### 允许文件

- `packages/contracts/src/playability/temporal-result.ts`（新增）
- `packages/contracts/src/playability/temporal-budget.ts`（新增）

### `temporal-result.ts`（纯类型）

按已签署授权包 §6 / D9 冻结：

- `InternalResultState`、`ProofStatus`、`Certificate`、`TemporalInternalResult`；
- `Witness`、`WitnessTransition`、`PolicyTermination`；
- `PermanentGateProof`、`PuCondition`、`PuConditionId`、`GeometryCoverage`、`HopSampleSummary`；
- `Stats`、`Diagnostics`、`DegradationReason`、`BudgetKind`。

约束：只允许从 `./geometry.js` 引入 `Aabb` / `Vec` / `Size` 类型；不得引入任何 I-02 模块；不得导入 `temporal.ts`；纯类型、无运行时代码。

### `temporal-budget.ts`

- `BudgetProfile`：D5 / D5B 冻结的默认值与硬上限（`maxStates`、`maxEdges`、`timeBudgetMs`、`maxCutsPerCheck`、`maxCutsPerBranch`、`maxWitnessTransitions`、`maxWitnessBytes`、`maxHopSamples`、`timeBudgetCheckpointWork`）。
- `InternalBudget = Partial<BudgetProfile>`（测试专用）。
- 预算合法性校验：非有限、`timeBudgetMs ≤ 0`、`maxStates < 1`、派生上界溢出。
- work counter、checkpoint（按 work units）、wall-clock abort（注入 `now`，只 abort）。
- `budgetStatus`（`complete | exhausted | aborted | invalid`）、`budgetKind`。
- `maxCutsPerCheck`（cutPoints）与 `cutPointsTotal` / `segmentsTotal` 计数。
- **定义但不执行** `maxCutsPerBranch`；不创建 U2 搜索 / Witness / 网格计数器。

### 禁止

- `analyzeTemporalInternal` 或任何完整分析入口；
- 测试文件（U1-04 负责）；
- 公共 barrel 导出；
- 修改 `temporal.ts`（U1-03 负责）；
- 任何 U2–U5 语义。

### 验收

`pnpm build` / `pnpm typecheck` 通过；`git diff` 只含上述两个文件；无公共导出。

## Answer

**2026-11-11 完成。只新增 `temporal-result.ts` / `temporal-budget.ts`；未触碰 `temporal.ts`、barrel 或测试。**

### 产出

- `temporal-result.ts`：D9 §1–§5 / §11 的纯类型全集 —— 顶层结果与 `certificate` 联合、W1 Witness、`PermanentGateProof`、`Stats`、`Diagnostics`（原因码与 `BudgetKind` 闭集）、`BudgetProfile` / `InternalBudget`。无运行时代码，只从 `./geometry.js` 引 `Aabb`。
- `temporal-budget.ts`：D5 / D5B 默认值与硬上限、派生上界、合法性检查、work counter、按 work units 的墙钟检查点、`maxCutsPerCheck` 与 `cutPointsTotal` / `segmentsTotal` 计数。

### 设计与票面差异（均为 DAG / D5 约束所致）

- `BudgetProfile` / `InternalBudget` 类型落在 `temporal-result.ts`，不在 budget 模块：`Stats.budget.budgetProfile` 需要它，而 D6 DAG 禁止 result 反向导入 budget。budget 模块只持有常量与函数。
- `maxEdges` 按 D5 §3.2 在**解析时**派生（`maxStates × maxBranching`），因此没有静态默认值：`BUDGET_DEFAULTS` 是 `Omit<BudgetProfile, "maxEdges">`，`deriveMaxBranching` / `deriveMaxEdges` 供 U2 计算网格后调用。
- 新增别名 `BudgetStatus`（等价于 D9 `Stats.budget.budgetStatus` 的内联联合），供 budget 模块复用，不改变任何字段形状。

### 冻结行为

- 校验：非有限 / 非整数 / `timeBudgetMs ≤ 0` / `maxStates < 1` / `timeBudgetCheckpointWork < 1` / 超过硬上限 ⇒ `invalid-budget`；派生上界非安全整数（含 `maxEdges` 覆盖值）⇒ `budget-bound-overflow`。**不回退默认值。**
- 计数：`chargeWork` 累加 work units，每满 `timeBudgetCheckpointWork` 读一次注入的 `now`；`chargeCheck(cutPoints)` 先判 `maxCutsPerCheck`，通过后累计 `cutPointsTotal` 与 `segmentsTotal = cutPoints + 1`，并计 1 work unit。`maxCutsPerBranch` 只定义、不执行（U2）。
- 停止单向：`exhausted | aborted` 一旦成立不再改变；`finish()` 做最后一次墙钟检查，未触发则定格 `complete` / `budgetKind = null`。

### 验证

- `pnpm typecheck` exit 0；`pnpm build` exit 0。
- `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts`：65/65 PASS；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 原样通过。
- `pnpm test`：170 files / 2616 tests passed；2 条已知 Vitest worker RPC 超时（与 U1-00 基线一致，非产品失败）。
- 一次性 dist 冒烟（未入库）：默认值、非法预算、硬上限、溢出、cut 计数、注入时钟 abort、`finish()` 定格均符合预期。正式测试矩阵由 U1-04 落地。
- `git status` 仅两个新增文件；barrel 未导出；`analyze:` / `Symbol(` / `node:fs|crypto` / `TEMPORAL_LAG_*` 零命中。

### 下游

U1-02（运动原语）仍 unblocked；U1-03 继续等待 U1-02。
