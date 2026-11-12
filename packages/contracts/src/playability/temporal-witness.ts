// **U2 Witness 环境**（D3 §1–§7）—— 状态格、静态走廊、精确 spawn、到达状态、
// wait / move 转移、S1–S4 与残差等待。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、几何前置 + 转移原语，没有搜索
//
//   本模块产出 U2 的底座：基础移动图、相位网格、静态走廊、精确 spawn、到达状态
//   （U2-01），以及 wait / move 转移、S1–S4、残差等待与工作预算计数（U2-02）。
//   **没有** Winning Set / U9（U2-03 / U2-04）、**没有** Witness 编码（U2-05）；
//   不 import `temporal.ts`（D6 DAG）。入口是纯函数：相同输入 ⇒ 相同输出，
//   不写文件；墙钟只用于 abort；S1–S4 失败只产生无效转移，不抛未处理异常。
//
// 二、单位（⚠️ 两套速度单位，别混）
//
//   `config.player.move.speed` 是 **px/s**（`game-config.ts` 的 `PlayerMove`）；
//   连续核心（`temporal-motion.ts` / `temporal-budget.ts` 的 `TriangleMotion` /
//   `intersectContinuous`）一律 **px/ms**。本模块在入口处显式 `/ 1000`，导出的
//   `maxSpeedPxPerMs` / `maxStep` 也只给 px/ms；`periodMs` / `dtMs` 是毫秒量。
//   **不得**把 px/s 直接乘 `dt`。
//
// 三、spawn 是脚点，不取整、不改写
//
//   `config.player.at` 按**脚点**解释，直接 `boxFromFoot(at, playerSize)`；
//   **不要**再经 `footOf`（那会把 `at` 当锚点再挪一次，见 D3 §3）。玩家尺寸取
//   manifest 的 asset `size`，`anchor` 不参与 `boxFromFoot`。
//   `footX` / `footY` 必须落在整数格，否则 IE；**禁止** `round()` 吸附、
//   **禁止** `startCells()` 的宽松多起点 —— 两者都会替玩家换一个出生状态，
//   不能作为证明起点。
//
// 四、静态走廊
//
//   x 域 = 基础移动图（不带 moving-hazard 静态掩码）中，与 spawn **同脚点 y** 的
//   `standable` 连续段（含 spawn）。`standable` 只看 `blocked`，Hazard 只进
//   `forbidden`，不参与这里的连通性 —— Hazard 的连续时间碰撞归 U2-02。
//   段再按合法范围裁剪：脚点 x 必须满足 `x − pw/2 ∈ [0, W − pw]`（盒完全在世界内），
//   越界格点不是合法状态，也**不 clamp**。裁剪后 `[xLo, xHi]` 内每个整数都是合法
//   走廊脚点，`xPositions = xHi − xLo + 1`。
//
// 五、失败一律是 D9 闭集
//
//   `WitnessSpaceFailure.reason` 只取 `temporal-result.ts` 的 `DegradationReason`
//   （D9 §5：原因码是闭集，新增原因必须改 D9 / AUTH）。D3 §3.4 的
//   `spawn-not-standable` 不在该闭集里，因此**不新增原因码**：它由
//   `reason: "spawn-not-on-lattice"` + `gap: "spawn-not-standable"` 表达（`gap` 是
//   本模块内部的结构化细分，只用于诊断与测试，不进 `DegradationReason`）。
//
// 六、确定性
//
//   遍历一律整数升序；不依赖 `Set` / 对象键枚举顺序 / 墙钟；`goalStates` 按
//   footX 升序去重。
// ─────────────────────────────────────────────────────────────────────────────
import type { AssetPackManifest } from "../assetpack.js";
import { playerMoveOf } from "../game-config.js";
import type { GameConfig } from "../game-config.js";
import type { Aabb, Size } from "./geometry.js";
import { boxFromFoot, contains, expandBox, overlapsStrict } from "./geometry.js";
import { buildMovementGraph } from "./graph.js";
import type { MovementGraph } from "./graph.js";
import { FIXED_RUNTIME_PROFILE, runtimeEntityGeometry } from "./profile.js";
import type { FixedRuntimeProfile } from "./profile.js";
import { createBudgetTracker } from "./temporal-budget.js";
import type { BudgetSignal, BudgetStop, BudgetTracker } from "./temporal-budget.js";
import { intersectContinuous, pieceSlope, trianglePosition } from "./temporal-motion.js";
import type { HazardBoxSpec, TriangleMotion } from "./temporal-motion.js";
import type {
  BudgetKind,
  BudgetProfile,
  BudgetStatus,
  DegradationReason,
} from "./temporal-result.js";

/** @internal 脚点整数格间距 [px]（D3 / D10 冻结：`xStep = 1`）。 */
const X_STEP = 1;

/** @internal 到达谓词的四边内缩 [px]（D3 §4：取整盒与真实盒每边相差 ≤0.5px）。 */
const GOAL_INSET = 0.5;

// ── 成功侧类型 ──────────────────────────────────────────────────────────────

