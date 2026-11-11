# U1-03 `temporal.ts` 类型、签名辅助与导入

Type: task
Status: resolved
Owner: claude (wayfinder session 2026-11-11)
Blocked by: 02, 03
Map: ../map.md
Class: U1 / IMPLEMENTATION

## Task

在 `temporal.ts` 增加内部类型、导入与确定性签名辅助。**不实现 `analyzeTemporalInternal`。**

### 允许文件

- `packages/contracts/src/playability/temporal.ts`（只增）

### 必须实现

- 导入 `temporal-result.ts` / `temporal-budget.ts` / `temporal-motion.ts` 的内部类型与函数。
- `TemporalInternalInput`：`config`、`manifest`、`lagMs`、`trustedInput`、可选 `testHooks?: { budget?: InternalBudget; now?: () => number }`。
- `TemporalInternalAnalyzer` 类型。
- `determinismSignature(result: TemporalInternalResult): string`：纯 JS FNV-1a 32-bit；规范化 JSON；只覆盖 U1 子集（motion 结果 + 预算计数 + `certificate: { kind: "none" }` + U1 诊断码）；排除 `wallClockMs` / `detail` / test hooks。
- 不导出到 `playability/index.ts` / `contracts/src/index.ts`。

### 禁止

- 实现 `analyzeTemporalInternal` 或任何完整分析入口；
- 改变既有导出、`TemporalAuditResult`、`auditPlayabilityTemporal` 行为或 `stubTemporalAnalyzer` 的存在；
- 新增 `analyze:` 属性标签、`auditPlayabilityTemporal(` 调用、`Symbol(`、`TEMPORAL_LAG_*` 同名常量；
- 测试文件（U1-04 负责）；
- U2–U5 语义。

### 验收

`pnpm build` / `pnpm typecheck` 通过；T-57 / T-58 / T-61 / T-62 / T-64 通过；`git diff` 只含 `temporal.ts`。

## Answer

**2026-11-11 完成。只改 `temporal.ts`（纯增）；未实现 `analyzeTemporalInternal`，未接生产。**

### 产出

- `TemporalInternalInput`：`config` / `manifest` / `lagMs` / `trustedInput` + 可选 `testHooks`（`budget?: InternalBudget`、`now?: () => number`）。
- `TemporalInternalAnalyzer` 类型。
- `determinismSignature(result: TemporalInternalResult): string`：纯 JS FNV-1a 32-bit（UTF-16 code units），8 位十六进制串；先做对象键排序的规范化 JSON。
  - 覆盖：`internalResult`、`certificate`、`stats.grid`、`stats.work`、`stats.budget` 状态 / `budgetKind`、`diagnostics` 原因码。
  - 排除：`stats.timing.wallClockMs`、`diagnostics.detail`、时间戳、`testHooks`、`budgetProfile`。
- 既有 I-01 导出、`TemporalAuditResult`、`auditPlayabilityTemporal`、`stubTemporalAnalyzer` 逐字未动。

### 与票面的差异（唯一一处）

票面要求「导入 result / budget / motion 的内部类型与函数」。U1-03 **只引用了 `temporal-result.ts`** 的 `InternalBudget` / `TemporalInternalResult`；budget 与 motion 没有任何符号在本票落地（分析入口明确禁止实现），为满足字面要求而加未使用的 import 属于死代码。DAG 依赖本身未变（motion → budget → result）；等真正的内部编排入口落地时再引入。

### 验证

- `pnpm typecheck` exit 0；`pnpm build` exit 0。
- `playability-temporal-input.test.ts`：65/65 PASS；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 原样通过。
- `pnpm test`：170 files / 2616 tests passed；2 条已知 Vitest worker RPC 超时（与基线一致）。
- 一次性 dist 冒烟（未入库）：8 位十六进制、重复运行相等、键序无关；`wallClockMs` / `detail` / `budgetProfile` 不改变签名；`work` 计数、原因码、预算状态、`grid` 变化均改变签名。
- `git status` 仅 `temporal.ts`；新符号未进入 `playability/index.ts` / `contracts/src/index.ts` / `api.ts`。

### 下游

U1-04（测试矩阵与 TEST_ONLY 夹具）进入 frontier。
