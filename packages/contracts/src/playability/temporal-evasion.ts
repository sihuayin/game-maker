// **U4 垂直规避图割半部**（D4 §4–§7）—— 图割判据、hop 60/120Hz 双档、
// 规范化采样覆盖与模型闭合声明。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、本模块只产出「图割半部」
//
//   对外只有 `computePermanentEvasion(...)`，输出限定为 `graphCut` /
//   `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure` /
//   `status` / `reason`。
//   `puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction`、
//   完整 `PermanentGateProof` 与 `TemporalInternalResult` / `certificate` 的组装归 U5；
//   本模块**不生成、不伪造**这些字段，也不把图割结论升级为 PU。
//
// 二、输入是已派生的显式几何
//
//   本模块不解析 `GameConfig`、不建图：精确 spawn 脚点格、**已外扩 0.5px** 的
//   `goalRegion`、门区 `gateRect`（诊断 / 对齐用）、运动参数与只读 graph 句柄
//   全部由调用方传入。图割起点必须用精确 spawn，**不得**用 `startCells()` 的
//   宽松多起点（D4 §4）。
//
// 三、依赖边界（D6 DAG）
//
//   只 import `temporal-result.ts` 类型与只读 `graph.ts` 类型；**不得** import
//   `temporal.ts`、`temporal-gate.ts` 或 `temporal-witness.ts`（否则成环）。
//   不新增公共 barrel 导出。
//
// 四、失败原因闭集
//
//   `reason` 只取 D9 `DegradationReason`，并按地图冻结映射使用：
//   `graph-cut-incomplete` / `hop-sample-budget` / `hop-doubling-changed` /
//   `movement-model-unclosed` / `geometry-untrusted`；**不新增原因码**。
//
// 五、关键不健全性与模型闭合
//
//   `midAirHits = 0` 只作否决证据，**永不**作为「不存在空中触达」的正面证明；
//   `graphCut.verdict` 只能是 `"conditional"`；图割不连通不得写成
//   Runtime 不可达。`movementModelClosure` 恒为 `"not-proven-air-control"`（D4 §7）：
//   - `scene.ts:89` 每帧无条件水平加速 ⇒ 空中水平控制未被移动模型闭合；
//   - `graph.ts` 的 hop 弧只模拟恒定水平速度；
//   - `reach.ts` 的 mid-air 扫描是 60Hz 保守保护，不是可达性证明；
//   - `walk-off` 只做同列竖直下落，不建模下落中的水平漂移。
//
//   因此本模块**从不**主张 Runtime 不可达、从不发布 PU / 公共 Verdict；
//   `movement-model-unclosed` 保留给未来要求该主张的调用方（U5 组装层），
//   U4 自身不产生该路径。输出键固定为六个，不得夹带 `puConditions` /
//   `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` / `certificate` /
//   `internalResult` / `publicCapability`。
// ─────────────────────────────────────────────────────────────────────────────
import { maxJumpHeight } from "../game-config.js";
import { boxFromFoot, overlapsStrict } from "./geometry.js";
import type { Aabb, Vec } from "./geometry.js";
import { hopEdges, movementNeighbors } from "./graph.js";
import type { MovementGraph, MoveParams } from "./graph.js";
import { assessReachability } from "./reach.js";
import type { DegradationReason, HopSampleSummary, PermanentGateProof, ProofStatus } from "./temporal-result.js";

// ── 输出半部的类型：直接取自 D9，不另立同义类型 ──────────────────────────────

/** @internal 图割判据记录，等价于 D9 `PermanentGateProof["graphCut"]`。 */
export type EvasionGraphCut = PermanentGateProof["graphCut"];

/** @internal hop 双档记录，等价于 D9 `PermanentGateProof["hopDoubling"]`。 */
export type EvasionHopDoubling = PermanentGateProof["hopDoubling"];

/** @internal 规范化采样覆盖记录，等价于 D9 `PermanentGateProof["hopSamplingCoverage"]`。 */
export type EvasionHopSamplingCoverage = PermanentGateProof["hopSamplingCoverage"];

/** @internal 模型闭合声明，等价于 D9 `PermanentGateProof["movementModelClosure"]`。 */
export type EvasionModelClosure = PermanentGateProof["movementModelClosure"];

/**
 * @internal 图割半部的输出。
 *
 * 缺失的半部显式用 `null` 表达「未证明」，不伪装成零值；`COMPLETE` 只在图割、
 * hop 双档与采样覆盖全部成立时出现。`movementModelClosure` 恒为
 * `"not-proven-air-control"`（D4 §7），不随 `status` 变化。
 */