/** @internal 相位网格；字段名与 D9 `Stats.grid` 对齐，另带 U2-02 需要的派生量。 */
export type WitnessGrid = {
  /** Hazard 相位周期 [ms]（由编排层解出后传入）。 */
  readonly periodMs: number;
  /** 相位格数 `N`（D9 的 `phaseSteps`）。 */
  readonly phaseSteps: number;
  /** `floor(maxSpeedPxPerMs · periodMs / xStep)`；粗化前的相位分辨率。 */
  readonly N_max: number;
  /** 每个相位格的时长 `periodMs / N` [ms]。 */
  readonly dtMs: number;
  /** 脚点整数格间距 [px]；恒为 1。 */
  readonly xStep: number;
  /** 连续核心使用的最大水平速度 [px/ms]（= `player.move.speed / 1000`）。 */
  readonly maxSpeedPxPerMs: number;
  /**
   * 一个相位格内允许的最大水平脚点位移 `maxSpeedPxPerMs · dtMs` [px]。
   * `N = N_max` 时 `≤ xStep`；容量粗化后**可以超过** `xStep`（这正是 S1 必须做
   * 连续检查、残差等待必须覆盖整格的原因）。
   */
  readonly maxStep: number;
  /** 静态走廊里的合法整数脚点位置数。 */
  readonly xPositions: number;
  /** 理论状态空间上界 `xPositions · N`，不是实际访问量。 */
  readonly stateCapacity: number;
  /** 相位分辨率被状态容量压过（`N < N_max`）；是诊断，不是降级。 */
  readonly phaseGridCapped: boolean;
  readonly phaseCapReason: "state-capacity" | null;
};

/** @internal 静态走廊：spawn 脚点 y 上 `standable` 连续段的合法脚点闭区间。 */
export type StaticCorridor = {
  /** 全程固定的脚点 y。 */
  readonly footY: number;
  /** 合法脚点 x 下界（含）。 */
  readonly xLo: number;
  /** 合法脚点 x 上界（含）。 */
  readonly xHi: number;
  readonly source: "standable-run";
};

/** @internal 精确 spawn：真实出生脚点无位移地落在整数格上。 */
export type SpawnCell = {
  readonly footX: number;
  readonly footY: number;
  /** 未取整玩家盒 `boxFromFoot({ footX, footY }, playerSize)`。 */
  readonly box: Aabb;
  readonly latticeAnchor: "foot-x";
};

/** @internal 到达状态；只在状态边界判定，与相位 `k` 无关。 */
export type Arrival = {
  readonly predicate: "overlapsStrict(playerBox, deflate(goalRect, 0.5))";
  readonly goalId: string;
  /** 空间层取整 Goal Rect（`entityBox` 已取整）。 */
  readonly goalRect: Aabb;
  /** 四边各内缩 0.5px 后的盒；到达谓词只与它求交。 */
  readonly deflatedGoalRect: Aabb;
  /** 满足到达谓词的走廊脚点 x，升序；相位无关。 */
  readonly goalStates: readonly number[];
};

/** @internal U2-01 的产物；U2-02 直接消费 `grid` / `corridor` / `spawn` / `arrival`。 */
export type WitnessSpace = {
  readonly ok: true;
  /** 基础移动图（不带 moving-hazard 静态掩码）；S1 的 `graph.solids` 就取它。 */
  readonly graph: MovementGraph;
  /** manifest asset `size`；玩家盒一律由它派生。 */
  readonly playerSize: Size;
  readonly grid: WitnessGrid;
  readonly corridor: StaticCorridor;
  readonly spawn: SpawnCell;
  readonly arrival: Arrival;
};

// ── 失败侧 ──────────────────────────────────────────────────────────────────

/**
 * @internal 失败的具体缺口（结构化细分，仅用于诊断 / 测试）。
 *
 * ⚠️ 它**不是** `DegradationReason`：D9 的原因码是闭集，新增必须改 D9 / AUTH。
 */
export type WitnessSpaceGap =
  | "player-geometry-missing"
  | "period-invalid"
  | "spawn-foot-not-integer"
  | "spawn-box-out-of-world"
  | "spawn-box-overlaps-solid"
  | "spawn-not-standable"
  | "phase-grid-infeasible"
  | "gate-missing"
  | "gate-asset-missing"
  | "goal-rect-degenerate"
  | "goal-outside-corridor";

/** @internal IE 失败；`reason` 只取 D9 闭集。 */
export type WitnessSpaceFailure = {
  readonly ok: false;
  readonly reason: DegradationReason;
  readonly gap: WitnessSpaceGap;
};

/** @internal 入口结果：判别联合，失败不抛异常。 */
export type WitnessSpaceResult = WitnessSpace | WitnessSpaceFailure;

/** @internal 入口输入；`budget` 只读，本票只用 `maxStates`。 */
export type WitnessSpaceInput = {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  /** 已解析的预算快照；本模块不解析 / 不校验 / 不建 tracker。 */
  readonly budget: BudgetProfile;
  /**
   * Hazard 相位周期 [ms]：编排层从移动 Hazard 解出后传入。
   * 非有限或 `≤ 0` ⇒ IE `grid-resolution-infeasible`（`gap: "period-invalid"`）。
   */
  readonly periodMs: number;
  readonly profile?: FixedRuntimeProfile;
};

const fail = (reason: DegradationReason, gap: WitnessSpaceGap): WitnessSpaceFailure => ({
  ok: false, reason, gap,
});

// ── 纯辅助（U2-02 起共用，避免各写一份盒派生） ─────────────────────────────

/** @internal 状态 `(footX, ·)` 的**未取整**玩家盒；脚点 y 全程固定为 spawn 脚点 y。 */
export const witnessPlayerBox = (space: WitnessSpace, footX: number): Aabb =>
  boxFromFoot({ x: footX, y: space.spawn.footY }, space.playerSize);

