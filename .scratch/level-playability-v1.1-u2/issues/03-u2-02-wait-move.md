# U2-02 wait / move、S1–S4 与预算计数

Type: task
Status: resolved
Owner: claude (U2-02 session 2026-11-12)
Blocked by: 02
Map: ../map.md
Class: U2 / IMPLEMENTATION

## Task

实现状态转移与四条验证义务。**不做 U9 / W / Witness 编码。**

### 允许文件

- `packages/contracts/src/playability/temporal-witness.ts`（只增）
- 只读引用：`temporal-motion.ts`、`temporal-budget.ts`、`temporal-result.ts`、`geometry.ts`、`graph.ts`

### 必须实现

- **状态**：`(footX, k)`；`wait(x,k) → (x,(k+1) mod N)`；`move(x,k) → (x',(k+1) mod N)`，恒速线性，`|x'−x|/dt ≤ maxSpeed`，方向任意。
- **S1**：`move` 对 `graph.solids` 做静态连续检查——玩家盒 x 线性移动，任一正宽度重叠 ⇒ 失败；**不得只查端点 `standable`**。
- **S2**：按折返点切段 + `lagPad`，调用 motion 的解析连续求交；任意正宽度碰撞区间 ⇒ 失败；相切不算撞；ε 不进碰撞谓词。
- **S3**：区间恰为一个相位格；时间 / 相位连续、可达；不得跨格。
- **S4**：`t1_prev = t0_next`、`x1_prev = x0_next`、相位格恰好 +1 (mod N)、玩家 y 与盒定义不变。
- **残差等待**：每个 `C_k` 从 `φ0` 到 `(k+1)·dt` 的整格保守验证（跨折返点切段），不得只查端点；`symbolic: true`。
- **预算**：`statesEnqueued` / `statesVisited` / `edgesChecked`；`maxStates` / `maxEdges` / `maxCutsPerBranch`（`segmentsTotal`）；wall-clock 只 abort；耗尽 ⇒ IE，不得输出部分 witness。
- 确定性排序；不得依赖 `Set` / 对象键枚举 / 墙钟。

### 禁止

- U9 / W 证书；Witness 编码；修改 budget / result / `temporal.ts`；测试文件；公共导出。

### 验收

`pnpm build` / `pnpm typecheck` 通过；diff 只含 `temporal-witness.ts`；S1–S4 失败语义只产生无效转移，不抛未处理异常。

## Answer

**范围**：只新增 `packages/contracts/src/playability/temporal-witness.ts`（产品目录唯一改动；U2-01 导出与语义未变，只更新模块头注释）。未改 `temporal-motion.ts` / `temporal-budget.ts` / `temporal-result.ts` / `graph.ts` / `geometry.ts` / `game-config.ts` / 测试 / 公共 barrel / 依赖 / fixture。未实现 U9 / W / Witness 编码，未组装 `TemporalInternalResult`；未推送 / 未开 PR / 未启动 U2-03。

### 实现摘要

