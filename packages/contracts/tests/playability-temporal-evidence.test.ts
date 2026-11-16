// I-03 U1：公共 temporal evidence 适配器矩阵。
//
// ⚠️ 全部用 synthetic 的**完整真实契约形状**输入；不依赖 assets / U4 真实 analyzer。
// ⚠️ 断言公共输出：13 个 degradation 值、coverage 三态、perLag 两项、limits、
//    P1–P4、N1–N6、未知码保守映射、输入不可变、无原始 D9 泄漏。

import { describe, expect, it } from "vitest";
import type {
  Certificate,
  DegradationReason,
  InternalResultState,
  PermanentGateProof,
  PuCondition,
  Stats,
  TemporalInternalResult,
} from "../src/playability/temporal-result.js";
import type { TemporalTwoLagInternalResult } from "../src/playability/temporal.js";
import type {
  PlayabilityCoverage,
  PlayabilityEvidence,
  PublicTemporalDegradation,
} from "../src/playability/verdict.js";
import { toPublicTemporalEvidence } from "../src/playability/temporal-evidence.js";

const BUDGET = {
  maxStates: 1, maxEdges: 1, timeBudgetMs: 1, maxCutsPerCheck: 1, maxCutsPerBranch: 1,
  maxWitnessTransitions: 10, maxWitnessBytes: 100, maxHopSamples: 20, timeBudgetCheckpointWork: 1,
} as const;

const stats = (over: {
  budgetStatus?: Stats["budget"]["budgetStatus"];
  budgetKind?: Stats["budget"]["budgetKind"];
  hopSamplesChecked?: number;
  witnessTransitions?: number;
  witnessBytes?: number;
} = {}): Stats => ({
  grid: {
    phaseSteps: 1, dtMs: 1, xStep: 1, xPositions: 1, stateCapacity: 1,
    phaseGridCapped: false, phaseCapReason: null, N_max: 1,
  },
  work: {
    statesEnqueued: 0, statesVisited: 0, edgesChecked: 0, cutPointsTotal: 0,
    segmentsTotal: 0, hopSamplesChecked: over.hopSamplesChecked ?? 0,
    witnessTransitions: over.witnessTransitions ?? 0, witnessBytes: over.witnessBytes ?? 0,
    maxBranching: 0, workUnitsSinceLastCheckpoint: 0,
  },
  timing: { wallClockMs: 0, timeBudgetCheckpointWork: 1 },
  budget: {
    budgetProfile: BUDGET,
    budgetStatus: over.budgetStatus ?? "complete",
    budgetKind: over.budgetKind ?? null,
  },
  determinismSignature: "test",
});

const WITNESS = {
  form: "u9" as const,
  derived: true as const,
  verifications: [] as const,
  policy: [] as const,
  termination: { kind: "trace" as const, finite: true as const, length: 0 },
  phaseCoverage: { cells: 1, covered: 1, complete: true },
  volume: { transitions: 0, bytes: 0 },
};

const pu = (id: PuCondition["id"], status: PuCondition["status"]): PuCondition =>
  status === "PASS" ? { id, status, evidence: `${id}-evidence` } : { id, status, blockedReason: `${id}-blocked` };

const SIX: readonly PuCondition[] = [
  pu("gate-coverage", "PASS"), pu("geometry-checked", "BLOCKED"), pu("graph-cut", "PASS"),
  pu("hop-doubling", "PASS"), pu("model-out-excluded", "BLOCKED"), pu("lag-consistent", "PASS"),
];

const proof = (puConditions: readonly PuCondition[]): PermanentGateProof => ({
  gate: { L: 0, R: 1, width: 1, y: 0, height: 1, epsilon: 0 },
  periodCoverage: { periodMs: 1, complete: true, intervals: [] },
  sideRule: {
    direction: "left->right",
    spawnBox: { x: 0, y: 0, w: 1, h: 1 },
    goalRegion: { x: 0, y: 0, w: 1, h: 1 },
  },
  forbiddenInjection: {
    gateRect: { x: 0, y: 0, w: 1, h: 1 },
    expandedRect: { x: 0, y: 0, w: 1, h: 1 },
    source: "forbiddenBoxes",
  },
  graphCut: { verdict: "conditional", reachableFootpoints: 0, goalIntersections: 0, midAirHits: 0, evidence: "test" },
  hopDoubling: {
    base: { n: 0, endpoints: [], cap: 0 },
    doubled: { n: 0, endpoints: [], cap: 0 },
    connectivityPreserved: true,
    normalizedCoverage: true,
  },
  hopSamplingCoverage: { covered: true, method: "normalized" },
  movementModelClosure: "not-proven-air-control",
  puConditions,
  geometryCoverage: {
    hazard: { chain: "manifest+atlas-metadata", runtimeBody: "unverified", coverage: "partial" },
    player: { chain: "manifest+atlas-metadata", runtimeBody: "unverified", coverage: "partial" },
    graph: { chain: "manifest+atlas-metadata", runtimeBody: "unverified", coverage: "partial" },
  },
  lagMode: "gate-independent; witness-only",
  lagInvariantByConstruction: true,
});

