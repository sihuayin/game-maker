import { describe, expect, it } from "vitest";
import {
  PLAYTEST_BASELINE_FORMAT, PLAYTEST_HARNESS_VERSION, PLAYTEST_REPORT_VERSION, PLAYTEST_RULES_VERSION, PLAYTEST_SCENARIO_VERSION,
  PlaytestBaselineSchema, aggregateAssertions, baselineCleanRunIssues, comparePlaytestToBaseline, expectedOf, sameBaselineExpected,
  type PlaytestBaseline, type PlaytestReport, type PlaytestScenarioReport,
} from "../src/index.js";

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
    identity: {
      scenarioFormatVersion: PLAYTEST_SCENARIO_VERSION, siteVersion: 1, packId: "g", packVersion: 1,
      configChecksum: "sha256:" + "a".repeat(64), shellVersion: "2",
      harnessVersion: PLAYTEST_HARNESS_VERSION, rulesVersion: PLAYTEST_RULES_VERSION,
    },
    command: "node playtest.mjs", exitCode: 0,
    startedAt: "2026-10-27T00:00:00.000Z", finishedAt: "2026-10-27T00:00:05.000Z",
    execution: "executed", scenarios: [scenario({ outcome: "SUCCESS" })], aggregate: "SUCCESS",
    runtime: { pollIntervalMs: 50, stepDelayMs: 35, scenarioTimeoutMs: 45000, viewport: { w: 1000, h: 600 }, deviceScaleFactor: 1, chromeFlags: [] },
    evidence: ["playtest-events"], ...over,
  };
}

function baseline(over: Partial<PlaytestBaseline> = {}): PlaytestBaseline {
  return PlaytestBaselineSchema.parse({
    baselineFormatVersion: PLAYTEST_BASELINE_FORMAT,
    baselineId: "success-basic",
    identity: {
      scenarioFormatVersion: PLAYTEST_SCENARIO_VERSION, scenarioId: "success-basic", scenarioVersion: 1,
      siteVersion: 1, packId: "g", packVersion: 1, configChecksum: "sha256:" + "a".repeat(64),
      shellVersion: "2", harnessVersion: PLAYTEST_HARNESS_VERSION, rulesVersion: PLAYTEST_RULES_VERSION,
    },
    coverage: { assertions: ["won"], endState: ["collected"], events: ["pickup"] },
    expected: { outcome: "SUCCESS", assertions: { won: "pass" }, endState: { collected: 6 }, eventCounts: { pickup: 6 } },
    source: {
      runId: "g/run/v1", reportPath: "g/run/v1/playtest/v1/result.json", reportChecksum: "sha256:" + "b".repeat(64),
      secondRunId: "g/run/v1", secondReportPath: "g/run/v1/playtest/v2/result.json", secondReportChecksum: "sha256:" + "c".repeat(64),
      promotedBy: "human", promotedAt: "2026-10-27T00:00:00.000Z", reason: "接受当前行为",
    },
    ...over,
  });
}

