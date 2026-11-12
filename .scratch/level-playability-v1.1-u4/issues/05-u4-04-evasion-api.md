# U4-04 图割模块 API 骨架与输入契约

Type: task
Status: open
Owner: —
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
