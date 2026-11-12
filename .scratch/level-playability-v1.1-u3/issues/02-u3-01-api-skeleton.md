# U3-01 门区模块 API 骨架与输入契约

Type: task
Status: open
Owner: —
Blocked by: 01
Map: ../map.md
Class: U3 / IMPLEMENTATION

## Task

新建 `packages/contracts/src/playability/temporal-gate.ts`，只建立**门区半部**的 API 骨架与输入契约。**不实现几何公式、周期覆盖、判侧或注入。**

### 允许文件

- `packages/contracts/src/playability/temporal-gate.ts`（新增）
- `packages/contracts/tests/playability-temporal-gate.test.ts`（新增；本票只放 API / 形状断言）
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，仅在确需时扩展）

### 必须完成

1. 定义并导出 `computePermanentGate(...)` 的输入 / 输出类型。输入必须是**已派生的显式几何**，不自行解析 `GameConfig`：运动参数、Hazard 盒规格、玩家几何、精确 spawn 盒、`goalRect`、以及只读 graph 句柄。
2. 输出限定为：
   ```ts
   {
     gate: { L; R; width; y; height; epsilon } | null,
     periodCoverage: { periodMs; complete; intervals } | null,
     sideRule: { direction; spawnBox; goalRegion } | null,
     forbiddenInjection: { gateRect; expandedRect; source: "forbiddenBoxes" } | null,
     gateStatus: "COMPLETE" | "INCOMPLETE",
     reason: DegradationReason | null,
   }
   ```
   `gate` 等字段的最终类型必须能无损耗地嵌入 D9 `PermanentGateProof` 的对应半部；**不得**在本模块定义与 D9 冲突的同义类型。
3. 失败原因只允许 D9 `DegradationReason` 闭集：本单元使用 `no-permanent-gate` / `geometry-untrusted`；**不新增原因码**。
4. 模块头注释写明：U3 只产出门区半部；`graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure` / 完整 `PermanentGateProof` / 完整 `TemporalInternalResult` 归 U4/U5。
5. 依赖边界：只 import `temporal-result.ts` / `temporal-budget.ts` / `temporal-motion.ts` 与 `geometry.ts` 类型；**不得** import `temporal.ts`、`temporal-witness.ts`。
6. 不新增公共 barrel 导出；内部符号标 `@internal`。
7. 骨架先返回 `INCOMPLETE` + `no-permanent-gate`，后续票逐段填充；测试断言形状与失败原因闭集。

### 禁止

- 实现 `L/R` 公式、周期覆盖、判侧、`forbiddenBoxes` 注入；
- 生成 U4 字段或完整证书；
- 修改 `temporal.ts` / `graph.ts` / `reach.ts` / 既有测试 / JSON fixture；
- 新增依赖或公共导出。

### 验收

`pnpm build` / `pnpm typecheck` exit 0；新增定向测试通过；T-55 / T-62 / T-64 与「不 import temporal.ts」断言通过；diff 仅白名单文件。

## Answer

（resolved 时填写）
