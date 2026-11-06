// LP-04：关卡完成性判据 —— 39 例矩阵的完成性类用例（生产化）+ 正例 / 反例 / 边界。
//
// ⚠️ `expectedVerdict` 是**层内**预期（plan R21(a)）；被空间 / 机制层证明的根因由本层抑制，
//   不重复报。完成性 coverage 与 verdict 必须同时断言。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseGameConfig } from "../src/index.js";
import type { GameConfig } from "../src/game-config.js";
import { auditCompletion, COMPLETION_JUDGMENTS } from "../src/playability/completion.js";
import { auditSpatial, SPATIAL_JUDGMENTS } from "../src/playability/spatial.js";
import { auditMechanic, MECHANIC_JUDGMENTS } from "../src/playability/mechanic.js";
import type { PlayabilityEvidence } from "../src/playability/verdict.js";

const readJson = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8"));

const DOC = readJson("playability-completion-matrix.json") as {
  manifest: unknown;
  cases: {
    caseId: string;
    expectedVerdict: string;
    expectedJudgmentId: string | null;
    expectedGap: string | null;
    failureLocation: string | null;
    note: string | null;
    config: unknown;
  }[];
};
const SPATIAL_DOC = readJson("playability-matrix.json") as { cases: { caseId: string; config: unknown }[] };
const MECHANIC_DOC = readJson("playability-mechanic-matrix.json") as { cases: { caseId: string; config: unknown }[] };

const MANIFEST = (() => {
  const parsed = parseAssetPack(DOC.manifest);
  if (!parsed.ok) throw new Error("fixture 的 manifest 不过 schema：" + parsed.errors.join("；"));
  return parsed.value;
})();

const configOf = (raw: unknown): GameConfig => {
  const parsed = parseGameConfig(raw);
  if (!parsed.ok) throw new Error("fixture 的 config 不过 schema：" + parsed.errors.join("；"));
  return parsed.value;
};
const caseOf = (id: string) => {
  const found = DOC.cases.find((c) => c.caseId === id);
  if (!found) throw new Error(`fixture 里没有用例 ${id}`);
  return found;
};
const configOfCase = (id: string): GameConfig => configOf(caseOf(id).config);
const completionOf = (id: string) => auditCompletion(configOfCase(id), MANIFEST);
const cloneOf = (id: string): GameConfig => structuredClone(configOfCase(id));
const fromFixture = (doc: { cases: { caseId: string; config: unknown }[] }, id: string): GameConfig => {
  const found = doc.cases.find((c) => c.caseId === id);
  if (!found) throw new Error(`fixture 里没有用例 ${id}`);
  return configOf(found.config);
};
const judgmentsOf = (evidence: readonly PlayabilityEvidence[]) => evidence.map((e) => e.judgmentId);

describe("§矩阵完成性类用例（生产化）", () => {
  it("fixture 覆盖 10 个完成性类用例，config / manifest 全部可解析", () => {
    expect(DOC.cases).toHaveLength(10);
    for (const c of DOC.cases) expect(() => configOf(c.config)).not.toThrow();
  });

  for (const c of DOC.cases) {
    it(`${c.caseId} ⇒ 层内 ${c.expectedVerdict}`, () => {
      const result = completionOf(c.caseId);
      expect(result.verdict).toBe(c.expectedVerdict);

      if (c.expectedJudgmentId) {
        expect(judgmentsOf(result.evidence)).toContain(c.expectedJudgmentId);
        if (c.failureLocation)
          expect(result.evidence.some((e) => e.judgmentId === c.expectedJudgmentId && e.target === c.failureLocation)).toBe(true);
      } else {
        expect(result.evidence).toEqual([]);
      }
      if (c.expectedGap) expect(result.gaps.map((g) => g.missing)).toContain(c.expectedGap);
      if (c.expectedVerdict === "NO_PROVEN_BLOCKER") expect(result.coverage).toBe("checked");
      if (c.expectedVerdict === "INSUFFICIENT_EVIDENCE") expect(result.coverage).toBe("partial");

      const targets = result.evidence.map((e) => e.target);
      expect(new Set(targets).size).toBe(targets.length);
    });
  }
});

describe("§完成性判据的核心：一次走法收齐再到达 gate", () => {
  it("单向坑 pickup：单独可取得但收齐后回不到 gate ⇒ no-walk", () => {
    const result = completionOf("one-way-pit-pickup");
    const evidence = result.evidence.find((e) => e.judgmentId === COMPLETION_JUDGMENTS.gateNotReachableAfterCollect)!;
    expect(evidence.target).toBe('entity "gate"');
    expect(evidence.witness.kind).toBe("no-path");
    if (evidence.witness.kind === "no-path") {
      expect(evidence.witness.required).toContain('entity "pit-pickup"');
      expect(evidence.witness.collectableAlone).toContain('entity "pit-pickup"');
      expect(evidence.witness.usedResetEdges).toBe(false);
    }
  });

  it("合法的强制顺序 / 一弧收两件 / 悬空 gate 不误报", () => {
    expect(completionOf("order-required-high-then-low").verdict).toBe("NO_PROVEN_BLOCKER");
    expect(completionOf("two-pickups-one-arc").verdict).toBe("NO_PROVEN_BLOCKER");
    expect(completionOf("gate-midair-jumpthrough").verdict).toBe("NO_PROVEN_BLOCKER");
    expect(completionOf("chest-midair-jumpthrough").verdict).toBe("NO_PROVEN_BLOCKER");
    expect(completionOf("chest-behind-wall-with-range").verdict).toBe("NO_PROVEN_BLOCKER");
  }, 20000);

  it("复位边是必需的：去掉 pit 里的 hazard，同一关从 NO_PROVEN 变成 no-walk", () => {
    const withHazard = completionOf("pit-chest-with-reset-hazard");
    expect(withHazard.verdict).toBe("NO_PROVEN_BLOCKER");

    const withoutHazard = cloneOf("pit-chest-with-reset-hazard");
    withoutHazard.entities = withoutHazard.entities.filter((e) => e.kind !== "hazard");
    const result = auditCompletion(withoutHazard, MANIFEST);
    expect(result.verdict).toBe("PROVEN_UNPLAYABLE");
    expect(judgmentsOf(result.evidence)).toContain(COMPLETION_JUDGMENTS.gateNotReachableAfterCollect);
  });

  it("chest 与 hazard 重叠：收集后复位、计数保留 ⇒ 不误报完成性", () => {
    // 该关的机制层另有 gate 阻断（见下方矩阵修正），完成性本身不报 chest 顺序问题。
    const result = completionOf("chest-overlapping-hazard");
    expect(judgmentsOf(result.evidence)).not.toContain(COMPLETION_JUDGMENTS.gateNotReachableAfterCollect);
  });
});

