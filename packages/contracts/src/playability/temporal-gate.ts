// **U3 门区半部**（D4 §1–§3）—— 全周期恒覆盖门区、全周期覆盖记录、判侧规则与
// `forbiddenBoxes` 注入。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、本模块只产出「门区半部」
//
//   对外只有 `computePermanentGate(...)`，输出限定为 `gate` / `periodCoverage` /
//   `sideRule` / `forbiddenInjection` / `gateStatus` / `reason`。
//   完整 `PermanentGateProof`（含 `graphCut` / `hopDoubling` / `hopSamplingCoverage` /
//   `movementModelClosure`）与 `TemporalInternalResult` 的组装归 U4 / U5；
//   本模块**不生成、不伪造**这些字段，也不把门区结论升级为 PU。
//
// 二、输入是已派生的显式几何
//
//   本模块不解析 `GameConfig`、不建图：运动参数、Hazard 盒规格、玩家几何、
//   精确 spawn 盒、`goalRect` 与只读 graph 句柄全部由调用方传入。
//   门区只消费 y 区间与 x 核心；Hazard 不是 solid、不提供支撑（D2 / D4）。
//
// 三、依赖边界（D6 DAG）
//
//   只 import `temporal-result.ts` / `temporal-budget.ts` / `temporal-motion.ts` /
//   `geometry.ts` / 只读 `graph.ts` 类型；**不得** import `temporal.ts` 或
//   `temporal-witness.ts`（否则成环）。不新增公共 barrel 导出。
//
// 四、失败原因闭集
//
//   `reason` 只取 D9 `DegradationReason` 的 `no-permanent-gate` /
//   `geometry-untrusted`（D9 §5）；**不新增原因码**，不得用自由字符串降级。
//
// 五、ε
//
//   `gate.epsilon` 是 I-00 §6.4 的**单一具名常量**
//   （`temporal-motion.ts` 的 `epsilon(xMin, xMax)`），只用于门宽 / 显式区间阈值，
//   **不进入**碰撞谓词。x 域取 Hazard 锚点的全周期行程 `[at.x, at.x + distance]`：
//   它是本层唯一独立的长度标尺（用门宽自身作标尺会让 `width > ε` 退化为恒真）。
// ─────────────────────────────────────────────────────────────────────────────
import { expandBox } from "./geometry.js";
import type { Aabb, Size } from "./geometry.js";
import type { MovementGraph } from "./graph.js";
import { epsilon } from "./temporal-motion.js";
import type { HazardBoxSpec, TriangleMotion } from "./temporal-motion.js";
import type { DegradationReason, PermanentGateProof, ProofStatus } from "./temporal-result.js";

// ── 输出半部的类型：直接取自 D9，不另立同义类型 ──────────────────────────────

/** @internal 门区闭式几何，等价于 D9 `PermanentGateProof["gate"]`。 */
export type GateGeometry = PermanentGateProof["gate"];

/** @internal 全周期覆盖记录，等价于 D9 `PermanentGateProof["periodCoverage"]`。 */
export type GatePeriodCoverage = PermanentGateProof["periodCoverage"];

/** @internal 判侧记录，等价于 D9 `PermanentGateProof["sideRule"]`。 */
export type GateSideRule = PermanentGateProof["sideRule"];

/** @internal forbidden 注入记录，等价于 D9 `PermanentGateProof["forbiddenInjection"]`。 */
export type GateForbiddenInjection = PermanentGateProof["forbiddenInjection"];

/**
 * @internal 门区半部的输出。
 *
 * 缺失的半部显式用 `null` 表达「未证明」，不伪装成零值；`COMPLETE` 只在门区、
 * 全周期覆盖、判侧与注入全部成立时出现。
 */
export type PermanentGateHalf = {
  readonly gate: GateGeometry | null;
  readonly periodCoverage: GatePeriodCoverage | null;
  readonly sideRule: GateSideRule | null;
  readonly forbiddenInjection: GateForbiddenInjection | null;
  readonly gateStatus: ProofStatus;
  readonly reason: DegradationReason | null;
};