const certificate = (
  kind: "witness" | "permanent-gate" | "none",
  status: "COMPLETE" | "INCOMPLETE" = "COMPLETE",
  puConditions: readonly PuCondition[] = [],
): Certificate => {
  if (kind === "none") return { kind: "none" };
  if (kind === "witness") return { kind: "witness", status, witness: WITNESS };
  return { kind: "permanent-gate", status, proof: proof(puConditions) };
};

const internal = (over: {
  internalResult?: InternalResultState;
  certificate?: Certificate;
  stats?: Stats;
  degradationReason?: DegradationReason | null;
  secondaryReasons?: readonly DegradationReason[];
} = {}): TemporalInternalResult => ({
  internalResult: over.internalResult ?? "insufficient-evidence",
  modelConditional: true,
  publicCapability: "BLOCKED",
  publicResult: null,
  certificate: over.certificate ?? { kind: "none" },
  stats: over.stats ?? stats(),
  diagnostics: {
    degradationReason: over.degradationReason ?? null,
    secondaryReasons: over.secondaryReasons ?? [],
  },
});

const twoLag = (
  first: TemporalInternalResult,
  second: TemporalInternalResult,
  combined: TemporalInternalResult = first,
): TemporalTwoLagInternalResult => ({ first, second, combined });

const EXISTING: PlayabilityCoverage = { spatial: "partial", mechanic: "checked", completion: "not-checked" };

const adapt = (
  two: TemporalTwoLagInternalResult,
  opts: { firstLagMs?: number; secondLagMs?: number; assetId?: string } = {},
): PlayabilityEvidence => toPublicTemporalEvidence({
  twoLag: two,
  firstLagMs: opts.firstLagMs ?? 16.67,
  secondLagMs: opts.secondLagMs ?? 200,
  existingCoverage: EXISTING,
  ...(opts.assetId !== undefined ? { assetId: opts.assetId } : {}),
});

const MAPPING: readonly (readonly [DegradationReason, PublicTemporalDegradation])[] = [
  ["invalid-budget", "invalid-input"],
  ["budget-bound-overflow", "invalid-input"],
  ["grid-resolution-infeasible", "invalid-input"],
  ["spawn-not-on-lattice", "invalid-input"],
  ["goal-not-representable", "invalid-input"],
  ["goal-rect-degenerate", "invalid-input"],
  ["state-budget-exhausted", "budget-exhausted"],
  ["edge-budget-exhausted", "budget-exhausted"],
  ["cut-budget-exhausted", "budget-exhausted"],
  ["witness-volume", "witness-volume"],
  ["hop-sample-budget", "hop-sample-budget"],
  ["wall-clock-abort", "wall-clock-abort"],
  ["lag-disagreement", "lag-disagreement"],
  ["model-out", "model-out"],
  ["geometry-untrusted", "geometry-untrusted"],
  ["no-witness-found", "no-witness"],
  ["no-permanent-gate", "no-permanent-gate"],
  ["graph-cut-incomplete", "graph-cut-incomplete"],
  ["hop-doubling-changed", "hop-doubling-changed"],
  ["movement-model-unclosed", "movement-model-unclosed"],
];

const RAW_ONLY = [
  "invalid-budget", "budget-bound-overflow", "grid-resolution-infeasible",
  "spawn-not-on-lattice", "goal-not-representable", "goal-rect-degenerate",
  "state-budget-exhausted", "edge-budget-exhausted", "cut-budget-exhausted",
  "no-witness-found",
] as const;

describe("§D9 → 13 个公共 degradation", () => {
  it("20 个内部码完整 many-to-one，公共值恰好 13 个", () => {
    expect(MAPPING).toHaveLength(20);
    expect(new Set(MAPPING.map(([, value]) => value)).size).toBe(13);
    for (const [reason, expected] of MAPPING) {
      const result = adapt(twoLag(
        internal({ degradationReason: reason }),
        internal({ degradationReason: reason }),
      ));
      expect(result.degradation?.reason).toBe(expected);
    }
  });

  it("仅含于内部的原因码不出现在公共输出", () => {
    for (const reason of RAW_ONLY) {
      const result = adapt(twoLag(internal({ degradationReason: reason }), internal({ degradationReason: reason })));
      expect(JSON.stringify(result)).not.toContain(reason);
    }
  });

  it("secondary 去重后按字典序", () => {
    const result = adapt(twoLag(internal({
      degradationReason: "no-witness-found",
      secondaryReasons: ["model-out", "no-witness-found", "model-out"],
    }), internal()));
    expect(result.degradation?.secondary).toEqual(["model-out", "no-witness"]);
  });

  it("COMPLETE ⇒ reason null、secondary []", () => {
    const r = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    const result = adapt(twoLag(r, r));
    expect(result.degradation).toEqual({ reason: null, secondary: [] });
    expect(result.witness).toMatchObject({ kind: "temporal", degradation: null });
  });
});

