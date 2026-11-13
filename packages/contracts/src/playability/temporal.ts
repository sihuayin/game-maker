// **时序分析的输入与编排词汇**（I-01）—— 纯函数，不读盘。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、I-01 只建立输入可信度与两档编排，不做时序算法
//
//   `stubTemporalAnalyzer` 是**显式占位实现**：对任何适用输入只返回
//   `INSUFFICIENT_EVIDENCE`，永不返回 `PROVEN_UNPLAYABLE` / `NO_PROVEN_BLOCKER`。
//   它不是能力声明；I-02 才在同一入口替换实现。
//
// 二、两档只比 verdict
//
//   `16.67ms` 与 `200ms` 两次调用；`verdict` 不同 ⇒ IE + `lag-disagreement`。
//   非法 lag ⇒ IE + `lag-invalid`，优先于 disagreement。`0` 合法（有限非负数）。
//
// 三、适用性与范围
//
//   只要存在 `kind === "hazard"` 且带 `motion` 的实体就适用；Y 轴与多移动 Hazard
//   保守 IE，不判为不适用。验证范围 = player + 配置引用的 hazard / pickup / goal。
// ─────────────────────────────────────────────────────────────────────────────
import type { AssetPackManifest } from "../assetpack.js";
import { FALLBACK_ANCHOR, playerMoveOf } from "../game-config.js";
import type { GameConfig } from "../game-config.js";
import type { Aabb } from "./geometry.js";
import { expandBox } from "./geometry.js";
import { buildMovementGraph } from "./graph.js";
import type { MovementGraph } from "./graph.js";
import { runtimeEntityGeometry } from "./profile.js";
import {
  BUDGET_DEFAULTS,
  deriveMaxBranching,
  deriveMaxEdges,
  resolveBudgetProfile,
} from "./temporal-budget.js";
import { computePermanentEvasion } from "./temporal-evasion.js";
import type { PermanentEvasionHalf } from "./temporal-evasion.js";
import { computePermanentGate } from "./temporal-gate.js";
import type { PermanentGateHalf } from "./temporal-gate.js";
import type { HazardBoxSpec, TriangleMotion } from "./temporal-motion.js";
import type {
  BudgetKind,
  BudgetProfile,
  BudgetStatus,
  Certificate,
  DegradationReason,
  Diagnostics,
  GeometryCoverage,
  InternalBudget,
  InternalResultState,
  PermanentGateProof,
  PuCondition,
  Stats,
  TemporalInternalResult,
} from "./temporal-result.js";
import {
  createWitnessWorkBudget,
  encodeWitness,
  resolveWitnessSpace,
  searchWinningSet,
} from "./temporal-witness.js";
import type { WitnessHazard, WitnessSpace, WitnessWorkSnapshot } from "./temporal-witness.js";
import type { PlayabilityVerdictState } from "./verdict.js";
import { isTrustedAtlasInput, type TrustedAtlasInput } from "./temporal-input.js";

/** 逐帧延迟（约 60Hz）。I01-04：唯一具名常量，不复用 mechanic.ts 的帧余量常量。 */
export const TEMPORAL_LAG_MS = 16.67;

/** 基准延迟：`smoothStep` 下 `delta ≤ 200ms` 的源码上界推导值，不是实测延迟。 */
export const TEMPORAL_LAG_BASELINE_MS = 200;

export type TemporalAuditResult =
  | { readonly applicable: false }
  | {
      readonly applicable: true;
      readonly verdict: PlayabilityVerdictState;
      readonly degradation?: "lag-invalid" | "lag-disagreement";
    };

export type TemporalAnalyzer = (args: {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  readonly lagMs: number;
  readonly trustedInput: TrustedAtlasInput;
}) => TemporalAuditResult;

export type TemporalScope = {
  readonly applicable: boolean;
  /** player + 引用的 hazard / pickup / goal；去重、稳定排序。 */
  readonly assetIds: readonly string[];
};

/**
 * 适用性与验证范围的**唯一来源**：三处生产调用方都经由 `runTemporalAudit`，
 * 不各自重写一遍。
 */
export function temporalScope(config: GameConfig): TemporalScope {
  const ids = new Set<string>([config.player.asset]);
  let applicable = false;
  for (const entity of config.entities) {
    if (entity.kind === "hazard" && entity.motion !== undefined) applicable = true;
    if (entity.kind === "hazard" || entity.kind === "pickup" || entity.kind === "goal") ids.add(entity.asset);
  }
  return { applicable, assetIds: [...ids].sort((a, b) => a.localeCompare(b)) };
}