/** @internal 到达谓词：未取整玩家盒与内缩后的取整 Goal Rect **严格**相交。 */
export const witnessArrives = (arrival: Arrival, playerBox: Aabb): boolean =>
  overlapsStrict(playerBox, arrival.deflatedGoalRect);

/** @internal `footX` 是否是静态走廊里的合法整数脚点。 */
export const inStaticCorridor = (corridor: StaticCorridor, footX: number): boolean =>
  Number.isInteger(footX) && footX >= corridor.xLo && footX <= corridor.xHi;

// ── 入口 ────────────────────────────────────────────────────────────────────

/**
 * @internal 建立 U2 的状态格、静态走廊、精确 spawn 与到达状态。
 *
 * 检查顺序固定（同一输入 ⇒ 同一失败码）：
 *   基础图 → spawn 整数格 → spawn 盒在世界内 → spawn 盒不压 solid → 脚点 `standable`
 *   → 走廊裁剪 → 相位网格可行性 → 目标盒 / 到达状态。
 *
 * 任何不满足都返回 `WitnessSpaceFailure`（D9 闭集原因码），不抛异常、不做搜索。
 */
export function resolveWitnessSpace(input: WitnessSpaceInput): WitnessSpaceResult {
  const { config, manifest, budget, periodMs } = input;
  const profile = input.profile ?? FIXED_RUNTIME_PROFILE;

  // ① 基础移动图：**不带** moving-hazard 静态掩码（Hazard 只进 forbidden 的语义
  //    留给 U2-02 的连续时间检查；这里的 `standable` 只看 `blocked`）。
  const graph = buildMovementGraph(config, manifest, profile);
  if (!graph) return fail("geometry-untrusted", "player-geometry-missing");

  const playerSize = graph.player.size;
  const worldW = config.world.size.w;
  const worldH = config.world.size.h;

  // ② 精确 spawn：`at` 是脚点，直接 `boxFromFoot`；不 `round()`、不 `footOf`。
  const footX = config.player.at.x;
  const footY = config.player.at.y;
  if (!Number.isInteger(footX) || !Number.isInteger(footY)) {
    return fail("spawn-not-on-lattice", "spawn-foot-not-integer");
  }
  const spawnBox = boxFromFoot({ x: footX, y: footY }, playerSize);
  // 合法范围按玩家盒左上角：x_left ∈ [0, W − pw]、y_top ∈ [0, H − ph]；越界不 clamp。
  if (!contains({ x: 0, y: 0, w: worldW, h: worldH }, spawnBox)) {
    return fail("spawn-not-on-lattice", "spawn-box-out-of-world");
  }
  if (graph.solids.some((solid) => overlapsStrict(spawnBox, solid.box))) {
    return fail("spawn-not-on-lattice", "spawn-box-overlaps-solid");
  }
  if (!graph.standableAt(footX, footY)) {
    return fail("spawn-not-on-lattice", "spawn-not-standable");
  }
  const spawn: SpawnCell = { footX, footY, box: spawnBox, latticeAnchor: "foot-x" };

  // ③ 静态走廊：spawn 脚点 y 上的 `standable` 连续段（含 spawn），再按合法范围裁剪。
  let xLo = footX;
  let xHi = footX;
  while (xLo - 1 >= 0 && graph.standableAt(xLo - 1, footY)) xLo -= 1;
  while (xHi + 1 <= worldW && graph.standableAt(xHi + 1, footY)) xHi += 1;
  // x_left = footX − pw/2 ⇒ 0 ≤ x_left 且 x_left + pw ≤ W；spawn 盒在世界内保证含 spawn。
  const legalLo = Math.ceil(playerSize.w / 2);
  const legalHi = Math.floor(worldW - playerSize.w / 2);
  xLo = Math.max(xLo, legalLo);
  xHi = Math.min(xHi, legalHi);
  const corridor: StaticCorridor = { footY, xLo, xHi, source: "standable-run" };
  const xPositions = xHi - xLo + 1;

  // ④ 相位网格：`xStep = 1`；`N_max` 由速度与周期给出，`N` 再被状态容量压。
  if (!Number.isFinite(periodMs) || periodMs <= 0) {
    return fail("grid-resolution-infeasible", "period-invalid");
  }
  const maxSpeedPxPerMs = playerMoveOf(config).speed / 1000; // px/s → px/ms
  const N_max = Math.floor((maxSpeedPxPerMs * periodMs) / X_STEP);
  const capacityN = Math.floor(budget.maxStates / xPositions);
  const phaseSteps = Math.min(N_max, capacityN);
  if (!(phaseSteps >= 2)) return fail("grid-resolution-infeasible", "phase-grid-infeasible");
  const dtMs = periodMs / phaseSteps;
  const phaseGridCapped = phaseSteps < N_max;
  const grid: WitnessGrid = {
    periodMs,
    phaseSteps,
    N_max,
    dtMs,
    xStep: X_STEP,
    maxSpeedPxPerMs,
    maxStep: maxSpeedPxPerMs * dtMs,
    xPositions,
    stateCapacity: xPositions * phaseSteps,
    phaseGridCapped,
    phaseCapReason: phaseGridCapped ? "state-capacity" : null,
  };

  // ⑤ 目标：`config.objective.gate` 的空间层取整盒，四边各内缩 0.5px。
  const gate = config.entities.find(
    (entity) => entity.kind === "goal" && entity.id === config.objective.gate,
  );
  if (!gate) return fail("goal-not-representable", "gate-missing");
  const geometry = runtimeEntityGeometry(gate, manifest, profile);
  if (!geometry) return fail("goal-not-representable", "gate-asset-missing");
  const goalRect = geometry.box; // `entityBox` 已取整
  const deflatedGoalRect = expandBox(goalRect, -GOAL_INSET);
  if (
    !Number.isFinite(deflatedGoalRect.x) || !Number.isFinite(deflatedGoalRect.y) ||
    !(deflatedGoalRect.w > 0) || !(deflatedGoalRect.h > 0)
  ) {
    return fail("goal-rect-degenerate", "goal-rect-degenerate");
  }

  // ⑥ 到达状态：只与相位无关地遍历走廊整数脚点；任何合法格点都不满足 ⇒ IE。
  const goalStates: number[] = [];
  for (let x = xLo; x <= xHi; x++) {
    if (overlapsStrict(boxFromFoot({ x, y: footY }, playerSize), deflatedGoalRect)) {
      goalStates.push(x);
    }
  }
  if (goalStates.length === 0) return fail("goal-not-representable", "goal-outside-corridor");

  const arrival: Arrival = {
    predicate: "overlapsStrict(playerBox, deflate(goalRect, 0.5))",
    goalId: gate.id,
    goalRect,
    deflatedGoalRect,
    goalStates,
  };

  return { ok: true, graph, playerSize, grid, corridor, spawn, arrival };
}

