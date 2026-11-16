// I-03 U1：I-02 内部时序结果 → 公共 evidence 的**纯适配器**。
//
// ⚠️ 本模块只读 `TemporalTwoLagInternalResult`；不回写、不触发分析、不产生公共 Verdict。
// ⚠️ 公共输出不携带完整 Witness / PermanentGateProof / Stats / 原始 D9 原因码。
// ⚠️ `COMPLETE` ⇒ degradation.reason=null 且 secondary=[]；`INCOMPLETE` ⇒ 至少一个非 null 原因。
// ⚠️ `coverage.temporal` 只表示输入 / 模型检查完成，不表示 geometry checked 或公共 NB / PU。

import type { TemporalTwoLagInternalResult } from "./temporal.js";
import type { DegradationReason, PuCondition, TemporalInternalResult } from "./temporal-result.js";
import type {
  CoverageState,
  PlayabilityCoverage,
  PlayabilityEvidence,
  PlayabilityWitness,
  PublicGeometryCoverage,
  PublicPuCondition,
  PublicTemporalDegradation,
  TemporalCoverageState,
  TemporalDegradationEvidence,
  TemporalLagConclusion,
  TemporalLagEvidence,
  TemporalLimitsEvidence,
  TemporalModelEvidence,
} from "./verdict.js";

/** 公共几何常量：I-02 内恒为 manifest 元数据 + 未验证 Runtime 体。 */
const GEOMETRY: PublicGeometryCoverage = {
  chain: "manifest+atlas-metadata",
  runtimeBody: "unverified",
  coverage: "partial",
};

/** D9 内部原因码 → 13 个公共值的完整 many-to-one 映射。 */
const DEGRADATION: Record<DegradationReason, PublicTemporalDegradation> = {
  "invalid-budget": "invalid-input",
  "budget-bound-overflow": "invalid-input",
  "grid-resolution-infeasible": "invalid-input",
  "spawn-not-on-lattice": "invalid-input",
  "goal-not-representable": "invalid-input",
  "goal-rect-degenerate": "invalid-input",
  "state-budget-exhausted": "budget-exhausted",
  "edge-budget-exhausted": "budget-exhausted",
  "cut-budget-exhausted": "budget-exhausted",
  "witness-volume": "witness-volume",
  "hop-sample-budget": "hop-sample-budget",
  "wall-clock-abort": "wall-clock-abort",
  "lag-disagreement": "lag-disagreement",
  "model-out": "model-out",
  "geometry-untrusted": "geometry-untrusted",
  "no-witness-found": "no-witness",
  "no-permanent-gate": "no-permanent-gate",
  "graph-cut-incomplete": "graph-cut-incomplete",
  "hop-doubling-changed": "hop-doubling-changed",
  "movement-model-unclosed": "movement-model-unclosed",
};

const mapDegradation = (reason: DegradationReason | null): PublicTemporalDegradation | null =>
  reason === null ? null : (DEGRADATION[reason] ?? "invalid-input");

const uniqueSorted = (
  values: readonly PublicTemporalDegradation[],
): readonly PublicTemporalDegradation[] => [...new Set(values)].sort();

const UNKNOWN_REASONS: ReadonlySet<PublicTemporalDegradation> = new Set([
  "invalid-input",
  "model-out",
  "geometry-untrusted",
]);

const statusOf = (result: TemporalInternalResult): "COMPLETE" | "INCOMPLETE" =>
  result.certificate.kind === "none" ? "INCOMPLETE" : result.certificate.status;

const mapPuCondition = (condition: PuCondition): PublicPuCondition => ({
  id: condition.id,
  status: condition.status,
  ...(condition.evidence !== undefined ? { evidence: condition.evidence } : {}),
  ...(condition.blockedReason !== undefined ? { blockedReason: condition.blockedReason } : {}),
});

const modelOf = (combined: TemporalInternalResult): TemporalModelEvidence => ({
  conditional: true,
  geometryCoverage: {
    hazard: { ...GEOMETRY },
    player: { ...GEOMETRY },
    graph: { ...GEOMETRY },
  },
  movementModelClosure: "not-proven-air-control",
  ...(combined.certificate.kind === "permanent-gate"
    ? { puConditions: combined.certificate.proof.puConditions.map(mapPuCondition) }
    : {}),
});

const conclusionOf = (result: TemporalInternalResult, lagMs: number): TemporalLagConclusion => ({
  lagMs,
  internalResult: result.internalResult,
  certificateKind: result.certificate.kind,
  certificateStatus: statusOf(result),
  degradation: mapDegradation(result.diagnostics.degradationReason),
});

