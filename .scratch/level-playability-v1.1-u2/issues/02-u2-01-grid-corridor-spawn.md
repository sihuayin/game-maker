# U2-01 状态格、静态走廊、精确 spawn 与目标状态

Type: task
Status: resolved
Owner: claude (U2-01 session 2026-11-12)
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

## Answer

**范围**：只新增 `packages/contracts/src/playability/temporal-witness.ts`（产品目录唯一改动）；未改 `temporal.ts` / budget / result / graph / profile / 测试 / 公共 barrel / 依赖 / fixture。未实现 wait / move、S1–S4、U9、W、Witness 编码；未推送 / 未开 PR / 未启动 U2-02。

### 实现摘要

- **单位**：`config.player.move.speed` 是 **px/s**（`PlayerMove` 注释与 `jumpVelocity` / `gravity` 同域），连续核心是 **px/ms**。入口显式 `/ 1000`，导出 `maxSpeedPxPerMs` / `maxStep` 只给 px/ms。
- **网格**：`xStep = 1`、`N_max = floor(maxSpeedPxPerMs · periodMs / xStep)`、`N = min(N_max, floor(budget.maxStates / xPositions))`、`N ≥ 2` 否则 IE `grid-resolution-infeasible`、`dtMs = periodMs / N`、`maxStep = maxSpeedPxPerMs · dtMs`、`stateCapacity = xPositions · N`、`phaseGridCapped = N < N_max`、`phaseCapReason = "state-capacity" | null`。`budget` 只读、只用 `maxStates`；不解析 / 不校验预算、不建 tracker。
- **静态走廊**：`buildMovementGraph(config, manifest, profile)` 基础图（**不带** moving-hazard 静态掩码）；从 spawn 脚点沿同 y 向两侧扩展 `standableAt`，再按合法范围裁剪：脚点 x 必须满足 `x − pw/2 ∈ [0, W − pw]` ⇒ `[ceil(pw/2), floor(W − pw/2)]`，越界不 clamp。`source: "standable-run"`；不使用 `startCells()`。
- **精确 spawn**：`config.player.at` 按脚点解释，`boxFromFoot(at, graph.player.size)`；**不**经 `footOf`、**不** `round()`。检查顺序固定：整数格 → 盒在世界内（`contains`）→ 不与 `graph.solids` 严格重叠 → `standableAt`。
- **目标 / 到达**：`config.objective.gate` 经 `runtimeEntityGeometry` 取**取整盒**（`entityBox` 已 `Math.round`），`expandBox(goalRect, -0.5)`；退化（`w ≤ 0` 或 `h ≤ 0`，即 `1×n` / `n×1`）⇒ IE `goal-rect-degenerate`。到达 = `overlapsStrict(未取整玩家盒(footX), deflatedGoalRect)`，只在状态边界判定、与 `k` 无关；遍历走廊整数脚点，无任何满足者 ⇒ IE `goal-not-representable`（含目标在走廊 / y 带外）。
- **确定性**：整数升序遍历、无 `Set`、无对象键枚举、无时钟；不抛未处理异常（全部走判别联合）。
- **D9 闭集约束（与票面字面的一处差异）**：D3 §3.4 的 `spawn-not-standable` 不在 D9 §5 冻结原因码闭集里，而 D9 明确「新增原因必须改 D9 / AUTH」。本票**不扩闭集**：spawn 侧四类缺口统一 `reason: "spawn-not-on-lattice"`，再用本模块内部 `gap`（`spawn-foot-not-integer` / `spawn-box-out-of-world` / `spawn-box-overlaps-solid` / `spawn-not-standable`）区分；`gap` 只用于诊断与测试，不进 `DegradationReason`。同理：玩家资源解不出（`buildMovementGraph` 返回 `null`）⇒ `geometry-untrusted`；目标侧缺口 ⇒ `goal-not-representable` / `goal-rect-degenerate`；周期非法 ⇒ `grid-resolution-infeasible`。

### API（`@internal`，仅模块内相对导入，不进 barrel）