// ── U2-02：状态转移、S1–S4、残差等待与预算计数 ──────────────────────────────
//
// 一、只有两种原语（D3 §1.2）
//
//   `wait(x,k) → (x,(k+1) mod N)`；`move(x,k) → (x',(k+1) mod N)`，恒速线性，
//   `|x'−x|/dt ≤ maxSpeed`，方向任意。每条转移恰占一个相位格
//   `[k·dt,(k+1)·dt]`（可加整周期偏移，见 `verifyTransition` 的 `cycle`）。
//
// 二、S1–S4 的失败语义
//
//   S1/S2/S3/S4 任一失败 ⇒ 该转移无效（`verified: false`），**不抛异常**；
//   失败原因只在本模块的 `TransitionFailureKind` 里，不新增 D9 原因码。
//   S1 用玩家盒 x 的**线性扫掠区间**与 `graph.solids` 做 `overlapsStrict`：
//   扫掠并集的正宽度重叠 ⇒ 存在正时长的严格重叠（不能只查端点 `standable`）。
//   S2 先按折返点 `m·P/2` 切段，再**逐段**按该单调段方向取 `lagPad`，构造保守
//   加宽盒后调用 `intersectContinuous`；不得用单一 pad 跨折返点。
//   S3/S4 的结构义务（一个相位格、`k+1 mod N`、`t1 = t0 + dt`）在
//   `verifyTransition` 内检查；链式连接用 `verifyTransitionChain`。
//
// 三、残差等待（D3 §5）
//
//   每个相位格 `C_k` 的残差等待从 `φ0 ∈ C_k` 到 `(k+1)·dt`：本模块对**整个格**
//   的 Hazard 位姿范围（跨折返点切段 + 该段方向 pad 的并集扫掠盒）与 spawn 玩家盒
//   做严格相交。`symbolic: true` / `residualWait: "conservative-over-cell"` 表明
//   这是格覆盖，不是逐个 `φ0` 的采样。
//
// 四、预算
//
//   复用 `createBudgetTracker`；`recordCheck` 把 `intersectContinuous` 的
//   `cutPoints` 交给 tracker，并按 `segmentsTotal`（`cutPoints + 1`）执行
//   `maxCutsPerBranch`。`maxStates` / `maxEdges` 在本模块的计数器上执行；任一
//   耗尽 ⇒ 返回 `BudgetStop`（IE 信号），调用方不得输出部分 witness。
//   墙钟只 abort，检查点粒度由 tracker 的 `timeBudgetCheckpointWork` 决定。
// ─────────────────────────────────────────────────────────────────────────────

/** @internal 状态 `(footX, k)`（D3 §1.1）；`footY` 全程固定，不进状态。 */
export type WitnessState = {
  readonly footX: number;
  readonly k: number;
};

/** @internal 单移动 Hazard 的连续时间输入：三角波 + manifest 盒（`size` / `anchor`）。 */
export type WitnessHazard = {
  readonly motion: TriangleMotion;
  readonly box: HazardBoxSpec;
};

/** @internal 只有两种原语（D3 §1.2）；`footX` 不变即 `wait`。 */
export type TransitionKind = "wait" | "move";

/**
 * @internal 转移无效的内部原因（**不是** D9 闭集；U2-03 负责映射到降级原因）。
 *
 * - `state`：脚点非整数或不在静态走廊；
 * - `speed`：`|Δx|/dt > maxSpeed`；
 * - `phase`：相位格不连续 / `k` 越界 / `to.k ≠ (from.k+1) mod N`（S3）；
 * - `static`：S1 连续静态碰撞；
 * - `hazard`：S2 / 残差等待连续碰撞；
 * - `continuity`：S4 链式连接断裂；
 * - `budget`：工作预算耗尽 / 墙钟 abort；
 * - `model-out`：非有限输入、Hazard 几何非法等模型外情况。
 */
export type TransitionFailureKind =
  | "state"
  | "speed"
  | "phase"
  | "static"
  | "hazard"
  | "continuity"
  | "budget"
  | "model-out";

