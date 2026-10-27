import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadScenarios } from "../runner.mjs";

const VALID = {
  formatVersion: "playtest-scenario/v1", id: "success-basic", version: 1, required: true,
  expectedOutcome: "SUCCESS", baselineEligible: true, target: { siteVersion: 1 },
  harnessCondition: "none", setup: { kind: "none" },
  actions: [{ kind: "move_to", target: { kind: "gate" } }],
  assertions: [{ id: "won", kind: "state", requires: ["won"], expect: { kind: "state", path: "won", op: "eq", value: true }, withinMs: 1000, onInsufficient: "unknown" }],
  termination: { kind: "won" }, timeoutMs: 1000, pollIntervalMs: 50, stepDelayMs: 35,
  comparableEvents: ["win"],
};

const dirs = [];
function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "playtest-scenarios-"));
  dirs.push(d);
  return d;
}
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
const write = (dir, name, obj) => fs.writeFileSync(path.join(dir, name), JSON.stringify(obj, null, 2));

describe("场景加载与版本绑定（票 02 Q3）", () => {
  it("接受 v1 且 site 版本匹配的场景", () => {
    const d = tmpDir();
    write(d, "success-basic.json", VALID);
    const r = loadScenarios({ scenarioDir: d, target: { siteVersion: 1 } });
    expect(r.scenarios).toHaveLength(1);
    expect(r.scenarios[0].scenario.id).toBe("success-basic");
    expect(r.rejections).toHaveLength(0);
  });

  it("拒绝未知场景格式版本（不降级、不静默）", () => {
    const d = tmpDir();
    write(d, "v2.json", { ...VALID, id: "v2", formatVersion: "playtest-scenario/v2" });
    const r = loadScenarios({ scenarioDir: d, target: { siteVersion: 1 } });
    expect(r.scenarios).toHaveLength(0);
    expect(r.rejections[0].reason).toContain("不支持的场景格式版本");
  });

  it("拒绝 target site 版本不匹配", () => {
    const d = tmpDir();
    write(d, "mismatch.json", { ...VALID, target: { siteVersion: 99 } });
    const r = loadScenarios({ scenarioDir: d, target: { siteVersion: 1 } });
    expect(r.scenarios).toHaveLength(0);
    expect(r.rejections[0].reason).toContain("不匹配");
  });

  it("拒绝 schema 不合法（缺断言）", () => {
    const d = tmpDir();
    write(d, "bad.json", { ...VALID, assertions: [] });
    const r = loadScenarios({ scenarioDir: d, target: { siteVersion: 1 } });
    expect(r.scenarios).toHaveLength(0);
    expect(r.rejections[0].reason).toContain("schema");
  });
});