// ── 输入契约：全部是已派生的显式几何 ────────────────────────────────────────

/**
 * @internal U3 输入。
 *
 * `playerSize` 与 `graph.player` 必须同源（D4 §3：图与空间层使用同一份静态
 * solids、玩家几何与 profile）；`spawnBox` 是 D3 精确 spawn 盒，**不**外扩，
 * 也**不得**用 `startCells()` 的宽松多起点替代；`goalRect` 未外扩，判侧时由本模块
 * 四边外扩 `0.5px` 得 `goalRegion`。
 */
export type PermanentGateInput = {
  /** 三角波运动：`at` / `distance` / `periodMs`（px、px/ms）。 */
  readonly motion: TriangleMotion;
  /** Hazard 盒规格：manifest `size` + `anchor`，忽略 `entity.body`。 */
  readonly hazard: HazardBoxSpec;
  /** 玩家盒尺寸（manifest 解出的碰撞几何）。 */
  readonly playerSize: Size;
  /** 精确 spawn 盒（D3 脚点整数格派生，不外扩）。 */
  readonly spawnBox: Aabb;
  /** 配置派生的目标矩形（未外扩）。 */
  readonly goalRect: Aabb;
  /** 只读 graph 句柄（基线图，不带 `forbiddenBoxes`）；本模块不修改它。 */
  readonly graph: MovementGraph;
  /**
   * 建图入口。调用方持有 `config` / `manifest` / `profile`，本模块**不解析**
   * `GameConfig`；实现必须是
   * `buildMovementGraph(config, manifest, profile, { forbiddenBoxes })`
   * 且与 `graph` 同源。本模块用 `buildGraph([])` 重跑基线图校验同源，
   * 再以**原始** `gateRect` 注入一次（扩张只由 `graph.ts` 完成）。
   */
  readonly buildGraph: (forbiddenBoxes: readonly Aabb[]) => MovementGraph | null;
};

// ── 失败构造 ────────────────────────────────────────────────────────────────

/** @internal 门区几何判定结果；失败原因只取 D9 闭集的 U3 两项。 */
type GateGeometryCheck =
  | { readonly ok: true; readonly gate: GateGeometry }
  | { readonly ok: false; readonly reason: DegradationReason };

const incomplete = (reason: DegradationReason): PermanentGateHalf => ({
  gate: null,
  periodCoverage: null,
  sideRule: null,
  forbiddenInjection: null,
  gateStatus: "INCOMPLETE",
  reason,
});

// ── 门区闭式（D4 §1.1） ─────────────────────────────────────────────────────

/**
 * @internal
 * 门区闭式几何与有效性判定。
 *
 * ```text
 * L = at + d − anchorX·w
 * R = at + (1 − anchorX)·w
 * width = w − d
 * ```
 *
 * 有效条件：`width > ε`；Hazard 盒 y 区间与玩家盒 y 区间**严格重叠**。
 * 门区**不加** Witness 的 lag pad、不用整段扫掠区、不预扩张（D4 §1.4）。
 * 非法周期 / 非有限数值 / 非法几何 ⇒ `geometry-untrusted`，不静默修复；
 * 门宽或 y 区间不成立 ⇒ `no-permanent-gate`。
 */
