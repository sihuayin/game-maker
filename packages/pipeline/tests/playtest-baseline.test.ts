import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PLAYTEST_HARNESS_VERSION, PLAYTEST_REPORT_VERSION, PLAYTEST_RULES_VERSION, PLAYTEST_SCENARIO_VERSION,
  PlaytestBaselineSchema, aggregateAssertions, type PlaytestReport, type PlaytestScenarioReport,
} from "@game-maker/contracts";
import { promotePlaytestBaseline } from "../src/playtest-baseline.js";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "playtest-baseline-")); dirs.push(d); return d; };

function scenario(over: Partial<PlaytestScenarioReport> = {}): PlaytestScenarioReport {
  const assertions = over.assertions ?? [{ id: "won", kind: "state" as const, requires: ["won"], result: "pass" as const, observed: true, expect: { kind: "state", path: "won", op: "eq", value: true }, withinMs: 1000, evidence: [] }];
  return {
    scenarioId: "success-basic", scenarioVersion: 1, required: true, harnessCondition: "none",
    expectedOutcome: "SUCCESS", baselineEligible: true, execution: "executed", terminationReached: true,
    assertions, assertionAggregate: aggregateAssertions(assertions),
    endState: { collected: 6, won: true, hits: 0, chestsOpened: 2, activePickups: 0, playerX: 1380 },
    initialState: { collected: 0, won: false, hits: 0, chestsOpened: 0, activePickups: 4, playerX: 40 },
    actions: [], comparableEvents: ["pickup", "win"], eventCounts: { pickup: 6, win: 1, "runtime-error": 0 },
    evidence: ["playtest-events"], ...over,
  };
}
function report(over: Partial<PlaytestReport> = {}): PlaytestReport {
  return {
    reportVersion: PLAYTEST_REPORT_VERSION,
    identity: { scenarioFormatVersion: PLAYTEST_SCENARIO_VERSION, siteVersion: 1, packId: "g", packVersion: 1, shellVersion: "2", harnessVersion: PLAYTEST_HARNESS_VERSION, rulesVersion: PLAYTEST_RULES_VERSION },
    command: "node playtest.mjs", exitCode: 0, startedAt: "2026-10-27T00:00:00.000Z", finishedAt: "2026-10-27T00:00:05.000Z",
    execution: "executed", scenarios: [scenario({ outcome: "SUCCESS" })], aggregate: "SUCCESS",
    runtime: { pollIntervalMs: 50, stepDelayMs: 35, scenarioTimeoutMs: 45000, viewport: { w: 1000, h: 600 }, deviceScaleFactor: 1, chromeFlags: [] },
    evidence: ["playtest-events"], ...over,
  };
}
const writeReport = (dir: string, name: string, r: PlaytestReport) => {
  const p = path.join(dir, name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(r, null, 2) + "\n");
  return p;
};
const COVERAGE = { assertions: ["won"], endState: ["collected" as const], events: ["pickup" as const] };
const promote = (root: string, reports: [string, string], over: Record<string, unknown> = {}) => promotePlaytestBaseline({
  baselineDir: path.join(root, "baselines"), baselineId: "success-basic", scenarioId: "success-basic",
  reportPaths: reports, coverage: COVERAGE, reason: "接受当前行为", promotedBy: "human", ...over,
});

describe("promotePlaytestBaseline（显式、可审计）", () => {
  it("两次干净运行一致 ⇒ 写 baseline.json，含来源审计", () => {
    const root = tmp();
    const a = writeReport(root, "g/run/v1/playtest/v1/result.json", report());
    const b = writeReport(root, "g/run/v1/playtest/v2/result.json", report());
    const baseline = promote(root, [a, b]);
    const file = path.join(root, "baselines/success-basic/baseline.json");
    expect(fs.existsSync(file)).toBe(true);
    const parsed = PlaytestBaselineSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    expect(parsed.expected.outcome).toBe("SUCCESS");
    expect(parsed.source.promotedBy).toBe("human");
    expect(parsed.source.reason).toContain("接受");
    expect(parsed.source.reportChecksum).toMatch(/^sha256:/);
    expect(baseline.baselineId).toBe("success-basic");
  });

  it("身份不一致 ⇒ 拒绝", () => {
    const root = tmp();
    const a = writeReport(root, "g/run/v1/playtest/v1/result.json", report());
    const b = writeReport(root, "g/run/v1/playtest/v2/result.json", report({ identity: { ...report().identity, siteVersion: 2 } }));
    expect(() => promote(root, [a, b])).toThrow(/身份/);
  });

  it("覆盖字段不稳定 ⇒ 拒绝（不放宽阈值）", () => {
    const root = tmp();
    const a = writeReport(root, "g/run/v1/playtest/v1/result.json", report());
    const b = writeReport(root, "g/run/v1/playtest/v2/result.json", report({ scenarios: [scenario({ outcome: "SUCCESS", endState: { collected: 5, won: true, hits: 0, chestsOpened: 2, activePickups: 0, playerX: 1380 } })] }));
    expect(() => promote(root, [a, b])).toThrow(/投影不一致/);
  });

  it("UNKNOWN / 未归因运行错误 ⇒ 不是干净运行", () => {
    const root = tmp();
    const a = writeReport(root, "g/run/v1/playtest/v1/result.json", report());
    const b = writeReport(root, "g/run/v1/playtest/v2/result.json", report({ scenarios: [scenario({ outcome: "UNKNOWN", assertionAggregate: "unknown" })] }));
    expect(() => promote(root, [a, b])).toThrow(/UNKNOWN|干净/);
    const c = writeReport(root, "g/run/v1/playtest/v3/result.json", report({ scenarios: [scenario({ outcome: "SUCCESS", eventCounts: { pickup: 6, win: 1, "runtime-error": 1 } })] }));
    expect(() => promote(root, [a, c])).toThrow(/runtime-error/);
  });

  it("已存在默认拒绝；--replace 显式覆盖", () => {
    const root = tmp();
    const a = writeReport(root, "g/run/v1/playtest/v1/result.json", report());
    const b = writeReport(root, "g/run/v1/playtest/v2/result.json", report());
    promote(root, [a, b]);
    expect(() => promote(root, [a, b])).toThrow(/已存在/);
    expect(() => promote(root, [a, b], { replace: true, reason: "重定" })).not.toThrow();
    const parsed = PlaytestBaselineSchema.parse(JSON.parse(fs.readFileSync(path.join(root, "baselines/success-basic/baseline.json"), "utf8")));
    expect(parsed.source.reason).toBe("重定");
  });

  it("允许记录非 SUCCESS 的已接受行为（GAMEPLAY_FAILURE）", () => {
    const root = tmp();
    const a = writeReport(root, "g/run/v1/playtest/v1/result.json", report({ execution: "executed", aggregate: "GAMEPLAY_FAILURE", scenarios: [scenario({ outcome: "GAMEPLAY_FAILURE" })] }));
    const b = writeReport(root, "g/run/v1/playtest/v2/result.json", report({ execution: "executed", aggregate: "GAMEPLAY_FAILURE", scenarios: [scenario({ outcome: "GAMEPLAY_FAILURE" })] }));
    const baseline = promote(root, [a, b]);
    expect(baseline.expected.outcome).toBe("GAMEPLAY_FAILURE");
  });
});