/** 显式生产 stub：只返回 IE，永不 NB / PU。它不是时序算法的能力声明。 */
export function stubTemporalAnalyzer(_args: Parameters<TemporalAnalyzer>[0]): TemporalAuditResult {
  return { applicable: true, verdict: "INSUFFICIENT_EVIDENCE" };
}

const lagInvalid = (): TemporalAuditResult => ({
  applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-invalid",
});

const insufficient = (): TemporalAuditResult => ({
  applicable: true, verdict: "INSUFFICIENT_EVIDENCE",
});

const isLagInvalid = (result: TemporalAuditResult): boolean =>
  result.applicable && result.degradation === "lag-invalid";

/**
 * 单档时序入口。
 *
 * 顺序：先校验 lag，再判 brand，再判适用性。非法 lag 即使配置没有移动 Hazard
 * 也返回 `applicable:true` + `lag-invalid`（I01-04 §6）。
 */
export function auditPlayabilityTemporal(
  config: GameConfig,
  manifest: AssetPackManifest,
  options: {
    readonly lagMs: number;
    readonly trustedInput: TrustedAtlasInput;
    readonly analyze: TemporalAnalyzer;
  },
): TemporalAuditResult {
  const { lagMs, trustedInput, analyze } = options;
  if (typeof lagMs !== "number" || !Number.isFinite(lagMs) || lagMs < 0) return lagInvalid();
  if (!isTrustedAtlasInput(trustedInput)) return insufficient();
  if (!temporalScope(config).applicable) return { applicable: false };
  return analyze({ config, manifest, lagMs, trustedInput });
}

/**
 * 两档比较。只比 `verdict`；`lag-invalid` 优先于 `lag-disagreement`。
 */
export function resolveTwoLagResults(a: TemporalAuditResult, b: TemporalAuditResult): TemporalAuditResult {
  if (isLagInvalid(a) || isLagInvalid(b)) return lagInvalid();
  if (!a.applicable && !b.applicable) return { applicable: false };
  if (!a.applicable || !b.applicable) {
    return { applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-disagreement" };
  }
  if (a.verdict === b.verdict) return { applicable: true, verdict: a.verdict };
  return { applicable: true, verdict: "INSUFFICIENT_EVIDENCE", degradation: "lag-disagreement" };
}

// ── I-02：内部入口词汇与确定性签名（U1，@internal）────────────────────────────
//
// ⚠️ 这些符号**不**进 `playability/index.ts` / `contracts/src/index.ts`：`api.ts` 只按
//   名字转出 I-01 的公共编排，不转出内部入口。`testHooks` 不是生产参数。
//
// ⚠️ `analyzeTemporalInternal` 的实现在 U5-01 组装层补齐：它把 U2（Witness / W）、
//   U3（门区半部）、U4（图割半部）汇成 D9 内部结果。仍然**不接生产**、不发布
//   公共 Verdict；`publicCapability` 恒为 `"BLOCKED"`、`publicResult` 恒为 `null`。

/** @internal I-02 内部入口输入；`start / goal / corridor` 由 `GameConfig` + profile 派生。 */
export type TemporalInternalInput = {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  readonly lagMs: number;
  readonly trustedInput: TrustedAtlasInput;
  /**
   * @internal 仅用于 I-02 专项测试。
   * `budget` 不得高于硬上限；`now` 只参与 wall-clock abort，不参与相位 / 移动 /
   * 碰撞 / Witness / 策略选择。
   */
  readonly testHooks?: {
    readonly budget?: InternalBudget;
    readonly now?: () => number;
  };
};

/** @internal I-02 内部分析器类型；具体实现不在 U1。 */
export type TemporalInternalAnalyzer =
  (input: TemporalInternalInput) => TemporalInternalResult;

/** 规范化 JSON：对象键排序、数组保留语义顺序；不引入 `Map` / `Set` / class。 */
const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, val) => {
    if (val === null || typeof val !== "object" || Array.isArray(val)) return val;
    const record = val as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = record[key];
    return sorted;
  });

/** FNV-1a 32-bit（UTF-16 code units），输出 8 位十六进制串。 */
const fnv1a32 = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

/**
 * @internal 确定性指纹（FNV-1a 32-bit）。
 *
 * 覆盖：`grid`、`work` 计数、`internalResult`、`certificate`、`diagnostics` 原因码、
 * `stats.budget` 状态。排除：`stats.timing.wallClockMs`、`diagnostics.detail`、
 * 时间戳与 `testHooks`。
 *
 * ⚠️ 32-bit 只是**指纹**，不是无碰撞证明。确定性测试必须同时比较签名与剔除
 * `wallClockMs` / `detail` 后的规范化完整序列化；不得仅凭签名相等判定结果相同。
 */