const gateGeometryOf = (input: PermanentGateInput): GateGeometryCheck => {
  const { motion, hazard, playerSize, spawnBox } = input;
  const numeric = [
    motion.at.x, motion.at.y, motion.distance, motion.periodMs,
    hazard.size.w, hazard.size.h, hazard.anchor.x, hazard.anchor.y,
    playerSize.w, playerSize.h, spawnBox.x, spawnBox.y, spawnBox.w, spawnBox.h,
  ];
  if (numeric.some((value) => !Number.isFinite(value))) {
    return { ok: false, reason: "geometry-untrusted" };
  }
  if (!(motion.periodMs > 0) || motion.distance < 0) {
    return { ok: false, reason: "geometry-untrusted" };
  }
  if (!(hazard.size.w > 0) || !(hazard.size.h > 0) || !(playerSize.w > 0) || !(playerSize.h > 0)) {
    return { ok: false, reason: "geometry-untrusted" };
  }
  if (hazard.anchor.x < 0 || hazard.anchor.x > 1 || hazard.anchor.y < 0 || hazard.anchor.y > 1) {
    return { ok: false, reason: "geometry-untrusted" };
  }
  if (!(spawnBox.w > 0) || !(spawnBox.h > 0)) {
    return { ok: false, reason: "geometry-untrusted" };
  }

  const width = hazard.size.w - motion.distance;
  const threshold = epsilon(motion.at.x, motion.at.x + motion.distance);
  if (!(width > threshold)) return { ok: false, reason: "no-permanent-gate" };

  const hazY = motion.at.y - hazard.anchor.y * hazard.size.h;
  const hazH = hazard.size.h;
  // 严格重叠：贴边不算（Hazard 与玩家盒仅在边界接触时不可能挡住玩家）。
  if (!(hazY < spawnBox.y + spawnBox.h && spawnBox.y < hazY + hazH)) {
    return { ok: false, reason: "no-permanent-gate" };
  }

  const L = motion.at.x + motion.distance - hazard.anchor.x * hazard.size.w;
  const R = motion.at.x + (1 - hazard.anchor.x) * hazard.size.w;
  return { ok: true, gate: { L, R, width, y: hazY, height: hazH, epsilon: threshold } };
};

// ── 判侧规则（D4 §2） ───────────────────────────────────────────────────────

/** @internal PU 目标区域四边外扩 [px]（D4 §2；与 D3 的 NB 内缩方向相反）。 */
const GOAL_INFLATION = 0.5;

/** @internal 判侧判定结果。 */
type GateSideCheck =
  | { readonly ok: true; readonly sideRule: GateSideRule }
  | { readonly ok: false; readonly reason: DegradationReason };

/**
 * @internal
 * 判侧：证明起点与目标被门区**分离**。
 *
 * ```text
 * goalRegion = inflate(goalRect, 0.5)
 * 左→右：spawnBox.x + spawnBox.w ≤ L ∧ goalRegion.x ≥ R
 * 右→左：spawnBox.x ≥ R            ∧ goalRegion.x + goalRegion.w ≤ L
 * ```
 *
 * - spawn 用 D3 的**精确盒**，不外扩；**不得**用 `startCells()` 的宽松多起点。
 * - `goalRegion` 四边外扩 `0.5px`：PU 是「到不了」的过近似，方向与 NB 的到达内缩
 *   相反，**不得**复用 witness 的到达判断。
 * - 同侧 / 目标跨门 / 起点不在严格一侧 / 无法判侧 ⇒ `no-permanent-gate`；
 *   绝不输出可升级的门区结论。
 */
const sideRuleOf = (input: PermanentGateInput, gate: GateGeometry): GateSideCheck => {
  const { spawnBox, goalRect } = input;
  const goalValues = [goalRect.x, goalRect.y, goalRect.w, goalRect.h];
  if (goalValues.some((value) => !Number.isFinite(value))) {
    return { ok: false, reason: "geometry-untrusted" };
  }
  if (!(goalRect.w > 0) || !(goalRect.h > 0)) {
    return { ok: false, reason: "geometry-untrusted" };
  }

  const goalRegion = expandBox(goalRect, GOAL_INFLATION);
  const spawnRight = spawnBox.x + spawnBox.w;
  const goalRight = goalRegion.x + goalRegion.w;

  if (spawnRight <= gate.L && goalRegion.x >= gate.R) {
    return { ok: true, sideRule: { direction: "left->right", spawnBox, goalRegion } };
  }
  if (spawnBox.x >= gate.R && goalRight <= gate.L) {
    return { ok: true, sideRule: { direction: "right->left", spawnBox, goalRegion } };
  }
  return { ok: false, reason: "no-permanent-gate" };
};

