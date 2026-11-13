# U4-04 图割模块 API 骨架与输入契约

Type: task
Status: resolved
Owner: claude (U4-04 session 2026-11-13)
Blocked by: 04
Map: ../map.md
Class: U4 / IMPLEMENTATION

## Task

新建 `packages/contracts/src/playability/temporal-evasion.ts`，只建立**垂直规避图割半部**的 API 骨架与输入契约。**不实现图割判据、hop 双档或模型闭合。**

### 允许文件

- `packages/contracts/src/playability/temporal-evasion.ts`（新增）
- `packages/contracts/tests/playability-temporal-evasion.test.ts`（扩展；本票只放 API / 形状断言）
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，仅在确需时扩展）

### 必须完成

1. 定义并导出 `computePermanentEvasion(...)` 的输入 / 输出类型（名称可调整，但必须 `@internal`）。输入必须是**已派生的显式几何**，不自行解析 `GameConfig`：
   - 精确 spawn 脚点格；
   - `goalRegion`（**已外扩 0.5px** 的 AABB）；
   - `gateRect` 或其 `y` / `height` / `L` / `R`（由调用方传入，**不得 import `temporal-gate.ts`**）；
   - `move`（MoveParams / profile）与只读 graph 句柄。
2. 输出限定为：
   ```ts
   {
     graphCut: { verdict: "conditional"; reachableFootpoints; goalIntersections; midAirHits; evidence } | null,
     hopDoubling: { base; doubled; connectivityPreserved; normalizedCoverage } | null,
     hopSamplingCoverage: { covered; method: "normalized" | "insufficient" } | null,
     movementModelClosure: "not-proven-air-control",
     status: "COMPLETE" | "INCOMPLETE",
     reason: DegradationReason | null,
   }
   ```
   字段类型必须能无损耗地嵌入 D9 `PermanentGateProof` 的对应半部；**不得**定义与 D9 冲突的同义类型。
3. 失败原因只允许 D9 `DegradationReason` 闭集，并按地图 Notes 的冻结映射使用：`hop-sample-budget` / `hop-doubling-changed` / `graph-cut-incomplete` / `movement-model-unclosed` / `geometry-untrusted`。**不新增原因码**。
4. 模块头注释写明：U4 只产出图割半部；`puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` / 完整 `PermanentGateProof` / 完整 `TemporalInternalResult` / `certificate` 归 U5。
5. 依赖边界：只 import `temporal-result.ts` / `temporal-budget.ts` / `temporal-motion.ts` 与只读 `graph.ts` / `reach.ts` 既有符号；**不得** import `temporal.ts` / `temporal-gate.ts` / `temporal-witness.ts`。
6. 不新增公共 barrel 导出；内部符号标 `@internal`。
7. 骨架先返回 `INCOMPLETE` + `graph-cut-incomplete`，三个半部字段为 `null`；后续票逐段填充。
8. 测试断言：输出形状、原因闭集、输入契约（`goalRegion` 已外扩由调用方保证）、依赖边界。

### 禁止

- 实现 `assessReachability` 消费、hop 双档、模型闭合；
- 生成 U5 字段或完整证书；
- 修改 `graph.ts` / `reach.ts` / `temporal.ts` / 既有测试 / JSON fixture；
- 新增依赖或公共导出。

### 验收

`pnpm build` / `pnpm typecheck` exit 0；定向 evasion 测试通过；`playability-graph.test.ts` 默认等价断言仍通过；T-55 / T-62 / T-64 与「不 import `temporal.ts` / `temporal-gate.ts`」断言通过；diff 仅白名单文件。

## Answer

（resolved 时填写）

## Answer

**完成。** 图割半部 API 骨架与输入契约就位；未实现任何图割 / hop / 模型闭合语义。

| 项 | 结果 |
| --- | --- |
| 新增（白名单内） | `packages/contracts/src/playability/temporal-evasion.ts`（108 行，`567899d9…`） |
| 扩展 | `packages/contracts/tests/playability-temporal-evasion.test.ts`（`54469616…`，11 tests） |
| 入口 | `computePermanentEvasion(input: PermanentEvasionInput): PermanentEvasionHalf`（`@internal`） |
| 输入 | `spawnCell`（精确脚点格）/ `goalRegion`（已外扩 0.5px）/ `gateRect`（诊断）/ `move` / 只读 `graph` |
| 输出 | `graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure` / `status` / `reason`，半部类型取自 D9 索引类型 |
| 骨架行为 | 恒 `INCOMPLETE` + `graph-cut-incomplete`，三个半部 `null`；`movementModelClosure = "not-proven-air-control"` |
| 依赖边界 | 只 import `geometry` / `graph` / `temporal-result` 类型；不 import `temporal.ts` / `temporal-gate.ts` / `temporal-witness.ts` |
| 公共面 | 不进任何 barrel；导出符号全标 `@internal` |
| `pnpm build` / `pnpm typecheck` | 退出码 **0** / **0** |
| 定向 evasion 测试 | 退出码 **0**；**11 / 11 passed** |
| graph + gate + input | 退出码 **0**；**124 / 124 passed** |
| `pnpm test` | 退出码 **0**；**175 / 175 files，2806 / 2806 tests passed** |
| 白名单外改动 | **无**；STOP **未触发** |

证据：[`../evidence/04-evasion-api.md`](../evidence/04-evasion-api.md)（原始输出 `04-*.log`，本地保留不入库）。

**下游**：U4-05（图割判据与 reach 消费）已 **unblocked**。本票未启动 U4-05。