- **状态与转移**：`WitnessState = { footX, k }`；`wait(x,k) → (x,(k+1) mod N)`、`move(x,k) → (x',(k+1) mod N)`，恒速线性，`|Δx| ≤ maxStep (= maxSpeed·dt)`。相位格边界 `witnessPhaseCellBounds(grid,k,cycle)`：`t0 = cycle·P + k·dt`、`t1 = cycle·P + (k+1)·dt`（`k=N−1` 折到 `(cycle+1)·P`）；相邻格 `t1_prev === t0_next` 在浮点上逐位相等（S4 无需容差）。`cycle` 是可选整周期偏移。
- **S1 静态连续**：玩家盒 x 线性移动 ⇒ 扫掠并集 `[min(x0,x1), max(x0,x1)+w]`（y 不变）。对 `graph.solids` 逐个 `overlapsStrict`；正宽度重叠 ⇒ 失败。该判据与「存在正时长的严格 x 重叠」等价（连续移动区间的并集），因此能抓住两端 `standable` 但跨过 solid 的 `move`，不是端点采样。谓词仍是唯一的 `overlapsStrict`，未复制第二套碰撞语义。
- **S2 Hazard 连续**：先按折返点 `m·P/2` 切段（`monotoneBoundaries`），每段用 `pieceSlope` 取该段方向；`pad = |slope|·lagMs`。上升段构造 `w' = w+pad`、`anchor.x' = (anchor.x·w)/(w+pad)`（左缘不动、右缘加宽）；下降段 `anchor.x' = (anchor.x·w+pad)/(w+pad)`（左缘加宽）；`size.h` / `anchor.y` 不变。逐段调用 `intersectContinuous`（玩家盒按 `a` 时刻平移），**不跨折返点共用 pad**，不重写解析求交。`intervals` 任一 `end > start` ⇒ 失败；`intervalTolerance = 0`，相切不算撞，ε 不进谓词，不设最小安全窗口。
- **S3**：`k` 为整数且在 `[0,N)`、`to.k === (from.k+1) mod N`、区间恰为 `[t0,t0+dt)` 且 `t1 > t0`；跨格 / 非整数相位 ⇒ `phase` 失败。
- **S4**：`verifyTransitionChain(space, transitions)` 检查每条相位 +1、`x1_prev = x0_next`、`t1_prev = t0_next`（允许整周期偏移，兼容 canonical 时间与累计 `cycle` 两种记录方式）。玩家 y / 盒定义由 `space` 固定（`witnessPlayerBox` 只用 footX），无需逐条比较。
- **残差等待**：`verifyResidualWait` 对每个 `C_k` 做整格覆盖：跨折返点切段，每段取「并集扫掠盒 + 该段方向 `lagPad`」，与 `space.spawn.box` 做 `overlapsStrict`。输出 `symbolic: true` / `residualWait: "conservative-over-cell"`；任一碰撞 ⇒ 该格失败。**不检查格端点**。残差等待是 `wait`，spawn 盒由 U2-01 保证不压 solid，故不重复 S1。
- **预算**：`createWitnessWorkBudget({ profile, now? })` 复用 `createBudgetTracker`；`recordCheck(cutPoints)` 把 `intersectContinuous` 的 `cutPoints` 交给 `chargeCheck`，并按 `segmentsTotal + cutPoints + 1 > maxCutsPerBranch` 先投影再记账（D5 §3.1）。`maxStates` 在 `statesEnqueued` 与 `statesVisited` 两个计数器上分别执行（visited ≤ enqueued；U9 的 processed 状态也受约束），`maxEdges` 按 `edgesChecked`。任一耗尽返回 `BudgetStop`（`state-budget-exhausted` / `edge-budget-exhausted` / `cut-budget-exhausted` / `wall-clock-abort`），不输出部分结果。墙钟只 abort，检查点粒度由 `timeBudgetCheckpointWork` 决定，不参与策略 / 碰撞。
- **确定性**：solid 按 `graph.solids` 数组序、切段按时间升序、计数器只做整数累加；无 `Set` / 对象键枚举 / 墙钟分支。

### API（`@internal`，仅模块内相对导入，不进 barrel）

```ts
type WitnessState = { footX: number; k: number };
type WitnessHazard = { motion: TriangleMotion; box: HazardBoxSpec };
type TransitionKind = "wait" | "move";
type TransitionFailureKind = "state" | "speed" | "phase" | "static" | "hazard"
  | "continuity" | "budget" | "model-out";
type PhaseCellBounds = { t0: number; t1: number };
witnessPhaseCellBounds(grid, k, cycle?): PhaseCellBounds

type WitnessWorkSnapshot = { statesEnqueued; statesVisited; edgesChecked;
  cutPointsTotal; segmentsTotal; budgetStatus; budgetKind;
  workUnitsSinceLastCheckpoint; wallClockMs; timeBudgetCheckpointWork };
type WitnessWorkBudget = { profile; tracker;
  enqueueState(count?); visitState(count?); checkEdge(count?);
  recordCheck(cutPoints); chargeWork(units?); snapshot(); finish() };
createWitnessWorkBudget({ profile, now? }): WitnessWorkBudget

type TransitionCheckInput = { space; hazard; lagMs; from; to; cycle?; budget };
type TransitionCheck = { kind; from; to; t0; t1; playerSpeedX;
  verified; failure; cutPoints; segments; budgetStop };
verifyTransition(input): TransitionCheck

type TransitionChainCheck = { ok: true } | { ok: false; index; failure: "continuity" };
verifyTransitionChain(space, transitions): TransitionChainCheck

type ResidualWaitInput = { space; hazard; lagMs; cell; cycle?; budget };
type ResidualWaitCheck = { cell; t0: { kind: "cell-start"; cell; symbolic: true };
  t1; symbolic: true; residualWait: "conservative-over-cell";
  verified; failure; segments; budgetStop };
verifyResidualWait(input): ResidualWaitCheck
```