export type PermanentEvasionHalf = {
  readonly graphCut: EvasionGraphCut | null;
  readonly hopDoubling: EvasionHopDoubling | null;
  readonly hopSamplingCoverage: EvasionHopSamplingCoverage | null;
  readonly movementModelClosure: EvasionModelClosure;
  readonly status: ProofStatus;
  readonly reason: DegradationReason | null;
};

// ── 输入契约：全部是已派生的显式几何 ────────────────────────────────────────

/**
 * @internal U4 输入。
 *
 * `spawnCell` 是 D3 的**精确** spawn 脚点格（不是 `startCells()` 的宽松种子）；
 * `goalRegion` 必须**已**按 D4 §2 四边外扩 0.5px（到达方向为过近似，与 NB 的内缩
 * 方向相反）；`gateRect` 只用于诊断 / 与门区半部对齐，图割判据本身只消费
 * `goalRegion`、`spawnCell`、`move` 与 `graph`。`graph` 必须与空间层使用同一份
 * 静态 solids、玩家几何与 profile。
 */
export type PermanentEvasionInput = {
  readonly spawnCell: Vec;
  readonly goalRegion: Aabb;
  readonly gateRect: Aabb;
  readonly move: MoveParams;
  readonly graph: MovementGraph;
  /**
   * 生效的每弧 hop 采样上限（D5 `maxHopSamples`，默认 / 硬上限 240）。
   * 调用方（U5 组装层）已用 `resolveBudgetProfile` 校验；低于 `hopSamples` 的
   * 结构下限 6（或高于 240）时本模块显式降级 `hop-sample-budget`，不改用默认值。
   */
  readonly maxHopSamples?: number;
};

/**
 * @internal 把图的 `startCells()` 钉成 D3 的**精确** spawn 脚点格。
 *
 * `assessReachability` 的种子默认来自 `startCells()`（出生点附近一个身位内的宽松
 * 多起点）；PU 图割只允许从精确 spawn 出发（D4 §4），因此这里覆盖种子函数，
 * 其余字段（solid / blocked / forbidden / player / columns）全部原样共享。
 */
export function withExactSpawnSeed(graph: MovementGraph, spawnCell: Vec): MovementGraph {
  return { ...graph, startCells: () => [spawnCell] };
}

/** @internal U4 图割判据（不对外承诺语义细节；半部形状取自 D9）。 */
function graphCutOf(input: PermanentEvasionInput): EvasionGraphCut {
  const seeded = withExactSpawnSeed(input.graph, input.spawnCell);
  // `full: true`：走完整 BFS，不因目标提前覆盖而停；`midAir` 用 reach.ts 现有
  // 60Hz 行为，只作否决证据（D4 §4），不参与 hop 双档参数化。
  const assessment = assessReachability(
    seeded,
    input.move,
    [{ id: "goal-region", rect: input.goalRegion }],
    { full: true },
  );
  const reachableFootpoints = assessment.seen.size;
  const goalIntersections = assessment.covered.size;
  const midAirHits = assessment.midAir.size;
  return {
    verdict: "conditional",
    reachableFootpoints,
    goalIntersections,
    midAirHits,
    evidence: `reach@full; seeds=${assessment.seeds.length}; footpoints=${reachableFootpoints}; goalIntersections=${goalIntersections}; midAirHits=${midAirHits}; verdict=conditional`,
  };
}

/** @internal 模型闭合声明（D4 §7 / D9 冻结字面量）。 */
export const MOVEMENT_MODEL_CLOSURE = "not-proven-air-control" as const;

/** @internal hop 预算无法满足采样下限时的原因码（D9 闭集）。 */
const HOP_SAMPLE_BUDGET_REASON: DegradationReason = "hop-sample-budget";

// ── hop 双档（D4 §6） ───────────────────────────────────────────────────────

/** @internal 冻结的双档参数（D4 §6.1；主档 = 现行默认）。 */
const HOP_BASE = { hz: 60, maxSamples: 120 } as const;
const HOP_DOUBLED = { hz: 120, maxSamples: 240 } as const;

/** @internal `hopSamples` 的结构下限（与 `graph.ts` 的 `Math.max(6, …)` 一致）。 */
const HOP_MIN_SAMPLES = 6;

/**
 * @internal 把生效预算折算成两档每弧上限。
 *
 * 默认（`undefined`）保持 D4 冻结的 `120 / 240`；显式上限同时约束两档。
 * 调用方已把值校验到 `[6, 240]`；这里只把主档上限压到 `120`。
 */
const hopCapsOf = (maxHopSamples: number | undefined): { base: number; doubled: number } => {
  const requested = maxHopSamples ?? HOP_DOUBLED.maxSamples;
  return {
    base: Math.min(HOP_BASE.maxSamples, requested),
    doubled: requested,
  };
};

