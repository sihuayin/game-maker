# U1-01 内部结果类型与预算骨架

Type: task
Status: open
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
