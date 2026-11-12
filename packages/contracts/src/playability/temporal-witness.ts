// **U2 Witness 环境**（D3 §1–§4）—— 状态格、静态走廊、精确 spawn 与到达状态。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、这里只有几何前置，没有搜索
//
//   本模块产出 U2-02 起的唯一底座：基础移动图、相位网格、静态走廊、精确 spawn、
//   到达状态。**没有** wait / move 转移（U2-02）、**没有** S1–S4、U9 / W
//   （U2-03 / U2-04）、**没有** Witness 编码（U2-05）；不 import `temporal.ts`（D6 DAG）。
//   入口是纯函数：相同输入 ⇒ 相同输出，不读时钟、不写文件、不抛未处理异常。
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
import type { BudgetProfile, DegradationReason } from "./temporal-result.js";

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