type SamplingRun = {
  readonly reached: boolean;
  readonly footpoints: number;
  /** 本档实际接受的 hop 弧（起点 + 落点）。 */
  readonly arcs: readonly { readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number }[];
};

/**
 * @internal 用指定采样参数跑一次**完整**可达性检查（不提前终止）。
 *
 * ⚠️ `reach.ts` 只读且不参数化 hop 采样（D4 §5），因此这里用同一组
 * `movementNeighbors` / `hopEdges` 原语做完整 BFS；覆盖语义与 `assessReachability`
 * 对齐（落脚点盒、walk-off / fall 下落段、hop 弧采样点）。mid-air 不在此处，
 * 仍由 `reach.ts` 的 60Hz 行为只作否决。
 */
function reachWithSampling(
  graph: MovementGraph,
  move: MoveParams,
  start: Vec,
  goalRegion: Aabb,
  sampling: { readonly hz?: number; readonly maxSamples?: number },
): SamplingRun {
  const playerSize = graph.player.size;
  const seen = new Set<string>();
  const queue: Vec[] = [];
  const arcs: { ax: number; ay: number; bx: number; by: number }[] = [];
  let reached = false;
  const coverAt = (x: number, y: number): void => {
    if (reached) return;
    if (overlapsStrict(boxFromFoot({ x, y }, playerSize), goalRegion)) reached = true;
  };
  const add = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({ x, y });
    coverAt(x, y);
  };
  add(start.x, start.y);
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    for (const edge of movementNeighbors(graph, cell.x, cell.y)) {
      if (edge.kind !== "walk") {
        if (edge.x !== cell.x) coverAt(edge.x, cell.y);
        for (let y = cell.y + 1; y <= edge.y; y++) coverAt(edge.x, y);
      }
      add(edge.x, edge.y);
    }
    for (const edge of hopEdges(graph, cell.x, cell.y, move, sampling)) {
      for (const sample of edge.samples) coverAt(sample.x, sample.y);
      add(edge.x, edge.y);
      arcs.push({ ax: cell.x, ay: cell.y, bx: edge.x, by: edge.y });
    }
  }
  return { reached, footpoints: seen.size, arcs };
}

/**
 * @internal 单条候选弧的每弧采样数（与 `graph.ts` 的 `hopSamples` 同一公式与
 * 同一有效性条件）。只用于 `F1 ⊆ F2` 的整数判定与 cap 检测；实际采样仍由
 * `hopEdges` 完成，避免出现第二份采样实现。
 */
function arcSampleCount(
  graph: MovementGraph,
  move: MoveParams,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  hz: number,
  maxSamples: number,
): { readonly n: number; readonly capped: boolean } | null {
  if (ay - by > maxJumpHeight(move) || ay - by < -graph.height) return null;
  const disc = move.jumpVelocity * move.jumpVelocity - 2 * move.gravity * (ay - by);
  if (disc < 0) return null;
  const t = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
  if (Math.abs(bx - ax) > move.speed * t) return null;
  const raw = Math.ceil(t * hz);
  return { n: Math.max(6, Math.min(maxSamples, raw)), capped: raw > maxSamples };
}

/** @internal `F1 ⊆ F2`：对每个 `i` 用整数交叉乘判定，不用浮点容差。 */
export function normalPositionsCovered(n1: number, n2: number): boolean {
  for (let i = 0; i <= n1; i++) if ((i * n2) % n1 !== 0) return false;
  return true;
}

/** @internal D9 摘要的确定性投影：`n` 取该档最大每弧采样数，`endpoints` 为落点集合。 */
function summarize(run: SamplingRun, n: number, cap: number): HopSampleSummary {
  const endpoints = [...new Map(run.arcs.map((a) => [`${a.bx},${a.by}`, [a.bx, a.by] as const])).values()]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { n, endpoints, cap };
}

/**
 * @internal 主降级原因，**固定优先级**以保证确定性：
 *
 * 1. 图割否决（目标被落脚点覆盖，或 `midAirHits > 0`）⇒ `graph-cut-incomplete`；
 * 2. 任一档判目标可达 ⇒ `graph-cut-incomplete`；
 * 3. 任一档 cap 绑定 ⇒ `hop-sample-budget`；
 * 4. 覆盖不可证明 / 两档不一致 / 连通性改变 ⇒ `hop-doubling-changed`；
 * 5. 全部成立 ⇒ `null`（`COMPLETE`，仍是 `modelConditional`）。
 *
 * `movement-model-unclosed` 是本模块的**保留码**：U4 只做模型内计算，从不主张
 * Runtime 不可达（`scene.ts:89` 空中水平控制未闭合）。若未来调用方要求这种主张，
 * 必须在此返回该码，并保持 `INCOMPLETE`；U4 当前不产生该路径。
 */