export function determinismSignature(result: TemporalInternalResult): string {
  return fnv1a32(stableStringify({
    internalResult: result.internalResult,
    certificate: result.certificate,
    grid: result.stats.grid,
    work: result.stats.work,
    budget: {
      budgetStatus: result.stats.budget.budgetStatus,
      budgetKind: result.stats.budget.budgetKind,
    },
    diagnostics: {
      degradationReason: result.diagnostics.degradationReason,
      secondaryReasons: result.diagnostics.secondaryReasons,
    },
  }));
}


// ── U5-01：D9 内部结果组装（@internal）──────────────────────────────────────
//
// 组装顺序：模型适用性 → 预算 → U2 状态格 → NB（∀φ0 Winning Set）→ PU（U3 门区 + U4 图割）。
//
//   - NB 与 PU 是独立证明分支；任一完整成立即可给出内部候选，二者都不成立才 IE。
//   - NB 候选由 `∀φ0` Winning Set 承载（D10 §2）：I-02 的 `coverage.temporal` 恒为
//     `partial`，D10 §1.1 要求 U9 的 `checked` 前置不成立，因此 U9 不参与组装；这不是
//     把 U9 改写成非必要。
//   - 任何预算 / 模型 / 几何缺口都只降级为 IE；不伪造部分证书，不发布公共 Verdict。
//   - 门区半部 INCOMPLETE 时 `PermanentGateProof` 没有可如实填充的完整字段，因此
//     证书为 `none`（D9 §10.5）；只有门区 COMPLETE 而图割 / hop 不完整时才保留
//     `permanent-gate + INCOMPLETE` 的部分证明。

/** @internal 内部几何可信度；I-02 内恒为 manifest 元数据 + 未验证 Runtime 体。 */
const GEOMETRY_COVERAGE: GeometryCoverage = {
  chain: "manifest+atlas-metadata",
  runtimeBody: "unverified",
  coverage: "partial",
};

/** @internal 未建立状态格时的网格快照。 */
const emptyGrid = (): Stats["grid"] => ({
  phaseSteps: 0,
  dtMs: 0,
  xStep: 1,
  xPositions: 0,
  stateCapacity: 0,
  phaseGridCapped: false,
  phaseCapReason: null,
  N_max: 0,
});

const emptyWork = (): Stats["work"] => ({
  statesEnqueued: 0,
  statesVisited: 0,
  edgesChecked: 0,
  cutPointsTotal: 0,
  segmentsTotal: 0,
  hopSamplesChecked: 0,
  witnessTransitions: 0,
  witnessBytes: 0,
  maxBranching: 0,
  workUnitsSinceLastCheckpoint: 0,
});

/** @internal 非法预算 / 早期失败时仍要给出可审计预算快照。 */
const fallbackBudgetProfile = (): BudgetProfile => ({
  ...BUDGET_DEFAULTS,
  maxEdges: deriveMaxEdges(BUDGET_DEFAULTS.maxStates, 2),
});

const elapsedSince = (now: () => number, startedAt: number): number =>
  Math.max(0, now() - startedAt);

/** @internal 二次原因去重并按字典序稳定排序（locale-independent）。 */
const sortedReasons = (reasons: readonly DegradationReason[]): readonly DegradationReason[] => {
  const unique = [...new Set(reasons)];
  unique.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return unique;
};

/** @internal 跨分支主原因优先级：预算 > 模型 / 几何 > 普通否定证据。 */
const reasonRank = (reason: DegradationReason): number => {
  switch (reason) {
    case "invalid-budget":
    case "budget-bound-overflow":
      return 0;
    case "wall-clock-abort":
    case "state-budget-exhausted":
    case "edge-budget-exhausted":
    case "cut-budget-exhausted":
    case "witness-volume":
    case "hop-sample-budget":
      return 1;
    case "model-out":
    case "geometry-untrusted":
    case "spawn-not-on-lattice":
    case "goal-not-representable":
    case "goal-rect-degenerate":
    case "grid-resolution-infeasible":
      return 2;
    default:
      return 3;
  }
};

const primaryReason = (a: DegradationReason, b: DegradationReason): DegradationReason => {
  const rankA = reasonRank(a);
  const rankB = reasonRank(b);
  if (rankA !== rankB) return rankA < rankB ? a : b;
  return a <= b ? a : b;
};

/** @internal 工作预算类原因 → D9 `BudgetKind`；普通否定证据 / 模型缺口返回 `null`。 */
const budgetKindOfReason = (reason: DegradationReason): BudgetKind | null => {
  switch (reason) {
    case "state-budget-exhausted":
      return "state-budget";
    case "edge-budget-exhausted":
      return "edge-budget";
    case "cut-budget-exhausted":
      return "cut-budget";
    case "witness-volume":
      return "witness-volume";
    case "hop-sample-budget":
      return "hop-sample-budget";
    case "wall-clock-abort":
      return "wall-clock-abort";
    default:
      return null;
  }
};

