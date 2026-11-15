// **U2 Witness 环境**（D3 §1–§7）—— 状态格、静态走廊、精确 spawn、到达状态、
// wait / move 转移、S1–S4 与残差等待。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、几何前置 + 转移原语，没有搜索
//
//   本模块产出 U2 的底座：基础移动图、相位网格、静态走廊、精确 spawn、到达状态
//   （U2-01），wait / move 转移、S1–S4、残差等待与工作预算计数（U2-02），
//   全相位 Winning Set 与终止性（U2-03）、U9 安全等待格证书（U2-04），以及
//   Witness 编码 / 体积与确定性序列化（U2-05）。不 import `temporal.ts`（D6 DAG）。
//   入口是纯函数：相同输入 ⇒ 相同输出，不写文件；墙钟只用于 abort；
//   S1–S4 失败只产生无效转移，不抛未处理异常。
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
import {
  intersectContinuous,
  pieceSlope,
  triangleMaxRate,
  trianglePosition,
} from "./temporal-motion.js";
import type { CollisionInterval, HazardBoxSpec, TriangleMotion } from "./temporal-motion.js";
import type {
  BudgetKind,
  BudgetProfile,
  BudgetStatus,
  DegradationReason,
  PolicyTermination,
  Witness,
  WitnessForm,
  WitnessTransition,
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
//   S2 先按折返点 `m·P/2` 切段，再**逐段**取保守 `lagPad = |slope|·lagMs`，把
//   Hazard 盒**两侧对称**加宽后调用 `intersectContinuous`；不得用单一 pad 跨折返点，
//   也不得只按当前单调段方向单侧加宽（窗口跨折返点时会漏掉另一侧的可达位姿）。
//   S3/S4 的结构义务（一个相位格、`k+1 mod N`、`t1 = t0 + dt`）在
//   `verifyTransition` 内检查；链式连接用 `verifyTransitionChain`。
//
// 三、残差等待（D3 §5）
//
//   每个相位格 `C_k` 的残差等待从 `φ0 ∈ C_k` 到 `(k+1)·dt`：本模块对**整个格**
//   的 Hazard 位姿范围（跨折返点切段 + 对称 pad 的并集扫掠盒）与 spawn 玩家盒
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

// ── 保守 lag pad（三处共用：S2 / 残差等待 / U9 停留） ────────────────────────
//
// 语义是精确 `∃δ`：玩家在 `t` 时刻，Hazard 实际可达位姿是 `p(t+δ)`，δ ∈ [0, lag]。
// 三角波速度有界 ⇒ `|p(t+δ) − p(t)| ≤ |slope|·lag`；该界与方向无关。当窗口跨过
// 折返点 `m·P/2` 时，Hazard 会回到当前单调段的**另一侧**，所以单侧 pad 不是
// `∃δ` 的超集（R2 §4 反例）。三处一律用对称 pad：两侧各扩 `pad`，宽 `w + 2·pad`。
// I02-03 §8.1 已证对称 pad 是精确 `∃δ` 的保守超集。

/** @internal 保守 pad 量 `= |slope| × lagMs`（静止 Hazard 的 slope = 0 ⇒ pad = 0）。 */
const conservativeLagPad = (slope: number, lagMs: number): number => Math.abs(slope) * lagMs;

/**
 * @internal 对称 pad 后的 Hazard 盒：`[p − ax·w − pad, p + (1−ax)·w + pad]`。
 * 锚点按新宽度折算 `(ax·w + pad) / (w + 2·pad)`，其余字段不变。
 */
const lagPaddedHazardBox = (hazard: WitnessHazard, pad: number): HazardBoxSpec => {
  const w = hazard.box.size.w;
  const paddedWidth = w + 2 * pad;
  return {
    size: { w: paddedWidth, h: hazard.box.size.h },
    anchor: {
      x: paddedWidth === 0
        ? hazard.box.anchor.x
        : (hazard.box.anchor.x * w + pad) / paddedWidth,
      y: hazard.box.anchor.y,
    },
  };
};

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

  // S2：按折返点切段；每段内 Hazard 单调，pad 两侧对称取 `|slope|·lagMs`。
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

    // lagPad = hazardSpeed × lagMs，**两侧对称**扩：窗口跨折返点时 Hazard 可能回到
    // 本段另一侧，单侧 pad 会漏掉这些 `∃δ` 可达位姿（R2 §4）。
    const padded = lagPaddedHazardBox(hazard, conservativeLagPad(slope, lagMs));
    const playerBoxAtA: Aabb = { ...p0, x: p0.x + playerSpeedX * (a - t0) };
    const check = intersectContinuous({
      motion: hazard.motion,
      hazard: padded,
      playerBox: playerBoxAtA,
      playerSpeedX,
      t0: a,
      t1: b,
      maxCuts: input.budget.profile.maxCutsPerCheck,
    });
    if (!check.ok) {
      // 单次 check 的 `maxCutsPerCheck`（D5 §3.1）是工作预算，不是模型外；
      // 必须导出 BudgetStop，否则降级原因会被改写成 `model-out`。
      if (check.reason === "cut-budget") {
        return fail("budget", cutPoints, segments, {
          stopped: true,
          budgetStatus: "exhausted",
          budgetKind: "cut-budget",
          degradationReason: "cut-budget-exhausted",
        });
      }
      return fail("model-out", cutPoints, segments);
    }
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
 * 本函数按折返点切段，对每段取「并集扫掠盒 + 两侧对称 `lagPad`」，再与 spawn
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

    // 与 S2 同一个对称 pad、同一个 helper：本段的扫掠范围两侧都扩 `pad`。
    const pad = conservativeLagPad(slope, lagMs);
    const padded = lagPaddedHazardBox(hazard, pad);
    const leftOffset = hazard.box.anchor.x * hazard.box.size.w + pad;
    const start = trianglePosition(hazard.motion, a);
    const end = trianglePosition(hazard.motion, b);
    const leftAtStart = start - leftOffset;
    const leftAtEnd = end - leftOffset;
    const anchorMin = Math.min(leftAtStart, leftAtEnd);
    const anchorMax = Math.max(leftAtStart, leftAtEnd);

    segments += 1;
    const signal = input.budget.chargeWork(1);
    if (signal.stopped) return fail("budget", segments, signal);
    if (!yOverlaps) continue;
    const sweptHazard: Aabb = {
      x: anchorMin,
      y: hazardY,
      w: anchorMax - anchorMin + padded.size.w,
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

// ── U2-03：全相位 Winning Set（最小不动点）与终止性 ─────────────────────────
//
// 一、最小不动点，不是最大不动点（D10 §2.5）
//
//   W = μX.(Goal ∪ Pre∃(X))。实现是**反向 BFS**：从全部 Goal 状态
//   `(x_goal, k)`（rank 0）出发，按 FIFO 层次扩展；前驱 `(x, (k−1) mod N)`
//   只有在一条**已通过 S1–S4** 的 `wait` / `move` 边通向已 winning 的后继时
//   才进入 W。BFS 层次保证首次加入时的 rank 就是到 Goal 的最少边数；策略只取
//   这条 rank 严格递减（后继 rank = 当前 rank − 1）的边。这里没有最大不动点
//   的「安全但永不到达」语义，也不会把闭合的前缀当成证明。
//
// 二、全相位覆盖（D3 §5 / D10 §2.3）
//
//   每个半开相位格 `C_k` 的第一段是 spawn 原位的**残差等待**：先调用
//   `verifyResidualWait` 对整格 Hazard 位姿范围做保守验证；通过后，真实 `φ0`
//   对齐到格点相位 `(k+1) mod N`，因此只需检查
//   `(spawn.footX, (k+1) mod N) ∈ W`。`N` 个格全部通过才算 `complete`。
//
// 三、失败语义（D10 §2.5 / §3）
//
//   `winning-set-failed` 只是本模块的**内部状态名**；结果层原因码仍取 D9 闭集：
//   搜索完成但未覆盖全部格 ⇒ `status: "failed"` + `no-witness-found`；
//   预算 / 墙钟耗尽 ⇒ `status: "insufficient"` + 实际预算原因码。
//   **绝不**从失败推导 PU；失败侧不携带部分策略（`policy: []`）。
//
// 四、确定性与预算
//
//   状态索引 `(x − xLo)·N + k`；Goal 状态按 x 升序、k 升序入队；前驱按 x 升序
//   枚举（`x = 后继 x` 即 `wait`）。不使用 `Set` / 对象键枚举 / 墙钟排序。
//   复用调用方的 `WitnessWorkBudget`（U9 + W 共用 NB 预算）：每次 enqueue /
//   visit / 边检查 / `intersectContinuous` 都经它记账；任一 `BudgetStop`
//   立即转 `insufficient`，不保留部分 W。
// ─────────────────────────────────────────────────────────────────────────────

/** @internal W 的终止状态；`failed` / `insufficient` 都只能导出 IE。 */
export type WinningSetStatus = "complete" | "failed" | "insufficient";

/** @internal 单个相位格的覆盖证据（残差等待 + 对齐后的 spawn 状态）。 */
export type WinningSetPhaseCoverage = {
  readonly cell: number;
  /** 整格残差等待的保守验证结果（`symbolic: true`）。 */
  readonly residualWait: ResidualWaitCheck;
  /** 对齐后的 spawn 状态 `(spawn.footX, (k+1) mod N)`。 */
  readonly aligned: WitnessState;
  readonly alignedWinning: boolean;
  /** `residualWait.verified ∧ alignedWinning`。 */
  readonly covered: boolean;
};

/**
 * @internal 一个 winning 状态的 rank 与确定性后继。
 *
 * Goal 状态的 `transition` 为 `null`（到达即终止）；其余状态的后继必是
 * `verified: true` 的 `wait` / `move`，且 `rank(successor) = rank(state) − 1`。
 */
export type WinningSetPolicyEntry = {
  readonly state: WitnessState;
  readonly rank: number;
  readonly transition: TransitionCheck | null;
};

/** @internal 全相位 W 的搜索输入。 */
export type WinningSetSearchInput = {
  readonly space: WitnessSpace;
  readonly hazard: WitnessHazard;
  readonly lagMs: number;
  /** U9 + W 共用的 NB 预算；本函数不新建、不重置。 */
  readonly budget: WitnessWorkBudget;
};

/** @internal 全相位 W 的搜索结果；失败 / 耗尽侧不携带部分策略。 */
export type WinningSetResult = {
  readonly status: WinningSetStatus;
  /** D9 闭集原因码；`complete` 时为 `null`。 */
  readonly degradationReason: DegradationReason | null;
  readonly phaseCoverage: {
    readonly cells: number;
    readonly coveredPhases: readonly number[];
    readonly uncoveredPhases: readonly number[];
    readonly complete: boolean;
  };
  /** 按相位格升序的覆盖证据。 */
  readonly phases: readonly WinningSetPhaseCoverage[];
  /** 按状态索引升序；仅 `complete` / `failed` 侧非空。 */
  readonly policy: readonly WinningSetPolicyEntry[];
  readonly winningStates: number;
  readonly budgets: WitnessWorkSnapshot;
};

/**
 * @internal 预算快照 → D9 原因码。
 *
 * 正常情况下调用方已捕获 `BudgetStop.degradationReason`；这里只兜底
 * `budget.finish()` 在收尾时新触发的墙钟 abort（唯一没有 `BudgetStop` 的路径）。
 */
const budgetReasonOf = (kind: BudgetKind | null): DegradationReason => {
  switch (kind) {
    case "state-budget": return "state-budget-exhausted";
    case "edge-budget": return "edge-budget-exhausted";
    case "cut-budget": return "cut-budget-exhausted";
    case "witness-volume": return "witness-volume";
    case "hop-sample-budget": return "hop-sample-budget";
    default: return "wall-clock-abort";
  }
};

/** @internal `[0, N)` 的相位格列表（升序）。 */
const allPhaseCells = (phaseCount: number): number[] => {
  const cells: number[] = [];
  for (let k = 0; k < phaseCount; k++) cells.push(k);
  return cells;
};

// ── 反向 BFS 核心（U2-03 的 W 与 U2-04 的 W_{→s} / W_{→goal} 共用） ──────────
//
// 目标集是**任意 x 栅格列**：目标列上的全部 N 个相位格 rank 0。U2-03 传
// `arrival.goalStates`；U2-04 的出口段 / 候选收窄也传 `arrival.goalStates`，
// 接近段传 `[s]`。反向 BFS 的 FIFO 层次保证：状态首次入队时 rank 就是到目标列
// 的最少边数，策略后继的 rank 严格递减。
//
// 可选的 `stopWhenRanked` 只**提前结束**搜索：已发现状态的 rank 仍是精确最小值
// （BFS 分层，先发现必不劣于后发现的路径），未发现状态保持 -1。因此提前停止
// 不改变最小不动点语义，只少枚举与查询无关的状态。
// ─────────────────────────────────────────────────────────────────────────────

/** @internal 反向 BFS 的原始结果；预算停止时 `rank` / `successor` 只含部分状态。 */
type WinningCore = {
  readonly stop: BudgetStop | null;
  readonly stateCount: number;
  readonly phaseCount: number;
  readonly rank: Int32Array;
  readonly successor: readonly (TransitionCheck | null)[];
  readonly stateIndex: (footX: number, k: number) => number;
  readonly stateAt: (index: number) => WitnessState;
};

/** @internal 在 1D 静态走廊 × N 相位格上做反向 BFS；目标集 = `targetFootXs` 的全相位。 */
const solveWinningCore = (args: {
  readonly space: WitnessSpace;
  readonly hazard: WitnessHazard;
  readonly lagMs: number;
  readonly budget: WitnessWorkBudget;
  readonly targetFootXs: readonly number[];
  /** 这些状态全部 ranked 后提前结束；`undefined` 表示跑满。 */
  readonly stopWhenRanked?: readonly WitnessState[];
}): WinningCore => {
  const { space, hazard, lagMs, budget } = args;
  const grid = space.grid;
  const phaseCount = grid.phaseSteps;
  const { xLo, xHi } = space.corridor;
  const stateCount = (xHi - xLo + 1) * phaseCount;
  const stateIndex = (footX: number, k: number): number => (footX - xLo) * phaseCount + k;
  const stateAt = (index: number): WitnessState => ({
    footX: xLo + Math.floor(index / phaseCount),
    k: index % phaseCount,
  });

  const rank = new Int32Array(stateCount).fill(-1);
  const successor = new Array<TransitionCheck | null>(stateCount).fill(null);
  const queue: number[] = [];
  let head = 0;

  // 提前停止集合：整数状态索引，避免 `Set` 与对象键枚举（D3 §7 确定性）。
  const watch = new Uint8Array(stateCount);
  let remaining = 0;
  const earlyStop = args.stopWhenRanked !== undefined;
  for (const state of args.stopWhenRanked ?? []) {
    if (
      !Number.isInteger(state.footX) || !Number.isInteger(state.k) ||
      !inStaticCorridor(space.corridor, state.footX) ||
      state.k < 0 || state.k >= phaseCount
    ) continue;
    const index = stateIndex(state.footX, state.k);
    if (watch[index] === 1) continue;
    watch[index] = 1;
    remaining += 1;
  }

  const core = (stop: BudgetStop | null): WinningCore => ({
    stop,
    stateCount,
    phaseCount,
    rank,
    successor,
    stateIndex,
    stateAt,
  });

  // ① 目标列 rank 0：按输入顺序 × k 升序入队 ⇒ BFS 第 0 层固定。
  for (const targetX of args.targetFootXs) {
    if (!inStaticCorridor(space.corridor, targetX)) continue;
    for (let k = 0; k < phaseCount; k++) {
      const index = stateIndex(targetX, k);
      if (rank[index] !== -1) continue;
      rank[index] = 0;
      const enqueued = budget.enqueueState();
      if (enqueued.stopped) return core(enqueued);
      queue.push(index);
      if (watch[index] === 1) remaining -= 1;
    }
  }
  if (earlyStop && remaining === 0) return core(null);

  // ② 反向 BFS：前驱按 x 升序枚举（`x === current.footX` 即 `wait`）。
  while (head < queue.length) {
    const currentIndex = queue[head] as number;
    head += 1;
    const visited = budget.visitState();
    if (visited.stopped) return core(visited);

    const current = stateAt(currentIndex);
    const currentRank = rank[currentIndex] as number;
    const previousK = (current.k - 1 + phaseCount) % phaseCount;
    for (let x = xLo; x <= xHi; x++) {
      if (x !== current.footX && Math.abs(x - current.footX) > grid.maxStep) continue;
      const previousIndex = stateIndex(x, previousK);
      if (rank[previousIndex] !== -1) continue;
      const previous: WitnessState = { footX: x, k: previousK };
      const check = verifyTransition({
        space,
        hazard,
        lagMs,
        from: previous,
        to: current,
        budget,
      });
      if (check.budgetStop !== null) return core(check.budgetStop);
      if (!check.verified) continue;
      // FIFO 层次 ⇒ `currentRank` 是首次到达的最小 rank；策略 rank 严格递减。
      rank[previousIndex] = currentRank + 1;
      successor[previousIndex] = check;
      const enqueued = budget.enqueueState();
      if (enqueued.stopped) return core(enqueued);
      queue.push(previousIndex);
      if (watch[previousIndex] === 1) {
        remaining -= 1;
        if (earlyStop && remaining === 0) return core(null);
      }
    }
  }

  return core(null);
};

/**
 * @internal 在 1D 静态走廊 × N 相位格上求**最小**不动点，并提取严格递减 rank 的策略。
 *
 * 只做 W（D10 §2.5）；U9 见 `searchU9WaitingCell`（U2-04），Witness 编码 / 体积见
 * U2-05。输入 / 输出都是确定性的：同一 `space` / `hazard` / `lagMs` / 预算 ⇒ 同一
 * 结果（`budgets.wallClockMs` 除外，它不进确定性签名）。
 */
export function searchWinningSet(input: WinningSetSearchInput): WinningSetResult {
  const { space, hazard, lagMs, budget } = input;
  const grid = space.grid;
  const phaseCount = grid.phaseSteps;

  /** 失败 / 耗尽侧：不带任何部分 W 或策略。 */
  const insufficient = (stop: BudgetStop | null): WinningSetResult => {
    const budgets = budget.finish();
    return {
      status: "insufficient",
      degradationReason: stop?.degradationReason ?? budgetReasonOf(budgets.budgetKind),
      phaseCoverage: {
        cells: phaseCount,
        coveredPhases: [],
        uncoveredPhases: allPhaseCells(phaseCount),
        complete: false,
      },
      phases: [],
      policy: [],
      winningStates: 0,
      budgets,
    };
  };

  // ① 残差等待先行（D3 §5）：每个 `C_k` 都对整格 Hazard 位姿范围保守验证。
  //    单格失败只让该相位不可覆盖；预算耗尽则立即 insufficient。
  const residualWaits: ResidualWaitCheck[] = [];
  for (let k = 0; k < phaseCount; k++) {
    const residual = verifyResidualWait({ space, hazard, lagMs, cell: k, budget });
    if (residual.budgetStop !== null) return insufficient(residual.budgetStop);
    residualWaits.push(residual);
  }

  // ② 反向 BFS 求最小不动点：Goal 状态 rank 0，其余状态取「到 Goal 的最少边数」。
  const core = solveWinningCore({
    space,
    hazard,
    lagMs,
    budget,
    targetFootXs: space.arrival.goalStates,
  });
  if (core.stop !== null) return insufficient(core.stop);
  const { rank } = core;

  // ③ 全相位覆盖：残差等待 + 对齐后的 spawn 状态属于 W；N 个格全过才 complete。
  const coveredPhases: number[] = [];
  const uncoveredPhases: number[] = [];
  const phases: WinningSetPhaseCoverage[] = [];
  const spawnInCorridor = inStaticCorridor(space.corridor, space.spawn.footX);
  for (let k = 0; k < phaseCount; k++) {
    const residualWait = residualWaits[k] as ResidualWaitCheck;
    const aligned: WitnessState = { footX: space.spawn.footX, k: (k + 1) % phaseCount };
    const alignedWinning = spawnInCorridor &&
      (rank[core.stateIndex(aligned.footX, aligned.k)] as number) !== -1;
    const covered = residualWait.verified && alignedWinning;
    if (covered) coveredPhases.push(k);
    else uncoveredPhases.push(k);
    phases.push({ cell: k, residualWait, aligned, alignedWinning, covered });
  }

  // ④ 策略表：按状态索引升序（x 升序、k 升序）；只含已 winning 状态。
  const policy: WinningSetPolicyEntry[] = [];
  let winningStates = 0;
  for (let index = 0; index < core.stateCount; index++) {
    const value = rank[index] as number;
    if (value === -1) continue;
    winningStates += 1;
    policy.push({ state: core.stateAt(index), rank: value, transition: core.successor[index] ?? null });
  }

  // ⑤ 收尾墙钟检查：finish 新触发的 abort 同样只能 IE。
  const complete = coveredPhases.length === phaseCount;
  const budgets = budget.finish();
  if (budgets.budgetStatus !== "complete") {
    return {
      status: "insufficient",
      degradationReason: budgetReasonOf(budgets.budgetKind),
      phaseCoverage: {
        cells: phaseCount,
        coveredPhases: [],
        uncoveredPhases: allPhaseCells(phaseCount),
        complete: false,
      },
      phases: [],
      policy: [],
      winningStates: 0,
      budgets,
    };
  }

  return {
    status: complete ? "complete" : "failed",
    degradationReason: complete ? null : "no-witness-found",
    phaseCoverage: {
      cells: phaseCount,
      coveredPhases,
      uncoveredPhases,
      complete,
    },
    phases,
    policy,
    winningStates,
    budgets,
  };
}

// ── U2-04：U9 安全等待格证书（D10 §1） ──────────────────────────────────────
//
// 一、四项判据（D10 §1.6，缺一即 IE）
//
//   ① `s` 是基础移动图的 standable 脚点格，且与 spawn 位于同一脚点 y 的水平
//      连通段（即静态走廊内）；
//   ② 接近段 `∀k ∈ Z_N`：spawn 在 `C_k` 的残差等待整格保守安全，且对齐后的
//      `(spawn, (k+1) mod N) ∈ W_{→s}`，策略 rank 严格递减；
//   ③ 停留段：`s` 在 `[T_arr, T_arr + P]` 全周期无碰撞——只在 Hazard 折返点
//      `m·P/2` 切段，每段用两侧对称的 `lagPad = hazardSpeed × lagMs` 做解析
//      连续求交；不按 `dt` 采样，不设最小安全窗口；
//   ④ 出口段 `∃j ∈ Z_N`：`(s, j) ∈ W_{→goal}`，策略 rank 严格递减。
//
//   接近段是 `∀φ0`、出口段是 `∃ψ`；这个不对称来自等待格把「抵达相位」与
//   「通过相位」解耦（D10 §1.5），不得把出口也写成全称。
//
// 二、候选与效率
//
//   候选 `s` = 走廊内 `standable` 的整数脚点，按 x 升序固定顺序。先用一次
//   `W_{→goal}`（目标集 = `arrival.goalStates`）把候选收窄到「至少一个相位
//   `(s, j)` 已在 W」的列；再按 x 升序对候选求 `W_{→s}`（目标集 = `[s]`），
//   第一个四项全过的 `s` 即结果。顺序确定，不做依赖遍历次序的优化。
//
// 三、预算与失败
//
//   全部搜索、残差等待与停留段检查共用调用方的 `WitnessWorkBudget`（U9 + W 同一
//   NB 预算），不新建、不重置、不重发。任一预算耗尽 ⇒ 立即 `insufficient` +
//   实际预算原因码，且不保留任何部分 U9。搜索完成但无 `s` 四项全过 ⇒ `failed` +
//   D9 `no-witness-found`。两者都只能导出 IE，**绝不**推导 PU（D10 §3）。
//
// 四、前置条件
//
//   D10 §1.1：U9 要求 `coverage.temporal = checked`；本模块不能提升 coverage，
//   必须由调用方显式声明。D2 判定玩家几何不可信时同样降级。两种前置失败都用
//   D9 闭集里既有的 `geometry-untrusted`（不新增原因码），细分放在 `failure`。
// ─────────────────────────────────────────────────────────────────────────────

/** @internal U9 的终止状态；`failed` / `insufficient` 都只能导出 IE。 */
export type U9Status = "complete" | "failed" | "insufficient";

/** @internal `coverage.temporal` 的输入镜像；U9 只接受 `checked`。 */
export type U9CoveragePrecondition = "checked" | "partial" | "unknown";

/** @internal D10 §1.1 的显式输入前置；本模块无法自行提升 coverage / 几何可信性。 */
export type U9Preconditions = {
  readonly temporalCoverage: U9CoveragePrecondition;
  readonly playerGeometryTrusted: boolean;
};

/**
 * @internal U9 失败阶段（**不是** D9 原因码；D9 闭集不扩）。
 * 结构化细分只用于诊断 / 测试，结果层原因码仍是闭集。
 */
export type U9FailureKind =
  | "temporal-coverage"
  | "player-geometry"
  | "residual-wait"
  | "no-waiting-cell";

/** @internal 停留段单个单调子段的解析检查记录。 */
export type U9StaySegmentCheck = {
  readonly t0: number;
  readonly t1: number;
  readonly direction: "rising" | "falling" | "static";
  /** 该子段的 Hazard 速度 [px/ms]（三角波每段恒定）。 */
  readonly slope: number;
  /** 该子段的对称 pad 量 `= |slope| × lagMs`（两侧各扩同样多）。 */
  readonly lagPad: number;
  readonly cutPoints: number;
  /** `intersectContinuous` 的解析段数（`cutPoints + 1`）。 */
  readonly analyticSegments: number;
  /** 正宽度的碰撞开区间；零测度相切不记录、不算撞。 */
  readonly collisionIntervals: readonly CollisionInterval[];
  readonly collided: boolean;
};

/** @internal 停留段验证失败原因（内部细分，不新增 D9 原因码）。 */
export type U9StayFailure = "state" | "phase" | "hazard" | "budget" | "model-out";

/** @internal 停留段 `[T_arr, T_arr + P]` 的完整验证记录。 */
export type U9StayCheck = {
  readonly footX: number;
  readonly tArrival: number;
  readonly tEnd: number;
  readonly periodMs: number;
  /** `2·distance / periodMs` [px/ms]；静止 Hazard 为 0。 */
  readonly hazardSpeed: number;
  /** 等待全程统一的 pad `= hazardSpeed × lagMs`。 */
  readonly lagPad: number;
  /** `(T_arr, T_arr + P)` 内的折返点（严格内部，升序）。 */
  readonly turnarounds: readonly number[];
  /** 切段后的全部单调子段（升序）；每段都做了 `overlapsStrict` 解析检查。 */
  readonly segments: readonly U9StaySegmentCheck[];
  readonly verified: boolean;
  readonly failure: U9StayFailure | null;
  readonly budgetStop: BudgetStop | null;
};

/** @internal 停留段验证输入。 */
export type U9StayInput = {
  readonly space: WitnessSpace;
  readonly hazard: WitnessHazard;
  readonly lagMs: number;
  /** 停留的脚点 x；必须与 spawn 同脚点 y 且 standable。 */
  readonly footX: number;
  /** 抵达时刻 `T_arr`（策略给出，不是全局 t=0）。 */
  readonly tArrival: number;
  readonly budget: WitnessWorkBudget;
};

/** @internal 单个相位的接近段证据（残差等待 + 对齐状态 + rank）。 */
export type U9ApproachPhase = {
  readonly cell: number;
  readonly residualWait: ResidualWaitCheck;
  /** 对齐后的 spawn 状态 `(spawn.footX, (k+1) mod N)`。 */
  readonly aligned: WitnessState;
  /** `W_{→s}` 中的 rank；`-1` 表示不可达（U9 不成立）。 */
  readonly rank: number;
  /** 该相位的绝对抵达时刻 `T_arr = 对齐格点时刻 + rank·dt`；不可达时为 `null`。 */
  readonly tArrival: number | null;
  readonly covered: boolean;
};

/** @internal 相位覆盖摘要（与 `WinningSetPhaseCoverage` 同形，不携带证明对象）。 */
export type U9PhaseCoverage = {
  readonly cells: number;
  readonly coveredPhases: readonly number[];
  readonly uncoveredPhases: readonly number[];
  readonly complete: boolean;
};

/** @internal 接近段：`spawn → s` 的 `∀φ0` 证据。 */
export type U9Approach = {
  readonly targetFootX: number;
  readonly phaseCoverage: U9PhaseCoverage;
  readonly phases: readonly U9ApproachPhase[];
  /**
   * 策略：从 N 个对齐 spawn 状态出发、策略实际可达的状态（按状态索引升序）。
   * 每条 `transition` 都通过 S1–S4；rank 严格递减，终止于 `s` 列（rank 0）。
   */
  readonly policy: readonly WinningSetPolicyEntry[];
  readonly policyStates: number;
  /** 对齐 spawn 状态的最大 rank（完整路径的最大步数）。 */
  readonly maxRank: number;
};

/** @internal 出口段：`∃ψ` 选中的相位与 `W_{→goal}` 策略链。 */
export type U9Exit = {
  readonly footX: number;
  readonly phase: number;
  /** `(s, j)` 的 rank（到 Goal 的步数）。 */
  readonly rank: number;
  /** 从 `(s, j)` 起沿策略 rank 严格递减的转移链；`goalState` 为 rank 0 终点。 */
  readonly policy: readonly WinningSetPolicyEntry[];
  readonly goalState: WitnessState;
};

/** @internal 终止性证据：接近 / 出口都用严格递减 rank，rank 0 即目标。 */
export type U9TerminationEvidence = {
  readonly kind: "strictly-decreasing-rank";
  /** 按相位格升序的接近段 rank。 */
  readonly approachRanks: readonly number[];
  readonly approachMaxRank: number;
  readonly exitRank: number;
};

/** @internal U9 选中的等待格。 */
export type U9WaitingCell = {
  readonly footX: number;
  readonly footY: number;
  /** 未取整玩家盒 `boxFromFoot({ footX, footY }, playerSize)`。 */
  readonly playerBox: Aabb;
  readonly standable: true;
  readonly corridor: "spawn-foot-y-run";
};

/** @internal U9 搜索输入；`budget` 与 W 共用，本函数不新建、不重置。 */
export type U9SearchInput = {
  readonly space: WitnessSpace;
  readonly hazard: WitnessHazard;
  readonly lagMs: number;
  readonly budget: WitnessWorkBudget;
  readonly preconditions: U9Preconditions;
};

/** @internal U9 结果；失败 / 耗尽侧不携带任何部分证书（`policy` 不出现）。 */
export type U9Result = {
  readonly status: U9Status;
  /** D9 闭集原因码；`complete` 时为 `null`。 */
  readonly degradationReason: DegradationReason | null;
  /** 内部失败阶段；成功为 `null`。 */
  readonly failure: U9FailureKind | null;
  readonly waitingCell: U9WaitingCell | null;
  readonly approach: U9Approach | null;
  readonly stay: U9StayCheck | null;
  readonly exit: U9Exit | null;
  readonly termination: U9TerminationEvidence | null;
  readonly budgets: WitnessWorkSnapshot;
};

/**
 * @internal 判据 ①：`footX` 是否是基础移动图的 `standable` 整数脚点，且与 spawn
 * 同一脚点 y 的水平连通段（静态走廊）。
 *
 * 走廊本身就是 spawn 脚点 y 上的 `standable` 连续段再按合法范围裁剪，因此这里
 * 同时检查走廊归属与 `standable`，不依赖调用方顺序。
 */
export const isValidWaitingCell = (space: WitnessSpace, footX: number): boolean =>
  Number.isInteger(footX) &&
  space.corridor.footY === space.spawn.footY &&
  inStaticCorridor(space.corridor, footX) &&
  space.graph.standableAt(footX, space.corridor.footY);

/**
 * @internal 验证 `s` 在 `[T_arr, T_arr + P]` 全周期的停留安全（D10 §1.4）。
 *
 * - 只在折返点 `m·P/2` 切段：每段内 Hazard 位姿线性，用 `intersectContinuous`
 *   解析求交，**不按 `dt` 采样**；
 * - 每段取对称 `lagPad = |slope| × lagMs`（两侧各扩）；速度恒定 ⇒ 全程同一 pad；
 * - `overlapsStrict`，不带 ε；任一正宽度碰撞 ⇒ 不成立；相切 / 零测度不算撞；
 * - `s` 是 `standable` 脚点 ⇒ 玩家盒不压 solid（与残差等待同一论证），不重复 S1。
 */
export function verifyU9Stay(input: U9StayInput): U9StayCheck {
  const { space, hazard, lagMs, footX, budget } = input;
  const tArrival = input.tArrival;

  const empty = (failure: U9StayFailure, budgetStop: BudgetStop | null = null): U9StayCheck => ({
    footX,
    tArrival,
    tEnd: tArrival,
    periodMs: 0,
    hazardSpeed: 0,
    lagPad: 0,
    turnarounds: [],
    segments: [],
    verified: false,
    failure,
    budgetStop,
  });

  if (!isValidWaitingCell(space, footX)) return empty("state");
  if (typeof tArrival !== "number" || !Number.isFinite(tArrival)) return empty("state");
  if (!isFiniteHazard(hazard, lagMs)) return empty("model-out");

  const periodMs = hazard.motion.periodMs;
  const hazardSpeed = triangleMaxRate(hazard.motion);
  const lagPadValue = hazardSpeed * lagMs;
  const t0 = tArrival;
  const t1 = tArrival + periodMs;
  if (!Number.isFinite(t1) || !(t1 > t0)) return empty("phase");

  const playerBox = witnessPlayerBox(space, footX);
  const boundaries = monotoneBoundaries(periodMs, t0, t1);
  const turnarounds = boundaries.slice(1, -1);
  const segments: U9StaySegmentCheck[] = [];
  let failure: U9StayFailure | null = null;
  let budgetStop: BudgetStop | null = null;

  for (let i = 0; i + 1 < boundaries.length; i++) {
    const a = boundaries[i] as number;
    const b = boundaries[i + 1] as number;
    if (!(b > a)) continue;
    const slope = pieceSlope(hazard.motion, a, b);
    if (slope === null) {
      failure = "model-out";
      break;
    }
    // 与 S2 同一个对称 pad、同一个 helper：窗口跨折返点时两侧都必须被覆盖。
    const pad = conservativeLagPad(slope, lagMs);
    const check = intersectContinuous({
      motion: hazard.motion,
      hazard: lagPaddedHazardBox(hazard, pad),
      playerBox,
      playerSpeedX: 0,
      t0: a,
      t1: b,
      maxCuts: budget.profile.maxCutsPerCheck,
    });
    if (!check.ok) {
      failure = "model-out";
      break;
    }
    const signal = budget.recordCheck(check.cutPoints);
    // 正宽度开区间 ⇒ 碰撞；相切 / 零测度不算撞（intervalTolerance = 0）。
    const collisions = check.intervals.filter((interval) => interval.end > interval.start);
    segments.push({
      t0: a,
      t1: b,
      direction: slope > 0 ? "rising" : slope < 0 ? "falling" : "static",
      slope,
      lagPad: pad,
      cutPoints: check.cutPoints,
      analyticSegments: check.segments,
      collisionIntervals: collisions,
      collided: collisions.length > 0,
    });
    if (signal.stopped) {
      failure = "budget";
      budgetStop = signal;
      break;
    }
    // 任一子段碰撞 ⇒ U9 不成立；仍记录其余子段（切段数有限，结论不变）。
    if (collisions.length > 0) failure = "hazard";
  }

  const verified = failure === null;
  return {
    footX,
    tArrival,
    tEnd: t1,
    periodMs,
    hazardSpeed,
    lagPad: lagPadValue,
    turnarounds,
    segments,
    verified,
    failure,
    budgetStop,
  };
}

/**
 * @internal 从 `(s, j)` 沿 rank 严格递减的策略走到 rank 0 的 Goal 状态。
 *
 * 返回的链就是出口段的 `W_{→goal}` 策略执行记录；内部一致性（连接、rank 递减、
 * 终点 rank 0 且无后继）任一不满足都返回 `null`（不输出未验证的链）。
 */
const buildU9Exit = (
  core: WinningCore,
  footX: number,
  phase: number,
): U9Exit | null => {
  const startIndex = core.stateIndex(footX, phase);
  const startRank = core.rank[startIndex] as number;
  if (startRank < 0) return null;

  const policy: WinningSetPolicyEntry[] = [];
  let index = startIndex;
  for (let step = 0; step <= core.stateCount; step++) {
    const state = core.stateAt(index);
    const rank = core.rank[index] as number;
    if (rank < 0) return null;
    const transition = core.successor[index] ?? null;
    policy.push({ state, rank, transition });
    if (transition === null) {
      if (rank !== 0) return null;
      return { footX, phase, rank: startRank, policy, goalState: state };
    }
    if (transition.from.footX !== state.footX || transition.from.k !== state.k) return null;
    const next = core.stateIndex(transition.to.footX, transition.to.k);
    if ((core.rank[next] as number) !== rank - 1) return null;
    index = next;
  }
  return null;
};

/**
 * @internal U9 安全等待格证书（D10 §1.6 四项）。
 *
 * 只做 U9；不做 Witness 编码 / 体积（U2-05）、不做门区 / 图割 / PU。
 * 输入 / 输出确定性：候选 x 升序、相位升序、子段按时间升序、策略按状态索引
 * 升序；不依赖 `Set` / 对象键枚举 / 墙钟。
 */
export function searchU9WaitingCell(input: U9SearchInput): U9Result {
  const { space, hazard, lagMs, budget } = input;
  const grid = space.grid;
  const phaseCount = grid.phaseSteps;
  const { xLo, xHi } = space.corridor;

  const nulls = {
    waitingCell: null,
    approach: null,
    stay: null,
    exit: null,
    termination: null,
  } as const;

  /** 前置失败 ⇒ IE（D10 §1.1）；输入前置优先于预算。 */
  const preconditionFailure = (failure: U9FailureKind): U9Result => ({
    status: "insufficient",
    degradationReason: "geometry-untrusted",
    failure,
    ...nulls,
    budgets: budget.finish(),
  });

  /** 预算耗尽 / 墙钟 abort ⇒ 立即 insufficient，不保留部分 U9。 */
  const insufficient = (stop: BudgetStop | null, failure: U9FailureKind | null): U9Result => {
    const budgets = budget.finish();
    return {
      status: "insufficient",
      degradationReason: stop?.degradationReason ?? budgetReasonOf(budgets.budgetKind),
      failure,
      ...nulls,
      budgets,
    };
  };

  /** 完整失败 ⇒ `no-witness-found`；收尾墙钟 abort 仍升级 insufficient。 */
  const failed = (failure: U9FailureKind): U9Result => {
    const budgets = budget.finish();
    if (budgets.budgetStatus !== "complete") {
      return {
        status: "insufficient",
        degradationReason: budgetReasonOf(budgets.budgetKind),
        failure,
        ...nulls,
        budgets,
      };
    }
    return {
      status: "failed",
      degradationReason: "no-witness-found",
      failure,
      ...nulls,
      budgets,
    };
  };

  // ① 前置条件：coverage.temporal = checked 与玩家几何可信性都是显式输入。
  if (input.preconditions.temporalCoverage !== "checked") {
    return preconditionFailure("temporal-coverage");
  }
  if (input.preconditions.playerGeometryTrusted !== true) {
    return preconditionFailure("player-geometry");
  }

  // ② 判据 ②-a：N 个相位格的残差等待整格保守验证（与 s 无关）。
  const residualWaits: ResidualWaitCheck[] = [];
  for (let k = 0; k < phaseCount; k++) {
    const residual = verifyResidualWait({ space, hazard, lagMs, cell: k, budget });
    if (residual.budgetStop !== null) return insufficient(residual.budgetStop, "residual-wait");
    if (!residual.verified) return failed("residual-wait");
    residualWaits.push(residual);
  }

  // ③ 判据 ④ 的底座：一次全相位 `W_{→goal}`（目标集 = Goal 状态）。
  const goalCore = solveWinningCore({
    space,
    hazard,
    lagMs,
    budget,
    targetFootXs: space.arrival.goalStates,
  });
  if (goalCore.stop !== null) return insufficient(goalCore.stop, null);

  // ④ 候选收窄：走廊内 standable 且至少一个相位 `(s, j)` 已在 `W_{→goal}`；x 升序。
  const candidateX: number[] = [];
  for (let x = xLo; x <= xHi; x++) {
    if (!isValidWaitingCell(space, x)) continue;
    let hasWinningPhase = false;
    for (let j = 0; j < phaseCount; j++) {
      if ((goalCore.rank[goalCore.stateIndex(x, j)] as number) >= 0) {
        hasWinningPhase = true;
        break;
      }
    }
    if (hasWinningPhase) candidateX.push(x);
  }
  if (candidateX.length === 0) return failed("no-waiting-cell");

  // 对齐状态与格点时刻与 s 无关：N 个相位恰是 spawn 列的整列。
  const alignedStates: WitnessState[] = [];
  const alignedStarts: number[] = [];
  for (let k = 0; k < phaseCount; k++) {
    alignedStates.push({ footX: space.spawn.footX, k: (k + 1) % phaseCount });
    alignedStarts.push(witnessPhaseCellBounds(grid, k).t1);
  }

  // ⑤ 按 x 升序找第一个四项全过的 s；任何预算停止立即 insufficient。
  for (const footX of candidateX) {
    // 判据 ②-b：`W_{→s}`（目标集 = `[s]`），提前停在 spawn 整列全 ranked。
    const approachCore = solveWinningCore({
      space,
      hazard,
      lagMs,
      budget,
      targetFootXs: [footX],
      stopWhenRanked: alignedStates,
    });
    if (approachCore.stop !== null) return insufficient(approachCore.stop, null);

    const phases: U9ApproachPhase[] = [];
    const coveredPhases: number[] = [];
    const uncoveredPhases: number[] = [];
    let allCovered = true;
    let maxRank = 0;
    let maxTArrival = -Infinity;
    for (let k = 0; k < phaseCount; k++) {
      const cellStart = alignedStarts[k] as number;
      const aligned = alignedStates[k] as WitnessState;
      const rank = approachCore.rank[approachCore.stateIndex(aligned.footX, aligned.k)] as number;
      const tArrival = rank >= 0 ? cellStart + rank * grid.dtMs : null;
      const residualWait = residualWaits[k] as ResidualWaitCheck;
      const covered = residualWait.verified && rank >= 0;
      if (rank > maxRank) maxRank = rank;
      if (tArrival !== null && tArrival > maxTArrival) maxTArrival = tArrival;
      if (covered) coveredPhases.push(k);
      else {
        uncoveredPhases.push(k);
        allCovered = false;
      }
      phases.push({ cell: k, residualWait, aligned, rank, tArrival, covered });
    }
    if (!allCovered) continue;

    // 接近段策略：N 个对齐状态的策略可达闭包（不输出无关状态）。
    const reachable = new Uint8Array(approachCore.stateCount);
    const pending: number[] = [];
    for (const aligned of alignedStates) {
      const index = approachCore.stateIndex(aligned.footX, aligned.k);
      if ((approachCore.rank[index] as number) < 0 || reachable[index] === 1) continue;
      reachable[index] = 1;
      pending.push(index);
    }
    while (pending.length > 0) {
      const index = pending.pop() as number;
      const transition = approachCore.successor[index] ?? null;
      if (transition === null) continue;
      const next = approachCore.stateIndex(transition.to.footX, transition.to.k);
      if (reachable[next] === 1) continue;
      reachable[next] = 1;
      pending.push(next);
    }
    const approachPolicy: WinningSetPolicyEntry[] = [];
    for (let index = 0; index < approachCore.stateCount; index++) {
      if (reachable[index] !== 1) continue;
      approachPolicy.push({
        state: approachCore.stateAt(index),
        rank: approachCore.rank[index] as number,
        transition: approachCore.successor[index] ?? null,
      });
    }

    // 判据 ③：停留段 `[T_arr, T_arr + P]`。取各相位抵达时刻的最大值作代表：
    // 全周期检查与抵达相位无关（[T, T+P] 恰好覆盖一次完整 Hazard 周期）。
    const stay = verifyU9Stay({
      space,
      hazard,
      lagMs,
      footX,
      tArrival: maxTArrival,
      budget,
    });
    if (stay.budgetStop !== null) return insufficient(stay.budgetStop, null);
    if (!stay.verified) continue;

    // 判据 ④：`∃j`。候选收窄已保证至少一个相位在 `W_{→goal}`；这里取 rank 最小、
    // 同 rank 取相位最小者（确定性，且出口路径最短）。
    let exitPhase = -1;
    let exitRank = -1;
    for (let j = 0; j < phaseCount; j++) {
      const value = goalCore.rank[goalCore.stateIndex(footX, j)] as number;
      if (value < 0) continue;
      if (exitRank === -1 || value < exitRank) {
        exitRank = value;
        exitPhase = j;
      }
    }
    if (exitPhase < 0) continue;
    const exit = buildU9Exit(goalCore, footX, exitPhase);
    if (exit === null) continue;

    const approach: U9Approach = {
      targetFootX: footX,
      phaseCoverage: {
        cells: phaseCount,
        coveredPhases,
        uncoveredPhases,
        complete: true,
      },
      phases,
      policy: approachPolicy,
      policyStates: approachPolicy.length,
      maxRank,
    };
    const termination: U9TerminationEvidence = {
      kind: "strictly-decreasing-rank",
      approachRanks: phases.map((phase) => phase.rank),
      approachMaxRank: maxRank,
      exitRank: exit.rank,
    };

    // 收尾墙钟检查：finish 新触发的 abort 仍只能 IE。
    const budgets = budget.finish();
    if (budgets.budgetStatus !== "complete") {
      return {
        status: "insufficient",
        degradationReason: budgetReasonOf(budgets.budgetKind),
        failure: null,
        ...nulls,
        budgets,
      };
    }

    return {
      status: "complete",
      degradationReason: null,
      failure: null,
      waitingCell: {
        footX,
        footY: space.corridor.footY,
        playerBox: witnessPlayerBox(space, footX),
        standable: true,
        corridor: "spawn-foot-y-run",
      },
      approach,
      stay,
      exit,
      termination,
      budgets,
    };
  }

  return failed("no-waiting-cell");
}

// ── U2-05：Witness 编码、体积与确定性 ────────────────────────────────────────
//
// 一、编码职责
//
//   把 U2-03 的 `WinningSetResult` / U2-04 的 `U9Result` 中**已通过 S1–S4** 的
//   转移记录压成 D9 `Witness`：`verifications` 是
//   `[fromFoot, fromK, toFoot, toK, t0, t1, 1]` 的去重表，`policy` 是指向下标的
//   有序策略表，`termination` / `phaseCoverage` 给出终止性与相位覆盖。
//   **不组装** `TemporalInternalResult`（入口与完整结果归 U5）；不修改 D9 形状。
//
// 二、确定性序列化（体积口径）
//
//   `serialized` = 对「Witness **去掉 `volume`**」的六个语义字段做规范化 JSON：
//   对象键按字典序、数组保留语义顺序、数字用 JSON 的确定性格式、不输出
//   `undefined`。`volume.bytes` 就是 `serialized` 的 UTF-8 字节数（标准
//   `TextEncoder`），因此可独立复算：`new TextEncoder().encode(serialized).length`。
//   `volume` 本身不进入序列化，避免 `bytes` 自指；`volume.transitions` 由
//   `verifications.length` 给出。同一输入重复编码必须逐字节一致。
//
// 三、体积
//
//   `volume.transitions = verifications.length`；任一超过
//   `maxWitnessTransitions` / `maxWitnessBytes` ⇒ `witness-volume`，**不截断**、
//   不返回部分 Witness。转移上限在构建过程中增量检查，字节上限在序列化后检查。
//
// 四、一次一档 lag
//
//   入口一次只接受一档 `lagMs` 与一个结果；不接收跨档数组、不做跨档合并。
//   U9 还会校验 `stay.lagPad` / `stay.hazardSpeed` / 每段 `lagPad` 与传入
//   `hazard` / `lagMs` 一致，防止把另一档的停留记录拼进来。W 的转移记录不携带
//   lag；双档隔离由「一次一档」的入口形状与调用方逐档独立调用保证。
//
// 五、时间基准
//
//   `wait` / `move` 转移（W、U9 接近段、U9 出口段、U9 停留段）统一使用
//   `witnessPhaseCellBounds(grid, k, 0)` 的**规范相位格时间**；整周期偏移由
//   重放器按 S4 规则（`prev.t1 === next.t0` 或相差 `periodMs`）补上。U9 的停留段
//   因此分解为 `k = 0..N−1` 的 N 个单格 `wait`：Hazard 严格以 `P` 周期重复、
//   玩家在 `s` 静止，`[T_arr, T_arr+P]` 的解析检查与规范相位格逐相位同值，
//   这不是采样，也不是把 `∀` / `∃` 改写。
//
// 六、U9 的段结构
//
//   `policy` 的顺序固定为：接近段（相位格升序、链内顺序）→ 停留段（`k` 升序
//   N 个单格 `wait`）→ 出口段（链内顺序）。段内可按 `(fromFoot, fromK)` 选后继；
//   跨段允许同一 `(fromFoot, fromK)` 出现不同后继（例如 `(s, j)` 既是停留 wait
//   的起点，也是出口链的起点），这是 U9 复合证书的语义，不是重复记录。接近段
//   的残差等待是**整格保守覆盖**而非逐 `φ0` 采样，D9 元组无法表达半格等待，
//   由 `phaseCoverage.complete`（N 个半开相位格全覆盖）+ 对齐状态承载，不塞进
//   `verifications`。
//
// 七、失败
//
//   失败只返回 D9 闭集原因码：体积超限 `witness-volume`；输入结果不完整 /
//   记录结构不一致 `no-witness-found`（不输出部分 Witness）；非法预算
//   `invalid-budget`；Hazard / lag 非有限或跨档不一致 `model-out`。
// ─────────────────────────────────────────────────────────────────────────────

/** @internal U2-05 编码输入：全相位 Winning Set。一次只接受一档 `lagMs`。 */
export type WinningSetWitnessEncodingRequest = {
  readonly form: "winning-set";
  readonly space: WitnessSpace;
  readonly hazard: WitnessHazard;
  readonly lagMs: number;
  /** 只读预算；本入口只用 `maxWitnessTransitions` / `maxWitnessBytes`。 */
  readonly budget: BudgetProfile;
  readonly result: WinningSetResult;
};

/** @internal U2-05 编码输入：U9 安全等待格。一次只接受一档 `lagMs`。 */
export type U9WitnessEncodingRequest = {
  readonly form: "u9";
  readonly space: WitnessSpace;
  readonly hazard: WitnessHazard;
  readonly lagMs: number;
  /** 只读预算；本入口只用 `maxWitnessTransitions` / `maxWitnessBytes`。 */
  readonly budget: BudgetProfile;
  readonly result: U9Result;
};

/** @internal 编码入口的判别联合；两档 lag 必须各自独立调用。 */
export type WitnessEncodingRequest = WinningSetWitnessEncodingRequest | U9WitnessEncodingRequest;

/** @internal 编码成功：`bytes === UTF-8(serialized).length`。 */
export type WitnessEncodingSuccess = {
  readonly ok: true;
  readonly witness: Witness;
  /** Witness 去掉 `volume` 后的规范化 JSON；`bytes` 就是它的 UTF-8 长度。 */
  readonly serialized: string;
  readonly bytes: number;
};

/** @internal 编码失败；`reason` 只取 D9 原因码闭集，不带部分 Witness。 */
export type WitnessEncodingFailure = {
  readonly ok: false;
  readonly reason: DegradationReason;
};

/** @internal 编码结果。 */
export type WitnessEncodingResult = WitnessEncodingSuccess | WitnessEncodingFailure;

// ── 规范化 JSON（确定性序列化） ─────────────────────────────────────────────

/**
 * @internal 规范化 JSON：对象键字典序、数组保序、数字用 `JSON.stringify` 的
 * 确定性格式、跳过 `undefined`。只接受可 JSON 化的纯数据。
 *
 * 不依赖对象键的原始枚举顺序（先 `sort()`），也不依赖 `Set` / `Map` 的遍历顺序。
 */
const canonicalJson = (value: unknown): string => {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError("canonical JSON requires finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const item = record[key];
      if (item === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${canonicalJson(item)}`);
    }
    return `{${parts.join(",")}}`;
  }
  throw new TypeError(`canonical JSON cannot encode ${typeof value}`);
};

// ── 内部辅助：策略表、链式重放、去重 ────────────────────────────────────────

const encodingFailure = (reason: DegradationReason): WitnessEncodingFailure => ({
  ok: false,
  reason,
});

/** @internal 编码出的语义字段；`volume` 在最终序列化之后补。 */
type EncodedWitnessParts =
  | {
      readonly ok: true;
      readonly form: WitnessForm;
      readonly verifications: readonly WitnessTransition[];
      readonly policy: readonly number[];
      readonly termination: PolicyTermination;
      readonly phaseCoverage: Witness["phaseCoverage"];
    }
  | WitnessEncodingFailure;

/** @internal `coveredPhases` 必须恰好是 `0..N−1`（升序、无缺、无重复）。 */
const coversAllPhases = (covered: readonly number[], phaseCount: number): boolean => {
  if (covered.length !== phaseCount) return false;
  for (let k = 0; k < phaseCount; k++) {
    if (covered[k] !== k) return false;
  }
  return true;
};

/** @internal 预算的两个 Witness 上限必须是有限非负整数。 */
const witnessBudgetValid = (budget: BudgetProfile): boolean =>
  Number.isInteger(budget.maxWitnessTransitions) && budget.maxWitnessTransitions >= 0 &&
  Number.isInteger(budget.maxWitnessBytes) && budget.maxWitnessBytes >= 0;

/**
 * @internal 把一条已通过 S1–S4 的转移转成 D9 元组。
 *
 * 只接受 `verified: true`、`failure: null`、整数状态、`to.k = (from.k+1) mod N`、
 * 有限且递增的时间，并要求时间与规范相位格 `witnessPhaseCellBounds(grid, from.k, 0)`
 * 逐位一致（U2-03 / U2-04 的记录都以 cycle = 0 生成）。任一不满足返回 `null`，
 * 调用方必须放弃整张 Witness，不得跳过该记录继续。
 */
const witnessTransitionTuple = (
  check: TransitionCheck,
  grid: WitnessGrid,
): WitnessTransition | null => {
  if (!check.verified || check.failure !== null) return null;
  const { from, to } = check;
  if (
    !Number.isInteger(from.footX) || !Number.isInteger(from.k) ||
    !Number.isInteger(to.footX) || !Number.isInteger(to.k)
  ) {
    return null;
  }
  if (from.k < 0 || from.k >= grid.phaseSteps) return null;
  if (to.k !== (from.k + 1) % grid.phaseSteps) return null;
  if (!Number.isFinite(check.t0) || !Number.isFinite(check.t1) || !(check.t1 > check.t0)) {
    return null;
  }
  const bounds = witnessPhaseCellBounds(grid, from.k, 0);
  if (check.t0 !== bounds.t0 || check.t1 !== bounds.t1) return null;
  return [from.footX, from.k, to.footX, to.k, check.t0, check.t1, 1];
};

/** @internal 编码草稿：去重表 + 策略下标，转移上限增量检查。 */
type WitnessDraft = {
  readonly verifications: WitnessTransition[];
  readonly policy: number[];
  readonly indexOf: Map<string, number>;
  readonly maxTransitions: number;
  overflowed: boolean;
};

const createWitnessDraft = (maxTransitions: number): WitnessDraft => ({
  verifications: [],
  policy: [],
  indexOf: new Map<string, number>(),
  maxTransitions,
  overflowed: false,
});

/**
 * @internal 追加一条转移；完全相同的元组只保留第一次出现的下标。
 *
 * 去重键含全部七个字段（含时间），因此不会把不同时间 / 不同后继的记录合并。
 * 输出顺序只由调用方的 push 顺序决定，不遍历 `Map`。
 */
const addWitnessTransition = (draft: WitnessDraft, transition: WitnessTransition): number => {
  const key = transition.join(",");
  const existing = draft.indexOf.get(key);
  if (existing !== undefined) return existing;
  const index = draft.verifications.length;
  draft.verifications.push(transition);
  draft.indexOf.set(key, index);
  draft.policy.push(index);
  if (draft.verifications.length > draft.maxTransitions) draft.overflowed = true;
  return index;
};

/** @internal 状态 → 策略项的稠密查表（状态索引按 `(footX − xLo)·N + k`）。 */
type PolicyLookup = {
  readonly entries: readonly (WinningSetPolicyEntry | null)[];
  readonly ranks: Int32Array;
};

const buildPolicyLookup = (
  space: WitnessSpace,
  policy: readonly WinningSetPolicyEntry[],
): PolicyLookup | null => {
  const { xLo, xHi } = space.corridor;
  const phaseCount = space.grid.phaseSteps;
  const stateCount = (xHi - xLo + 1) * phaseCount;
  const entries: (WinningSetPolicyEntry | null)[] =
    new Array<WinningSetPolicyEntry | null>(stateCount).fill(null);
  const ranks = new Int32Array(stateCount).fill(-1);
  for (const entry of policy) {
    const { footX, k } = entry.state;
    if (
      !Number.isInteger(footX) || footX < xLo || footX > xHi ||
      !Number.isInteger(k) || k < 0 || k >= phaseCount
    ) {
      return null;
    }
    if (!Number.isInteger(entry.rank) || entry.rank < 0) return null;
    const index = (footX - xLo) * phaseCount + k;
    if (entries[index] !== null) return null;
    entries[index] = entry;
    ranks[index] = entry.rank;
  }
  return { entries, ranks };
};

/** @internal 沿策略链重放的结果。 */
type ChainWalk =
  | { readonly kind: "ok"; readonly steps: number; readonly terminal: WitnessState }
  | { readonly kind: "fail" }
  | { readonly kind: "overflow" };

/**
 * @internal 建立「从任意 winning 状态沿 rank 严格递减的后继走到目标列」的
 * 重放器。每一步都重新检查：状态命中策略表、转移已验证、`from` 一致、
 * `to.k` 前进一格、后继 rank = 当前 rank − 1、相邻转移时间按 S4 连续。
 *
 * `overflow` 表示 verifications 已超过 `maxWitnessTransitions`，调用方必须
 * 立即返回 `witness-volume`，不得保留已构造的部分记录。
 */
const createChainWalker = (
  space: WitnessSpace,
  lookup: PolicyLookup,
  draft: WitnessDraft,
) => {
  const { xLo, xHi } = space.corridor;
  const grid = space.grid;
  const phaseCount = grid.phaseSteps;
  const stateCount = (xHi - xLo + 1) * phaseCount;
  const indexOf = (footX: number, k: number): number => (footX - xLo) * phaseCount + k;
  const inRange = (footX: number, k: number): boolean =>
    Number.isInteger(footX) && footX >= xLo && footX <= xHi &&
    Number.isInteger(k) && k >= 0 && k < phaseCount;

  return (start: WitnessState): ChainWalk => {
    let state = start;
    let previousT1: number | null = null;
    for (let step = 0; step <= stateCount; step++) {
      if (!inRange(state.footX, state.k)) return { kind: "fail" };
      const index = indexOf(state.footX, state.k);
      const entry = lookup.entries[index];
      if (entry === undefined || entry === null) return { kind: "fail" };
      const rank = lookup.ranks[index] as number;
      if (entry.transition === null) {
        if (rank !== 0) return { kind: "fail" };
        return { kind: "ok", steps: step, terminal: state };
      }
      const tuple = witnessTransitionTuple(entry.transition, grid);
      if (tuple === null) return { kind: "fail" };
      if (tuple[0] !== state.footX || tuple[1] !== state.k) return { kind: "fail" };
      if (!inRange(tuple[2], tuple[3])) return { kind: "fail" };
      const targetIndex = indexOf(tuple[2], tuple[3]);
      if ((lookup.ranks[targetIndex] as number) !== rank - 1) return { kind: "fail" };
      if (previousT1 !== null) {
        const offset = previousT1 - tuple[4];
        if (offset !== 0 && offset !== grid.periodMs) return { kind: "fail" };
      }
      previousT1 = tuple[5];
      addWitnessTransition(draft, tuple);
      if (draft.overflowed) return { kind: "overflow" };
      state = { footX: tuple[2], k: tuple[3] };
    }
    return { kind: "fail" };
  };
};

// ── W：全相位 Winning Set 编码 ──────────────────────────────────────────────

/**
 * @internal W 编码：从 N 个 spawn 起始相位各沿 rank 严格递减的后继走到 Goal。
 *
 * - 起点是 `phases[k].aligned = (spawn.footX, (k+1) mod N)`，N 个格全部要走到
 *   目标列（rank 0 且无后继）；
 * - 所有路径用到的转移按「相位格升序 → 链内顺序」去重进 `verifications`；
 * - `policy` 是这些去重记录的下标（同一张无记忆策略表），重放按
 *   `(fromFoot, fromK)` 选后继；
 * - `termination.rank[i]` 是该记录源状态的 rank（后继 rank = 它 − 1，rank 1 的
 *   后继是 Goal）；rank 严格递减 ⇒ 有限步抵达 Goal。
 */
const encodeWinningSetParts = (
  request: WinningSetWitnessEncodingRequest,
): EncodedWitnessParts => {
  const { space, result, budget } = request;
  const grid = space.grid;
  const phaseCount = grid.phaseSteps;

  if (result.status !== "complete") {
    return encodingFailure(result.degradationReason ?? "no-witness-found");
  }
  if (
    !result.phaseCoverage.complete ||
    result.phaseCoverage.cells !== phaseCount ||
    !coversAllPhases(result.phaseCoverage.coveredPhases, phaseCount) ||
    result.phases.length !== phaseCount
  ) {
    return encodingFailure("no-witness-found");
  }

  const lookup = buildPolicyLookup(space, result.policy);
  if (lookup === null) return encodingFailure("no-witness-found");
  const draft = createWitnessDraft(budget.maxWitnessTransitions);
  const walk = createChainWalker(space, lookup, draft);

  for (let k = 0; k < phaseCount; k++) {
    const phase = result.phases[k];
    if (phase === undefined || phase.cell !== k || !phase.covered) {
      return encodingFailure("no-witness-found");
    }
    // 残差等待是整格保守覆盖；它没有 D9 元组，但必须已通过才允许编码该格。
    if (!phase.residualWait.verified || phase.residualWait.failure !== null) {
      return encodingFailure("no-witness-found");
    }
    const aligned = phase.aligned;
    if (aligned.footX !== space.spawn.footX || aligned.k !== (k + 1) % phaseCount) {
      return encodingFailure("no-witness-found");
    }
    const walked = walk(aligned);
    if (walked.kind === "overflow") return encodingFailure("witness-volume");
    if (walked.kind === "fail") return encodingFailure("no-witness-found");
  }

  // rank 与 policy 一一对应：policy 是去重顺序，verifications 同序。
  const ranks: number[] = [];
  for (const transition of draft.verifications) {
    const index = (transition[0] - space.corridor.xLo) * phaseCount + transition[1];
    const rank = lookup.ranks[index] as number;
    if (!Number.isInteger(rank) || rank < 1) return encodingFailure("no-witness-found");
    ranks.push(rank);
  }

  return {
    ok: true,
    form: "winning-set",
    verifications: draft.verifications,
    policy: draft.policy,
    termination: { kind: "rank", rank: ranks },
    phaseCoverage: {
      cells: phaseCount,
      covered: result.phaseCoverage.coveredPhases.length,
      complete: true,
    },
  };
};

// ── U9：安全等待格编码 ──────────────────────────────────────────────────────

/**
 * @internal U9 编码：接近段 `∀k` + 停留段整周期 + 出口段 `∃j`。
 *
 * - 接近段：N 个对齐 spawn 状态各自的 `W_{→s}` 链，全部进入 `verifications`；
 * - 停留段：规范相位格的 N 个单格 `wait`（`k = 0..N−1`，`fromFoot = toFoot = s`），
 *   覆盖 `[T_arr, T_arr+P]` 的整周期解析检查；`stay.segments` 必须逐段连续、
 *   无正宽度碰撞，且 pad 与传入 `lagMs` 一致；
 * - 出口段：只编码 U2-04 选中的 `∃j` 起点与链，**不**把 `∃` 扩成 `∀`；
 * - `termination.trace.length` 是任一 spawn 相位到 Goal 的最长有限排程
 *   （接近 rank + 等到出口相位的单格 wait 数 + 出口 rank）。
 */
const encodeU9Parts = (
  request: U9WitnessEncodingRequest,
): EncodedWitnessParts => {
  const { space, hazard, lagMs, result, budget } = request;
  const grid = space.grid;
  const phaseCount = grid.phaseSteps;

  if (result.status !== "complete") {
    return encodingFailure(result.degradationReason ?? "no-witness-found");
  }
  const { waitingCell, approach, stay, exit } = result;
  if (waitingCell === null || approach === null || stay === null || exit === null) {
    return encodingFailure("no-witness-found");
  }
  if (
    !approach.phaseCoverage.complete ||
    approach.phaseCoverage.cells !== phaseCount ||
    !coversAllPhases(approach.phaseCoverage.coveredPhases, phaseCount) ||
    approach.phases.length !== phaseCount
  ) {
    return encodingFailure("no-witness-found");
  }
  if (approach.targetFootX !== waitingCell.footX) return encodingFailure("no-witness-found");
  if (!isValidWaitingCell(space, waitingCell.footX)) return encodingFailure("no-witness-found");

  // 停留段必须属于**这一档** hazard / lag，且整周期检查真的通过。
  const hazardSpeed = triangleMaxRate(hazard.motion);
  if (stay.periodMs !== grid.periodMs) return encodingFailure("model-out");
  if (stay.footX !== waitingCell.footX) return encodingFailure("no-witness-found");
  if (stay.hazardSpeed !== hazardSpeed) return encodingFailure("model-out");
  if (stay.lagPad !== hazardSpeed * lagMs) return encodingFailure("model-out");
  if (!Number.isFinite(stay.tArrival) || !Number.isFinite(stay.tEnd)) {
    return encodingFailure("model-out");
  }
  if (!stay.verified || stay.failure !== null || stay.segments.length === 0) {
    return encodingFailure("no-witness-found");
  }
  let cursor = stay.tArrival;
  for (const segment of stay.segments) {
    if (segment.t0 !== cursor || !(segment.t1 > segment.t0)) {
      return encodingFailure("no-witness-found");
    }
    if (!Number.isFinite(segment.slope) || !Number.isFinite(segment.lagPad)) {
      return encodingFailure("model-out");
    }
    if (segment.lagPad !== Math.abs(segment.slope) * lagMs) return encodingFailure("model-out");
    if (segment.collided || segment.collisionIntervals.length > 0) {
      return encodingFailure("no-witness-found");
    }
    cursor = segment.t1;
  }
  if (cursor !== stay.tEnd) return encodingFailure("no-witness-found");

  // ① 接近段：∀k。每个相位格的残差等待必须通过，对齐状态必须在 W_{→s} 中走到 s。
  const lookup = buildPolicyLookup(space, approach.policy);
  if (lookup === null) return encodingFailure("no-witness-found");
  const draft = createWitnessDraft(budget.maxWitnessTransitions);
  const walk = createChainWalker(space, lookup, draft);
  const approachRanks: number[] = [];
  let maxCell = -1;
  let maxArrival = -Infinity;
  for (let k = 0; k < phaseCount; k++) {
    const phase = approach.phases[k];
    if (phase === undefined || phase.cell !== k || !phase.covered) {
      return encodingFailure("no-witness-found");
    }
    if (!phase.residualWait.verified || phase.residualWait.failure !== null) {
      return encodingFailure("no-witness-found");
    }
    if (!Number.isInteger(phase.rank) || phase.rank < 0) {
      return encodingFailure("no-witness-found");
    }
    if (phase.tArrival === null || !Number.isFinite(phase.tArrival)) {
      return encodingFailure("no-witness-found");
    }
    const aligned = phase.aligned;
    if (aligned.footX !== space.spawn.footX || aligned.k !== (k + 1) % phaseCount) {
      return encodingFailure("no-witness-found");
    }
    const walked = walk(aligned);
    if (walked.kind === "overflow") return encodingFailure("witness-volume");
    if (walked.kind === "fail") return encodingFailure("no-witness-found");
    if (walked.steps !== phase.rank || walked.terminal.footX !== waitingCell.footX) {
      return encodingFailure("no-witness-found");
    }
    approachRanks.push(phase.rank);
    if (phase.tArrival > maxArrival) {
      maxArrival = phase.tArrival;
      maxCell = k;
    }
  }
  if (maxCell < 0 || stay.tArrival !== maxArrival) return encodingFailure("no-witness-found");

  // ② 停留段：规范相位格的 N 个单格 wait。Hazard 严格周期重复、玩家静止，
  //    因此 [T_arr, T_arr+P] 的整周期解析检查逐相位适用于这 N 格。
  for (let k = 0; k < phaseCount; k++) {
    const bounds = witnessPhaseCellBounds(grid, k, 0);
    const tuple: WitnessTransition = [
      waitingCell.footX, k, waitingCell.footX, (k + 1) % phaseCount,
      bounds.t0, bounds.t1, 1,
    ];
    addWitnessTransition(draft, tuple);
    if (draft.overflowed) return encodingFailure("witness-volume");
  }

  // ③ 出口段：∃j。只编码 U2-04 选中的那一条链，不要求所有相位都能出去。
  if (
    exit.footX !== waitingCell.footX ||
    !Number.isInteger(exit.phase) || exit.phase < 0 || exit.phase >= phaseCount ||
    !Number.isInteger(exit.rank) || exit.rank < 0 ||
    exit.policy.length === 0
  ) {
    return encodingFailure("no-witness-found");
  }
  let expectedFoot = exit.footX;
  let expectedK = exit.phase;
  let expectedRank = exit.rank;
  let previousT1: number | null = null;
  let terminated = false;
  for (let i = 0; i < exit.policy.length; i++) {
    const entry = exit.policy[i];
    if (entry === undefined) return encodingFailure("no-witness-found");
    if (
      entry.state.footX !== expectedFoot ||
      entry.state.k !== expectedK ||
      entry.rank !== expectedRank
    ) {
      return encodingFailure("no-witness-found");
    }
    if (entry.transition === null) {
      if (i !== exit.policy.length - 1 || entry.rank !== 0) {
        return encodingFailure("no-witness-found");
      }
      if (
        entry.state.footX !== exit.goalState.footX ||
        entry.state.k !== exit.goalState.k ||
        !space.arrival.goalStates.includes(entry.state.footX)
      ) {
        return encodingFailure("no-witness-found");
      }
      terminated = true;
      break;
    }
    const tuple = witnessTransitionTuple(entry.transition, grid);
    if (
      tuple === null ||
      tuple[0] !== expectedFoot ||
      tuple[1] !== expectedK
    ) {
      return encodingFailure("no-witness-found");
    }
    if (previousT1 !== null) {
      const offset = previousT1 - tuple[4];
      if (offset !== 0 && offset !== grid.periodMs) return encodingFailure("no-witness-found");
    }
    previousT1 = tuple[5];
    addWitnessTransition(draft, tuple);
    if (draft.overflowed) return encodingFailure("witness-volume");
    expectedFoot = tuple[2];
    expectedK = tuple[3];
    expectedRank = entry.rank - 1;
  }
  if (!terminated) return encodingFailure("no-witness-found");

  // 终止性：每个 spawn 相位都有一条有限排程；取最长者作为 trace 长度。
  let traceLength = 0;
  for (let k = 0; k < phaseCount; k++) {
    const rank = approachRanks[k] as number;
    const arrivalPhase = (k + 1 + rank) % phaseCount;
    const waits = (exit.phase - arrivalPhase + phaseCount) % phaseCount;
    const length = rank + waits + exit.rank;
    if (!Number.isSafeInteger(length)) return encodingFailure("model-out");
    if (length > traceLength) traceLength = length;
  }

  return {
    ok: true,
    form: "u9",
    verifications: draft.verifications,
    policy: draft.policy,
    termination: { kind: "trace", finite: true, length: traceLength },
    phaseCoverage: {
      cells: phaseCount,
      covered: approach.phaseCoverage.coveredPhases.length,
      complete: true,
    },
  };
};

// ── 入口 ────────────────────────────────────────────────────────────────────

/**
 * @internal 把 W / U9 的验证记录编码为 D9 `Witness`（U2-05）。
 *
 * 一次只接受一档 `lagMs` 与其对应结果；两档必须分别调用。体积按
 * 「Witness 去掉 `volume` 的规范化 JSON」的 UTF-8 字节数计量；任一上限超出
 * 立即返回 `witness-volume`，不截断、不返回部分 Witness。**不组装**
 * `TemporalInternalResult`。
 */
export function encodeWitness(request: WitnessEncodingRequest): WitnessEncodingResult {
  if (!witnessBudgetValid(request.budget)) return encodingFailure("invalid-budget");
  if (!Number.isFinite(request.lagMs) || request.lagMs < 0) {
    return encodingFailure("model-out");
  }
  if (!isFiniteHazard(request.hazard, request.lagMs)) return encodingFailure("model-out");

  const parts = request.form === "winning-set"
    ? encodeWinningSetParts(request)
    : encodeU9Parts(request);
  if (!parts.ok) return parts;

  if (parts.verifications.length > request.budget.maxWitnessTransitions) {
    return encodingFailure("witness-volume");
  }
  // 序列化对象 = Witness 的六个语义字段（不含 volume），避免 bytes 自指。
  const serialized = canonicalJson({
    derived: true,
    form: parts.form,
    phaseCoverage: parts.phaseCoverage,
    policy: parts.policy,
    termination: parts.termination,
    verifications: parts.verifications,
  });
  const bytes = new TextEncoder().encode(serialized).length;
  if (bytes > request.budget.maxWitnessBytes) return encodingFailure("witness-volume");

  const witness: Witness = {
    form: parts.form,
    derived: true,
    verifications: parts.verifications,
    policy: parts.policy,
    termination: parts.termination,
    phaseCoverage: parts.phaseCoverage,
    volume: { transitions: parts.verifications.length, bytes },
  };
  return { ok: true, witness, serialized, bytes };
}
