// 机制覆盖报告 v2（票 07 / P0-02 v2 票 02）：四层矩阵（设计 / 运行时 / config / QA）+ 门禁。
//
// ⚠️ 判的是**机制级**的端到端齐不齐，不是 `qa.ts` 那六条产物级判据（票 06 裁定：不做第 7 判据）。
import { describe, expect, it } from "vitest";
import {
  buildMechanicCoverage, mechanicCoverageProblem,
  MECHANIC_COVERAGE_STATUSES, MechanicCoverageReportSchema,
  type GameConfig, type GameDesignSpec, type ProbeResult,
} from "../src/index.js";

/** `buildMechanicCoverage` 只读 `design.mechanics`、`config.{terrain,entities,objective}`。 */
const design = (mechanics: { id: string; mechanic: string }[]): GameDesignSpec =>
  ({ mechanics }) as GameDesignSpec;

const config = (over: Partial<Record<string, unknown>> = {}): GameConfig => ({
  entities: [
    { id: "p1", kind: "pickup", at: { x: 200, y: 240 } },
    { id: "c1", kind: "chest", at: { x: 300, y: 240 } },
    { id: "h1", kind: "hazard", at: { x: 340, y: 240 }, motion: { kind: "cycle", axis: "x", distance: 100, periodMs: 3000 } },
    { id: "g1", kind: "goal", at: { x: 440, y: 230 } },
    { id: "s1", kind: "solid", at: { x: 0, y: 250 }, box: { w: 480, h: 20 } },
  ],
  terrain: [{ x: 0, y: 250, w: 480, h: 20 }],
  objective: { kind: "collect-then-reach", gate: "g1" },
  ...over,
}) as unknown as GameConfig;

const report = (mechanics: string[], cfg: GameConfig = config(), probeResults?: ProbeResult[]) =>
  buildMechanicCoverage(design(mechanics.map((m, i) => ({ id: `m-${i}`, mechanic: m }))), cfg, probeResults);

const subject = {
  packId: "fixture", packVersion: 1, siteVersion: 1, shellVersion: "2",
  manifestChecksum: `sha256:${"a".repeat(64)}`, configChecksum: `sha256:${"b".repeat(64)}`,
};

