# U2-01 状态格、静态走廊、精确 spawn 与目标状态

Type: task
Status: open
Owner: —
Blocked by: 01
Map: ../map.md
Class: U2 / IMPLEMENTATION

## Task

在 `temporal-witness.ts` 建立状态空间与几何前置。**不做 wait / move 验证，不做 U9 / W。**

### 允许文件

- `packages/contracts/src/playability/temporal-witness.ts`（新增）
- 只读引用：`graph.ts`、`reach.ts`、`targets.ts`、`profile.ts`、`game-config.ts`、`geometry.ts`、`temporal-motion.ts`、`temporal-budget.ts`、`temporal-result.ts`

### 必须实现

- **网格**：`xStep = 1`；`N_max = floor(maxSpeed·P/xStep)`；`N = min(N_max, floor(maxStates/xPositions))`；`N ≥ 2`；`dt = P/N`；`maxStep = maxSpeed·dt`；`stateCapacity = xPositions·N`；`phaseGridCapped` / `phaseCapReason`。`N < 2` ⇒ IE `grid-resolution-infeasible`。
- **静态走廊**：`buildMovementGraph` 基础图（不带 moving-hazard 静态掩码）；spawn 脚点 y 上的 `standable` 连通段，`source: "standable-run"`；Hazard 只进 `forbidden`；**不使用 `startCells()`**。
- **精确 spawn**：`config.player.at` 按脚点解释，经 `boxFromFoot` 派生；完全在世界内且不与 `graph.solids` 严格重叠；`footX` / `footY` 必须整数，否则 IE `spawn-not-on-lattice` / `spawn-not-standable`；**禁止 `round()` 吸附**。
- **目标**：`runtimeEntityGeometry` 的取整盒；四边各内缩 `0.5px`；到达 = `overlapsStrict(未取整玩家盒, deflated)`；退化 / 空 ⇒ IE `goal-rect-degenerate`；没有任何合法格点满足 ⇒ IE `goal-not-representable`。
- **合法范围**：`x_left ∈ [0, W − pw]`、`y_top ∈ [0, H − ph]`；越界是非法状态，不 clamp。
- **类型**：`WitnessGrid` / `StaticCorridor` / `SpawnCell` / `Arrival`；字段确定、排序稳定。
- 失败只用 D9 已冻结原因码；不得临时加自由字符串。

### 禁止

- wait / move 转移、S1–S4、U9、W、Witness 编码；
- 修改 `temporal.ts` / budget / result / graph / profile；
- 测试文件（U2-06 负责）；公共导出；U3–U5 语义。

### 验收

`pnpm build` / `pnpm typecheck` 通过；`git diff` 只含 `temporal-witness.ts`；无公共导出；无 `analyze:` 标签。