describe("§跨层根因抑制", () => {
  it("空间层已报 gate 不可达 ⇒ 完成性抑制（two-one-way-branches）", () => {
    const config = configOfCase("two-one-way-branches");
    const spatial = auditSpatial(config, MANIFEST);
    const completion = auditCompletion(config, MANIFEST, undefined, { spatial });
    expect(spatial.verdict).toBe("PROVEN_UNPLAYABLE");
    expect(spatial.evidence.some((e) => e.judgmentId === SPATIAL_JUDGMENTS.gateUnreachable)).toBe(true);
    expect(completion.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(completion.gaps.map((g) => g.missing)).toContain("suppressed-by-spatial-or-mechanic");
    expect(completion.evidence).toEqual([]);
  });

  it("机制层已报 gate 阻断 ⇒ 完成性抑制（chest-overlapping-hazard）", () => {
    const config = configOfCase("chest-overlapping-hazard");
    const mechanic = auditMechanic(config, MANIFEST);
    const completion = auditCompletion(config, MANIFEST, undefined, { mechanic });
    expect(mechanic.verdict).toBe("PROVEN_UNPLAYABLE");
    expect(mechanic.evidence.some((e) => e.judgmentId === MECHANIC_JUDGMENTS.pathBlocked && e.target === 'entity "gate"')).toBe(true);
    expect(completion.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(completion.gaps.map((g) => g.missing)).toContain("suppressed-by-spatial-or-mechanic");
  });

  it("空间层已报 chest blocked ⇒ 完成性抑制，不重复报 gate", () => {
    const config = fromFixture(SPATIAL_DOC, "chest-sealed-in-solid");
    const spatial = auditSpatial(config, MANIFEST);
    const completion = auditCompletion(config, MANIFEST, undefined, { spatial });
    expect(spatial.verdict).toBe("PROVEN_UNPLAYABLE");
    expect(spatial.evidence.some((e) => e.judgmentId === SPATIAL_JUDGMENTS.chestBlocked)).toBe(true);
    expect(completion.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(completion.gaps.map((g) => g.missing)).toContain("suppressed-by-spatial-or-mechanic");
  });

  it("机制层已报静止 hazard 封路 ⇒ 完成性抑制", () => {
    const config = fromFixture(MECHANIC_DOC, "static-hazard-seals-path");
    const mechanic = auditMechanic(config, MANIFEST);
    const completion = auditCompletion(config, MANIFEST, undefined, { mechanic });
    expect(mechanic.verdict).toBe("PROVEN_UNPLAYABLE");
    expect(completion.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(completion.gaps.map((g) => g.missing)).toContain("suppressed-by-spatial-or-mechanic");
  });
});

describe("§边界与证据不足", () => {
  it("k > 12 ⇒ k-over-limit gap，不硬拒", () => {
    const c = cloneOf("gate-midair-jumpthrough");
    for (let i = 0; i < 12; i++)
      c.entities.push({ id: `extra-${i}`, kind: "pickup", at: { x: 200 + i * 20, y: 250 }, asset: "pickup-suitcase" });
    // 原 config 已有 1 个 pickup ⇒ k = 13
    const result = auditCompletion(c, MANIFEST);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.gaps.map((g) => g.missing)).toContain("k-over-limit");
    expect(result.evidence).toEqual([]);
  });

  it("k = 0 ⇒ no-required-collectibles gap，不硬拒", () => {
    const c = cloneOf("gate-midair-jumpthrough");
    c.entities = c.entities.filter((e) => e.kind !== "pickup" && e.kind !== "chest");
    const result = auditCompletion(c, MANIFEST);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.gaps.map((g) => g.missing)).toContain("no-required-collectibles");
  });

  it("gate 缺失 ⇒ gate-missing gap，不重复报", () => {
    const c = cloneOf("gate-midair-jumpthrough");
    c.entities = c.entities.filter((e) => e.id !== c.objective.gate);
    const result = auditCompletion(c, MANIFEST);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.gaps.map((g) => g.missing)).toContain("gate-missing");
  });

  it("完成性 coverage：完成 / no-walk 都是 checked；证据不足是 partial", () => {
    expect(completionOf("order-required-high-then-low").coverage).toBe("checked");
    expect(completionOf("one-way-pit-pickup").coverage).toBe("checked");
    expect(completionOf("two-one-way-branches").coverage).toBe("partial");
  });
});