// ── forbidden 注入（D4 §3） ─────────────────────────────────────────────────

/** @internal 逐元素相等（`Uint8Array` 掩码比较）。 */
const sameNumbers = (a: ArrayLike<number>, b: ArrayLike<number>): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

/** @internal 静态底座相等：世界、玩家、solids、coverage 与 `blocked`。 */
const sameStatics = (a: MovementGraph, b: MovementGraph): boolean =>
  a.width === b.width &&
  a.height === b.height &&
  a.stride === b.stride &&
  a.coverage === b.coverage &&
  sameNumbers(a.blocked, b.blocked) &&
  JSON.stringify(a.solids) === JSON.stringify(b.solids) &&
  JSON.stringify(a.player) === JSON.stringify(b.player);

/** @internal 同一份基线图：静态底座 + `forbidden` + `standable` 全等。 */
const sameGraph = (a: MovementGraph, b: MovementGraph): boolean =>
  sameStatics(a, b) && sameNumbers(a.forbidden, b.forbidden) && sameNumbers(a.standable, b.standable);

/**
 * @internal `graph.ts` 的禁区脚点格范围（与 `buildMovementGraph` 的展开公式一致）。
 *
 * 只用于**校验**注入结果，不用于注入本身：扩张必须由 `graph.ts` 完成。
 */
const forbiddenCellRange = (
  box: Aabb,
  player: Size,
  graph: MovementGraph,
): { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number } => {
  const halfW = player.w / 2;
  return {
    x0: Math.max(0, Math.floor(box.x - halfW) + 1),
    x1: Math.min(graph.width, Math.ceil(box.x + box.w + halfW) - 1),
    y0: Math.max(0, Math.floor(box.y) + 1),
    y1: Math.min(graph.height, Math.ceil(box.y + box.h + player.h) - 1),
  };
};

/** @internal forbidden 注入判定结果。 */
type GateInjectionCheck =
  | { readonly ok: true; readonly injection: GateForbiddenInjection }
  | { readonly ok: false; readonly reason: DegradationReason };

/**
 * @internal
 * `forbiddenBoxes` 注入与记录。
 *
 * - 把**原始** `gateRect`（`[L, R] × [y, y + height]`）原样交给建图入口；
 *   扩张只由 `graph.ts` 完成一次 —— 不预扩张、不重复扩张。
 * - 不写入 `blocked`：禁区只拒绝穿越，不提供支撑；门顶不是地板
 *   （`standable` 只看 `blocked`）。
 * - 基线图、注入图与传入的 `graph` 必须同源（同一份 solids / 玩家几何 / profile），
 *   否则 `geometry-untrusted`。
 * - 本模块只记录注入，**不**做图割、不调用 `assessReachability`、不产出 `graphCut`。
 */
const forbiddenInjectionOf = (
  input: PermanentGateInput,
  gate: GateGeometry,
): GateInjectionCheck => {
  const gateRect: Aabb = { x: gate.L, y: gate.y, w: gate.width, h: gate.height };
  const base = input.buildGraph([]);
  if (base === null || !sameGraph(base, input.graph)) {
    return { ok: false, reason: "geometry-untrusted" };
  }
  if (base.player.size.w !== input.playerSize.w || base.player.size.h !== input.playerSize.h) {
    return { ok: false, reason: "geometry-untrusted" };
  }

  const injected = input.buildGraph([gateRect]);
  if (injected === null || !sameStatics(injected, base)) {
    return { ok: false, reason: "geometry-untrusted" };
  }

  const { x0, x1, y0, y1 } = forbiddenCellRange(gateRect, input.playerSize, base);
  const expectedForbidden = base.forbidden.slice();
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) expectedForbidden[x * base.stride + y] = 1;
  }
  if (!sameNumbers(expectedForbidden, injected.forbidden)) {
    return { ok: false, reason: "geometry-untrusted" };
  }

  const expectedStandable = new Uint8Array(base.blocked.length);
  for (let x = 0; x <= base.width; x++) {
    for (let y = 0; y <= base.height; y++) {
      const index = x * base.stride + y;
      if (expectedForbidden[index] === 0 && y + 1 <= base.height && base.blocked[index + 1] === 1) {
        expectedStandable[index] = 1;
      }
    }
  }
  if (!sameNumbers(expectedStandable, injected.standable)) {
    return { ok: false, reason: "geometry-untrusted" };
  }

  const expandedRect: Aabb = {
    x: gateRect.x - input.playerSize.w / 2,
    y: gateRect.y,
    w: gateRect.w + input.playerSize.w,
    h: gateRect.h + input.playerSize.h,
  };
  return { ok: true, injection: { gateRect, expandedRect, source: "forbiddenBoxes" } };
};

