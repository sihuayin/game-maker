// I-03 U2：公共 Verdict 映射矩阵。
//
// ⚠️ 只用 synthetic existing / temporal evidence；不依赖 U4/U5 真实链路。
// ⚠️ 覆盖 gate/admission 双重检查、证据合并、coverage 隔离、冲突、非阻断。

import { describe, expect, it } from "vitest";
import type {
  PlayabilityCoverage,
  PlayabilityEvidence,
  PlayabilityVerdictState,
  TemporalCoverageState,
} from "../src/playability/verdict.js";
import {
  mapPublicVerdict,
  PHASE1_CAPABILITY_ADMISSION,
  PHASE1_CAPABILITY_GATE,
  PublicVerdictConflictError,
  type CapabilityAdmission,
  type PublicCapabilityGate,
  type PublicVerdictInput,
} from "../src/playability/public-verdict.js";
import {
  mapPublicVerdict as apiMapPublicVerdict,
  PHASE1_CAPABILITY_GATE as API_GATE,
  PublicVerdictConflictError as ApiConflictError,
} from "../src/playability/api.js";
import { playabilityIssues } from "../src/playability/api.js";

const coverage = (over: Partial<PlayabilityCoverage> = {}): PlayabilityCoverage => ({
  spatial: "checked", mechanic: "checked", completion: "checked", ...over,
});

const existing = (
  verdict: PlayabilityVerdictState,
  evidence: readonly PlayabilityEvidence[] = [],
  cov: PlayabilityCoverage = coverage(),
): PublicVerdictInput => ({ verdict, evidence, coverage: cov });

const temporalEvidence = (
  result: "nb-candidate" | "pu-candidate" | "insufficient-evidence",
  temporal: TemporalCoverageState = "checked",
  geometry?: "partial",
  coverageOverride: Partial<PlayabilityCoverage> = {},
): PlayabilityEvidence => ({
  judgmentId: "PLAYABILITY_TEMPORAL_EVIDENCE",
  target: "objective.gate",
  detail: "temporal synthetic",
  witness: {
    kind: "temporal",
    result,
    certificateKind: result === "insufficient-evidence" ? "none" : "witness",
    certificateStatus: result === "insufficient-evidence" ? "INCOMPLETE" : "COMPLETE",
    degradation: result === "insufficient-evidence" ? "no-witness" : null,
  },
  coverage: {
    spatial: "checked", mechanic: "checked", completion: "checked",
    ...coverageOverride,
    temporal,
    ...(geometry !== undefined ? { geometry } : {}),
  },
});

const blockingEvidence: PlayabilityEvidence = {
  judgmentId: "PLAYABILITY_MECHANIC_PATH_BLOCKED",
  target: 'entity "suitcase-3"',
  detail: "mechanic blocked",
  witness: { kind: "blocked", rect: { x: 0, y: 0, w: 1, h: 1 }, overlapFoot: { x: 0, y: 0, w: 1, h: 1 }, solids: ["carriage"] },
  coverage: coverage(),
};

const OPEN_BOTH: PublicCapabilityGate = { nb: "OPEN", pu: "OPEN" };
const ADMITTED_BOTH: CapabilityAdmission = { nb: true, pu: true };
const NOT_ADMITTED = PHASE1_CAPABILITY_ADMISSION;

type TemporalInput =
  | { readonly applicable: false }
  | { readonly applicable: true; readonly evidence?: PlayabilityEvidence };

const map = (
  input: PublicVerdictInput,
  temporal: TemporalInput,
  gate: PublicCapabilityGate = PHASE1_CAPABILITY_GATE,
  admission: CapabilityAdmission = NOT_ADMITTED,
) => mapPublicVerdict({ existing: input, temporal, gate, admission });