// ── 工作预算计数 ────────────────────────────────────────────────────────────

/** @internal U2 工作快照；字段可直接展开进 D9 `Stats.work` / `Stats.timing` / `Stats.budget`。 */
export type WitnessWorkSnapshot = {
  /** 唯一入队状态数（D5 §2：W 的唯一入队 `(footX, k)`）。 */
  readonly statesEnqueued: number;
  /** 实际出队处理状态数；**不与** `statesEnqueued` 合并。 */
  readonly statesVisited: number;
  /** 每次考虑（含验证后拒绝）的 `wait` / `move` 转移数。 */
  readonly edgesChecked: number;
  readonly cutPointsTotal: number;
  readonly segmentsTotal: number;
  readonly budgetStatus: BudgetStatus;
  readonly budgetKind: BudgetKind | null;
  readonly workUnitsSinceLastCheckpoint: number;
  readonly wallClockMs: number;
  readonly timeBudgetCheckpointWork: number;
};

/**
 * @internal U2 工作预算：tracker + 三类计数器 + 累计 cut 预算。
 *
 * `maxStates` 在 `statesEnqueued` 与 `statesVisited` 两个计数器上分别执行
 * （visited ≤ enqueued 恒成立；U9 的 processed 状态也受同一预算约束）。
 * `maxCutsPerBranch` 按 `segmentsTotal = cutPoints + 1` 投影检查，先于单次
 * `chargeCheck` 判定，避免越界后再记账。
 */
export type WitnessWorkBudget = {
  readonly profile: BudgetProfile;
  /** 底层 tracker；U2-03 需要额外工作计量时可直接 `chargeWork`。 */
  readonly tracker: BudgetTracker;
  enqueueState(count?: number): BudgetSignal;
  visitState(count?: number): BudgetSignal;
  checkEdge(count?: number): BudgetSignal;
  recordCheck(cutPoints: number): BudgetSignal;
  chargeWork(units?: number): BudgetSignal;
  snapshot(): WitnessWorkSnapshot;
  finish(): WitnessWorkSnapshot;
};

/** @internal 建立 U2 工作预算。`now` 仅注入给墙钟 abort。 */
export function createWitnessWorkBudget(args: {
  readonly profile: BudgetProfile;
  readonly now?: () => number;
}): WitnessWorkBudget {
  const { profile } = args;
  const tracker = createBudgetTracker({ profile, now: args.now });

  let statesEnqueued = 0;
  let statesVisited = 0;
  let edgesChecked = 0;
  let ownStop: BudgetStop | null = null;

  const requireCount = (count: number, name: string): void => {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`${name} must be a non-negative integer`);
    }
  };

  const stop = (
    status: "exhausted" | "aborted",
    kind: BudgetKind,
    reason: DegradationReason,
  ): BudgetStop => {
    if (ownStop === null) {
      ownStop = { stopped: true, budgetStatus: status, budgetKind: kind, degradationReason: reason };
    }
    return ownStop;
  };

  const adopt = (signal: BudgetSignal): BudgetSignal => {
    if (signal.stopped && ownStop === null) ownStop = signal;
    return ownStop ?? signal;
  };

  const enqueueState = (count = 1): BudgetSignal => {
    requireCount(count, "states");
    if (ownStop !== null) return ownStop;
    statesEnqueued += count;
    if (statesEnqueued > profile.maxStates) {
      return stop("exhausted", "state-budget", "state-budget-exhausted");
    }
    return adopt(tracker.chargeWork(1));
  };

  const visitState = (count = 1): BudgetSignal => {
    requireCount(count, "states");
    if (ownStop !== null) return ownStop;
    statesVisited += count;
    if (statesVisited > profile.maxStates) {
      return stop("exhausted", "state-budget", "state-budget-exhausted");
    }
    return adopt(tracker.chargeWork(1));
  };

  const checkEdge = (count = 1): BudgetSignal => {
    requireCount(count, "edges");
    if (ownStop !== null) return ownStop;
    edgesChecked += count;
    if (edgesChecked > profile.maxEdges) {
      return stop("exhausted", "edge-budget", "edge-budget-exhausted");
    }
    return adopt(tracker.chargeWork(1));
  };

  const recordCheck = (cutPoints: number): BudgetSignal => {
    requireCount(cutPoints, "cut points");
    if (ownStop !== null) return ownStop;
    const base = tracker.snapshot();
    if (base.segmentsTotal + cutPoints + 1 > profile.maxCutsPerBranch) {
      return stop("exhausted", "cut-budget", "cut-budget-exhausted");
    }
    return adopt(tracker.chargeCheck(cutPoints));
  };

  const chargeWork = (units = 1): BudgetSignal => {
    if (ownStop !== null) return ownStop;
    return adopt(tracker.chargeWork(units));
  };

  const snapshot = (): WitnessWorkSnapshot => {
    const base = tracker.snapshot();
    return {
      statesEnqueued,
      statesVisited,
      edgesChecked,
      cutPointsTotal: base.cutPointsTotal,
      segmentsTotal: base.segmentsTotal,
      budgetStatus: ownStop?.budgetStatus ?? base.budgetStatus,
      budgetKind: ownStop?.budgetKind ?? base.budgetKind,
      workUnitsSinceLastCheckpoint: base.workUnitsSinceLastCheckpoint,
      wallClockMs: base.wallClockMs,
      timeBudgetCheckpointWork: base.timeBudgetCheckpointWork,
    };
  };

  const finish = (): WitnessWorkSnapshot => {
    tracker.finish();
    return snapshot();
  };

  return {
    profile,
    tracker,
    enqueueState,
    visitState,
    checkEdge,
    recordCheck,
    chargeWork,
    snapshot,
    finish,
  };
}