`speed` / `state` / `phase` 是结构合法性（不是 S1–S4 之外的第三种原语）；`model-out` 覆盖非有限输入。失败原因只在本模块内部，未新增 D9 原因码。

### 验证

- `pnpm build`：exit 0；`pnpm typecheck`：exit 0。
- `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts`：**65/65**（T-55/57/58/61/62/64 原样通过）。
- 架构扫描：无 `analyze:` 标签、`auditPlayabilityTemporal(`、`Symbol(`、`TEMPORAL_LAG_*`、`node:fs` / `node:crypto`；不 import `temporal.ts`；无新公共 barrel 导出。
- `git status` / `git diff --stat`：产品路径只含 `packages/contracts/src/playability/temporal-witness.ts`。
- 一次性本地探针（不入库，合成 `WitnessSpace`；真实配置的下游由 U2-06 覆盖）：
  - **S1 跨 solid**：`maxStep=10`、solid `x∈[10,11]`、玩家 `footX 9 → 12`。两端玩家盒都只与 solid **相切**（端点 `standable` 均成立），S1 判 `static`；说明不是端点检查。
  - **S2 折返点切段**：`P=100`、`N=3`、`dt=100/3`，格 1 跨 `t=50` 折返点。远离玩家时 `segments=2`（两段各自求交，`cutPoints=0`）；玩家在 Hazard 路径上时 `hazard`。
  - **S2 pad 方向**：上升段远方玩家 `lag=0` 安全、`lag=100`（pad=8px）判 `hazard`；下降段同理；静态相切（`lag=0`）安全。方向按段正确。
  - **残差等待整格**：hazard 在 `C_0` 内扫过 spawn ⇒ `hazard`；`C_1` 的安全范围 ⇒ `verified`；`symbolic / conservative-over-cell` 输出正确。
  - **预算**：`maxStates=1` ⇒ `state-budget-exhausted`；`maxEdges=1` 的第二条边 ⇒ `edge-budget-exhausted`；`maxCutsPerBranch=1` 的第二次 `recordCheck` ⇒ `cut-budget-exhausted`；注入时钟超 `timeBudgetMs` ⇒ `wall-clock-abort`；`snapshot` 中 `statesEnqueued` / `statesVisited` / `edgesChecked` / `cutPointsTotal` / `segmentsTotal` 分列。

### 与票面的差异 / 说明

- 残差等待按票面用「并集 + pad 扫掠盒 + `overlapsStrict`」，不调用 `intersectContinuous`；因此它只计 work units，不增加 `segmentsTotal`（读段数在结果的 `segments` 字段）。`maxCutsPerBranch` 仍按 `intersectContinuous` 的 `segmentsTotal` 执行。
- `maxStates` 在 enqueued 与 visited 两个计数器上都执行：W 的 visited ≤ enqueued 不会提前触发；U9 的 processed 状态单独记账时也受同一预算约束。
- S4 链检查允许 `t1_prev − t0_next ∈ {0, P}`：既支持调用方累计 `cycle` 的绝对时间，也支持每周期 canonical 时间；其它偏移一律 `continuity` 失败。
- 残差等待不重复 S1：spawn 盒已由 U2-01 的 `spawn-box-overlaps-solid` 前置检查保证不压 solid。

### 下游 U2-03

- 状态枚举 `(x ∈ [corridor.xLo, corridor.xHi], k ∈ [0,N))`，后继相位 `(k+1) mod N`、`|Δx| ≤ grid.maxStep`；每条候选边调用 `verifyTransition`（`kind` 自动区分 wait / move）。
- 每个相位格先调用 `verifyResidualWait({ cell: k, ... })`；失败 ⇒ 该格不覆盖 ⇒ IE。
- 只把 `verified: true` 的转移放进策略；策略轨迹用 `verifyTransitionChain` 做 S4 复核。
- 预算：`createWitnessWorkBudget` 的 `enqueueState` / `visitState` / `checkEdge` / `recordCheck` / `snapshot` / `finish` 可直接作为 W 的计数与 IE 信号；`BudgetStop` 不得被忽略或降级为部分 witness。
