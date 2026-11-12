# U2-03 全相位 Winning Set 与终止性

Type: task
Status: resolved
Owner: claude (U2-03 session 2026-11-12)
Blocked by: 03
Map: ../map.md
Class: U2 / IMPLEMENTATION

## Task

在 1D 走廊 × N 相位格上求最小不动点，并提取严格递减 rank 的策略。**不做 U9。**

### 必须实现

- `W = μX.(Goal ∪ Pre∃(X))`；只用 `wait` / `move` 与已实现的 S1–S4 安全边。
- 状态 `(x_i, k)`：`x_i` 在走廊栅格（`xStep = 1`，并入 spawn / goal 的 x）；后继相位 `(k+1) mod N`；`|Δx| ≤ maxSpeed·dt`。
- **全部 N 个半开相位格**覆盖；每格先验证 spawn 残差等待（U2-02），再搜索。
- 反向 BFS / 队列求**最小**不动点；每个状态记录有限 rank（到 goal 的步数）；策略只选 rank **严格递减**的后继。
- 终止性：有限完整轨迹或严格递减 rank；仅有逐边安全不足。
- 失败语义：未覆盖全部格 ⇒ IE `winning-set-failed`；预算耗尽 ⇒ IE；**绝不推 PU**。
- 确定性：固定遍历顺序、稳定排序、去重；不依赖 `Set` 枚举顺序。
- 输出：W 状态（complete / failed / insufficient）、policy / rank、覆盖计数、预算计数。

### 禁止

- U9；Witness 编码 / 体积；修改其它文件；测试文件（U2-06 负责）；公共导出。

### 验收

`pnpm build` / `pnpm typecheck` 通过；W 的最小不动点与 rank 语义由 U2-06 测试验证；diff 只含 `temporal-witness.ts`。

## Answer

**2026-11-12 完成。**产品路径只改 `packages/contracts/src/playability/temporal-witness.ts`（只增 275 行）；未新增测试 / fixture / 公共 barrel 导出 / 依赖，未改 `temporal-result.ts` 的 D9 闭集。

### 实现摘要

- 在 `temporal-witness.ts` 末尾追加 U2-03 段：`searchWinningSet` 在 1D 静态走廊 × `N` 相位格上求**最小**不动点 `W = μX.(Goal ∪ Pre∃(X))`，并提取严格递减 rank 的策略。
- 复用 U2-01 的 `WitnessSpace` / `WitnessGrid` / `StaticCorridor` / `SpawnCell` / `Arrival` 与 U2-02 的 `verifyTransition` / `verifyResidualWait` / `createWitnessWorkBudget`；**没有**新增状态 / 转移原语，**没有** U9、Witness 编码或 `TemporalInternalResult`。
- 状态索引固定为 `(x − xLo)·N + k`（`x` 取 `xLo..xHi` 的整数脚点，`k ∈ [0,N)`）。Goal 状态 `(x_goal, k)` 与 `k` 无关、rank 0。
- **反向 BFS（FIFO）求最小不动点**：从全部 Goal 状态入队，按层次扩展；前驱 `(x, (k−1) mod N)` 只有在一条已通过 S1–S4 的 `wait` / `move` 边通向已 winning 后继时才入 W。Goal 按 `x` 升序、`k` 升序入队，前驱按 `x` 升序枚举（`x = 后继 x` 即 `wait`），首次到达的 rank 即到 Goal 的最少边数。
- 策略只记录**被发现时的那一条** `verified: true` 转移；其 rank 严格递减（后继 rank = 当前 rank − 1），Goal 状态的 `transition` 为 `null`。策略表按状态索引升序输出，不依赖 `Set` / 对象键枚举 / 墙钟。
- 失败 / 耗尽侧 `policy: []`，不把部分 W 当 NB。

### 新增 API（全部 `@internal`，无 barrel 导出）

```ts
type WinningSetStatus = "complete" | "failed" | "insufficient";

type WinningSetPhaseCoverage = {
  cell: number;
  residualWait: ResidualWaitCheck;
  aligned: WitnessState;          // (spawn.footX, (k+1) mod N)
  alignedWinning: boolean;
  covered: boolean;               // residualWait.verified && alignedWinning
};

type WinningSetPolicyEntry = {
  state: WitnessState;
  rank: number;
  transition: TransitionCheck | null;   // Goal 为 null；其余必 verified 且 rank 严格 −1
};

type WinningSetSearchInput = {
  space: WitnessSpace;
  hazard: WitnessHazard;
  lagMs: number;
  budget: WitnessWorkBudget;      // U9 + W 共用；不新建 / 不重置
};

type WinningSetResult = {
  status: WinningSetStatus;
  degradationReason: DegradationReason | null;
  phaseCoverage: {
    cells: number;
    coveredPhases: readonly number[];
    uncoveredPhases: readonly number[];
    complete: boolean;
  };
  phases: readonly WinningSetPhaseCoverage[];
  policy: readonly WinningSetPolicyEntry[];
  winningStates: number;
  budgets: WitnessWorkSnapshot;
};

function searchWinningSet(input: WinningSetSearchInput): WinningSetResult;
```