describe("comparePlaytestToBaseline（三值、纯观察）", () => {
  it("身份一致 + 覆盖字段一致 ⇒ match", () => {
    expect(comparePlaytestToBaseline(report(), baseline())).toMatchObject({ result: "match", baselineId: "success-basic" });
  });
  it("身份不匹配 ⇒ not-comparable（不是 changed/match）", () => {
    const r = report();
    const b = baseline({ identity: { ...baseline().identity, siteVersion: 2 } });
    const c = comparePlaytestToBaseline(r, b);
    expect(c.result).toBe("not-comparable");
    expect(c.reason).toContain("siteVersion");
  });
  it("覆盖字段变化 ⇒ changed + 结构化 diff", () => {
    const r = report({ scenarios: [scenario({ outcome: "SUCCESS", endState: { collected: 5, won: true, hits: 0, chestsOpened: 2, activePickups: 0, playerX: 1380 } })] });
    const c = comparePlaytestToBaseline(r, baseline());
    expect(c.result).toBe("changed");
    expect(c.diff).toContainEqual({ path: "endState.collected", baseline: 6, current: 5 });
  });
  it("覆盖外字段变化 ⇒ 仍是 match（只比较 coverage）", () => {
    const r = report({ scenarios: [scenario({ outcome: "SUCCESS", endState: { collected: 6, won: true, hits: 99, chestsOpened: 0, activePickups: 0, playerX: 1 } })] });
    expect(comparePlaytestToBaseline(r, baseline()).result).toBe("match");
  });
  it("覆盖断言 unknown / 缺失 ⇒ not-comparable", () => {
    const unknown = report({ scenarios: [scenario({ outcome: "UNKNOWN", assertions: [{ id: "won", kind: "state", requires: ["won"], result: "unknown", insufficientEvidence: { ruleId: "poll-gap", missingObservation: "x", affectedAssertionIds: ["won"], explanation: "e" }, evidence: ["ev"] }], assertionAggregate: "unknown" })] });
    expect(comparePlaytestToBaseline(unknown, baseline()).result).toBe("not-comparable");
    const missing = report({ scenarios: [scenario({ outcome: "SUCCESS", assertions: [], assertionAggregate: "unknown" })] });
    expect(comparePlaytestToBaseline(missing, baseline()).result).toBe("not-comparable");
  });
  it("允许非 SUCCESS 的已接受行为（如 GAMEPLAY_FAILURE）", () => {
    const fail = report({ execution: "executed", aggregate: "GAMEPLAY_FAILURE", scenarios: [scenario({ outcome: "GAMEPLAY_FAILURE" })] });
    const b = baseline({ expected: { outcome: "GAMEPLAY_FAILURE", assertions: { won: "pass" }, endState: { collected: 6 }, eventCounts: { pickup: 6 } } });
    expect(comparePlaytestToBaseline(fail, b).result).toBe("match");
  });
  it("比较结果不改报告（纯观察）", () => {
    const r = report();
    const before = JSON.stringify(r);
    comparePlaytestToBaseline(r, baseline());
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe("baselineCleanRunIssues / expectedOf / sameBaselineExpected", () => {
  const coverage = { assertions: ["won"], endState: ["collected" as const], events: ["pickup" as const] };
  it("干净报告没有 issue", () => {
    expect(baselineCleanRunIssues(report(), "success-basic", coverage)).toEqual([]);
  });
  it("UNKNOWN / runtime-error / 覆盖断言 unknown ⇒ issue", () => {
    const unknown = report({ scenarios: [scenario({ outcome: "UNKNOWN", assertions: [{ id: "won", kind: "state", requires: ["won"], result: "unknown", insufficientEvidence: { ruleId: "poll-gap", missingObservation: "x", affectedAssertionIds: ["won"], explanation: "e" }, evidence: ["ev"] }], assertionAggregate: "unknown" })] });
    expect(baselineCleanRunIssues(unknown, "success-basic", coverage).length).toBeGreaterThan(0);
    const err = report({ scenarios: [scenario({ outcome: "SUCCESS", eventCounts: { pickup: 6, win: 1, "runtime-error": 1 } })] });
    expect(baselineCleanRunIssues(err, "success-basic", coverage).some((x) => x.includes("runtime-error"))).toBe(true);
  });
  it("expectedOf 只投影 coverage；sameBaselineExpected 比较规范化值", () => {
    const a = expectedOf(report(), "success-basic", coverage);
    const b = expectedOf(report(), "success-basic", coverage);
    expect(a.expected).toEqual({ outcome: "SUCCESS", assertions: { won: "pass" }, endState: { collected: 6 }, eventCounts: { pickup: 6 } });
    expect(sameBaselineExpected(a.expected, b.expected)).toBe(true);
  });
  it("schema 拒绝 coverage 为空 / expected 含覆盖外字段", () => {
    expect(() => PlaytestBaselineSchema.parse({ ...baseline(), coverage: { assertions: [], endState: [], events: [] } })).toThrow();
    expect(() => PlaytestBaselineSchema.parse({ ...baseline(), coverage: { assertions: ["won"], endState: [], events: [] }, expected: { outcome: "SUCCESS", assertions: { won: "pass", extra: "pass" }, endState: {}, eventCounts: {} } })).toThrow();
  });
});