const lagOf = (
  first: TemporalInternalResult,
  second: TemporalInternalResult,
  firstLagMs: number,
  secondLagMs: number,
): TemporalLagEvidence => ({
  mode: "gate-independent; witness-only",
  invariantByConstruction: true,
  perLag: [conclusionOf(first, firstLagMs), conclusionOf(second, secondLagMs)],
});

const degradationOf = (combined: TemporalInternalResult): TemporalDegradationEvidence => {
  if (statusOf(combined) === "COMPLETE") return { reason: null, secondary: [] };
  const primary = mapDegradation(combined.diagnostics.degradationReason);
  const secondary = uniqueSorted(
    combined.diagnostics.secondaryReasons
      .map((reason) => mapDegradation(reason))
      .filter((reason): reason is PublicTemporalDegradation => reason !== null),
  );
  // INCOMPLETE 必须有至少一个非 null 原因；内部契约违反时保守落到 invalid-input。
  return { reason: primary ?? "invalid-input", secondary };
};

const limitsOf = (combined: TemporalInternalResult): TemporalLimitsEvidence => ({
  budgetStatus: combined.stats.budget.budgetStatus,
  budgetKind: combined.stats.budget.budgetKind,
  witnessTransitions: combined.stats.work.witnessTransitions,
  witnessBytes: combined.stats.work.witnessBytes,
  maxWitnessTransitions: combined.stats.budget.budgetProfile.maxWitnessTransitions,
  maxWitnessBytes: combined.stats.budget.budgetProfile.maxWitnessBytes,
  hopSamplesChecked: combined.stats.work.hopSamplesChecked,
  maxHopSamples: combined.stats.budget.budgetProfile.maxHopSamples,
  geometryCoverage: "partial",
});

const coverageTemporalOf = (
  first: TemporalInternalResult,
  second: TemporalInternalResult,
  combined: TemporalInternalResult,
): TemporalCoverageState => {
  const reasons = [first, second, combined].map((result) =>
    mapDegradation(result.diagnostics.degradationReason),
  );
  if (reasons.some((reason) => reason !== null && UNKNOWN_REASONS.has(reason))) return "unknown";
  return first.stats.budget.budgetStatus === "complete" &&
    second.stats.budget.budgetStatus === "complete"
    ? "checked"
    : "partial";
};

const geometrySummaryOf = (): CoverageState => {
  const values: readonly CoverageState[] = [GEOMETRY.coverage, GEOMETRY.coverage, GEOMETRY.coverage];
  if (values.every((value) => value === "checked")) return "checked";
  if (values.every((value) => value === "not-checked")) return "not-checked";
  return "partial";
};

const assertLag = (lagMs: number): void => {
  if (typeof lagMs !== "number" || !Number.isFinite(lagMs) || lagMs < 0) {
    throw new RangeError(`lagMs must be a finite non-negative number; got ${String(lagMs)}`);
  }
};

export type ToPublicTemporalEvidenceArgs = {
  readonly twoLag: TemporalTwoLagInternalResult;
  readonly firstLagMs: number;
  readonly secondLagMs: number;
  readonly existingCoverage: PlayabilityCoverage;
  readonly assetId?: string;
};

/**
 * 纯适配器：内部双档结果 → 公共 `PlayabilityEvidence`。
 *
 * - 只读 `twoLag` / `existingCoverage`；输出新对象 / 新数组。
 * - 无效 lag ⇒ `RangeError`（显式失败，不生成公共 evidence）。
 * - 未知内部 D9 码 ⇒ 保守映射 `invalid-input`，不原样透传。
 */
export function toPublicTemporalEvidence(args: ToPublicTemporalEvidenceArgs): PlayabilityEvidence {
  assertLag(args.firstLagMs);
  assertLag(args.secondLagMs);

  const { first, second, combined } = args.twoLag;
  const temporal = coverageTemporalOf(first, second, combined);
  const geometry = geometrySummaryOf();
  const degradation = degradationOf(combined);
  const coverage: PlayabilityCoverage = { ...args.existingCoverage, temporal, geometry };
  const witness: PlayabilityWitness = {
    kind: "temporal",
    result: combined.internalResult,
    certificateKind: combined.certificate.kind,
    certificateStatus: statusOf(combined),
    degradation: degradation.reason,
  };
  const detail = `时序分析：${combined.internalResult}；证书 ${combined.certificate.kind}/${statusOf(combined)}`
    + (degradation.reason === null ? "" : `；降级 ${degradation.reason}`);

  return {
    judgmentId: "PLAYABILITY_TEMPORAL_EVIDENCE",
    target: "objective.gate",
    detail,
    witness,
    coverage,
    ...(args.assetId !== undefined && args.assetId.trim().length > 0 ? { assetId: args.assetId } : {}),
    model: modelOf(combined),
    lag: lagOf(first, second, args.firstLagMs, args.secondLagMs),
    degradation,
    limits: limitsOf(combined),
  };
}