### 相位对齐与覆盖映射

- 对每个 `k ∈ [0,N)`，先 `verifyResidualWait(cell: k)` 验证 spawn 在 `C_k` 的整格残差等待；单格失败只让该相位不可覆盖。
- 残差等待把真实 `φ0 ∈ C_k` 对齐到格点相位 `(k+1) mod N`（D3 §5 / D10 §2.3），因此检查 `(spawn.footX, (k+1) mod N) ∈ W`。
- `coveredPhases` = 残差等待通过 **且** 对齐 spawn 状态 winning 的格；`N` 个半开格全部覆盖才 `complete`。`uncoveredPhases` 升序；`phaseCoverage.complete` 只表示相位域全覆盖，不单独等于 W 证明。
- `spawn.footX` 不在静态走廊时对齐状态一律不 winning（防御分支；U2-01 已保证在走廊内）。

### 终止性与失败语义

- `winningSetStatus` 取票面 `"complete" | "failed" | "insufficient"`（D10 §5.3 的 `"proven"` / `"failed-complete"` 是结果层命名，映射为 `complete` / `failed`）。
- 搜索完成但未覆盖全部格 ⇒ `failed` + `degradationReason: "no-witness-found"`；`winning-set-failed` 只作内部状态名，**未**新增 D9 原因码。
- 任一 `BudgetStop`（或 `finish()` 新触发的墙钟 abort）⇒ 立即 `insufficient` + 实际原因码（`state-budget-exhausted` / `edge-budget-exhausted` / `cut-budget-exhausted` / `wall-clock-abort`），`policy: []`。
- 两种失败都只能导出 IE；代码不产生 PU 结论。

### 预算

- 复用调用方的 `WitnessWorkBudget`（U9 + W 共用 NB 预算）：Goal / 前驱每次 **enqueue**、每次 **visit** 计 `maxStates`；每条候选边经 `verifyTransition` 计 `maxEdges`；每条转移内的 `intersectContinuous` 由 `recordCheck` 累计 `cutPoints` / `segments` 并执行 `maxCutsPerCheck` / `maxCutsPerBranch`；墙钟只 abort。
- 预算耗尽发生在任何阶段都单向转 `insufficient`；不保留部分 W / 策略。

### 验证结果（本地一次性探针，不入库）

- `pnpm build`：exit 0；`pnpm typecheck`：exit 0。
- `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts`：**65/65 passed**（T-55 / 57 / 58 / 61 / 62 / 64 原样通过）。
- 最小 vs 最大不动点：`N=2`、`maxStep=0.5`（只有 `wait` 自环）、Goal 仅在 `x=20` ⇒ W 只有 2 个 Goal 状态（最大安全不变集会是全部 42 个）；`status=failed`、`no-witness-found`。
- 完整覆盖：`N=2`、`maxStep=10`、走廊 `0..20` ⇒ W=42、rank ≤ 2、两格全覆盖、`status=complete`；逐条策略转移的后继 rank 均严格 −1（0 条断裂）。
- 残差等待：`N=4`、Hazard 只在格 1/2 扫过 spawn ⇒ 格 0/3 残差通过、格 1/2 `failure="hazard"`；未全部覆盖 ⇒ `status=failed`。
- 预算：`maxStates=2` ⇒ `insufficient` + `state-budget-exhausted`；`maxEdges=0` ⇒ `edge-budget-exhausted`；`maxCutsPerBranch=0` ⇒ `cut-budget-exhausted`；注入墙钟 ⇒ `wall-clock-abort`；四种情况 `policy.length=0`。
- 确定性：同一输入两次运行，剔除 `wallClockMs` 后完整 JSON 逐字段相同。
- 真实夹具集成（探针）：原配置在 U2-01 即 `goal-outside-corridor`（既有行为，solid 行李挡住 spawn 所在走廊）；移除 solid 后走廊 `16..1424`、`N=354`、`xPositions=1409`、`maxStep≈1.017`。W=79,320 状态，winning x 仅 `1036..1424`；spawn x=40 不在 W（车厢扫掠带不可穿越）⇒ `failed` / `no-witness-found`，353/354 格残差等待通过，294ms、预算 `complete`。这验证了最小不动点不会把「安全但到不了 goal」的 spawn 侧状态收进 W。

### 下游（U2-04）

- U9 的接近段可直接复用本搜索：目标集由 `space.arrival.goalStates` 泛化，构造以等待格 `s` 为目标状态的 `WitnessSpace` 即可求 `W_{→s}`；出口段 `∃j : (s,j) ∈ W_{→goal}` 也复用同一函数。
- U2-04 必须继续共用同一个 `WitnessWorkBudget`；本函数不新建 / 不重置预算，也不调用 U9。
- U2-05 直接消费 `policy`（rank + 已验证转移）与 `phaseCoverage` 编码策略表 / termination；本票不编码、不计量体积。
