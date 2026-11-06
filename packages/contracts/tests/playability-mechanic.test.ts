// LP-03：机制可通行性判据 —— 39 例矩阵的机制类用例（生产化）+ 正例 / 反例 / 合法边界。
//
// ⚠️ `expectedVerdict` 是**层内**预期（plan R21(a)），不是整关 aggregate。
//   证据不足的用例用 `gaps` 表达；`coverage.mechanic` 单独记录看得有多全。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseGameConfig } from "../src/index.js";
import type { GameConfig, GameEntity } from "../src/game-config.js";
import { auditMechanic, MECHANIC_JUDGMENTS } from "../src/playability/mechanic.js";
import type { PlayabilityEvidence } from "../src/playability/verdict.js";

const FIXTURE = fileURLToPath(new URL("./fixtures/playability-mechanic-matrix.json", import.meta.url));
const DOC = JSON.parse(readFileSync(FIXTURE, "utf8")) as {
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
const mechanicOf = (id: string) => auditMechanic(configOf(caseOf(id).config), MANIFEST);
const cloneOf = (id: string): GameConfig => structuredClone(configOf(caseOf(id).config));
const judgmentsOf = (evidence: readonly PlayabilityEvidence[]) => evidence.map((e) => e.judgmentId);
const entityOf = (c: GameConfig, id: string): GameEntity => {
  const e = c.entities.find((x) => x.id === id);
  if (!e) throw new Error(`config 里没有实体 ${id}`);
  return e;
};
const fullHeightDanger = (id = "laser", at = { x: 800, y: 250 }): GameEntity => ({
  id, kind: "danger", at, asset: "hazard-sweeping-carriage",
  body: { w: 64, h: 270 }, strike: { periodMs: 300, activeMs: 300 },
});

describe("§矩阵机制类用例（生产化）", () => {
  it("fixture 覆盖 6 个机制类用例，config / manifest 全部可解析", () => {
    expect(DOC.cases).toHaveLength(6);
    for (const c of DOC.cases) expect(() => configOf(c.config)).not.toThrow();
  });

  for (const c of DOC.cases) {
    it(`${c.caseId} ⇒ 层内 ${c.expectedVerdict}`, () => {
      const result = mechanicOf(c.caseId);
      expect(result.verdict).toBe(c.expectedVerdict);

      if (c.expectedJudgmentId) {
        expect(judgmentsOf(result.evidence)).toContain(c.expectedJudgmentId);
        if (c.failureLocation)
          expect(result.evidence.some((e) => e.judgmentId === c.expectedJudgmentId && e.target === c.failureLocation)).toBe(true);
      } else {
        expect(result.evidence).toEqual([]);
      }
      if (c.expectedGap) expect(result.gaps.map((g) => g.missing)).toContain(c.expectedGap);

      // 同一目标只产一条 error（A/B 去重）。
      const targets = result.evidence.map((e) => e.target);
      expect(new Set(targets).size).toBe(targets.length);

      if (c.expectedVerdict === "INSUFFICIENT_EVIDENCE") expect(result.coverage).toBe("partial");
    });
  }

  it("被 hazard 包住的 pickup 不被硬拒，但同一 hazard 后面的目标仍可被 A 证明", () => {
    const result = mechanicOf("pickup-in-static-hazard");
    expect(result.gaps).toContainEqual({ missing: "target-inside-hazard", target: "suitcase-2" });
    expect(result.evidence.some((e) => e.target === 'entity "suitcase-2"')).toBe(false);
    expect(result.evidence.some((e) => e.judgmentId === MECHANIC_JUDGMENTS.pathBlocked && e.target === 'entity "suitcase-3"')).toBe(true);
  });
});

describe("§A：静止 hazard 封路（反事实）", () => {
  it("可跳过的静止 hazard 不报（合法边界）", () => {
    const c = cloneOf("static-hazard-seals-path");
    // 16×16 的 hazard：玩家滞空可以越过（研究矩阵的 64×48 才封死）。
    const hazard = entityOf(c, "carriage");
    hazard.asset = "pickup-suitcase";
    const result = auditMechanic(c, MANIFEST);
    expect(judgmentsOf(result.evidence)).not.toContain(MECHANIC_JUDGMENTS.pathBlocked);
    expect(result.verdict).toBe("NO_PROVEN_BLOCKER");
    expect(result.coverage).toBe("partial");   // hazard 帧几何不可复核
  });

  it("witness 可机检：列出 blocker 与反事实", () => {
    const evidence = mechanicOf("static-hazard-seals-path").evidence.find((e) => e.target === 'entity "suitcase-3"')!;
    expect(evidence.witness.kind).toBe("blocked");
    if (evidence.witness.kind === "blocked") {
      expect(evidence.witness.blockers?.map((b) => b.id)).toContain("carriage");
      expect(evidence.witness.rect).toEqual({ x: 768, y: 202, w: 64, h: 48 });
    }
    expect(evidence.expected).toContain("without static hazards: reachable");
  });

  it("出生点在静止 hazard 里 ⇒ 只记 gap，不报 A", () => {
    const c = cloneOf("static-hazard-seals-path");
    entityOf(c, "carriage").at = { x: 40, y: 250 };
    const result = auditMechanic(c, MANIFEST);
    expect(result.gaps.map((g) => g.missing)).toContain("spawn-in-hazard");
    expect(judgmentsOf(result.evidence)).not.toContain(MECHANIC_JUDGMENTS.pathBlocked);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("hazard 的 `body` 被 Runtime 忽略：按帧几何（16×16）判，不用 200×200 body", () => {
    const c = cloneOf("static-hazard-seals-path");
    const hazard = entityOf(c, "carriage");
    hazard.asset = "pickup-suitcase";
    hazard.body = { w: 200, h: 200 };
    c.entities.push({ id: "near-body-edge", kind: "pickup", at: { x: 740, y: 250 }, asset: "pickup-suitcase" });
    const result = auditMechanic(c, MANIFEST);
    expect(result.gaps.some((g) => g.missing === "target-inside-hazard" && g.target === "near-body-edge")).toBe(false);
  });

  it("巡逻 hazard ⇒ moving-hazard-phase gap，不报 A", () => {
    const result = mechanicOf("wide-patrol");
    expect(result.gaps.map((g) => g.missing)).toContain("moving-hazard-phase");
    expect(result.evidence).toEqual([]);
  });
});

describe("§B：全高 danger 安全窗口", () => {
  it("全高 + 窄 idle ⇒ PATH_NO_SAFE_WINDOW，witness 带 idle/required", () => {
    const result = mechanicOf("danger-full-wall");
    const evidence = result.evidence.find((e) => e.target === 'entity "suitcase-3"')!;
    expect(evidence.judgmentId).toBe(MECHANIC_JUDGMENTS.pathNoSafeWindow);
    expect(evidence.witness.kind).toBe("no-safe-window");
    if (evidence.witness.kind === "no-safe-window") {
      expect(evidence.witness.idleMs).toBe(300);
      expect(evidence.witness.requiredMs).toBeCloseTo(((64 + 32) / 90) * 1000, 5);
      expect(evidence.witness.fullColumnCut).toBe(true);
    }
  });

  it("宽 idle ⇒ 不报（合法边界）", () => {
    const result = mechanicOf("danger-wide-idle");
    expect(result.verdict).toBe("NO_PROVEN_BLOCKER");
    expect(result.evidence).toEqual([]);
    expect(result.coverage).toBe("checked");
  });

  it("非全高 danger（16×16，可跳过）⇒ 不报 B，记 non-full-column gap", () => {
    const c = cloneOf("danger-full-wall");
    const danger = entityOf(c, "laser");
    danger.body = { w: 16, h: 16 };
    const result = auditMechanic(c, MANIFEST);
    expect(judgmentsOf(result.evidence)).not.toContain(MECHANIC_JUDGMENTS.pathNoSafeWindow);
    expect(result.gaps.map((g) => g.missing)).toContain("non-full-column-danger");
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("目标都在近侧 ⇒ 不需要穿越，不报", () => {
    const c = cloneOf("danger-full-wall");
    c.entities = c.entities.filter((e) => e.id !== "suitcase-3");
    entityOf(c, "suitcase-2").at = { x: 300, y: 250 };
    entityOf(c, "signal").at = { x: 200, y: 250 };
    const result = auditMechanic(c, MANIFEST);
    expect(result.verdict).toBe("NO_PROVEN_BLOCKER");
    expect(result.evidence).toEqual([]);
  });

  it("出生点在 danger 里 ⇒ gap，不报", () => {
    const c = cloneOf("danger-full-wall");
    entityOf(c, "laser").at = { x: 40, y: 250 };
    const result = auditMechanic(c, MANIFEST);
    expect(result.gaps.map((g) => g.missing)).toContain("spawn-in-danger");
    expect(result.evidence).toEqual([]);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("目标被 danger 包住 ⇒ gap，不硬拒", () => {
    const c = cloneOf("danger-full-wall");
    c.entities = c.entities.filter((e) => e.id !== "suitcase-3");
    entityOf(c, "suitcase-2").at = { x: 800, y: 250 };   // 与 laser 盒相交
    entityOf(c, "signal").at = { x: 200, y: 250 };
    const result = auditMechanic(c, MANIFEST);
    expect(result.gaps).toContainEqual({ missing: "target-inside-danger", target: "suitcase-2" });
    expect(result.evidence).toEqual([]);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("多个 danger ⇒ multiple-dangers-unproven，不报", () => {
    const c = cloneOf("danger-full-wall");
    c.entities.push(fullHeightDanger("laser-2", { x: 1000, y: 250 }));
    const result = auditMechanic(c, MANIFEST);
    expect(result.gaps.map((g) => g.missing)).toContain("multiple-dangers-unproven");
    expect(result.evidence).toEqual([]);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("requiredMs 落在 idle + 1 帧边界内 ⇒ gap，不报", () => {
    const c = cloneOf("danger-full-wall");
    const danger = entityOf(c, "laser");
    danger.strike = { periodMs: 1060, activeMs: 300 };   // 1066.7 在 (1060, 1076.7]
    const result = auditMechanic(c, MANIFEST);
    expect(result.gaps.map((g) => g.missing)).toContain("danger-window-frame-boundary");
    expect(result.evidence).toEqual([]);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("§A/B 去重", () => {
  it("同一目标被 A/B 同时证明 ⇒ 只留一条（A 优先），另一条并入 detail", () => {
    const c = cloneOf("static-hazard-seals-path");
    c.entities.push(fullHeightDanger("laser", { x: 1000, y: 250 }));
    const result = auditMechanic(c, MANIFEST);
    for (const target of ['entity "suitcase-3"', 'entity "signal"']) {
      const matches = result.evidence.filter((e) => e.target === target);
      expect(matches).toHaveLength(1);
      expect(matches[0]!.judgmentId).toBe(MECHANIC_JUDGMENTS.pathBlocked);
      expect(matches[0]!.detail).toContain("另有");
    }
  });
});

describe("§coverage 与证据不足", () => {
  it("只有 danger 且 B 有结论 ⇒ mechanic checked", () => {
    expect(mechanicOf("danger-full-wall").coverage).toBe("checked");
    expect(mechanicOf("danger-wide-idle").coverage).toBe("checked");
  });

  it("moving-platform ⇒ moving-platform-unsupported gap", () => {
    const result = mechanicOf("moving-platform");
    expect(result.gaps.map((g) => g.missing)).toContain("moving-platform-unsupported");
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("无机制实体 ⇒ checked / NO_PROVEN_BLOCKER", () => {
    const c = cloneOf("static-hazard-seals-path");
    c.entities = c.entities.filter((e) => e.kind !== "hazard");
    const result = auditMechanic(c, MANIFEST);
    expect(result.coverage).toBe("checked");
    expect(result.verdict).toBe("NO_PROVEN_BLOCKER");
  });
});
