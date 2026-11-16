// I-03 U2：能力门 + 公共 Verdict 映射。
//
// ⚠️ 本模块只消费已有 `PlayabilityVerdict` + U1 temporal evidence + gate/admission；
//   不实现准入链、不读取 evidence 推断 gate、不产生 ConfigIssue。
// ⚠️ 第一阶段 gate 两项 BLOCKED、admission 两项 false；`OPEN` 不等于 admission 通过。
// ⚠️ 只 import `verdict.ts` 叶子类型；不 import `api.ts`，避免 api ↔ public-verdict 环。

import type {
  PlayabilityCoverage,
  PlayabilityEvidence,
  PlayabilityVerdictState,
  TemporalCoverageState,
} from "./verdict.js";

export type PublicCapabilityGate = {
  readonly nb: "BLOCKED" | "OPEN";
  readonly pu: "BLOCKED" | "OPEN";
};

export type CapabilityAdmission = {
  readonly nb: boolean;
  readonly pu: boolean;
};

export const PHASE1_CAPABILITY_GATE = Object.freeze({
  nb: "BLOCKED",
  pu: "BLOCKED",
} as const);

export const PHASE1_CAPABILITY_ADMISSION = Object.freeze({
  nb: false,
  pu: false,
} as const);

export type PublicVerdictInput = {
  readonly verdict: PlayabilityVerdictState;
  readonly evidence: readonly PlayabilityEvidence[];
  readonly coverage: PlayabilityCoverage;
};

export type PublicVerdictResult = PublicVerdictInput;

export type PublicVerdictConflictDetails = {
  readonly existingVerdict: PlayabilityVerdictState;
  readonly temporalResult: "nb-candidate" | "pu-candidate";
  readonly coverageTemporal: TemporalCoverageState;
  readonly gate: PublicCapabilityGate;
  readonly admission: CapabilityAdmission;
};

/** existing PU 与已获准入的 temporal candidate 冲突；STOP + HITL，不得静默择一。 */
export class PublicVerdictConflictError extends Error {
  readonly details: PublicVerdictConflictDetails;

  constructor(details: PublicVerdictConflictDetails) {
    super(
      `Public verdict conflict: existing=${details.existingVerdict}, temporal=${details.temporalResult}, `
      + `coverage.temporal=${details.coverageTemporal}, gate=${details.gate.nb}/${details.gate.pu}, `
      + `admission=${details.admission.nb}/${details.admission.pu}`,
    );
    this.name = "PublicVerdictConflictError";
    this.details = details;
  }
}

type TemporalInput =
  | { readonly applicable: false }
  | { readonly applicable: true; readonly evidence?: PlayabilityEvidence };

type Candidate = "nb-candidate" | "pu-candidate" | "insufficient-evidence" | undefined;

const candidateOf = (evidence: PlayabilityEvidence | undefined): Candidate =>
  evidence?.witness.kind === "temporal" ? evidence.witness.result : undefined;

const gateOpen = (
  candidate: "nb-candidate" | "pu-candidate",
  gate: PublicCapabilityGate,
  admission: CapabilityAdmission,
): boolean => {
  if (candidate === "nb-candidate") return gate.nb === "OPEN" && admission.nb;
  return gate.pu === "OPEN" && admission.pu;
};

/**
 * 把 existing 三层结果 + temporal evidence 映射为公共 Verdict。
 *
 * - `existing` PU / IE 优先；temporal 不能削弱；
 * - temporal 只在 existing NB 时可能产生 NB / PU（后者需 PU gate OPEN + admitted）；
 * - `applicable:false` ⇒ existing，不设 temporal/geometry；
 * - `applicable:true` 无 evidence ⇒ `temporal:"unknown"` ⇒ IE；geometry 不设置；
 * - existing PU + 已获准入的 NB / PU candidate ⇒ `PublicVerdictConflictError`。
 */
export function mapPublicVerdict(args: {
  readonly existing: PublicVerdictInput;
  readonly temporal: TemporalInput;
  readonly gate: PublicCapabilityGate;
  readonly admission: CapabilityAdmission;
}): PublicVerdictResult {
  const { existing, temporal, gate, admission } = args;
  const applicable = temporal.applicable;
  const temporalEvidence = applicable ? temporal.evidence : undefined;
  const candidate = candidateOf(temporalEvidence);
  const temporalState: TemporalCoverageState | undefined = applicable
    ? (temporalEvidence?.coverage.temporal ?? "unknown")
    : undefined;

  const baseCoverage: PlayabilityCoverage = {
    spatial: existing.coverage.spatial,
    mechanic: existing.coverage.mechanic,
    completion: existing.coverage.completion,
  };
  const coverage: PlayabilityCoverage = applicable
    ? {
        ...baseCoverage,
        temporal: temporalState,
        ...(temporalEvidence?.coverage.geometry !== undefined
          ? { geometry: temporalEvidence.coverage.geometry }
          : {}),
      }
    : baseCoverage;

  // 旧 temporal evidence 一律移除；只有 applicable + evidence 才追加新 evidence。
  const nonTemporalEvidence = existing.evidence.filter(
    (evidence) => evidence.judgmentId !== "PLAYABILITY_TEMPORAL_EVIDENCE",
  );
  const evidence = applicable && temporalEvidence
    ? [...nonTemporalEvidence, temporalEvidence]
    : nonTemporalEvidence;

  if (
    existing.verdict === "PROVEN_UNPLAYABLE" &&
    (candidate === "nb-candidate" || candidate === "pu-candidate") &&
    gateOpen(candidate, gate, admission)
  ) {
    throw new PublicVerdictConflictError({
      existingVerdict: existing.verdict,
      temporalResult: candidate,
      coverageTemporal: temporalState ?? "unknown",
      gate,
      admission,
    });
  }

  let verdict: PlayabilityVerdictState;
  if (existing.verdict === "PROVEN_UNPLAYABLE") {
    verdict = "PROVEN_UNPLAYABLE";
  } else if (existing.verdict === "INSUFFICIENT_EVIDENCE") {
    verdict = "INSUFFICIENT_EVIDENCE";
  } else if (!applicable) {
    verdict = existing.verdict;
  } else if (temporalState !== "checked") {
    verdict = "INSUFFICIENT_EVIDENCE";
  } else if (candidate === "nb-candidate") {
    verdict = gateOpen(candidate, gate, admission) ? "NO_PROVEN_BLOCKER" : "INSUFFICIENT_EVIDENCE";
  } else if (candidate === "pu-candidate") {
    verdict = gateOpen(candidate, gate, admission) ? "PROVEN_UNPLAYABLE" : "INSUFFICIENT_EVIDENCE";
  } else {
    verdict = "INSUFFICIENT_EVIDENCE";
  }

  return { verdict, evidence, coverage };
}
