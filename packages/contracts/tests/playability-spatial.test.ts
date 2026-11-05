// LP-02：空间可达性判据 —— 正例 / 反例 / 合法边界 / 39 例矩阵的空间类用例（生产化）。
//
// 矩阵来源：`level-playability-test-matrix/v1` 的 group=spatial；
// 生产夹具：`tests/fixtures/playability-matrix.json`（manifest 全用例共用一份）。
//
// ⚠️ `expectedVerdict` 是**层内**预期（plan R21(a)），不是整关 aggregate；
//   `coverage` 必须与 verdict 一起看：`NO_PROVEN_BLOCKER` 不代表「看全了」。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auditGameConfig, parseAssetPack, parseGameConfig } from "../src/index.js";
import type { GameConfig } from "../src/game-config.js";
import { auditSpatial, SPATIAL_JUDGMENTS, SPATIAL_NON_BLOCKING } from "../src/playability/spatial.js";
import { aggregateLayer } from "../src/playability/verdict.js";
import type { PlayabilityEvidence } from "../src/playability/verdict.js";

const FIXTURE = fileURLToPath(new URL("./fixtures/playability-matrix.json", import.meta.url));
const DOC = JSON.parse(readFileSync(FIXTURE, "utf8")) as {
  manifest: unknown;
  cases: {
    caseId: string;
    owner: "playability" | "auditGameConfig";
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
const spatialOf = (id: string) => auditSpatial(configOf(caseOf(id).config), MANIFEST);
const judgmentsOf = (evidence: readonly PlayabilityEvidence[]) => evidence.map((e) => e.judgmentId);

describe("§矩阵空间类用例（生产化）", () => {
  it("fixture 覆盖 23 个空间类用例，config / manifest 全部可解析", () => {
    expect(DOC.cases).toHaveLength(23);
    for (const c of DOC.cases) expect(() => configOf(c.config)).not.toThrow();
  });

  for (const c of DOC.cases) {
    if (c.owner !== "playability") continue;
    it(`${c.caseId} ⇒ 层内 ${c.expectedVerdict}`, () => {
      const result = spatialOf(c.caseId);
      expect(result.verdict).toBe(c.expectedVerdict);

      if (c.expectedJudgmentId) {
        expect(judgmentsOf(result.evidence)).toContain(c.expectedJudgmentId);
        if (c.failureLocation)
          expect(result.evidence.some((e) => e.judgmentId === c.expectedJudgmentId && e.target === c.failureLocation)).toBe(true);
      } else if (c.expectedGap) {
        // 证据不足的用例可以有**非阻断**证据（如 SPAWN_NO_FOOTHOLD），但绝不能有硬拒。
        expect(result.evidence.every((e) => SPATIAL_NON_BLOCKING.has(e.judgmentId))).toBe(true);
      } else {
        expect(result.evidence).toEqual([]);
      }
      if (c.expectedGap) expect(result.gaps.map((g) => g.missing)).toContain(c.expectedGap);

      // 同一目标只产一条 error：BLOCKED 与 UNREACHABLE 互斥。
      const targets = result.evidence.filter((e) => !SPATIAL_NON_BLOCKING.has(e.judgmentId)).map((e) => e.target);
      expect(new Set(targets).size).toBe(targets.length);

      // 层内 NO_PROVEN_BLOCKER 必须连带 partial coverage —— 不能把「没找到」说成「看全了」。
      if (c.expectedVerdict === "NO_PROVEN_BLOCKER") expect(result.coverage).toBe("partial");
    });
  }

  for (const c of DOC.cases) {
    if (c.owner !== "auditGameConfig") continue;
    it(`${c.caseId} ⇒ 归既有 auditGameConfig（层间边界）`, () => {
      const issues = auditGameConfig(configOf(c.config), MANIFEST).filter((i) => i.severity === "error");
      const spatial = spatialOf(c.caseId);
      // 空间层不重复报同一目标。
      expect(spatial.evidence.filter((e) => e.judgmentId.startsWith("PLAYABILITY_SPATIAL_"))).toEqual([]);
      if (c.expectedVerdict === "PROVEN_UNPLAYABLE") {
        expect(c.failureLocation).not.toBeNull();
        expect(issues.some((i) => i.where === c.failureLocation)).toBe(true);
      } else {
        expect(issues).toEqual([]);
      }
    });
  }
});

describe("§BLOCKED 与 UNREACHABLE 的根因分开", () => {
  it("目标完全埋进实心体 ⇒ *_BLOCKED，而不是 UNREACHABLE", () => {
    expect(judgmentsOf(spatialOf("goal-inside-luggage").evidence)).toContain(SPATIAL_JUDGMENTS.gateBlocked);
    expect(judgmentsOf(spatialOf("pickup-inside-luggage").evidence)).toContain(SPATIAL_JUDGMENTS.pickupBlocked);
    expect(judgmentsOf(spatialOf("chest-sealed-in-solid").evidence)).toContain(SPATIAL_JUDGMENTS.chestBlocked);
  });

  it("目标在坑对面的空腔里 ⇒ *_UNREACHABLE，而不是 BLOCKED", () => {
    const result = spatialOf("chest-in-pit");
    expect(judgmentsOf(result.evidence)).toEqual([SPATIAL_JUDGMENTS.chestUnreachable]);
    expect(result.evidence[0]?.witness.kind).toBe("no-path");
  });

  it("chest 的 range 四边外扩：range0 ⇒ BLOCKED，range30 ⇒ 合法边界", () => {
    expect(judgmentsOf(spatialOf("chest-inside-luggage-range0").evidence)).toEqual([SPATIAL_JUDGMENTS.chestBlocked]);
    expect(spatialOf("chest-inside-luggage-range30").evidence).toEqual([]);
  });

  it("chest-range-rescues：range 把 chest 从坑边救回来；同一关的 gate 确实在沟对面到不了", () => {
    // 矩阵用例的本意是「range 救回 chest」；生产层内 verdict 仍会因为 gate 不可达而硬拒。
    const result = spatialOf("chest-range-rescues");
    expect(judgmentsOf(result.evidence)).not.toContain(SPATIAL_JUDGMENTS.chestUnreachable);
    expect(judgmentsOf(result.evidence)).not.toContain(SPATIAL_JUDGMENTS.chestBlocked);
    expect(judgmentsOf(result.evidence)).toContain(SPATIAL_JUDGMENTS.gateUnreachable);
  });

  it("pickup 的 `body` 被 Runtime 忽略：按帧几何判，仍能抓到埋进实心体", () => {
    // p-body 声明了 200×200 的 body；运行时只看帧尺寸（16×16），所以它仍埋在行李堆里。
    expect(judgmentsOf(spatialOf("pickup-body-override-inside").evidence)).toContain(SPATIAL_JUDGMENTS.pickupBlocked);
  });
});

describe("§出生点：只诊断，不硬拒", () => {
  it("窄口径深埋 ⇒ INSUFFICIENT_EVIDENCE + SPAWN_IN_TERRAIN，绝不是 PROVEN_UNPLAYABLE", () => {
    const result = spatialOf("spawn-deep-terrain");
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(judgmentsOf(result.evidence)).toContain(SPATIAL_JUDGMENTS.spawnInTerrain);
  });

  it("合法锚点嵌入（last-train：at.y = 地面顶边）不触发诊断", () => {
    expect(judgmentsOf(spatialOf("baseline-last-train").evidence)).not.toContain(SPATIAL_JUDGMENTS.spawnInTerrain);
  });

  it("出生点附近没有落脚点 ⇒ coverage-gap，不产 error", () => {
    const result = spatialOf("spawn-no-foothold");
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.gaps.map((g) => g.missing)).toContain("spawn-no-foothold");
    expect(result.evidence.every((e) => SPATIAL_NON_BLOCKING.has(e.judgmentId))).toBe(true);
  });
});

describe("§证据不足与覆盖缺口", () => {
  it("玩家资源解不到 ⇒ 不建图、不产 error（归引用族）", () => {
    const config = configOf(caseOf("baseline-last-train").config);
    config.player.asset = "查无此资源";
    const result = auditSpatial(config, MANIFEST);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.gaps.map((g) => g.missing)).toContain("player-asset-missing");
    expect(result.evidence).toEqual([]);
  });

  it("gate 缺失 ⇒ coverage-gap，不硬拒", () => {
    const config = configOf(caseOf("baseline-last-train").config);
    config.entities = config.entities.filter((e) => e.id !== config.objective.gate);
    const result = auditSpatial(config, MANIFEST);
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.gaps.map((g) => g.missing)).toContain("gate-missing");
  });

  it("目标越界 ⇒ 不重复报（归 auditGameConfig.inWorld），只记 coverage-gap", () => {
    const result = spatialOf("target-out-of-world");
    expect(result.gaps.some((g) => g.missing === "target-out-of-world" && g.target === "signal")).toBe(true);
    expect(judgmentsOf(result.evidence)).not.toContain(SPATIAL_JUDGMENTS.gateUnreachable);
  });

  it("帧几何目标 ⇒ coverage partial（逐帧 atlas 不可见）", () => {
    expect(spatialOf("baseline-last-train").coverage).toBe("partial");
  });
});