describe("§coverage.temporal 三态", () => {
  it("两档 complete 且无 unknown 主因 ⇒ checked", () => {
    const r = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    expect(adapt(twoLag(r, r)).coverage.temporal).toBe("checked");
  });

  it("一档预算耗尽 ⇒ partial", () => {
    const first = internal({
      internalResult: "insufficient-evidence",
      stats: stats({ budgetStatus: "exhausted", budgetKind: "state-budget" }),
      degradationReason: "state-budget-exhausted",
    });
    const second = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    expect(adapt(twoLag(first, second, first)).coverage.temporal).toBe("partial");
  });

  it("model-out / invalid-input / geometry-untrusted ⇒ unknown", () => {
    for (const reason of ["model-out", "invalid-budget", "geometry-untrusted"] as const) {
      const r = internal({ degradationReason: reason, stats: stats({ budgetStatus: "invalid" }) });
      expect(adapt(twoLag(r, r)).coverage.temporal).toBe("unknown");
    }
  });

  it("两档 complete 但 lag-disagreement ⇒ checked（coverage 只表示分析完成）", () => {
    const first = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    const second = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    const combined = internal({ internalResult: "insufficient-evidence", degradationReason: "lag-disagreement" });
    expect(adapt(twoLag(first, second, combined)).coverage.temporal).toBe("checked");
  });

  it("既有三维 coverage 原样保留；geometry summary 恒 partial", () => {
    const r = internal();
    const result = adapt(twoLag(r, r));
    expect(result.coverage.spatial).toBe(EXISTING.spatial);
    expect(result.coverage.mechanic).toBe(EXISTING.mechanic);
    expect(result.coverage.completion).toBe(EXISTING.completion);
    expect(result.coverage.geometry).toBe("partial");
  });
});

describe("§lag / limits / witness", () => {
  it("perLag 恰好两项、顺序固定、含 lagMs、不含 witness", () => {
    const first = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    const second = internal({ internalResult: "insufficient-evidence", degradationReason: "no-witness-found" });
    const result = adapt(twoLag(first, second), { firstLagMs: 16.67, secondLagMs: 200 });
    expect(result.lag?.perLag).toHaveLength(2);
    expect(result.lag?.perLag[0]).toMatchObject({ lagMs: 16.67, internalResult: "nb-candidate" });
    expect(result.lag?.perLag[1]).toMatchObject({ lagMs: 200, internalResult: "insufficient-evidence" });
    expect("witness" in (result.lag?.perLag[0] ?? {})).toBe(false);
    expect(result.lag?.perLag[0]?.degradation).toBeNull();
    expect(result.lag?.perLag[1]?.degradation).toBe("no-witness");
  });

  it("limits 从内部 stats 取；hopSamplesChecked 如实取 0", () => {
    const r = internal({
      internalResult: "nb-candidate",
      certificate: certificate("witness", "COMPLETE"),
      stats: stats({ witnessTransitions: 7, witnessBytes: 11, hopSamplesChecked: 0 }),
    });
    const result = adapt(twoLag(r, r));
    expect(result.limits).toMatchObject({
      budgetStatus: "complete",
      budgetKind: null,
      witnessTransitions: 7,
      witnessBytes: 11,
      maxWitnessTransitions: BUDGET.maxWitnessTransitions,
      maxWitnessBytes: BUDGET.maxWitnessBytes,
      hopSamplesChecked: 0,
      maxHopSamples: BUDGET.maxHopSamples,
      geometryCoverage: "partial",
    });
  });

  it("certificate none ⇒ INCOMPLETE；public witness 仍是 temporal", () => {
    const r = internal({ internalResult: "insufficient-evidence", degradationReason: "no-witness-found" });
    const result = adapt(twoLag(r, r));
    expect(result.witness).toMatchObject({ kind: "temporal", certificateKind: "none", certificateStatus: "INCOMPLETE" });
    expect(result.lag?.perLag[0]?.certificateStatus).toBe("INCOMPLETE");
  });
});