describe("四层矩阵：设计 / 运行时 / config / QA 各自成格", () => {
  it("open-chest / avoid-danger：四层全 satisfied（有 probe 结果）⇒ verdict satisfied", () => {
    const r = report(["open-chest", "avoid-danger"], config(), [
      { mechanic: "open-chest", passed: true },
      { mechanic: "avoid-danger", passed: true },
    ]);
    expect(r.verdict).toBe("satisfied");
    for (const m of r.mechanics) {
      expect(m.design).toBe("satisfied");
      expect(m.runtime).toBe("satisfied");
      expect(m.config.status).toBe("satisfied");
      expect(m.qa).toBe("satisfied");
    }
    expect(r.probe.executed).toBe(true);
    expect(mechanicCoverageProblem(r)).toBeUndefined();
  });

  it("不传 probeResults ⇒ qa=not-tested、probe.executed=false；绝不默认 passed", () => {
    const r = report(["collect-pickup", "open-chest", "avoid-danger"]);
    expect(r.probe.executed).toBe(false);
    expect(r.probe.results).toEqual([]);
    expect(r.mechanics.every((m) => m.qa === "not-tested")).toBe(true);
    // not-tested 不阻断：config 满足时 verdict 仍是 satisfied
    expect(r.verdict).toBe("satisfied");
    expect(mechanicCoverageProblem(r)).toBeUndefined();
  });

  it("传入 probeResults 但声明的受 probe 机制缺结果 ⇒ qa=failed、verdict failed", () => {
    const r = report(["avoid-danger"], config(), [{ mechanic: "collect-pickup", passed: true }]);
    expect(r.probe.executed).toBe(true);
    expect(r.mechanics[0]!.qa).toBe("failed");
    expect(r.verdict).toBe("failed");
    expect(mechanicCoverageProblem(r)).toContain("QA 层 failed");
  });

  it("probe 结果 passed=false ⇒ qa=failed", () => {
    const r = report(["open-chest"], config(), [{ mechanic: "open-chest", passed: false }]);
    expect(r.mechanics[0]!.qa).toBe("failed");
    expect(r.verdict).toBe("failed");
  });

  it("声明 avoid-danger 但 config 无 danger/hazard ⇒ config missing、verdict failed、门禁点名", () => {
    const r = report(["avoid-danger"], config({ entities: [{ id: "p1", kind: "pickup", at: { x: 200, y: 240 } }] }));
    const m = r.mechanics[0]!;
    expect(m.config.status).toBe("missing");
    expect(m.config.requiredEntityKinds).toEqual(["danger", "hazard"]);
    expect(m.config.found).toEqual({ danger: 0, hazard: 0 });
    expect(r.verdict).toBe("failed");
    expect(mechanicCoverageProblem(r)).toContain("config 层缺 danger / hazard");
  });

  it("avoid-danger 只有 hazard 没有 danger ⇒ config satisfied（运行时两者同一条 hitHazard）", () => {
    const r = report(["avoid-danger"]);
    const m = r.mechanics[0]!;
    expect(m.config.status).toBe("satisfied");
    expect(m.config.found).toEqual({ danger: 0, hazard: 1 });
  });

  it("collect-pickup / open-chest 的 config 要求分别是 pickup / chest", () => {
    const noPickup = report(["collect-pickup"], config({ entities: [{ id: "c1", kind: "chest", at: { x: 300, y: 240 } }] }));
    expect(noPickup.mechanics[0]!.config.status).toBe("missing");
    expect(noPickup.mechanics[0]!.config.requiredEntityKinds).toEqual(["pickup"]);

    const noChest = report(["open-chest"], config({ entities: [{ id: "p1", kind: "pickup", at: { x: 200, y: 240 } }] }));
    expect(noChest.mechanics[0]!.config.status).toBe("missing");
    expect(noChest.mechanics[0]!.config.requiredEntityKinds).toEqual(["chest"]);
  });

  it("collide-terrain / moving-platform / reach-goal 的 config token", () => {
    const terrain = report(["collide-terrain"], config({ terrain: [] }));
    expect(terrain.mechanics[0]!.config.status).toBe("missing");
    expect(terrain.mechanics[0]!.config.requiredEntityKinds).toEqual(["terrain"]);

    const motion = report(["moving-platform"], config({ entities: [{ id: "s1", kind: "solid", at: { x: 0, y: 250 } }] }));
    expect(motion.mechanics[0]!.config.status).toBe("missing");
    expect(motion.mechanics[0]!.config.requiredEntityKinds).toEqual(["motion:cycle"]);

    const goal = report(["reach-goal"], config({ objective: { kind: "collect-then-reach", gate: "g1" } }));
    expect(goal.mechanics[0]!.config.status).toBe("satisfied");
    expect(goal.mechanics[0]!.config.requiredEntityKinds).toEqual(["goal", "objective:collect-then-reach"]);
  });

  it("`moving-platform`（experimental + 无运行时 + 无 motion）⇒ 三层可阻断状态，门禁逐格点名", () => {
    const r = report(["moving-platform"], config({ entities: [{ id: "s1", kind: "solid", at: { x: 0, y: 250 } }] }));
    expect(r.verdict).toBe("failed");
    const m = r.mechanics[0]!;
    expect(m.design).toBe("unsupported");
    expect(m.runtime).toBe("unsupported");
    expect(m.config.status).toBe("missing");
    expect(m.qa).toBe("not-tested");
    const problem = mechanicCoverageProblem(r)!;
    expect(problem).toContain("moving-platform");
    expect(problem).toContain("设计层 unsupported");
    expect(problem).toContain("运行时层 unsupported");
    expect(problem).toContain("config 层缺 motion:cycle");
    expect(problem).not.toContain("QA 层 not-tested");
  });

  it("run / jump / gravity 无实体要求 ⇒ config satisfied（空要求）", () => {
    const r = report(["run", "jump", "gravity"], config({ entities: [], terrain: [] }));
    for (const m of r.mechanics) {
      expect(m.config.status).toBe("satisfied");
      expect(m.config.requiredEntityKinds).toEqual([]);
      expect(m.config.found).toEqual({});
    }
    expect(r.verdict).toBe("satisfied");
  });
});

describe("形状：报告过自己的契约", () => {
  it("状态枚举是封闭的五态；核心 + subject 过 `mechanic-coverage/v2`", () => {
    expect(MECHANIC_COVERAGE_STATUSES).toEqual(["satisfied", "missing", "unsupported", "not-tested", "failed"]);
    const core = report(["open-chest"], config(), [{ mechanic: "open-chest", passed: true }]);
    expect(MechanicCoverageReportSchema.safeParse({ ...core, subject }).success).toBe(true);
    expect(core.format).toBe("mechanic-coverage/v2");
  });

  it("缺 subject ⇒ 不过 v2 报告 schema", () => {
    const core = report(["open-chest"]);
    expect(MechanicCoverageReportSchema.safeParse(core).success).toBe(false);
  });

  it("单条机制门禁失败不被总体通过掩盖", () => {
    const r = report(["open-chest", "moving-platform"], config(), [{ mechanic: "open-chest", passed: true }]);
    expect(r.mechanics.map((m) => m.design)).toEqual(["satisfied", "unsupported"]);
    expect(r.verdict).toBe("failed");
    expect(mechanicCoverageProblem(r)).toContain("moving-platform");
  });
});