function degradationReasonOf(args: {
  readonly graphCut: EvasionGraphCut;
  readonly base: SamplingRun;
  readonly doubled: SamplingRun;
  readonly capBound: boolean;
  readonly coverage: boolean;
  readonly connectivityPreserved: boolean;
}): DegradationReason | null {
  if (args.graphCut.goalIntersections > 0 || args.graphCut.midAirHits > 0) return "graph-cut-incomplete";
  if (args.base.reached || args.doubled.reached) return "graph-cut-incomplete";
  if (args.capBound) return "hop-sample-budget";
  if (!args.coverage || !args.connectivityPreserved) return "hop-doubling-changed";
  return null;
}

/**
 * @internal
 *
 * **U4-06 / U4-07**：图割 + hop 双档 + 规范化采样覆盖 + 模型闭合声明与输出边界。
 *
 * 判据（D4 §4 / §6）：
 * - 图割：精确 spawn 出发的可达落脚点不得与 `goalRegion` 严格相交；
 *   `midAirHits > 0` 只作**否决**，`midAirHits = 0` 永不作为正面证明；
 *   `verdict` 只能是 `"conditional"`。
 * - hop 双档：60 / 120Hz 两档各自独立跑完整可达性；验证 `F1 ⊆ F2`；
 *   **不要求** `n_doubled = 2·n_base`；cap 绑定、两档不一致、连通性改变 ⇒ `INCOMPLETE`。
 */
export function computePermanentEvasion(input: PermanentEvasionInput): PermanentEvasionHalf {
  // hop 预算低于采样原语的结构下限（或高于硬上限）时，无法在不超预算的前提下
  // 完成双档 BFS ⇒ 显式降级 `hop-sample-budget`，不静默改用默认值。
  if (
    input.maxHopSamples !== undefined &&
    (!Number.isInteger(input.maxHopSamples) ||
      input.maxHopSamples < HOP_MIN_SAMPLES ||
      input.maxHopSamples > HOP_DOUBLED.maxSamples)
  ) {
    return {
      graphCut: null,
      hopDoubling: null,
      hopSamplingCoverage: null,
      movementModelClosure: MOVEMENT_MODEL_CLOSURE,
      status: "INCOMPLETE",
      reason: HOP_SAMPLE_BUDGET_REASON,
    };
  }
  const graphCut = graphCutOf(input);
  const caps = hopCapsOf(input.maxHopSamples);
  const baseSampling = { hz: HOP_BASE.hz, maxSamples: caps.base };
  const doubledSampling = { hz: HOP_DOUBLED.hz, maxSamples: caps.doubled };
  const base = reachWithSampling(input.graph, input.move, input.spawnCell, input.goalRegion, baseSampling);
  const doubled = reachWithSampling(input.graph, input.move, input.spawnCell, input.goalRegion, doubledSampling);

  // 逐弧覆盖与 cap：两档接受的弧取并集（双档只会因更密采样删边，不会新增弧）。
  const seenArc = new Set<string>();
  let coverage = true;
  let capBound = false;
  let maxNBase = 0;
  let maxNDoubled = 0;
  for (const arc of [...base.arcs, ...doubled.arcs]) {
    const key = `${arc.ax},${arc.ay},${arc.bx},${arc.by}`;
    if (seenArc.has(key)) continue;
    seenArc.add(key);
    const n1 = arcSampleCount(input.graph, input.move, arc.ax, arc.ay, arc.bx, arc.by, baseSampling.hz, baseSampling.maxSamples);
    const n2 = arcSampleCount(input.graph, input.move, arc.ax, arc.ay, arc.bx, arc.by, doubledSampling.hz, doubledSampling.maxSamples);
    if (!n1 || !n2) continue;
    maxNBase = Math.max(maxNBase, n1.n);
    maxNDoubled = Math.max(maxNDoubled, n2.n);
    if (n1.capped || n2.capped) capBound = true;
    if (!normalPositionsCovered(n1.n, n2.n)) coverage = false;
  }

  const connectivityPreserved = base.reached === doubled.reached;
  const hopDoubling = {
    base: summarize(base, maxNBase, caps.base),
    doubled: summarize(doubled, maxNDoubled, caps.doubled),
    connectivityPreserved,
    normalizedCoverage: coverage,
  };
  const hopSamplingCoverage = {
    covered: coverage,
    method: coverage ? ("normalized" as const) : ("insufficient" as const),
  };

  const reason = degradationReasonOf({ graphCut, base, doubled, capBound, coverage, connectivityPreserved });

  return {
    graphCut,
    hopDoubling,
    hopSamplingCoverage,
    movementModelClosure: MOVEMENT_MODEL_CLOSURE,
    status: reason === null ? "COMPLETE" : "INCOMPLETE",
    reason,
  };
}
