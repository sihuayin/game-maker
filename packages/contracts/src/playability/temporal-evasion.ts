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
// 五、关键不健全性
//
//   `midAirHits = 0` 只作否决证据，**永不**作为「不存在空中触达」的正面证明；
//   `graphCut.verdict` 只能是 `"conditional"`；图割不连通不得写成
//   Runtime 不可达（`scene.ts:89` 空中水平控制未闭合）。
// ─────────────────────────────────────────────────────────────────────────────
import type { Aabb, Vec } from "./geometry.js";
import type { MovementGraph, MoveParams } from "./graph.js";
import { assessReachability } from "./reach.js";
import type { DegradationReason, PermanentGateProof, ProofStatus } from "./temporal-result.js";

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

/**
 * @internal
 *
 * **U4-05**：已填充图割判据；hop 双档与模型闭合由 U4-06 / U4-07 填充。
 * 因此当前 `status` 恒为 `INCOMPLETE`、`reason` 恒为 `graph-cut-incomplete`
 * （含 hop 半部尚未实现的含义）。
 *
 * 判据（D4 §4）：精确 spawn 出发的可达落脚点不得与 `goalRegion` 严格相交；
 * `midAirHits > 0` 只作**否决**，`midAirHits = 0` 永不作为正面证明；
 * `verdict` 只能是 `"conditional"`。
 */
export function computePermanentEvasion(input: PermanentEvasionInput): PermanentEvasionHalf {
  return {
    graphCut: graphCutOf(input),
    hopDoubling: null,
    hopSamplingCoverage: null,
    movementModelClosure: "not-proven-air-control",
    status: "INCOMPLETE",
    reason: "graph-cut-incomplete",
  };
}