describe("§合法复杂布局不被误杀", () => {
  it("低天花板走廊：walk 边让目标可达（旧 hop-only 模型的两条误报）", () => {
    expect(spatialOf("low-ceiling-walkable").evidence).toEqual([]);
  });

  it("moving solid 按静态原位：扫过区不再当实心（high-pickup 因此不可达才是真问题）", () => {
    const result = spatialOf("moving-solid-sweep");
    expect(judgmentsOf(result.evidence)).toEqual([SPATIAL_JUDGMENTS.pickupUnreachable]);
  });

  it("悬空终点：跳跃弧上碰到就算够到，不要求落地", () => {
    const config = configOf(caseOf("baseline-last-train").config);
    const gate = config.entities.find((e) => e.id === config.objective.gate)!;
    gate.at = { x: 700, y: 210 };
    expect(judgmentsOf(auditSpatial(config, MANIFEST).evidence)).not.toContain(SPATIAL_JUDGMENTS.gateUnreachable);
  });
});

describe("§verdict 聚合语义", () => {
  const evidence = (judgmentId: string): PlayabilityEvidence => ({
    judgmentId, target: "entity \"x\"", detail: "d",
    witness: { kind: "coverage-gap", missing: "x" },
    coverage: { spatial: "partial", mechanic: "not-checked", completion: "not-checked" },
  });

  it("阻断型 evidence 优先于诊断 / 缺口", () => {
    expect(aggregateLayer({
      coverage: "partial",
      evidence: [evidence(SPATIAL_JUDGMENTS.spawnInTerrain), evidence(SPATIAL_JUDGMENTS.pickupBlocked)],
      nonBlocking: SPATIAL_NON_BLOCKING,
      gaps: ["gate-missing"],
    })).toBe("PROVEN_UNPLAYABLE");
  });

  it("只有诊断 / 缺口 ⇒ INSUFFICIENT_EVIDENCE", () => {
    expect(aggregateLayer({
      coverage: "partial", evidence: [evidence(SPATIAL_JUDGMENTS.spawnInTerrain)], nonBlocking: SPATIAL_NON_BLOCKING,
    })).toBe("INSUFFICIENT_EVIDENCE");
    expect(aggregateLayer({ coverage: "partial", evidence: [], gaps: ["player-asset-missing"] }))
      .toBe("INSUFFICIENT_EVIDENCE");
  });

  it("什么都没有 ⇒ NO_PROVEN_BLOCKER（coverage 仍单独记录 partial）", () => {
    expect(aggregateLayer({ coverage: "partial", evidence: [] })).toBe("NO_PROVEN_BLOCKER");
  });
});