/** @internal 组装中的可变部分；`finalizeInternal` 负责补 stats 与确定性签名。 */
type InternalDraft = {
  readonly internalResult: InternalResultState;
  readonly certificate: Certificate;
  readonly degradationReason: DegradationReason | null;
  readonly secondaryReasons?: readonly DegradationReason[];
  readonly budgetStatus: BudgetStatus;
  readonly budgetKind: BudgetKind | null;
  readonly budgetProfile: BudgetProfile;
  readonly grid?: Stats["grid"];
  readonly work?: Stats["work"];
  readonly timing?: Stats["timing"];
  readonly detail?: string;
};

const finalizeInternal = (draft: InternalDraft): TemporalInternalResult => {
  const stats: Stats = {
    grid: draft.grid ?? emptyGrid(),
    work: draft.work ?? emptyWork(),
    timing: draft.timing ?? {
      wallClockMs: 0,
      timeBudgetCheckpointWork: draft.budgetProfile.timeBudgetCheckpointWork,
    },
    budget: {
      budgetProfile: draft.budgetProfile,
      budgetStatus: draft.budgetStatus,
      budgetKind: draft.budgetKind,
    },
    determinismSignature: "",
  };
  const result: TemporalInternalResult = {
    internalResult: draft.internalResult,
    modelConditional: true,
    publicCapability: "BLOCKED",
    publicResult: null,
    certificate: draft.certificate,
    stats,
    diagnostics: {
      degradationReason: draft.degradationReason,
      secondaryReasons: sortedReasons(draft.secondaryReasons ?? []),
      ...(draft.detail === undefined ? {} : { detail: draft.detail }),
    },
  };
  return {
    ...result,
    stats: { ...stats, determinismSignature: determinismSignature(result) },
  };
};

/** @internal 单移动 Hazard 的解析结果；失败只用 D9 闭集原因码。 */
type MoverResolution =
  | { readonly ok: true; readonly motion: TriangleMotion; readonly hazard: WitnessHazard }
  | { readonly ok: false; readonly reason: DegradationReason };

/**
 * @internal 解析 I-02 唯一支持的移动模型：单个、沿 X 轴、`cycle` 三角波 Hazard。
 *
 * 模型外（Y 轴 / 多移动 Hazard / Moving Platform / Danger 联合）一律 `model-out`；
 * Hazard 资源或几何不可解一律 `geometry-untrusted`。不做静默近似。
 */
const resolveMover = (config: GameConfig, manifest: AssetPackManifest): MoverResolution => {
  const hazards = config.entities.filter(
    (entity) => entity.kind === "hazard" && entity.motion !== undefined,
  );
  if (hazards.length !== 1) return { ok: false, reason: "model-out" };
  const entity = hazards[0]!;
  const motion = entity.motion!;
  if (motion.axis !== "x") return { ok: false, reason: "model-out" };
  if (config.entities.some((other) => other.kind === "solid" && other.motion !== undefined)) {
    return { ok: false, reason: "model-out" };
  }
  if (config.entities.some((other) => other.kind === "danger" && other.strike !== undefined)) {
    return { ok: false, reason: "model-out" };
  }

  const asset = manifest.assets.find((candidate) => candidate.id === entity.asset);
  const geometry = runtimeEntityGeometry(entity, manifest);
  if (!asset || !geometry) return { ok: false, reason: "geometry-untrusted" };
  if (!Number.isFinite(motion.periodMs) || motion.periodMs <= 0) {
    return { ok: false, reason: "grid-resolution-infeasible" };
  }

  const triangle: TriangleMotion = {
    at: { x: entity.at.x, y: entity.at.y },
    distance: motion.distance,
    periodMs: motion.periodMs,
  };
  const box: HazardBoxSpec = {
    size: { w: geometry.box.w, h: geometry.box.h },
    anchor: asset.anchor ?? FALLBACK_ANCHOR,
  };
  return { ok: true, motion: triangle, hazard: { motion: triangle, box } };
};

const gridOf = (space: WitnessSpace): Stats["grid"] => ({
  phaseSteps: space.grid.phaseSteps,
  dtMs: space.grid.dtMs,
  xStep: space.grid.xStep,
  xPositions: space.grid.xPositions,
  stateCapacity: space.grid.stateCapacity,
  phaseGridCapped: space.grid.phaseGridCapped,
  phaseCapReason: space.grid.phaseCapReason,
  N_max: space.grid.N_max,
});

