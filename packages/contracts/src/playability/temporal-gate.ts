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
//   **不进入**碰撞谓词。
// ─────────────────────────────────────────────────────────────────────────────
import type { Aabb, Size } from "./geometry.js";
import type { MovementGraph } from "./graph.js";
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
  /** 只读 graph 句柄；本模块不建图、不修改 graph。 */
  readonly graph: MovementGraph;
};

// ── 入口 ────────────────────────────────────────────────────────────────────

/**
 * @internal
 * U3 门区半部的入口。
 *
 * U3-01 只建立 API 契约与输入边界：始终返回 `INCOMPLETE` + `no-permanent-gate`，
 * 不计算任何门区半部。几何闭式（U3-02）、全周期覆盖（U3-03）、判侧（U3-04）与
 * `forbiddenInjection`（U3-05）由后续票逐段填充；在填满之前，**不得**返回
 * `COMPLETE`，也不得以「部分结果」冒充证明。
 */
export const computePermanentGate = (input: PermanentGateInput): PermanentGateHalf => {
  void input;
  return {
    gate: null,
    periodCoverage: null,
    sideRule: null,
    forbiddenInjection: null,
    gateStatus: "INCOMPLETE",
    reason: "no-permanent-gate",
  };
};
