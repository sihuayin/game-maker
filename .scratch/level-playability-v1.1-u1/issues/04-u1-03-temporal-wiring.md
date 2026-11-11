# U1-03 `temporal.ts` 类型、签名辅助与导入

Type: task
Status: open
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
