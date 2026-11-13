// U5-01：D9 内部结果组装（`analyzeTemporalInternal`）。
//
// ⚠️ 本文件只覆盖组装形状、六条件状态、跨分支不变量与确定性；A–J 矩阵在 U5-04
//    追加到同一文件。所有世界都是内存夹具，不读文件系统、不新增 JSON fixture。
import { describe, expect, it } from "vitest";
import { parseGameConfig } from "../src/index.js";
import {
  analyzeTemporalInternal,
  determinismSignature,
  resolveTwoLagInternalResults,
  resolveTwoLagResults,
} from "../src/playability/temporal.js";
import {
  createWitnessWorkBudget,
  resolveWitnessSpace,
  searchWinningSet,
  verifyTransition,
} from "../src/playability/temporal-witness.js";
import type { TemporalInternalResult, BudgetProfile } from "../src/playability/temporal-result.js";
import {
  budgetProfileFixture,
  canonicalJson,
  deterministicView,
  trustedInputFixture,
  witnessConfigRaw,
  witnessHazard,
  witnessManifest,
  witnessWorld,
  type WitnessWorldOptions,
} from "./playability-temporal-fixtures.js";

const analyze = (
  options: WitnessWorldOptions = {},
  overrides: Partial<BudgetProfile> = {},
  lagMs = 0,
): TemporalInternalResult => {
  const { config, manifest } = witnessWorld(options);
  return analyzeTemporalInternal({
    config,
    manifest,
    lagMs,
    trustedInput: trustedInputFixture(),
    testHooks: { budget: overrides, now: () => 1000 },
  });
};

const analyzeWithClock = (
  options: WitnessWorldOptions,
  overrides: Partial<BudgetProfile>,
  now: () => number,
  lagMs = 0,
): TemporalInternalResult => {
  const { config, manifest } = witnessWorld(options);
  return analyzeTemporalInternal({
    config,
    manifest,
    lagMs,
    trustedInput: trustedInputFixture(),
    testHooks: { budget: overrides, now },
  });
};

/** NB 正样本：Hazard 在玩家上方往返，玩家可在走廊里安全等待 / 通过。 */
const NB_WORLD: WitnessWorldOptions = { hazardY: 20 };

/**
 * PU 正样本：Hazard 20×60 恒覆盖玩家的整个可跳高度，门区宽 10；
 * forbidden 注入把走廊完全切断，hop 无法越过。
 */
const PU_WORLD: WitnessWorldOptions = {
  hazardW: 20,
  hazardH: 60,
  hazardX: 50,
  hazardY: 40,
  hazardDistance: 10,
  hazardPeriodMs: 200,
};

/** G：门区成立，但 Hazard 只有 12 高，玩家可以跳过去 ⇒ 图割不成立。 */
const EVASION_WORLD: WitnessWorldOptions = {
  hazardW: 20,
  hazardH: 12,
  hazardX: 50,
  hazardY: 40,
  hazardDistance: 10,
  hazardPeriodMs: 200,
};

/** F / 门区不成立：Hazard 太窄（w − d < 0），不存在恒覆盖核心。 */
const NO_GATE_WORLD: WitnessWorldOptions = {
  hazardW: 4,
  hazardH: 12,
  hazardX: 5,
  hazardDistance: 10,
  hazardPeriodMs: 200,
};

const reasonOf = (result: TemporalInternalResult) => result.diagnostics.degradationReason;

const expectInvariants = (result: TemporalInternalResult): void => {
  expect(result.modelConditional).toBe(true);
  expect(result.publicCapability).toBe("BLOCKED");
  expect(result.publicResult).toBeNull();
  expect(result.stats.determinismSignature).toMatch(/^[0-9a-f]{8}$/);

  const { internalResult, certificate } = result;
  expect(internalResult === "nb-candidate").toBe(
    certificate.kind === "witness" && certificate.status === "COMPLETE",
  );
  expect(internalResult === "pu-candidate").toBe(
    certificate.kind === "permanent-gate" && certificate.status === "COMPLETE",
  );
  if (certificate.kind === "none") expect(internalResult).toBe("insufficient-evidence");
  if (certificate.kind !== "none" && certificate.status === "INCOMPLETE") {
    expect(result.diagnostics.degradationReason).not.toBeNull();
  }
  if (certificate.kind !== "none" && certificate.status === "COMPLETE") {
    expect(result.diagnostics.degradationReason).toBeNull();
  }
  if (internalResult === "insufficient-evidence") {
    expect(result.diagnostics.degradationReason).not.toBeNull();
  }
};