// ── 相位格边界 ──────────────────────────────────────────────────────────────

/** @internal 相位格 `C_k` 的绝对时间边界（含整周期偏移）。 */
export type PhaseCellBounds = {
  readonly t0: number;
  readonly t1: number;
};

/**
 * @internal `C_k` 的时间边界：`t0 = cycle·P + k·dt`；
 * `t1 = cycle·P + (k+1)·dt`，`k = N−1` 时折到 `(cycle+1)·P`。
 *
 * 这样相邻格 `t1_prev === t0_next` 在浮点上**逐位相等**（S4），不需要容差。
 */
export const witnessPhaseCellBounds = (
  grid: WitnessGrid,
  k: number,
  cycle = 0,
): PhaseCellBounds => {
  const base = cycle * grid.periodMs;
  const t0 = base + k * grid.dtMs;
  const t1 = k + 1 < grid.phaseSteps ? base + (k + 1) * grid.dtMs : (cycle + 1) * grid.periodMs;
  return { t0, t1 };
};

/** @internal `[t0,t1]` 内按折返点 `m·P/2` 切出的单调段边界（升序，含端点）。 */
const monotoneBoundaries = (periodMs: number, t0: number, t1: number): number[] => {
  const half = periodMs / 2;
  const boundaries: number[] = [t0];
  const first = Math.floor(t0 / half) + 1;
  const last = Math.ceil(t1 / half) - 1;
  for (let m = first; m <= last; m++) {
    const turn = m * half;
    if (turn > t0 && turn < t1) boundaries.push(turn);
  }
  boundaries.push(t1);
  return boundaries;
};

/** @internal Hazard 输入是否满足解析求交的有限性前提。 */
const isFiniteHazard = (hazard: WitnessHazard, lagMs: number): boolean =>
  Number.isFinite(lagMs) && lagMs >= 0 &&
  Number.isFinite(hazard.motion.at.x) && Number.isFinite(hazard.motion.at.y) &&
  Number.isFinite(hazard.motion.distance) && Number.isFinite(hazard.motion.periodMs) &&
  hazard.motion.periodMs > 0 &&
  Number.isFinite(hazard.box.size.w) && hazard.box.size.w >= 0 &&
  Number.isFinite(hazard.box.size.h) && hazard.box.size.h >= 0 &&
  Number.isFinite(hazard.box.anchor.x) && Number.isFinite(hazard.box.anchor.y);

// ── 转移验证 ────────────────────────────────────────────────────────────────

/** @internal 单条转移的验证输入。 */
export type TransitionCheckInput = {
  readonly space: WitnessSpace;
  readonly hazard: WitnessHazard;
  readonly lagMs: number;
  readonly from: WitnessState;
  readonly to: WitnessState;
  /** 整周期偏移（整数，默认 0）；用于把同一条格内转移放到绝对时间轴上。 */
  readonly cycle?: number;
  readonly budget: WitnessWorkBudget;
};

/**
 * @internal 转移验证结果。`verified: true` 才可进入 Witness；
 * 失败只产生无效转移，`failure` 说明违反的 S 义务。
 */
export type TransitionCheck = {
  readonly kind: TransitionKind;
  readonly from: WitnessState;
  readonly to: WitnessState;
  readonly t0: number;
  readonly t1: number;
  readonly playerSpeedX: number;
  readonly verified: boolean;
  readonly failure: TransitionFailureKind | null;
  /** 本条转移内所有 `intersectContinuous` 调用累计的折返点数。 */
  readonly cutPoints: number;
  /** 同上，解析段数（每次调用 `cutPoints + 1`）。 */
  readonly segments: number;
  readonly budgetStop: BudgetStop | null;
};

const transitionResult = (
  kind: TransitionKind,
  from: WitnessState,
  to: WitnessState,
  t0: number,
  t1: number,
  playerSpeedX: number,
  failure: TransitionFailureKind | null,
  cutPoints: number,
  segments: number,
  budgetStop: BudgetStop | null,
): TransitionCheck => ({
  kind,
  from,
  to,
  t0,
  t1,
  playerSpeedX,
  verified: failure === null,
  failure,
  cutPoints,
  segments,
  budgetStop,
});

/**
 * @internal 验证一条 `wait` / `move` 转移（S1–S4）。
 *
 * 固定检查顺序：边计数 → 状态合法性 → S3（相位 / 时间）→ 速度上限 →
 * S1（静态连续）→ S2（Hazard 连续）。预算停止在任何阶段都优先返回。
 *
 * 失败只产生 `verified: false`，不抛未处理异常；`model-out` 是非有限输入。
 */
