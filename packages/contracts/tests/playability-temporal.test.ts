// U5-01：D9 内部结果组装（`analyzeTemporalInternal`）。
//
// ⚠️ 本文件只覆盖组装形状、六条件状态、跨分支不变量与确定性；A–J 矩阵在 U5-04
//    追加到同一文件。所有世界都是内存夹具，不读文件系统、不新增 JSON fixture。
import { describe, expect, it } from "vitest";
import { parseGameConfig } from "../src/index.js";
import { analyzeTemporalInternal, determinismSignature } from "../src/playability/temporal.js";
import type { TemporalInternalResult, BudgetProfile } from "../src/playability/temporal-result.js";
import {
  canonicalJson,
  deterministicView,
  trustedInputFixture,
  witnessConfigRaw,
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