describe("U5-01 内部结果组装形状", () => {
  it("[I02-05][AC-13] 顶层字段固定为 D9 七项，公共能力恒 BLOCKED", () => {
    const result = analyze(NB_WORLD);
    expect(Object.keys(result).sort()).toEqual([
      "certificate",
      "diagnostics",
      "internalResult",
      "modelConditional",
      "publicCapability",
      "publicResult",
      "stats",
    ]);
    expect(Object.keys(result.stats).sort()).toEqual([
      "budget", "determinismSignature", "grid", "timing", "work",
    ]);
    expectInvariants(result);
  });

  it("[I02-05][AC-11] 模型外输入（Y 轴移动 / 多移动 Hazard）⇒ IE + model-out", () => {
    const raw = witnessConfigRaw({ hazardY: 20 }) as {
      entities: { id: string; kind: string; motion?: { axis: string } }[];
    };
    const hazard = raw.entities.find((entity) => entity.id === "hazard")!;
    hazard.motion!.axis = "y";
    const parsed = parseGameConfig(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const yAxis = analyzeTemporalInternal({
      config: parsed.value,
      manifest: witnessManifest({ hazardY: 20 }),
      lagMs: 0,
      trustedInput: trustedInputFixture(),
      testHooks: { now: () => 1000 },
    });
    expect(yAxis.internalResult).toBe("insufficient-evidence");
    expect(reasonOf(yAxis)).toBe("model-out");
    expectInvariants(yAxis);

    const twice = witnessConfigRaw({ hazardY: 20 }) as {
      entities: { id: string; kind: string }[];
    };
    const original = twice.entities.find((entity) => entity.id === "hazard")!;
    twice.entities.push({ ...original, id: "hazard-2" });
    const parsedTwice = parseGameConfig(twice);
    expect(parsedTwice.ok).toBe(true);
    if (!parsedTwice.ok) return;
    const multiple = analyzeTemporalInternal({
      config: parsedTwice.value,
      manifest: witnessManifest({ hazardY: 20 }),
      lagMs: 0,
      trustedInput: trustedInputFixture(),
      testHooks: { now: () => 1000 },
    });
    expect(multiple.internalResult).toBe("insufficient-evidence");
    expect(reasonOf(multiple)).toBe("model-out");
    expectInvariants(multiple);
  });
});

describe("U5-01 NB 分支", () => {
  it("[I02-01][AC-03] 全相位 Winning Set 成立 ⇒ nb-candidate + witness COMPLETE", () => {
    const result = analyze(NB_WORLD);
    expect(result.internalResult).toBe("nb-candidate");
    expect(result.certificate.kind).toBe("witness");
    if (result.certificate.kind !== "witness") return;
    expect(result.certificate.status).toBe("COMPLETE");
    const witness = result.certificate.witness;
    expect(witness.form).toBe("winning-set");
    expect(witness.derived).toBe(true);
    expect(witness.volume.transitions).toBeGreaterThan(0);
    expect(witness.volume.bytes).toBeGreaterThan(0);
    expect(witness.phaseCoverage.complete).toBe(true);
    for (const index of witness.policy) {
      expect(witness.verifications[index]?.[6]).toBe(1);
    }
    expect(result.stats.budget.budgetStatus).toBe("complete");
    expect(result.stats.budget.budgetKind).toBeNull();
    expect(result.stats.work.witnessTransitions).toBe(witness.volume.transitions);
    expectInvariants(result);
  });
});

describe("U5-01 PU 分支与六条件", () => {
  it("[I02-04][AC-05][AC-06][AC-07] 门区 + 图割 + hop 完整 ⇒ pu-candidate", () => {
    const result = analyze(PU_WORLD);
    expect(result.internalResult).toBe("pu-candidate");
    expect(result.certificate.kind).toBe("permanent-gate");
    if (result.certificate.kind !== "permanent-gate") return;
    expect(result.certificate.status).toBe("COMPLETE");
    const proof = result.certificate.proof;

    expect(proof.graphCut.verdict).toBe("conditional");
    expect(proof.graphCut.goalIntersections).toBe(0);
    expect(proof.graphCut.midAirHits).toBe(0);
    expect(proof.hopDoubling.connectivityPreserved).toBe(true);
    expect(proof.hopDoubling.normalizedCoverage).toBe(true);
    expect(proof.hopSamplingCoverage).toEqual({ covered: true, method: "normalized" });
    expect(proof.movementModelClosure).toBe("not-proven-air-control");
    expect(proof.lagMode).toBe("gate-independent; witness-only");
    expect(proof.lagInvariantByConstruction).toBe(true);

    expect(proof.puConditions.map((condition) => condition.id)).toEqual([
      "gate-coverage",
      "geometry-checked",
      "graph-cut",
      "hop-doubling",
      "model-out-excluded",
      "lag-consistent",
    ]);
    const statusOf = (id: string) =>
      proof.puConditions.find((condition) => condition.id === id)!.status;
    expect(statusOf("gate-coverage")).toBe("PASS");
    expect(statusOf("geometry-checked")).toBe("BLOCKED");
    expect(statusOf("graph-cut")).toBe("PASS");
    expect(statusOf("hop-doubling")).toBe("PASS");
    expect(statusOf("model-out-excluded")).toBe("BLOCKED");
    expect(statusOf("lag-consistent")).toBe("PASS");
    for (const condition of proof.puConditions) {
      if (condition.status === "PASS") expect(condition.evidence).toBeTruthy();
      if (condition.status === "BLOCKED") expect(condition.blockedReason).toBeTruthy();
    }

    for (const coverage of [proof.geometryCoverage.hazard, proof.geometryCoverage.player, proof.geometryCoverage.graph]) {
      expect(coverage).toEqual({
        chain: "manifest+atlas-metadata",
        runtimeBody: "unverified",
        coverage: "partial",
      });
    }
    expectInvariants(result);
  });

  it("[I02-04][AC-06] 门区成立但图割不成立 ⇒ permanent-gate INCOMPLETE + graph-cut-incomplete", () => {
    const result = analyze(EVASION_WORLD);
    expect(result.internalResult).toBe("insufficient-evidence");
    expect(result.certificate.kind).toBe("permanent-gate");
    if (result.certificate.kind !== "permanent-gate") return;
    expect(result.certificate.status).toBe("INCOMPLETE");
    expect(reasonOf(result)).toBe("graph-cut-incomplete");
    const statusOf = (id: string) =>
      result.certificate.kind === "permanent-gate"
        ? result.certificate.proof.puConditions.find((condition) => condition.id === id)!.status
        : undefined;
    expect(statusOf("gate-coverage")).toBe("PASS");
    expect(statusOf("geometry-checked")).toBe("BLOCKED");
    expect(statusOf("graph-cut")).toBe("INSUFFICIENT_EVIDENCE");
    expect(statusOf("model-out-excluded")).toBe("BLOCKED");
    expectInvariants(result);
  });

  it("[I02-03][AC-05] 门区不成立（无恒覆盖核心）⇒ IE + no-permanent-gate，不伪造证明", () => {
    const result = analyze(NO_GATE_WORLD);
    expect(result.internalResult).toBe("insufficient-evidence");
    expect(result.certificate.kind).toBe("none");
    expect(reasonOf(result)).toBe("no-permanent-gate");
    expectInvariants(result);
  });
});

describe("U5-01 预算与确定性", () => {
  it("[I02-05][AC-08] edge 预算触顶 ⇒ IE + exhausted + edge-budget", () => {
    const result = analyze(NB_WORLD, { maxEdges: 1 });
    expect(result.internalResult).toBe("insufficient-evidence");
    expect(result.certificate.kind).toBe("none");
    expect(result.stats.budget.budgetStatus).toBe("exhausted");
    expect(result.stats.budget.budgetKind).toBe("edge-budget");
    expect(reasonOf(result)).toBe("edge-budget-exhausted");
    expectInvariants(result);
  });

  it("[I02-05][AC-10] 相同输入重复运行：签名与规范化完整序列化一致", () => {
    for (const world of [NB_WORLD, PU_WORLD, EVASION_WORLD, NO_GATE_WORLD]) {
      const first = analyze(world);
      const second = analyze(world);
      expect(second.stats.determinismSignature).toBe(first.stats.determinismSignature);
      expect(determinismSignature(first)).toBe(first.stats.determinismSignature);
      expect(canonicalJson(deterministicView(second))).toBe(canonicalJson(deterministicView(first)));
      expectInvariants(first);
    }
  });

  it("[I02-05][AC-10] wallClockMs / detail 不进入确定性签名", () => {
    const { config, manifest } = witnessWorld(NB_WORLD);
    const base = {
      config,
      manifest,
      lagMs: 0,
      trustedInput: trustedInputFixture(),
    } as const;
    // 两个注入时钟的**步进速率**不同：墙钟读数不同，但都远低于 timeBudgetMs。
    const clock = (rateMs: number) => {
      let t = 1000;
      return () => {
        t += rateMs;
        return t;
      };
    };
    const early = analyzeTemporalInternal({ ...base, testHooks: { now: clock(1) } });
    const late = analyzeTemporalInternal({ ...base, testHooks: { now: clock(0) } });
    expect(late.stats.timing.wallClockMs).not.toBe(early.stats.timing.wallClockMs);
    expect(late.stats.determinismSignature).toBe(early.stats.determinismSignature);
    expect(determinismSignature(late)).toBe(determinismSignature(early));
  });
});


// ── U5-02：预算闭合与降级硬化 ───────────────────────────────────────────────
//
// 小型世界：worldW=20、xPositions=19、N_max=4、默认速度 20 px/s。
const COMPACT_NB: WitnessWorldOptions = {
  worldW: 20,
  goalX: 15,
  goalW: 2,
  spawnX: 3,
  hazardX: 10,
  hazardDistance: 4,
  hazardPeriodMs: 200,
  hazardY: 20,
};

/** 周期 300ms：`maxStates=113` 时 N=5、dt=60，某个相位格内部跨折返点 150。 */
const CROSSING_NB: WitnessWorldOptions = { ...COMPACT_NB, hazardPeriodMs: 300 };

describe("U5-02 预算闭合与降级硬化", () => {
  it("[I02-05][AC-08] phaseGridCapped 只是诊断；N ≥ 2 时仍可完成", () => {
    const result = analyze(COMPACT_NB, { maxStates: 56 });
    expect(result.stats.grid.phaseSteps).toBe(2);
    expect(result.stats.grid.N_max).toBe(4);
    expect(result.stats.grid.phaseGridCapped).toBe(true);
    expect(result.stats.grid.phaseCapReason).toBe("state-capacity");
    expect(result.internalResult).toBe("nb-candidate");
    expectInvariants(result);
  });

  it("[I02-05][AC-08] N < 2 ⇒ grid-resolution-infeasible，不截断到 2", () => {
    const result = analyze(COMPACT_NB, { maxStates: 37 });
    expect(result.stats.grid.phaseSteps).toBe(0);
    expect(reasonOf(result)).toBe("grid-resolution-infeasible");
    expectInvariants(result);
  });

  it("[I02-05][AC-08] 非法预算 / 超硬上限 ⇒ invalid-budget，不回退默认值", () => {
    const invalid: Partial<BudgetProfile>[] = [
      { maxStates: 0 },
      { maxStates: 1_000_001 },
      { timeBudgetMs: 0 },
      { timeBudgetMs: 10_001 },
      { maxCutsPerCheck: 1_000_001 },
      { maxCutsPerBranch: 10_000_001 },
      { maxWitnessTransitions: 1_000_001 },
      { maxWitnessBytes: 64 * 1024 * 1024 + 1 },
      { maxHopSamples: 241 },
      { timeBudgetCheckpointWork: 0 },
    ];
    for (const overrides of invalid) {
      const result = analyze(NB_WORLD, overrides);
      expect(reasonOf(result), JSON.stringify(overrides)).toBe("invalid-budget");
      expect(result.stats.budget.budgetStatus).toBe("invalid");
      expect(result.internalResult).toBe("insufficient-evidence");
      expectInvariants(result);
    }
  });

  it("[I02-05][AC-08] 派生上界溢出 ⇒ budget-bound-overflow", () => {
    const result = analyze(NB_WORLD, { maxEdges: 2_000_001 });
    expect(reasonOf(result)).toBe("budget-bound-overflow");
    expect(result.stats.budget.budgetStatus).toBe("invalid");
    expectInvariants(result);
  });

  it("[I02-05][AC-08] edge 先于 cut 检查：edge 触顶不被改写为 cut-budget", () => {
    const result = analyze(NB_WORLD, { maxEdges: 0, maxCutsPerBranch: 1 });
    expect(reasonOf(result)).toBe("edge-budget-exhausted");
    expect(result.stats.budget).toMatchObject({
      budgetStatus: "exhausted",
      budgetKind: "edge-budget",
    });
    expectInvariants(result);
  });

  it("[I02-05][AC-08] 折返点预切段：单次 check 不跨折返点，maxCutsPerCheck=0 不误伤 U2", () => {
    // `verifyTransition` 在调用 intersectContinuous 前已按折返点切段，因此单次
    // check 的 expectedCuts 恒为 0；它不会伪造 cut-budget。单次上限本身由
    // playability-temporal-budget.test.ts 的 tracker 级测试覆盖。
    const result = analyze(CROSSING_NB, { maxStates: 113, maxCutsPerCheck: 0 });
    expect(result.internalResult).toBe("nb-candidate");
    expect(result.stats.budget).toMatchObject({ budgetStatus: "complete", budgetKind: null });
    expectInvariants(result);
  });

  it("[I02-05][AC-08] Witness 体积：恰好达上限通过，多 1 即 witness-volume", () => {
    const baseline = analyze(NB_WORLD);
    expect(baseline.certificate.kind).toBe("witness");
    if (baseline.certificate.kind !== "witness") return;
    const transitions = baseline.certificate.witness.volume.transitions;
    const bytes = baseline.certificate.witness.volume.bytes;
    expect(transitions).toBeGreaterThan(0);
    expect(bytes).toBeGreaterThan(0);

    const atCap = analyze(NB_WORLD, {
      maxWitnessTransitions: transitions,
      maxWitnessBytes: bytes,
    });
    expect(atCap.internalResult).toBe("nb-candidate");

    const overTransitions = analyze(NB_WORLD, { maxWitnessTransitions: transitions - 1 });
    expect(overTransitions.internalResult).toBe("insufficient-evidence");
    expect(reasonOf(overTransitions)).toBe("witness-volume");
    expect(overTransitions.stats.budget).toMatchObject({
      budgetStatus: "exhausted",
      budgetKind: "witness-volume",
    });
    expectInvariants(overTransitions);

    const overBytes = analyze(NB_WORLD, { maxWitnessBytes: bytes - 1 });
    expect(overBytes.internalResult).toBe("insufficient-evidence");
    expect(reasonOf(overBytes)).toBe("witness-volume");
    expect(overBytes.stats.budget).toMatchObject({
      budgetStatus: "exhausted",
      budgetKind: "witness-volume",
    });
    expectInvariants(overBytes);
  });

  it("[I02-05][AC-08] maxHopSamples 生效：cap 绑定 ⇒ hop-sample-budget + 部分证明", () => {
    const result = analyze(PU_WORLD, { maxHopSamples: 6 });
    expect(result.internalResult).toBe("insufficient-evidence");
    expect(reasonOf(result)).toBe("hop-sample-budget");
    expect(result.stats.budget).toMatchObject({
      budgetStatus: "exhausted",
      budgetKind: "hop-sample-budget",
    });
    expect(result.certificate.kind).toBe("permanent-gate");
    if (result.certificate.kind !== "permanent-gate") return;
    expect(result.certificate.status).toBe("INCOMPLETE");
    expect(result.certificate.proof.hopDoubling.base.cap).toBe(6);
    expect(result.certificate.proof.hopDoubling.doubled.cap).toBe(6);
    expectInvariants(result);
  });

  it("[I02-05][AC-08] maxHopSamples 低于采样下限 ⇒ hop-sample-budget，不静默改用默认值", () => {
    const result = analyze(PU_WORLD, { maxHopSamples: 0 });
    expect(result.internalResult).toBe("insufficient-evidence");
    expect(reasonOf(result)).toBe("hop-sample-budget");
    expect(result.stats.budget).toMatchObject({
      budgetStatus: "exhausted",
      budgetKind: "hop-sample-budget",
    });
    expect(result.certificate.kind).toBe("none");
    expectInvariants(result);
  });

  it("[I02-05][AC-08] 「不完整」与「不一致」是不同原因", () => {
    const incomplete = analyze(NB_WORLD, { maxEdges: 0 });
    expect(reasonOf(incomplete)).toBe("edge-budget-exhausted");
    expect(reasonOf(incomplete)).not.toBe("lag-disagreement");

    const disagreement = resolveTwoLagResults(
      { applicable: true, verdict: "NO_PROVEN_BLOCKER" },
      { applicable: true, verdict: "PROVEN_UNPLAYABLE" },
    );
    expect(disagreement).toEqual({
      applicable: true,
      verdict: "INSUFFICIENT_EVIDENCE",
      degradation: "lag-disagreement",
    });
  });
});


// ── U5-03：墙钟 abort 与确定性 ──────────────────────────────────────────────
describe("U5-03 墙钟 abort 与确定性", () => {
  it("[I02-05][AC-08][AC-10] 注入时钟确定性触发 wall-clock-abort，且重复运行一致", () => {
    const budget = { timeBudgetMs: 10, timeBudgetCheckpointWork: 1 };
    const steppingClock = () => {
      let t = 0;
      return () => {
        t += 100;
        return t;
      };
    };
    const first = analyzeWithClock(NB_WORLD, budget, steppingClock());
    const second = analyzeWithClock(NB_WORLD, budget, steppingClock());

    expect(first.internalResult).toBe("insufficient-evidence");
    expect(reasonOf(first)).toBe("wall-clock-abort");
    expect(first.stats.budget).toMatchObject({
      budgetStatus: "aborted",
      budgetKind: "wall-clock-abort",
    });
    expect(second.stats.determinismSignature).toBe(first.stats.determinismSignature);
    expect(canonicalJson(deterministicView(second))).toBe(canonicalJson(deterministicView(first)));
    expectInvariants(first);
  });

  it("[I02-05][AC-10] 同一工作预算下，墙钟不前进则不 abort（abort 只由注入时钟驱动）", () => {
    const budget = { timeBudgetMs: 10, timeBudgetCheckpointWork: 1 };
    const noAbort = analyzeWithClock(NB_WORLD, budget, () => 0);
    expect(noAbort.internalResult).toBe("nb-candidate");
    expect(noAbort.stats.budget.budgetStatus).toBe("complete");
    expectInvariants(noAbort);
  });

  it("[I02-05][AC-10] wallClockMs 不进签名，也不进规范化完整序列化", () => {
    const fast = analyzeWithClock(NB_WORLD, {}, () => 0);
    const slowClock = () => {
      let t = 0;
      return () => {
        t += 1;
        return t;
      };
    };
    const slow = analyzeWithClock(NB_WORLD, {}, slowClock());
    expect(fast.internalResult).toBe("nb-candidate");
    expect(slow.internalResult).toBe("nb-candidate");
    expect(slow.stats.timing.wallClockMs).not.toBe(fast.stats.timing.wallClockMs);
    expect(slow.stats.determinismSignature).toBe(fast.stats.determinismSignature);
    expect(canonicalJson(deterministicView(slow))).toBe(canonicalJson(deterministicView(fast)));
  });

  it("[I02-05][AC-10] diagnostics.detail 不进签名：同类缺口不同细节签名相等", () => {
    const outOfWorld = analyzeWithClock({ ...NB_WORLD, spawnY: 100 }, {}, () => 1000);
    const notStandable = analyzeWithClock({ ...NB_WORLD, spawnY: 30 }, {}, () => 1000);
    expect(reasonOf(outOfWorld)).toBe("spawn-not-on-lattice");
    expect(reasonOf(notStandable)).toBe("spawn-not-on-lattice");
    expect(outOfWorld.diagnostics.detail).toBeTruthy();
    expect(notStandable.diagnostics.detail).toBeTruthy();
    expect(outOfWorld.diagnostics.detail).not.toBe(notStandable.diagnostics.detail);
    expect(outOfWorld.stats.determinismSignature).toBe(notStandable.stats.determinismSignature);
    expect(canonicalJson(deterministicView(outOfWorld)))
      .toBe(canonicalJson(deterministicView(notStandable)));
  });

  it("[I02-05][AC-10] 签名覆盖 certificate：改动验证记录即改变签名", () => {
    const result = analyze(NB_WORLD);
    expect(result.certificate.kind).toBe("witness");
    const tampered = JSON.parse(JSON.stringify(result)) as TemporalInternalResult;
    if (tampered.certificate.kind !== "witness") return;
    const tuple = tampered.certificate.witness.verifications[0];
    expect(tuple).toBeDefined();
    (tuple as unknown as number[])[4] = Number(tuple![4]) + 1;
    expect(determinismSignature(tampered)).not.toBe(determinismSignature(result));
  });

  it("[I02-05][AC-10] 四个世界 × 三档 lag：重复运行签名与规范化序列化一致", () => {
    for (const options of [NB_WORLD, PU_WORLD, EVASION_WORLD, NO_GATE_WORLD]) {
      for (const lagMs of [0, 16.67, 200]) {
        const first = analyze(options, {}, lagMs);
        const second = analyze(options, {}, lagMs);
        expect(second.stats.determinismSignature, `${lagMs}`)
          .toBe(first.stats.determinismSignature);
        expect(canonicalJson(deterministicView(second)))
          .toBe(canonicalJson(deterministicView(first)));
        expectInvariants(first);
      }
    }
  });

  it("[I02-05][AC-10] 策略后继 tie-break：同 rank 取最小 footX / k", () => {
    const world: WitnessWorldOptions = {
      worldW: 20,
      goalX: 15,
      goalW: 2,
      spawnX: 3,
      hazardX: 10,
      hazardDistance: 4,
      hazardPeriodMs: 200,
      hazardY: 20,
      playerSpeed: 90,
    };
    const profile = budgetProfileFixture({ maxStates: 38 });
    const { config, manifest } = witnessWorld(world);
    const spaceResult = resolveWitnessSpace({ config, manifest, budget: profile, periodMs: 200 });
    if (!spaceResult.ok) throw new Error(`expected space, got ${spaceResult.reason}`);
    const space = spaceResult;
    const hazard = witnessHazard(world);
    const search = searchWinningSet({
      space,
      hazard,
      lagMs: 0,
      budget: createWitnessWorkBudget({ profile, now: () => 0 }),
    });
    expect(search.status).toBe("complete");

    const byKey = new Map(search.policy.map((entry) => [
      `${entry.state.footX},${entry.state.k}`,
      entry,
    ]));
    let multi = 0;
    let violations = 0;
    for (const entry of search.policy) {
      if (entry.transition === null) continue;
      const candidates: { footX: number; k: number }[] = [];
      const k = (entry.state.k + 1) % space.grid.phaseSteps;
      for (let x = space.corridor.xLo; x <= space.corridor.xHi; x++) {
        if (Math.abs(x - entry.state.footX) > space.grid.maxStep) continue;
        const candidate = byKey.get(`${x},${k}`);
        if (!candidate || candidate.rank !== entry.rank - 1) continue;
        const check = verifyTransition({
          space,
          hazard,
          lagMs: 0,
          from: entry.state,
          to: { footX: x, k },
          budget: createWitnessWorkBudget({ profile, now: () => 0 }),
        });
        if (check.verified) candidates.push({ footX: x, k });
      }
      if (candidates.length > 1) multi += 1;
      candidates.sort((a, b) => a.footX - b.footX || a.k - b.k);
      if (candidates.length === 0) continue;
      const chosen = entry.transition.to;
      const minimal = candidates[0]!;
      if (chosen.footX !== minimal.footX || chosen.k !== minimal.k) violations += 1;
    }
    expect(multi).toBeGreaterThan(0);
    expect(violations).toBe(0);
  });
});


// ── U5-04：A–J 矩阵与跨单元组合 ─────────────────────────────────────────────
describe("U5-04 A–J 矩阵", () => {
  const expectPublicBoundary = (result: TemporalInternalResult): void => {
    expect(result.publicCapability).toBe("BLOCKED");
    expect(result.publicResult).toBeNull();
  };

  it("[I02-02][AC-03] A：安全等待窗口 ⇒ nb-candidate + witness COMPLETE", () => {
    const result = analyze(NB_WORLD);
    expect(result.internalResult).toBe("nb-candidate");
    expect(result.certificate.kind).toBe("witness");
    if (result.certificate.kind !== "witness") return;
    expect(result.certificate.status).toBe("COMPLETE");
    expect(result.certificate.witness.phaseCoverage.complete).toBe(true);
    expect(result.diagnostics.degradationReason).toBeNull();
    expectPublicBoundary(result);
  });

  it("[I02-03][AC-05][AC-06][AC-07] B：永久门区且无垂直规避 ⇒ pu-candidate + 六条件", () => {
    const result = analyze(PU_WORLD);
    expect(result.internalResult).toBe("pu-candidate");
    expect(result.certificate.kind).toBe("permanent-gate");
    if (result.certificate.kind !== "permanent-gate") return;
    expect(result.certificate.status).toBe("COMPLETE");
    const proof = result.certificate.proof;
    const statusOf = (id: string) =>
      proof.puConditions.find((condition) => condition.id === id)!.status;
    expect(statusOf("gate-coverage")).toBe("PASS");
    expect(statusOf("geometry-checked")).toBe("BLOCKED");
    expect(statusOf("graph-cut")).toBe("PASS");
    expect(statusOf("hop-doubling")).toBe("PASS");
    expect(statusOf("model-out-excluded")).toBe("BLOCKED");
    expect(statusOf("lag-consistent")).toBe("PASS");
    expect(proof.graphCut.verdict).toBe("conditional");
    expect(proof.movementModelClosure).toBe("not-proven-air-control");
    expect(result.diagnostics.degradationReason).toBeNull();
    expectPublicBoundary(result);
  });

  it("[I02-05][AC-11] C：几何 / 时序 / 规避证据不足 ⇒ IE + 缺口一致", () => {
    const spawnGap = analyze({ ...NB_WORLD, spawnY: 100 });
    expect(spawnGap.internalResult).toBe("insufficient-evidence");
    expect(spawnGap.diagnostics.degradationReason).toBe("spawn-not-on-lattice");
    expect(spawnGap.diagnostics.detail).toContain("spawn-box-out-of-world");
    expectPublicBoundary(spawnGap);

    const gateGap = analyze(NO_GATE_WORLD);
    expect(gateGap.internalResult).toBe("insufficient-evidence");
    expect(gateGap.diagnostics.degradationReason).toBe("no-permanent-gate");
    expect(gateGap.certificate.kind).toBe("none");
    expectPublicBoundary(gateGap);
  });

  it("[I02-01][AC-01][AC-02] D：折返点切段与 witness verified 一致", () => {
    const result = analyze(CROSSING_NB, { maxStates: 113 });
    expect(result.internalResult).toBe("nb-candidate");
    expect(result.certificate.kind).toBe("witness");
    if (result.certificate.kind !== "witness") return;
    const half = 150; // period 300ms
    const tuple = result.certificate.witness.verifications.find(
      (entry) => entry[4] < half && entry[5] > half,
    );
    expect(tuple).toBeDefined();
    if (tuple === undefined) return;
    expect(tuple[6]).toBe(1);

    const profile = budgetProfileFixture({ maxStates: 113 });
    const { config, manifest } = witnessWorld(CROSSING_NB);
    const spaceResult = resolveWitnessSpace({
      config,
      manifest,
      budget: profile,
      periodMs: 300,
    });
    if (!spaceResult.ok) throw new Error(`expected space, got ${spaceResult.reason}`);
    const check = verifyTransition({
      space: spaceResult,
      hazard: witnessHazard(CROSSING_NB),
      lagMs: 0,
      from: { footX: tuple[0], k: tuple[1] },
      to: { footX: tuple[2], k: tuple[3] },
      budget: createWitnessWorkBudget({ profile, now: () => 0 }),
    });
    expect(check.verified).toBe(true);
    expect(check.t0).toBe(tuple[4]);
    expect(check.t1).toBe(tuple[5]);
    // `verifyTransition` 在调用连续求交前已按折返点预切段：跨折返点的相位格
    // 变成 2 个单调段，因此 transition 级 `cutPoints = 0`、`segments = 2`。
    expect(check.cutPoints).toBe(0);
    expect(check.segments).toBe(2);
    expectPublicBoundary(result);
  });

  it("[I02-02][AC-03][AC-04] E：等待阶段碰撞 ⇒ 不得 nb-candidate", () => {
    const result = analyze({ hazardX: 5, hazardDistance: 10 });
    expect(result.internalResult).not.toBe("nb-candidate");
    expect(result.internalResult).toBe("insufficient-evidence");
    expect(result.certificate.kind).toBe("none");
    const reasons = [
      result.diagnostics.degradationReason,
      ...result.diagnostics.secondaryReasons,
    ];
    expect(reasons).toContain("no-witness-found");
    expectPublicBoundary(result);
  });

  it("[I02-03][AC-05] F：短暂安全窗口 ⇒ IE + no-permanent-gate + certificate none", () => {
    const result = analyze(NO_GATE_WORLD);
    expect(result.internalResult).toBe("insufficient-evidence");
    expect(result.diagnostics.degradationReason).toBe("no-permanent-gate");
    expect(result.certificate.kind).toBe("none");
    expectPublicBoundary(result);
  });

  it("[I02-04][AC-06][AC-07] G：垂直规避 ⇒ permanent-gate INCOMPLETE + 图割原因", () => {
    const result = analyze(EVASION_WORLD);
    expect(result.internalResult).toBe("insufficient-evidence");
    expect(result.certificate.kind).toBe("permanent-gate");
    if (result.certificate.kind !== "permanent-gate") return;
    expect(result.certificate.status).toBe("INCOMPLETE");
    expect([
      "graph-cut-incomplete",
      "hop-doubling-changed",
      "movement-model-unclosed",
    ]).toContain(result.diagnostics.degradationReason);
    expectPublicBoundary(result);
  });

  it("[I02-05][AC-08] H：搜索预算超限 ⇒ IE + exhausted + 对应 budgetKind", () => {
    const result = analyze(NB_WORLD, { maxEdges: 0 });
    expect(result.internalResult).toBe("insufficient-evidence");
    expect(result.stats.budget).toMatchObject({
      budgetStatus: "exhausted",
      budgetKind: "edge-budget",
    });
    expect(result.diagnostics.degradationReason).toBe("edge-budget-exhausted");
    expectPublicBoundary(result);
  });

  it("[I02-05][AC-09] I：两档 lag 合并 ⇒ 一致 / 不一致 / 不完整三分", () => {
    const lagA = analyze(NB_WORLD, {}, 16.67);
    const lagB = analyze(NB_WORLD, {}, 200);
    expect(lagA.certificate.kind).toBe("witness");
    expect(lagB.certificate.kind).toBe("witness");

    const agreed = resolveTwoLagInternalResults(lagA, lagB);
    expect(agreed.internalResult).toBe("nb-candidate");
    expect(agreed.diagnostics.degradationReason).toBeNull();
    expectPublicBoundary(agreed);

    // 组合函数单测：两档完整但结论不同 ⇒ lag-disagreement（同输入的逐档隔离
    // 回归由 U5-05 承担）。
    const completeFailure = analyze(NO_GATE_WORLD, {}, 200);
    expect(completeFailure.internalResult).toBe("insufficient-evidence");
    expectPublicBoundary(completeFailure);
    const disagreed = resolveTwoLagInternalResults(lagA, completeFailure);
    expect(disagreed.internalResult).toBe("insufficient-evidence");
    expect(disagreed.diagnostics.degradationReason).toBe("lag-disagreement");
    expect(disagreed.certificate.kind).toBe("none");
    expectPublicBoundary(disagreed);

    const incomplete = analyze(NB_WORLD, { maxEdges: 0 }, 200);
    expectPublicBoundary(incomplete);
    const merged = resolveTwoLagInternalResults(lagA, incomplete);
    expect(merged.diagnostics.degradationReason).toBe("edge-budget-exhausted");
    expect(merged.stats.budget).toMatchObject({
      budgetStatus: "exhausted",
      budgetKind: "edge-budget",
    });
    expectPublicBoundary(merged);

    const reversed = resolveTwoLagInternalResults(incomplete, lagA);
    expect(reversed.diagnostics.degradationReason).toBe("edge-budget-exhausted");
    expect(reversed.stats.budget).toMatchObject({
      budgetStatus: "exhausted",
      budgetKind: "edge-budget",
    });
    expectPublicBoundary(reversed);
  });

  it("[I02-05][AC-10] J：相同输入重复运行 ⇒ determinismSignature 相等", () => {
    const first = analyze(NB_WORLD);
    const second = analyze(NB_WORLD);
    expect(second.stats.determinismSignature).toBe(first.stats.determinismSignature);
    expect(canonicalJson(deterministicView(second))).toBe(canonicalJson(deterministicView(first)));
    expectPublicBoundary(first);
  });

  it("[I02-05][AC-13] 跨单元：NB / PU 互斥、门区 + 图割 + hop 联合、IE 优先级", () => {
    const results = [
      analyze(NB_WORLD),
      analyze(PU_WORLD),
      analyze(EVASION_WORLD),
      analyze(NO_GATE_WORLD),
    ];
    for (const result of results) {
      const isNb = result.internalResult === "nb-candidate";
      const isPu = result.internalResult === "pu-candidate";
      expect(Number(isNb) + Number(isPu)).toBeLessThanOrEqual(1);
      expectPublicBoundary(result);
      if (result.internalResult === "nb-candidate") {
        expect(result.certificate.kind).toBe("witness");
      }
      if (result.internalResult === "pu-candidate") {
        expect(result.certificate.kind).toBe("permanent-gate");
      }
      if (result.internalResult === "insufficient-evidence") {
        const certificate = result.certificate;
        expect(certificate.kind === "none" ||
          (certificate.kind === "permanent-gate" && certificate.status === "INCOMPLETE"))
          .toBe(true);
      }
    }

    // 门区 + 图割 + hop 三者缺一不可。
    expect(analyze(PU_WORLD).internalResult).toBe("pu-candidate");
    expect(analyze(EVASION_WORLD).internalResult).not.toBe("pu-candidate");
    expect(analyze(NO_GATE_WORLD).internalResult).not.toBe("pu-candidate");

    // IE 优先级：模型外（步骤 1）压过非法预算（步骤 4）。
    const raw = witnessConfigRaw({ hazardY: 20 }) as {
      entities: { id: string; kind: string; motion?: { axis: string } }[];
    };
    raw.entities.find((entity) => entity.id === "hazard")!.motion!.axis = "y";
    const parsed = parseGameConfig(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const yAxis = analyzeTemporalInternal({
      config: parsed.value,
      manifest: witnessManifest({ hazardY: 20 }),
      lagMs: 0,
      trustedInput: trustedInputFixture(),
      testHooks: { budget: { maxStates: 0 }, now: () => 1000 },
    });
    expect(yAxis.diagnostics.degradationReason).toBe("model-out");
    expectPublicBoundary(yAxis);

    // IE 优先级：预算（步骤 5）压过普通否定证据（步骤 7）。
    const budgetFirst = analyze(NB_WORLD, { maxEdges: 0 });
    expect(budgetFirst.diagnostics.degradationReason).toBe("edge-budget-exhausted");
  });
});