const workOf = (
  snapshot: WitnessWorkSnapshot,
  maxBranching: number,
  witnessTransitions = 0,
  witnessBytes = 0,
): Stats["work"] => ({
  statesEnqueued: snapshot.statesEnqueued,
  statesVisited: snapshot.statesVisited,
  edgesChecked: snapshot.edgesChecked,
  cutPointsTotal: snapshot.cutPointsTotal,
  segmentsTotal: snapshot.segmentsTotal,
  hopSamplesChecked: 0,
  witnessTransitions,
  witnessBytes,
  maxBranching,
  workUnitsSinceLastCheckpoint: snapshot.workUnitsSinceLastCheckpoint,
});

/**
 * @internal PU 六条件逐条状态（D4 §8 / D9 §3）。
 *
 * `geometry-checked` / `model-out-excluded` 恒 `BLOCKED`；其余四项只有在对应证明
 * 完整时才是 `PASS`。禁止用单个布尔替代。
 */
const puConditionsOf = (
  gate: PermanentGateHalf,
  evasion: PermanentEvasionHalf | null,
): readonly PuCondition[] => {
  const gatePass =
    gate.gateStatus === "COMPLETE" && gate.gate !== null && gate.periodCoverage !== null;
  const evasionEvidence = evasion?.graphCut ?? null;
  const graphPass = evasion !== null && evasion.status === "COMPLETE" && evasionEvidence !== null;
  const hopPass =
    graphPass &&
    evasion !== null &&
    evasion.hopDoubling !== null &&
    evasion.hopDoubling.connectivityPreserved &&
    evasion.hopDoubling.normalizedCoverage;

  const conditions: PuCondition[] = [
    gatePass
      ? {
          id: "gate-coverage",
          status: "PASS",
          evidence: `closed-form-full-period; width=${gate.gate!.width}; periodMs=${gate.periodCoverage!.periodMs}`,
        }
      : { id: "gate-coverage", status: "INSUFFICIENT_EVIDENCE" },
    {
      id: "geometry-checked",
      status: "BLOCKED",
      blockedReason: "runtime-body-unverified; coverage=partial",
    },
    graphPass
      ? { id: "graph-cut", status: "PASS", evidence: evasionEvidence!.evidence }
      : { id: "graph-cut", status: "INSUFFICIENT_EVIDENCE" },
    hopPass
      ? {
          id: "hop-doubling",
          status: "PASS",
          evidence: "base/doubled complete; F1⊆F2; connectivity preserved",
        }
      : { id: "hop-doubling", status: "INSUFFICIENT_EVIDENCE" },
    {
      id: "model-out-excluded",
      status: "BLOCKED",
      blockedReason: "movement-model-not-proven-air-control",
    },
    {
      id: "lag-consistent",
      status: "PASS",
      evidence: "gate-independent; witness-only; lagInvariantByConstruction",
    },
  ];
  return conditions;
};

/** @internal 只有门区半部与图割半部都能如实填充时才构造 `PermanentGateProof`。 */
const permanentGateProofOf = (
  gate: PermanentGateHalf,
  evasion: PermanentEvasionHalf,
): PermanentGateProof | null => {
  if (
    gate.gate === null || gate.periodCoverage === null ||
    gate.sideRule === null || gate.forbiddenInjection === null ||
    evasion.graphCut === null || evasion.hopDoubling === null ||
    evasion.hopSamplingCoverage === null
  ) {
    return null;
  }
  return {
    gate: gate.gate,
    periodCoverage: gate.periodCoverage,
    sideRule: gate.sideRule,
    forbiddenInjection: gate.forbiddenInjection,
    graphCut: evasion.graphCut,
    hopDoubling: evasion.hopDoubling,
    hopSamplingCoverage: evasion.hopSamplingCoverage,
    movementModelClosure: evasion.movementModelClosure,
    puConditions: puConditionsOf(gate, evasion),
    geometryCoverage: {
      hazard: GEOMETRY_COVERAGE,
      player: GEOMETRY_COVERAGE,
      graph: GEOMETRY_COVERAGE,
    },
    lagMode: "gate-independent; witness-only",
    lagInvariantByConstruction: true,
  };
};

type GateProofOutcome = {
  readonly status: "COMPLETE" | "INCOMPLETE";
  readonly reason: DegradationReason | null;
  readonly proof: PermanentGateProof | null;
};

/**
 * @internal 跑 PU 分支：门区半部（U3）→ forbidden 注入图 → 图割半部（U4）。
 *
 * 图割必须消费**注入了原始 `gateRect`** 的图（D4 §3 / §4）；`gateRect` 的扩张只由
 * `graph.ts` 完成一次，本层不预扩张。
 */