export function verifyTransition(input: TransitionCheckInput): TransitionCheck {
  const { space, hazard, lagMs, from, to } = input;
  const grid = space.grid;
  const cycle = input.cycle ?? 0;
  const kind: TransitionKind = from.footX === to.footX ? "wait" : "move";
  const bounds = witnessPhaseCellBounds(grid, from.k, Number.isInteger(cycle) ? cycle : 0);
  const t0 = bounds.t0;
  const t1 = bounds.t1;
  const duration = t1 - t0;
  const playerSpeedX = duration > 0 ? (to.footX - from.footX) / duration : 0;

  const fail = (
    failure: TransitionFailureKind,
    cutPoints = 0,
    segments = 0,
    budgetStop: BudgetStop | null = null,
  ): TransitionCheck =>
    transitionResult(kind, from, to, t0, t1, playerSpeedX, failure, cutPoints, segments, budgetStop);

  // 每次考虑（含拒绝）的转移都计 1 条 edge（D5 §2）。
  const edge = input.budget.checkEdge();
  if (edge.stopped) return fail("budget", 0, 0, edge);

  // S3 + 状态合法性：脚点在走廊整数格，相位格恰好前进 1（mod N），时间区间为格。
  if (
    !Number.isInteger(from.footX) || !Number.isInteger(to.footX) ||
    !inStaticCorridor(space.corridor, from.footX) ||
    !inStaticCorridor(space.corridor, to.footX)
  ) {
    return fail("state");
  }
  if (
    !Number.isInteger(from.k) || from.k < 0 || from.k >= grid.phaseSteps ||
    !Number.isInteger(cycle) ||
    to.k !== (from.k + 1) % grid.phaseSteps ||
    !Number.isFinite(t0) || !Number.isFinite(t1) || !(duration > 0)
  ) {
    return fail("phase");
  }
  if (Math.abs(to.footX - from.footX) > grid.maxStep) return fail("speed");

  const p0 = witnessPlayerBox(space, from.footX);
  const p1 = witnessPlayerBox(space, to.footX);

  // S1：玩家盒 x 线性移动 ⇒ 扫掠并集 = [min(x0,x1), max(x0,x1)+w]；y 是静态门槛。
  // 扫掠并集与 solid 严格相交 ⇔ 存在正时长的严格重叠（不能只查端点 standable）。
  const swept: Aabb = {
    x: Math.min(p0.x, p1.x),
    y: p0.y,
    w: Math.abs(p1.x - p0.x) + p0.w,
    h: p0.h,
  };
  for (const solid of space.graph.solids) {
    const signal = input.budget.chargeWork(1);
    if (signal.stopped) return fail("budget", 0, 0, signal);
    if (overlapsStrict(swept, solid.box)) return fail("static");
  }

  // S2：按折返点切段；每段内 Hazard 单调，pad 方向取该段运动方向。
  if (!isFiniteHazard(hazard, lagMs)) return fail("model-out");
  let cutPoints = 0;
  let segments = 0;
  const boundaries = monotoneBoundaries(hazard.motion.periodMs, t0, t1);
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const a = boundaries[i] as number;
    const b = boundaries[i + 1] as number;
    if (!(b > a)) continue;
    const slope = pieceSlope(hazard.motion, a, b);
    if (slope === null) return fail("model-out", cutPoints, segments);

    // lagPad = hazardSpeed × lagMs；方向取该单调段。上升段向右加宽，下降段向左加宽。
    const pad = Math.abs(slope) * lagMs;
    const w = hazard.box.size.w;
    const paddedWidth = w + pad;
    const anchorX = pad === 0 || paddedWidth === 0
      ? hazard.box.anchor.x
      : slope > 0
        ? (hazard.box.anchor.x * w) / paddedWidth
        : (hazard.box.anchor.x * w + pad) / paddedWidth;
    const playerBoxAtA: Aabb = { ...p0, x: p0.x + playerSpeedX * (a - t0) };
    const check = intersectContinuous({
      motion: hazard.motion,
      hazard: {
        size: { w: paddedWidth, h: hazard.box.size.h },
        anchor: { x: anchorX, y: hazard.box.anchor.y },
      },
      playerBox: playerBoxAtA,
      playerSpeedX,
      t0: a,
      t1: b,
      maxCuts: input.budget.profile.maxCutsPerCheck,
    });
    if (!check.ok) return fail("model-out", cutPoints, segments);
    cutPoints += check.cutPoints;
    segments += check.segments;

    const signal = input.budget.recordCheck(check.cutPoints);
    if (signal.stopped) return fail("budget", cutPoints, segments, signal);
    // 正宽度开区间 ⇒ 失败；相切 / 零测度不算撞（intervalTolerance = 0）。
    if (check.intervals.some((interval) => interval.end > interval.start)) {
      return fail("hazard", cutPoints, segments);
    }
  }

  return transitionResult(kind, from, to, t0, t1, playerSpeedX, null, cutPoints, segments, null);
}

// ── S4：转移链连续性 ────────────────────────────────────────────────────────

/** @internal 链式连续性失败：`index` 是第一条断裂的转移下标。 */
export type TransitionChainFailure = {
  readonly ok: false;
  readonly index: number;
  readonly failure: "continuity";
};

/** @internal `verifyTransitionChain` 的结果。 */
export type TransitionChainCheck = { readonly ok: true } | TransitionChainFailure;

/**
 * @internal S4 链式连续性：`x1_prev = x0_next`、`t1_prev = t0_next`（允许整周期
 * 偏移，D3 §1.2）、每条的相位恰前进 1（mod N）。
 *
 * 玩家 y 与玩家盒定义由 `space` 固定（`witnessPlayerBox` 只用 footX），
 * 因此不需要逐条比较。只检查结构连续性，不重复验证碰撞。
 */