describe("§能力门 / admission 双重检查", () => {
  it("existing PU / IE 优先；not applicable 保留 existing", () => {
    expect(map(existing("PROVEN_UNPLAYABLE"), { applicable: false }).verdict).toBe("PROVEN_UNPLAYABLE");
    expect(map(existing("INSUFFICIENT_EVIDENCE"), { applicable: false }).verdict).toBe("INSUFFICIENT_EVIDENCE");
    const nb = map(existing("NO_PROVEN_BLOCKER"), { applicable: false });
    expect(nb.verdict).toBe("NO_PROVEN_BLOCKER");
    expect(nb.coverage.temporal).toBeUndefined();
    expect(nb.coverage.geometry).toBeUndefined();
  });

  it("applicable + 无 evidence ⇒ temporal unknown ⇒ IE；不设置 geometry", () => {
    const result = map(existing("NO_PROVEN_BLOCKER"), { applicable: true });
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.coverage.temporal).toBe("unknown");
    expect("geometry" in result.coverage).toBe(false);
    expect(result.evidence).toEqual([]);
  });

  it("partial / unknown ⇒ IE", () => {
    for (const temporal of ["partial", "unknown"] as const) {
      const result = map(existing("NO_PROVEN_BLOCKER"), { applicable: true, evidence: temporalEvidence("nb-candidate", temporal) });
      expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    }
  });

  it("checked + 内部 IE ⇒ IE", () => {
    const result = map(existing("NO_PROVEN_BLOCKER"), { applicable: true, evidence: temporalEvidence("insufficient-evidence") });
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("NB candidate：gate BLOCKED ⇒ IE；OPEN+admitted ⇒ NB；OPEN+未准入 ⇒ IE", () => {
    const base = existing("NO_PROVEN_BLOCKER");
    const ev = temporalEvidence("nb-candidate");
    expect(map(base, { applicable: true, evidence: ev }).verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(map(base, { applicable: true, evidence: ev }, OPEN_BOTH, ADMITTED_BOTH).verdict).toBe("NO_PROVEN_BLOCKER");
    expect(map(base, { applicable: true, evidence: ev }, OPEN_BOTH, { nb: false, pu: true }).verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("PU candidate：gate BLOCKED ⇒ IE；OPEN+admitted ⇒ PU；OPEN+未准入 ⇒ IE", () => {
    const base = existing("NO_PROVEN_BLOCKER");
    const ev = temporalEvidence("pu-candidate");
    expect(map(base, { applicable: true, evidence: ev }).verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(map(base, { applicable: true, evidence: ev }, OPEN_BOTH, ADMITTED_BOTH).verdict).toBe("PROVEN_UNPLAYABLE");
    expect(map(base, { applicable: true, evidence: ev }, OPEN_BOTH, { nb: true, pu: false }).verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("NB / PU admission 独立：一方准入不使另一方开放", () => {
    const base = existing("NO_PROVEN_BLOCKER");
    const nbGateOpen = { nb: "OPEN", pu: "BLOCKED" } as const;
    const nbAdmitted = { nb: true, pu: false } as const;
    const puGateOpen = { nb: "BLOCKED", pu: "OPEN" } as const;
    const puAdmitted = { nb: false, pu: true } as const;
    expect(map(base, { applicable: true, evidence: temporalEvidence("nb-candidate") }, nbGateOpen, nbAdmitted).verdict).toBe("NO_PROVEN_BLOCKER");
    expect(map(base, { applicable: true, evidence: temporalEvidence("pu-candidate") }, nbGateOpen, nbAdmitted).verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(map(base, { applicable: true, evidence: temporalEvidence("pu-candidate") }, puGateOpen, puAdmitted).verdict).toBe("PROVEN_UNPLAYABLE");
    expect(map(base, { applicable: true, evidence: temporalEvidence("nb-candidate") }, puGateOpen, puAdmitted).verdict).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("§existing PU 与 temporal candidate 冲突", () => {
  it("V7：existing PU + NB candidate + gate.nb OPEN + admitted ⇒ conflict", () => {
    expect(() => map(existing("PROVEN_UNPLAYABLE"), { applicable: true, evidence: temporalEvidence("nb-candidate") }, OPEN_BOTH, ADMITTED_BOTH))
      .toThrow(PublicVerdictConflictError);
  });

  it("PU candidate 分支：existing PU + gate.pu OPEN + admitted ⇒ conflict", () => {
    expect(() => map(existing("PROVEN_UNPLAYABLE"), { applicable: true, evidence: temporalEvidence("pu-candidate") }, OPEN_BOTH, ADMITTED_BOTH))
      .toThrow(PublicVerdictConflictError);
  });

  it("gate OPEN 但 admission false ⇒ 不冲突，保留 existing PU", () => {
    expect(map(existing("PROVEN_UNPLAYABLE"), { applicable: true, evidence: temporalEvidence("nb-candidate") }, OPEN_BOTH, { nb: false, pu: false }).verdict)
      .toBe("PROVEN_UNPLAYABLE");
  });

  it("gate BLOCKED ⇒ 不冲突，保留 existing PU", () => {
    expect(map(existing("PROVEN_UNPLAYABLE"), { applicable: true, evidence: temporalEvidence("pu-candidate") }).verdict)
      .toBe("PROVEN_UNPLAYABLE");
  });

  it("冲突摘要不含原始 D9 码 / 完整证据", () => {
    try {
      map(existing("PROVEN_UNPLAYABLE"), { applicable: true, evidence: temporalEvidence("nb-candidate") }, OPEN_BOTH, ADMITTED_BOTH);
      throw new Error("expected conflict");
    } catch (error) {
      const text = JSON.stringify((error as PublicVerdictConflictError).details) + String((error as Error).message);
      for (const raw of [
        "invalid-budget", "budget-bound-overflow", "grid-resolution-infeasible",
        "spawn-not-on-lattice", "goal-not-representable", "goal-rect-degenerate",
        "state-budget-exhausted", "edge-budget-exhausted", "cut-budget-exhausted",
        "no-witness-found",
      ]) {
        expect(text).not.toContain(raw);
      }
      expect(text).not.toContain("verifications");
      expect(text).not.toContain("permanentGateProof");
    }
  });
});

describe("§优先级 / 证据合并 / coverage", () => {
  it("existing IE + candidate + OPEN+admitted ⇒ 保持 IE（V8）", () => {
    const result = map(existing("INSUFFICIENT_EVIDENCE"), { applicable: true, evidence: temporalEvidence("nb-candidate") }, OPEN_BOTH, ADMITTED_BOTH);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("旧 temporal evidence 一律移除；新 evidence 只追加一次", () => {
    const oldTemporal = temporalEvidence("insufficient-evidence", "partial");
    const base = existing("NO_PROVEN_BLOCKER", [blockingEvidence, oldTemporal]);
    const next = temporalEvidence("nb-candidate");
    const result = map(base, { applicable: true, evidence: next });
    expect(result.evidence).toEqual([blockingEvidence, next]);
    expect(result.evidence.filter((e) => e.judgmentId === "PLAYABILITY_TEMPORAL_EVIDENCE")).toHaveLength(1);
  });

  it("applicable:false 也移除旧 temporal evidence", () => {
    const oldTemporal = temporalEvidence("nb-candidate");
    const result = map(existing("NO_PROVEN_BLOCKER", [blockingEvidence, oldTemporal]), { applicable: false });
    expect(result.evidence).toEqual([blockingEvidence]);
  });

  it("coverage 三维始终取 existing；evidence 三维不得覆盖", () => {
    const base = existing("NO_PROVEN_BLOCKER", [], coverage({ spatial: "partial", mechanic: "checked", completion: "not-checked" }));
    const ev = temporalEvidence("nb-candidate", "checked", "partial", {
      spatial: "checked", mechanic: "partial", completion: "checked",
    });
    const result = map(base, { applicable: true, evidence: ev });
    expect(result.coverage.spatial).toBe("partial");
    expect(result.coverage.mechanic).toBe("checked");
    expect(result.coverage.completion).toBe("not-checked");
    expect(result.coverage.temporal).toBe("checked");
    expect(result.coverage.geometry).toBe("partial");
  });

  it("evidence 无 geometry ⇒ 不伪造 unknown；有 geometry ⇒ 复制", () => {
    const noGeometry = temporalEvidence("nb-candidate", "checked");
    const result = map(existing("NO_PROVEN_BLOCKER"), { applicable: true, evidence: noGeometry });
    expect("geometry" in result.coverage).toBe(false);
    const withGeometry = temporalEvidence("nb-candidate", "checked", "partial");
    expect(map(existing("NO_PROVEN_BLOCKER"), { applicable: true, evidence: withGeometry }).coverage.geometry).toBe("partial");
  });

  it("输入无 mutation", () => {
    const base = existing("NO_PROVEN_BLOCKER", [blockingEvidence, temporalEvidence("insufficient-evidence", "partial")]);
    const ev = temporalEvidence("nb-candidate");
    const beforeBase = structuredClone(base);
    const beforeEv = structuredClone(ev);
    map(base, { applicable: true, evidence: ev });
    expect(base).toEqual(beforeBase);
    expect(ev).toEqual(beforeEv);
  });
});

describe("§playabilityIssues / 导出 / 常量", () => {
  it("temporal evidence 不产 issue；existing 阻断 evidence 仍产 issue", () => {
    const result = map(existing("PROVEN_UNPLAYABLE", [blockingEvidence]), { applicable: true, evidence: temporalEvidence("pu-candidate") });
    const issues = playabilityIssues(result);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.where).toBe('entity "suitcase-3"');
    expect(issues.every((issue) => issue.where !== "objective.gate")).toBe(true);
  });

  it("公共 IE / NB 结果不产 issue", () => {
    const ie = map(existing("NO_PROVEN_BLOCKER"), { applicable: true, evidence: temporalEvidence("nb-candidate") });
    expect(playabilityIssues(ie)).toEqual([]);
    const nb = map(existing("NO_PROVEN_BLOCKER"), { applicable: true, evidence: temporalEvidence("nb-candidate") }, OPEN_BOTH, ADMITTED_BOTH);
    expect(playabilityIssues(nb)).toEqual([]);
  });

  it("api.ts 导出 U2 mapper / 常量 / 冲突异常", () => {
    expect(typeof apiMapPublicVerdict).toBe("function");
    expect(API_GATE).toEqual({ nb: "BLOCKED", pu: "BLOCKED" });
    expect(new ApiConflictError({ existingVerdict: "PROVEN_UNPLAYABLE", temporalResult: "nb-candidate", coverageTemporal: "checked", gate: OPEN_BOTH, admission: ADMITTED_BOTH })).toBeInstanceOf(Error);
  });

  it("第一阶段常量冻结", () => {
    expect(Object.isFrozen(PHASE1_CAPABILITY_GATE)).toBe(true);
    expect(Object.isFrozen(PHASE1_CAPABILITY_ADMISSION)).toBe(true);
    expect(PHASE1_CAPABILITY_GATE).toEqual({ nb: "BLOCKED", pu: "BLOCKED" });
    expect(PHASE1_CAPABILITY_ADMISSION).toEqual({ nb: false, pu: false });
  });
});