// ── 入口 ────────────────────────────────────────────────────────────────────

// ── 全周期覆盖（D4 §1.2–§1.3） ──────────────────────────────────────────────

/** @internal 全周期覆盖判定结果。 */
type GateCoverageCheck =
  | { readonly ok: true; readonly coverage: GatePeriodCoverage }
  | { readonly ok: false; readonly reason: DegradationReason };

/**
 * @internal
 * 全周期覆盖记录，只允许**闭式全周期**结果。
 *
 * ```text
 * max p = at + d   （t = P/2）
 * min p = at       （t = 0 / P）
 * ```
 *
 * 两个半周期各自单调，各自相对门区核心的覆盖在定义上成立；折返点只作解析边界，
 * 不跨段推断。区间记录一个周期内的绝对时间窗口（ms，端点闭合），**不合并**，
 * 让「上升段 / 下降段」的解析来源保持可见。
 *
 * `intervals` 的语义（D9 未进一步限定，本模块冻结）：周期内门区核心被覆盖的时间
 * 窗口；有效门区在定义上覆盖整个周期，两段相邻且合起来是 `[0, periodMs]`。
 *
 * 采样、子周期或「幸运相位」结果**不得**生成 `complete: true`；非法周期不是
 * 「未覆盖」，而是 `geometry-untrusted`。
 */
const periodCoverageOf = (motion: TriangleMotion): GateCoverageCheck => {
  const period = motion.periodMs;
  if (!Number.isFinite(period) || !(period > 0)) {
    return { ok: false, reason: "geometry-untrusted" };
  }
  const half = period / 2;
  const coverage: GatePeriodCoverage = {
    periodMs: period,
    complete: true,
    intervals: [[0, half], [half, period]],
  };
  return { ok: true, coverage };
};

// ── 入口 ────────────────────────────────────────────────────────────────────

/**
 * @internal
 * U3 门区半部的入口。
 *
 * 填 `gate`（U3-02）、`periodCoverage`（U3-03）、`sideRule`（U3-04）与
 * `forbiddenInjection`（U3-05）。四者全部成立时 `gateStatus` 为 `COMPLETE`，
 * 但这只是**门区半部**完成，不代表完整 `PermanentGateProof` —— `graphCut` /
 * hop / 模型闭合归 U4 / U5，**不得**在本模块伪造。
 *
 * `INCOMPLETE` 一律不携带半部结果（宁可整段为 `null`，也不留下可被误读为
 * 「部分证明」的几何）。
 */
export const computePermanentGate = (input: PermanentGateInput): PermanentGateHalf => {
  const geometry = gateGeometryOf(input);
  if (!geometry.ok) return incomplete(geometry.reason);
  const coverage = periodCoverageOf(input.motion);
  if (!coverage.ok) return incomplete(coverage.reason);
  const side = sideRuleOf(input, geometry.gate);
  if (!side.ok) return incomplete(side.reason);
  const injection = forbiddenInjectionOf(input, geometry.gate);
  if (!injection.ok) return incomplete(injection.reason);
  return {
    gate: geometry.gate,
    periodCoverage: coverage.coverage,
    sideRule: side.sideRule,
    forbiddenInjection: injection.injection,
    gateStatus: "COMPLETE",
    reason: null,
  };
};