const runPermanentGateProof = (args: {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  readonly space: WitnessSpace;
  readonly hazard: WitnessHazard;
  /** 生效的 `maxHopSamples`（D5 §3；默认 / 硬上限 240）。 */
  readonly maxHopSamples: number;
}): GateProofOutcome => {
  const { config, manifest, space, hazard, maxHopSamples } = args;
  const buildGraph = (forbiddenBoxes: readonly Aabb[]): MovementGraph | null =>
    buildMovementGraph(config, manifest, undefined, { forbiddenBoxes });

  const gate = computePermanentGate({
    motion: hazard.motion,
    hazard: hazard.box,
    playerSize: space.playerSize,
    spawnBox: space.spawn.box,
    goalRect: space.arrival.goalRect,
    graph: space.graph,
    buildGraph,
  });
  if (gate.gateStatus !== "COMPLETE" || gate.gate === null || gate.sideRule === null) {
    return { status: "INCOMPLETE", reason: gate.reason ?? "no-permanent-gate", proof: null };
  }

  const gateRect: Aabb = {
    x: gate.gate.L,
    y: gate.gate.y,
    w: gate.gate.width,
    h: gate.gate.height,
  };
  const injected = buildGraph([gateRect]);
  if (injected === null) {
    return { status: "INCOMPLETE", reason: "geometry-untrusted", proof: null };
  }

  const evasion = computePermanentEvasion({
    spawnCell: { x: space.spawn.footX, y: space.spawn.footY },
    goalRegion: gate.sideRule.goalRegion,
    gateRect,
    move: playerMoveOf(config),
    graph: injected,
    maxHopSamples,
  });
  const proof = permanentGateProofOf(gate, evasion);
  if (evasion.status === "COMPLETE" && proof !== null) {
    return { status: "COMPLETE", reason: null, proof };
  }
  return {
    status: "INCOMPLETE",
    reason: evasion.reason ?? "graph-cut-incomplete",
    proof,
  };
};

/** @internal 单档结果是否完整：未受工作预算 / 墙钟 / Witness 体积限制。 */
const isCompleteLagResult = (result: TemporalInternalResult): boolean => {
  const reason = result.diagnostics.degradationReason;
  if (reason === null) return true;
  if (reason === "invalid-budget" || reason === "budget-bound-overflow") return false;
  return budgetKindOfReason(reason) === null;
};

/**
 * @internal 两档 lag 内部结果的合并（D9 §5 / D10 §3）。
 *
 * - **任一档不完整**（预算 / 墙钟 / 体积）⇒ 合并为 IE，保留该档实际原因，不得伪装成
 *   `lag-disagreement`；
 * - **两档都完整但结论不同**（`internalResult` 或主 `degradationReason` 不同）⇒
 *   IE + `lag-disagreement`，不保留任何一档的证书；
 * - **两档都完整且结论一致** ⇒ 保留主档（`first`，即 16.67ms 档）的结果。
 *
 * 本函数只做 D9 组合语义；逐档证据隔离（不跨档共享 / 拼接 Witness）由 U5-05 回归。
 * 不新增 `TemporalInternalResult` 字段；`detail` 只作诊断，不进确定性签名。
 */
export function resolveTwoLagInternalResults(
  first: TemporalInternalResult,
  second: TemporalInternalResult,
): TemporalInternalResult {
  const firstComplete = isCompleteLagResult(first);
  const secondComplete = isCompleteLagResult(second);

  if (!firstComplete || !secondComplete) {
    const incomplete = !firstComplete ? first : second;
    const other = !firstComplete ? second : first;
    const reason = incomplete.diagnostics.degradationReason!;
    const otherReason = other.diagnostics.degradationReason;
    return finalizeInternal({
      internalResult: "insufficient-evidence",
      certificate: { kind: "none" },
      degradationReason: reason,
      secondaryReasons: otherReason === null || otherReason === reason ? [] : [otherReason],
      budgetStatus: incomplete.stats.budget.budgetStatus,
      budgetKind: incomplete.stats.budget.budgetKind,
      budgetProfile: incomplete.stats.budget.budgetProfile,
      grid: incomplete.stats.grid,
      work: incomplete.stats.work,
      timing: incomplete.stats.timing,
      detail: "one lag incomplete; actual reason preserved",
    });
  }

  if (
    first.internalResult !== second.internalResult ||
    first.diagnostics.degradationReason !== second.diagnostics.degradationReason
  ) {
    return finalizeInternal({
      internalResult: "insufficient-evidence",
      certificate: { kind: "none" },
      degradationReason: "lag-disagreement",
      budgetStatus: "complete",
      budgetKind: null,
      budgetProfile: first.stats.budget.budgetProfile,
      grid: first.stats.grid,
      work: first.stats.work,
      timing: first.stats.timing,
      detail:
        `lag results differ: ${first.internalResult}/${first.diagnostics.degradationReason ?? "none"}` +
        ` vs ${second.internalResult}/${second.diagnostics.degradationReason ?? "none"}`,
    });
  }

  return first;
}