describe("§映射正 / 负例", () => {
  it("P1 nb-candidate + witness COMPLETE ⇒ temporal evidence，不是公共 Verdict", () => {
    const r = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    const result = adapt(twoLag(r, r));
    expect(result.witness).toMatchObject({ kind: "temporal", result: "nb-candidate", certificateStatus: "COMPLETE" });
    expect("verdict" in result).toBe(false);
  });

  it("P2 pu-candidate + permanent-gate COMPLETE ⇒ 六项 puConditions", () => {
    const r = internal({
      internalResult: "pu-candidate",
      certificate: certificate("permanent-gate", "COMPLETE", SIX),
    });
    const result = adapt(twoLag(r, r));
    expect(result.model?.puConditions).toHaveLength(6);
    expect(result.model?.puConditions?.map((c) => c.id)).toEqual(SIX.map((c) => c.id));
    expect("verdict" in result).toBe(false);
  });

  it("P3 IE + no-witness ⇒ IE 摘要，不产生安全结论", () => {
    const r = internal({ internalResult: "insufficient-evidence", degradationReason: "no-witness-found" });
    const result = adapt(twoLag(r, r));
    expect(result.witness).toMatchObject({ kind: "temporal", result: "insufficient-evidence" });
    expect(result.degradation?.reason).toBe("no-witness");
  });

  it("P4 预算耗尽 ⇒ coverage partial / budgetStatus exhausted", () => {
    const first = internal({
      internalResult: "insufficient-evidence",
      stats: stats({ budgetStatus: "exhausted", budgetKind: "edge-budget" }),
      degradationReason: "edge-budget-exhausted",
    });
    const second = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    const result = adapt(twoLag(first, second, first));
    expect(result.coverage.temporal).toBe("partial");
    expect(result.limits).toMatchObject({ budgetStatus: "exhausted", budgetKind: "edge-budget" });
  });

  it("N1–N3：适配器不产生公共 Verdict 字段", () => {
    const r = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    const result = adapt(twoLag(r, r));
    expect("verdict" in result).toBe(false);
    expect("publicCapability" in result).toBe(false);
    expect("publicResult" in result).toBe(false);
  });

  it("N4：coverage.temporal=checked 不把 geometry 推成 checked", () => {
    const r = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    expect(adapt(twoLag(r, r)).coverage.geometry).toBe("partial");
  });

  it("N5：非法输入 / 缺失值不静默填 checked / COMPLETE", () => {
    const r = internal({ degradationReason: "invalid-budget", stats: stats({ budgetStatus: "invalid" }) });
    const result = adapt(twoLag(r, r));
    expect(result.coverage.temporal).toBe("unknown");
    expect(result.witness).toMatchObject({ certificateKind: "none", certificateStatus: "INCOMPLETE" });
  });

  it("N6：不携带完整 proof / Witness / Stats / 原始 D9 码", () => {
    const r = internal({ internalResult: "pu-candidate", certificate: certificate("permanent-gate", "COMPLETE", SIX) });
    const result = adapt(twoLag(r, r));
    expect("proof" in result).toBe(false);
    expect("stats" in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain("verifications");
    for (const raw of RAW_ONLY) expect(JSON.stringify(result)).not.toContain(raw);
  });
});

describe("§边界", () => {
  it("未知内部码 ⇒ invalid-input，不原样透传", () => {
    const bad = internal({ degradationReason: "mystery" as unknown as DegradationReason });
    const result = adapt(twoLag(bad, bad));
    expect(result.degradation?.reason).toBe("invalid-input");
    expect(JSON.stringify(result)).not.toContain("mystery");
  });

  it("不修改输入 twoLag / existingCoverage", () => {
    const r = internal({ internalResult: "nb-candidate", certificate: certificate("witness", "COMPLETE") });
    const two = twoLag(r, r);
    const before = structuredClone(two);
    const existing = { ...EXISTING };
    toPublicTemporalEvidence({ twoLag: two, firstLagMs: 16.67, secondLagMs: 200, existingCoverage: existing });
    expect(two).toEqual(before);
    expect(existing).toEqual(EXISTING);
  });

  it("assetId 仅在有非空值时输出", () => {
    const r = internal();
    expect(adapt(twoLag(r, r), { assetId: "hazard-sweeping-carriage" }).assetId).toBe("hazard-sweeping-carriage");
    expect(adapt(twoLag(r, r)).assetId).toBeUndefined();
    expect(adapt(twoLag(r, r), { assetId: "   " }).assetId).toBeUndefined();
  });

  it("invalid lag ⇒ RangeError", () => {
    const r = internal();
    expect(() => adapt(twoLag(r, r), { firstLagMs: -1 })).toThrow(RangeError);
    expect(() => adapt(twoLag(r, r), { secondLagMs: Number.NaN })).toThrow(RangeError);
    expect(() => adapt(twoLag(r, r), { secondLagMs: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });
});
