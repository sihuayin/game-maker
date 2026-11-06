// LP-05：统一入口 `auditPlayability` / `playabilityIssues` —— 三层组合、去重、issue 映射。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseGameConfig } from "../src/index.js";
import type { GameConfig } from "../src/game-config.js";
import { auditPlayability, playabilityIssues } from "../src/playability/api.js";
import { auditSpatial } from "../src/playability/spatial.js";
import { auditMechanic } from "../src/playability/mechanic.js";
import { auditCompletion } from "../src/playability/completion.js";

const readJson = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8"));
const COMPLETION = readJson("playability-completion-matrix.json") as {
  manifest: unknown;
  cases: { caseId: string; config: unknown }[];
};
const SPATIAL = readJson("playability-matrix.json") as { cases: { caseId: string; config: unknown }[] };
const MECHANIC = readJson("playability-mechanic-matrix.json") as { cases: { caseId: string; config: unknown }[] };

const MANIFEST = (() => {
  const parsed = parseAssetPack(COMPLETION.manifest);
  if (!parsed.ok) throw new Error("fixture manifest：" + parsed.errors.join("；"));
  return parsed.value;
})();
const configOf = (raw: unknown): GameConfig => {
  const parsed = parseGameConfig(raw);
  if (!parsed.ok) throw new Error("fixture config：" + parsed.errors.join("；"));
  return parsed.value;
};
const caseOf = (doc: { cases: { caseId: string; config: unknown }[] }, id: string): GameConfig => {
  const c = doc.cases.find((x) => x.caseId === id);
  if (!c) throw new Error(`fixture 里没有 ${id}`);
  return configOf(c.config);
};
const apiOf = (id: string) => {
  const doc = COMPLETION.cases.some((c) => c.caseId === id) ? COMPLETION : SPATIAL.cases.some((c) => c.caseId === id) ? SPATIAL : MECHANIC;
  return auditPlayability(caseOf(doc, id), MANIFEST);
};
const issueOf = (id: string) => playabilityIssues(apiOf(id));

describe("§整关三态与 issue 映射", () => {
  it("无阻断：层 verdict 组合为 NO_PROVEN，coverage.spatial 仍诚实记 partial", () => {
    const verdict = apiOf("gate-midair-jumpthrough");
    expect(verdict.verdict).toBe("NO_PROVEN_BLOCKER");
    expect(verdict.coverage.spatial).toBe("partial");
    expect(playabilityIssues(verdict)).toEqual([]);
  });

  it("空间阻断：PROVEN，一条 error / 目标，不带 code", () => {
    const issues = issueOf("chest-sealed-in-solid");
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.severity).toBe("error");
      expect(i.code).toBeUndefined();
      expect(i.where).toMatch(/^entity "/);
    }
  });

  it("机制阻断：PROVEN，静止 hazard 的 message 进 issue", () => {
    const issues = issueOf("static-hazard-seals-path");
    expect(issues.some((i) => i.where === 'entity "signal"' && i.message.includes("静止 hazard"))).toBe(true);
    for (const i of issues) expect(i.code).toBeUndefined();
  });

  it("完成性阻断：PROVEN，target 是 gate", () => {
    const issues = issueOf("one-way-pit-pickup");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.where).toBe('entity "gate"');
    expect(issues[0]!.message).toContain("收齐后到达终点");
    expect(issues[0]!.code).toBeUndefined();
  });

  it("跨层去重：chest-overlapping-hazard 只留一条 gate error（机制优先）", () => {
    const issues = issueOf("chest-overlapping-hazard");
    const gate = issues.filter((i) => i.where === 'entity "gate"');
    expect(gate).toHaveLength(1);
    expect(gate[0]!.message).toContain("静止 hazard");
  });

  it("非阻断诊断（SPAWN_IN_TERRAIN）不产 issue", () => {
    const verdict = apiOf("spawn-deep-terrain");
    expect(verdict.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(playabilityIssues(verdict)).toEqual([]);
  });

  it("`playabilityIssues` 只由 PROVEN 派生：NO_PROVEN / INSUFFICIENT 一律空", () => {
    for (const id of ["gate-midair-jumpthrough", "spawn-deep-terrain"]) {
      const v = apiOf(id);
      expect(v.verdict).not.toBe("PROVEN_UNPLAYABLE");
      expect(playabilityIssues(v)).toEqual([]);
    }
  });
});

describe("§三层组合与 coverage", () => {
  it("组合结果包含三个维度的 coverage", () => {
    const v = apiOf("static-hazard-seals-path");
    expect(v.coverage).toHaveProperty("spatial");
    expect(v.coverage).toHaveProperty("mechanic");
    expect(v.coverage).toHaveProperty("completion");
    expect(v.verdict).toBe("PROVEN_UNPLAYABLE");
  });

  it("completion 复用 spatial/mechanic：直接调用三层与统一入口的阻断集合一致", () => {
    const config = caseOf(SPATIAL, "goal-inside-luggage");
    const spatial = auditSpatial(config, MANIFEST);
    const mechanic = auditMechanic(config, MANIFEST);
    const completion = auditCompletion(config, MANIFEST, undefined, { spatial, mechanic });
    const direct = [...spatial.evidence, ...mechanic.evidence, ...completion.evidence]
      .map((e) => e.target).sort();
    const api = apiOf("goal-inside-luggage").evidence.map((e) => e.target).sort();
    expect(new Set(api)).toEqual(new Set(direct));
  });
});