/**
 * @internal I-02 内部入口（D9 §6）。
 *
 * 单档 `lagMs`；两档分别调用、分别完整分析（D10 / §8.5）。`testHooks.budget` 只用于
 * 专项测试且不得高于硬上限；`testHooks.now` 只参与墙钟 abort。
 *
 * 输出边界：`internalResult` 是**模型内候选**，`publicCapability` 恒 `"BLOCKED"`、
 * `publicResult` 恒 `null`；不接生产、不发布公共 Verdict。
 */
export function analyzeTemporalInternal(input: TemporalInternalInput): TemporalInternalResult {
  const now = input.testHooks?.now ?? Date.now;
  const startedAt = now();
  const elapsed = (): number => elapsedSince(now, startedAt);
  const overrides = input.testHooks?.budget;

  // 单档 lag 的运行时兜底；I-01 已在公共入口校验，这里防止直接调用绕过。
  if (typeof input.lagMs !== "number" || !Number.isFinite(input.lagMs) || input.lagMs < 0) {
    return finalizeInternal({
      internalResult: "insufficient-evidence",
      certificate: { kind: "none" },
      degradationReason: "model-out",
      budgetStatus: "invalid",
      budgetKind: null,
      budgetProfile: fallbackBudgetProfile(),
      timing: {
        wallClockMs: elapsed(),
        timeBudgetCheckpointWork: BUDGET_DEFAULTS.timeBudgetCheckpointWork,
      },
      detail: "lagMs must be finite and non-negative",
    });
  }

  const mover = resolveMover(input.config, input.manifest);
  if (!mover.ok) {
    return finalizeInternal({
      internalResult: "insufficient-evidence",
      certificate: { kind: "none" },
      degradationReason: mover.reason,
      budgetStatus: "complete",
      budgetKind: null,
      budgetProfile: fallbackBudgetProfile(),
      timing: {
        wallClockMs: elapsed(),
        timeBudgetCheckpointWork: BUDGET_DEFAULTS.timeBudgetCheckpointWork,
      },
    });
  }

  // 先解析一版预算只为状态格读取 `maxStates`；最终预算在拿到网格后按 D5 重算。
  const provisional = resolveBudgetProfile({ maxBranching: 2, overrides });
  if (!provisional.ok) {
    return finalizeInternal({
      internalResult: "insufficient-evidence",
      certificate: { kind: "none" },
      degradationReason: provisional.degradationReason,
      budgetStatus: "invalid",
      budgetKind: null,
      budgetProfile: fallbackBudgetProfile(),
      timing: {
        wallClockMs: elapsed(),
        timeBudgetCheckpointWork: BUDGET_DEFAULTS.timeBudgetCheckpointWork,
      },
    });
  }

  const spaceResult = resolveWitnessSpace({
    config: input.config,
    manifest: input.manifest,
    budget: provisional.profile,
    periodMs: mover.motion.periodMs,
  });
  if (!spaceResult.ok) {
    return finalizeInternal({
      internalResult: "insufficient-evidence",
      certificate: { kind: "none" },
      degradationReason: spaceResult.reason,
      budgetStatus: "complete",
      budgetKind: null,
      budgetProfile: provisional.profile,
      timing: {
        wallClockMs: elapsed(),
        timeBudgetCheckpointWork: provisional.profile.timeBudgetCheckpointWork,
      },
      detail: `witness-space: ${spaceResult.gap}`,
    });
  }
  const space = spaceResult;
  const grid = gridOf(space);

  const maxBranching = deriveMaxBranching({
    maxSpeed: space.grid.maxSpeedPxPerMs,
    periodMs: space.grid.periodMs,
    phaseSteps: space.grid.phaseSteps,
    xStep: space.grid.xStep,
  });
  const resolved = resolveBudgetProfile({ maxBranching, overrides });
  if (!resolved.ok) {
    return finalizeInternal({
      internalResult: "insufficient-evidence",
      certificate: { kind: "none" },
      degradationReason: resolved.degradationReason,
      budgetStatus: "invalid",
      budgetKind: null,
      budgetProfile: fallbackBudgetProfile(),
      grid,
      timing: {
        wallClockMs: elapsed(),
        timeBudgetCheckpointWork: BUDGET_DEFAULTS.timeBudgetCheckpointWork,
      },
    });
  }
  const profile = resolved.profile;

  // ── NB 分支：∀φ0 Winning Set（D10 §2）────────────────────────────────────
  const nbBudget = createWitnessWorkBudget({ profile, now });
  const winning = searchWinningSet({
    space,
    hazard: mover.hazard,
    lagMs: input.lagMs,
    budget: nbBudget,
  });
  const nbSnapshot = winning.budgets;
  const nbTiming: Stats["timing"] = {
    wallClockMs: nbSnapshot.wallClockMs,
    timeBudgetCheckpointWork: nbSnapshot.timeBudgetCheckpointWork,
  };
  const nbWork = workOf(nbSnapshot, maxBranching);

  if (winning.status === "complete") {
    const encoded = encodeWitness({
      form: "winning-set",
      space,
      hazard: mover.hazard,
      lagMs: input.lagMs,
      budget: profile,
      result: winning,
    });
    if (encoded.ok) {
      return finalizeInternal({
        internalResult: "nb-candidate",
        certificate: { kind: "witness", status: "COMPLETE", witness: encoded.witness },
        degradationReason: null,
        budgetStatus: nbSnapshot.budgetStatus,
        budgetKind: nbSnapshot.budgetKind,
        budgetProfile: profile,
        grid,
        work: workOf(nbSnapshot, maxBranching, encoded.witness.volume.transitions, encoded.witness.volume.bytes),
        timing: nbTiming,
      });
    }

    // W 已证明 NB；编码失败只降级 IE，绝不再去主张 PU（否则会产出假 PU）。
    const encodeBudget: { status: BudgetStatus; kind: BudgetKind | null } =
      encoded.reason === "witness-volume"
        ? { status: "exhausted", kind: "witness-volume" }
        : encoded.reason === "invalid-budget"
          ? { status: "invalid", kind: null }
          : { status: nbSnapshot.budgetStatus, kind: nbSnapshot.budgetKind };
    return finalizeInternal({
      internalResult: "insufficient-evidence",
      certificate: { kind: "none" },
      degradationReason: encoded.reason,
      budgetStatus: encodeBudget.status,
      budgetKind: encodeBudget.kind,
      budgetProfile: profile,
      grid,
      work: nbWork,
      timing: nbTiming,
      detail: "winning-set search complete but witness encoding failed",
    });
  }
  const nbReason: DegradationReason = winning.degradationReason ?? "no-witness-found";

  // ── PU 分支：门区 + 图割 ─────────────────────────────────────────────────
  const pu = runPermanentGateProof({
    config: input.config,
    manifest: input.manifest,
    space,
    hazard: mover.hazard,
    maxHopSamples: profile.maxHopSamples,
  });
  const puTiming: Stats["timing"] = {
    wallClockMs: elapsed(),
    timeBudgetCheckpointWork: profile.timeBudgetCheckpointWork,
  };

  if (pu.status === "COMPLETE" && pu.proof !== null) {
    return finalizeInternal({
      internalResult: "pu-candidate",
      certificate: { kind: "permanent-gate", status: "COMPLETE", proof: pu.proof },
      degradationReason: null,
      budgetStatus: "complete",
      budgetKind: null,
      budgetProfile: profile,
      grid,
      work: nbWork,
      timing: puTiming,
    });
  }

  const primary = pu.reason === null ? nbReason : primaryReason(nbReason, pu.reason);
  const secondary = [nbReason, pu.reason].filter(
    (reason): reason is DegradationReason => reason !== null && reason !== primary,
  );
  const nbDecisive = primary === nbReason;
  const certificate: Certificate =
    pu.proof === null
      ? { kind: "none" }
      : { kind: "permanent-gate", status: "INCOMPLETE", proof: pu.proof };

  // 工作预算类主因必须把 `budgetStatus` / `budgetKind` 对齐（D9 §4 / §5），
  // 包括 U4 的 `hop-sample-budget`；不能只在 NB 快照上读取。
  const reasonKind = budgetKindOfReason(primary);
  const budgetStatus: BudgetStatus =
    reasonKind !== null
      ? reasonKind === "wall-clock-abort" ? "aborted" : "exhausted"
      : nbDecisive ? nbSnapshot.budgetStatus : "complete";
  const budgetKind: BudgetKind | null =
    reasonKind ?? (nbDecisive ? nbSnapshot.budgetKind : null);

  return finalizeInternal({
    internalResult: "insufficient-evidence",
    certificate,
    degradationReason: primary,
    secondaryReasons: secondary,
    budgetStatus,
    budgetKind,
    budgetProfile: profile,
    grid,
    work: nbWork,
    timing: puTiming,
  });
}