export const verifyTransitionChain = (
  space: WitnessSpace,
  transitions: readonly TransitionCheck[],
): TransitionChainCheck => {
  const phaseSteps = space.grid.phaseSteps;
  const periodMs = space.grid.periodMs;
  for (let i = 0; i < transitions.length; i++) {
    const current = transitions[i] as TransitionCheck;
    if (!(current.t1 > current.t0)) return { ok: false, index: i, failure: "continuity" };
    if (current.to.k !== (current.from.k + 1) % phaseSteps) {
      return { ok: false, index: i, failure: "continuity" };
    }
    if (i === 0) continue;
    const prev = transitions[i - 1] as TransitionCheck;
    if (current.from.footX !== prev.to.footX || current.from.k !== prev.to.k) {
      return { ok: false, index: i, failure: "continuity" };
    }
    const offset = prev.t1 - current.t0;
    if (!(offset === 0 || offset === periodMs)) {
      return { ok: false, index: i, failure: "continuity" };
    }
  }
  return { ok: true };
};

// ── 残差等待（D3 §5） ───────────────────────────────────────────────────────

/** @internal 相位格残差等待的验证输入。 */
export type ResidualWaitInput = {
  readonly space: WitnessSpace;
  readonly hazard: WitnessHazard;
  readonly lagMs: number;
  /** 相位格索引 `k ∈ [0, N)`；验证整个 `C_k`。 */
  readonly cell: number;
  readonly cycle?: number;
  readonly budget: WitnessWorkBudget;
};

/** @internal 残差等待结果；`symbolic` 表明这是格覆盖，不是具体 `φ0` 轨迹。 */
export type ResidualWaitCheck = {
  readonly cell: number;
  readonly t0: { readonly kind: "cell-start"; readonly cell: number; readonly symbolic: true };
  readonly t1: number;
  readonly symbolic: true;
  readonly residualWait: "conservative-over-cell";
  readonly verified: boolean;
  readonly failure: "phase" | "hazard" | "budget" | "model-out" | null;
  readonly segments: number;
  readonly budgetStop: BudgetStop | null;
};

/**
 * @internal 保守验证 `C_k` 的残差等待（D3 §5）。
 *
 * `φ0` 遍历整个格；残差等待覆盖的 Hazard 位姿范围就是 `C_k` 上的位姿范围。
 * 本函数按折返点切段，对每段取「并集扫掠盒 + 该段方向 `lagPad`」，再与 spawn
 * 玩家盒做 `overlapsStrict`。任一碰撞 ⇒ 该相位格失败；**不得只查格端点**。
 *
 * 残差等待是 `wait`，spawn 盒由 U2-01 保证不压 solid，因此这里不重复 S1。
 */
export function verifyResidualWait(input: ResidualWaitInput): ResidualWaitCheck {
  const { space, hazard, lagMs, cell } = input;
  const grid = space.grid;
  const cycle = input.cycle ?? 0;
  const bounds = witnessPhaseCellBounds(grid, cell, Number.isInteger(cycle) ? cycle : 0);
  const t0Meta = { kind: "cell-start", cell, symbolic: true } as const;

  const fail = (
    failure: "phase" | "hazard" | "budget" | "model-out",
    segments = 0,
    budgetStop: BudgetStop | null = null,
  ): ResidualWaitCheck => ({
    cell,
    t0: t0Meta,
    t1: bounds.t1,
    symbolic: true,
    residualWait: "conservative-over-cell",
    verified: false,
    failure,
    segments,
    budgetStop,
  });

  if (
    !Number.isInteger(cell) || cell < 0 || cell >= grid.phaseSteps ||
    !Number.isInteger(cycle)
  ) {
    return fail("phase");
  }
  if (!isFiniteHazard(hazard, lagMs)) return fail("model-out");
  const { t0, t1 } = bounds;
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || !(t1 > t0)) return fail("phase");

  const spawnBox = space.spawn.box;
  const w = hazard.box.size.w;
  const h = hazard.box.size.h;
  const hazardY = hazard.motion.at.y - hazard.box.anchor.y * h;
  const yOverlaps = hazardY < spawnBox.y + spawnBox.h && spawnBox.y < hazardY + h;

  let segments = 0;
  const boundaries = monotoneBoundaries(hazard.motion.periodMs, t0, t1);
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const a = boundaries[i] as number;
    const b = boundaries[i + 1] as number;
    if (!(b > a)) continue;
    const slope = pieceSlope(hazard.motion, a, b);
    if (slope === null) return fail("model-out", segments);

    const pad = Math.abs(slope) * lagMs;
    const start = trianglePosition(hazard.motion, a);
    const end = trianglePosition(hazard.motion, b);
    const anchorLo = Math.min(start, end);
    const anchorHi = Math.max(start, end);
    // 上升段向右 pad，下降段向左 pad；slope = 0 时 pad = 0。
    const anchorMin = slope > 0 ? anchorLo : anchorLo - pad;
    const anchorMax = slope > 0 ? anchorHi + pad : anchorHi;

    segments += 1;
    const signal = input.budget.chargeWork(1);
    if (signal.stopped) return fail("budget", segments, signal);
    if (!yOverlaps) continue;
    const sweptHazard: Aabb = {
      x: anchorMin - hazard.box.anchor.x * w,
      y: hazardY,
      w: anchorMax - anchorMin + w,
      h,
    };
    if (overlapsStrict(spawnBox, sweptHazard)) return fail("hazard", segments);
  }

  return {
    cell,
    t0: t0Meta,
    t1,
    symbolic: true,
    residualWait: "conservative-over-cell",
    verified: true,
    failure: null,
    segments,
    budgetStop: null,
  };
}