```ts
type WitnessGrid = { periodMs; phaseSteps; N_max; dtMs; xStep; maxSpeedPxPerMs;
                     maxStep; xPositions; stateCapacity; phaseGridCapped;
                     phaseCapReason: "state-capacity" | null };
type StaticCorridor = { footY; xLo; xHi; source: "standable-run" };
type SpawnCell = { footX; footY; box: Aabb; latticeAnchor: "foot-x" };
type Arrival = { predicate: "overlapsStrict(playerBox, deflate(goalRect, 0.5))";
                 goalId; goalRect: Aabb; deflatedGoalRect: Aabb; goalStates: readonly number[] };
type WitnessSpace = { ok: true; graph: MovementGraph; playerSize: Size; grid; corridor; spawn; arrival };
type WitnessSpaceGap = "player-geometry-missing" | "period-invalid" | "spawn-foot-not-integer"
  | "spawn-box-out-of-world" | "spawn-box-overlaps-solid" | "spawn-not-standable"
  | "phase-grid-infeasible" | "gate-missing" | "gate-asset-missing"
  | "goal-rect-degenerate" | "goal-outside-corridor";
type WitnessSpaceFailure = { ok: false; reason: DegradationReason; gap: WitnessSpaceGap };
type WitnessSpaceInput = { config; manifest; budget: BudgetProfile; periodMs: number;
                           profile?: FixedRuntimeProfile };

resolveWitnessSpace(input: WitnessSpaceInput): WitnessSpace | WitnessSpaceFailure
witnessPlayerBox(space: WitnessSpace, footX: number): Aabb   // 未取整玩家盒，footY 固定
witnessArrives(arrival: Arrival, playerBox: Aabb): boolean
inStaticCorridor(corridor: StaticCorridor, footX: number): boolean
```

`periodMs` 由编排层从移动 Hazard 解出后显式传入（本票不选 / 不合并多 Hazard）。

### 验证

- `pnpm build`：exit 0；`pnpm typecheck`：exit 0。
- `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts`：**65/65** 通过（T-55/57/58/61/62/64 原样通过）。
- 静态扫描：无 `analyze:` 标签、无 `Symbol(`、无 `TEMPORAL_LAG_*`、无 `node:fs` / `node:crypto`、不 import `temporal.ts`。
- `git status`：产品目录只新增 `packages/contracts/src/playability/temporal-witness.ts`。
- 一次性本地探针（不入库，真包 `fixtures/packs/last-train/v2` + `fixtures/game-configs/last-train.json`，`periodMs = 4000`、默认 `maxStates = 500000`）：
  - **真包**：luggage solid（`x=480`）截断 spawn 脚点 y（=250）的 `standable` 段 ⇒ 走廊 `[16, 464]`，gate（`x≈1400`）在走廊外 ⇒ IE `goal-not-representable` / `goal-outside-corridor`。符合 D3「目标不在走廊内不得推 PU」。
  - **探针配置**（内存删掉 luggage、其余同真包）：spawn `{footX:40, footY:250, box:{24,202,32,48}}`；走廊 `{footY:250, xLo:16, xHi:1424}`、`xPositions=1409`；`N_max=360`、`N=354`、`phaseGridCapped=true` / `"state-capacity"`、`dtMs≈11.2994`、`maxStep≈1.0169`、`stateCapacity=498786`；goal `rect {1392,210,16,40}` → deflated `{1392.5,210.5,15,39}`，`goalStates = 1377..1423`（47 个，升序、无重复；`1376` 不到达、`1377` 到达）。
  - **负向探针**：非整数脚点 ⇒ `spawn-not-on-lattice/spawn-foot-not-integer`；盒出世界 ⇒ `…/spawn-box-out-of-world`；压 solid ⇒ `…/spawn-box-overlaps-solid`；悬空 spawn ⇒ `…/spawn-not-standable`；目标 y 带外 ⇒ `goal-not-representable/goal-outside-corridor`；gate 缺 ⇒ `…/gate-missing`；`period 0` / `NaN` ⇒ `grid-resolution-infeasible/period-invalid`；`maxStates=1|5`（N<2）⇒ `…/phase-grid-infeasible`；1px 宽目标 ⇒ `goal-rect-degenerate`；玩家资源缺失 ⇒ `geometry-untrusted`。
- 注意：容量粗化后 `maxStep > xStep` 是**预期**行为（`maxStep = maxSpeed·dt`）；S1 连续检查与残差等待的整格覆盖因此不可省。

### 下游 U2-02

直接消费 `space.graph`（`solids` 做 S1、`standableAt` 做格点合法性）、`space.grid`（`phaseSteps` / `dtMs` / `maxSpeedPxPerMs` / `maxStep` / `periodMs`）、`space.corridor`（`xLo..xHi` 全部是合法整数脚点）、`space.spawn`（`(footX, k)` 起点集）、`space.arrival.goalStates`（与 `k` 无关的到达脚点）；盒派一走 `witnessPlayerBox` / `witnessArrives`。`WitnessSpaceFailure.reason` 可直接进 `diagnostics.degradationReason`（D9 闭集），`gap` 只作 `detail` 级说明。
