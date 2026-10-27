import { describe, expect, it } from "vitest";
import {
  DeliveryPlaytestSchema, DeliveryReportSchema, PLAYTEST_HARNESS_VERSION, PLAYTEST_REPORT_VERSION, PLAYTEST_RULES_VERSION,
  PLAYTEST_SCENARIO_VERSION, PlaytestEventSchema, PlaytestReportSchema, PlaytestScenarioSchema, aggregateAssertions, aggregatePlaytestOutcome,
  canonicalProjection, mapPlaytest, playtestProjectionOf, playtestSummaryOf, samePlaytestProjection,
  type DeliveryCheckStatus, type DeliveryPlaytest, type PlaytestReport, type PlaytestScenarioReport,
} from "../src/index.js";
import { applyVisualReview, buildDeliveryReport, deliveryVerdictOf } from "../src/delivery.js";

const identity = {
  scenarioFormatVersion: PLAYTEST_SCENARIO_VERSION as typeof PLAYTEST_SCENARIO_VERSION,
  siteVersion: 1,
  packId: "wasteland-scavenger",
  packVersion: 1,
  shellVersion: "v7",
  harnessVersion: PLAYTEST_HARNESS_VERSION,
  rulesVersion: PLAYTEST_RULES_VERSION,
};

function scenario(over: Partial<PlaytestScenarioReport> = {}): PlaytestScenarioReport {
  const assertions = over.assertions ?? [{
    id: "won", kind: "state" as const, requires: ["won"], result: "pass" as const,
    observed: true, evidence: [],
  }];
  return {
    scenarioId: "success-basic",
    scenarioVersion: 1,
    required: true,
    harnessCondition: "none",
    expectedOutcome: "SUCCESS",
    baselineEligible: true,
    execution: "executed",
    terminationReached: true,
    assertions,
    assertionAggregate: aggregateAssertions(assertions),
    endState: { collected: 6, won: true, hits: 0, chestsOpened: 2, activePickups: 0, playerX: 1380 },
    initialState: { collected: 0, won: false, hits: 0, chestsOpened: 0, activePickups: 4 },
    comparableEvents: ["pickup", "win"],
    eventCounts: { pickup: 6, win: 1 },
    actions: [],
    evidence: ["playtest-events"],
    ...over,
  };
}

function report(over: Partial<PlaytestReport> = {}): PlaytestReport {
  return {
    reportVersion: PLAYTEST_REPORT_VERSION,
    identity,
    command: "node packages/demo/probe/playtest/playtest.mjs",
    exitCode: 0,
    startedAt: "2026-10-27T00:00:00.000Z",
    finishedAt: "2026-10-27T00:00:05.000Z",
    execution: "executed",
    scenarios: [scenario()],
    runtime: { pollIntervalMs: 50, stepDelayMs: 35, scenarioTimeoutMs: 45000, viewport: { w: 1000, h: 600 }, deviceScaleFactor: 1, chromeFlags: ["--headless=new"] },
    evidence: ["playtest-result", "playtest-events"],
    ...over,
  };
}

const passSummary: DeliveryPlaytest = {
  report: "g/run/v1/playtest/v1/result.json",
  reportVersion: PLAYTEST_REPORT_VERSION,
  execution: "executed",
  aggregate: "SUCCESS",
  scenarios: [{ scenarioId: "success-basic", required: true, execution: "executed", outcome: "SUCCESS", evidence: ["playtest-events"] }],
  evidence: ["playtest-result", "playtest-events"],
};

const evidence = [
  { ref: "playtest-result", path: "g/run/v1/playtest/v1/result.json" },
  { ref: "playtest-events", path: "g/run/v1/playtest/v1/events.jsonl" },
];

function checks(status: DeliveryCheckStatus): Array<{ key: string; status: DeliveryCheckStatus; detail?: string }> {
  return [
    { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
    { key: "site", status: "pass" },
    { key: "playable-smoke", status, ...(status === "pass" ? { detail: "SUCCESS" } : {}) },
    { key: "visual-review", status: "pass" },
  ];
}

function delivery(over: Record<string, unknown> = {}) {
  const c = (over.checks ?? checks("pass")) as ReturnType<typeof checks>;
  return {
    runId: "g/run/v1", pack: { packId: "wasteland-scavenger", packVersion: 1 },
    config: { file: "g/run/v1/game-config.json" }, site: { version: 1, shell: "v7" },
    checks: c, verdict: deliveryVerdictOf(c as never), visualReview: { status: "pass" }, evidence,
    ...over,
  };
}

describe("aggregatePlaytestOutcome / aggregateAssertions", () => {
  it("按票 04 优先级聚合，not-executed 不参与", () => {
    expect(aggregatePlaytestOutcome([])).toBeUndefined();
    expect(aggregatePlaytestOutcome(["SUCCESS", "UNKNOWN"])).toBe("UNKNOWN");
    expect(aggregatePlaytestOutcome(["SUCCESS", "TIMEOUT", "AGENT_LIMITATION"])).toBe("TIMEOUT");
    expect(aggregatePlaytestOutcome(["ENVIRONMENT_FAILURE", "TIMEOUT"])).toBe("ENVIRONMENT_FAILURE");
    expect(aggregatePlaytestOutcome(["ENVIRONMENT_FAILURE", "GAMEPLAY_FAILURE"])).toBe("GAMEPLAY_FAILURE");
  });
  it("断言三值 fail > unknown > pass；空集不空过", () => {
    expect(aggregateAssertions([])).toBe("unknown");
    expect(aggregateAssertions([{ result: "pass" }, { result: "unknown" }])).toBe("unknown");
    expect(aggregateAssertions([{ result: "pass" }, { result: "fail" }])).toBe("fail");
    expect(aggregateAssertions([{ result: "pass" }])).toBe("pass");
  });
});

describe("mapPlaytest", () => {
  it("没有报告 = blocked；未执行 = blocked + not-executed", () => {
    expect(mapPlaytest(undefined)).toEqual({ status: "blocked" });
    expect(mapPlaytest({ execution: { status: "not-executed", reason: "no site" }, scenarios: [] }))
      .toEqual({ status: "blocked", detail: "not-executed" });
  });
  it("五态映射", () => {
    const view = (aggregate: "SUCCESS" | "GAMEPLAY_FAILURE" | "ENVIRONMENT_FAILURE" | "AGENT_LIMITATION" | "TIMEOUT" | "UNKNOWN") => ({
      execution: "executed" as const, aggregate,
      scenarios: [{ scenarioId: "s", required: true, execution: "executed" as const, outcome: aggregate }],
    });
    expect(mapPlaytest(view("SUCCESS"))).toEqual({ status: "pass", detail: "SUCCESS" });
    expect(mapPlaytest(view("GAMEPLAY_FAILURE"))).toEqual({ status: "fail", detail: "GAMEPLAY_FAILURE" });
    expect(mapPlaytest(view("ENVIRONMENT_FAILURE"))).toEqual({ status: "blocked", detail: "ENVIRONMENT_FAILURE" });
    expect(mapPlaytest(view("AGENT_LIMITATION"))).toEqual({ status: "incomplete", detail: "AGENT_LIMITATION" });
    expect(mapPlaytest(view("TIMEOUT"))).toEqual({ status: "incomplete", detail: "TIMEOUT" });
    expect(mapPlaytest(view("UNKNOWN"))).toEqual({ status: "incomplete", detail: "UNKNOWN" });
  });
  it("aggregate=SUCCESS 但必需场景未执行 ⇒ blocked，不是 pass", () => {
    const r = mapPlaytest({
      execution: "executed", aggregate: "SUCCESS",
      scenarios: [
        { scenarioId: "ok", required: true, execution: "executed", outcome: "SUCCESS" },
        { scenarioId: "missing", required: true, execution: { status: "not-executed", reason: "x" } },
      ],
    });
    expect(r.status).toBe("blocked");
    expect(r.detail).toContain("missing");
  });
  it("有 GAMEPLAY_FAILURE 时，即使必需场景未执行也不降级", () => {
    const r = mapPlaytest({
      execution: "executed", aggregate: "GAMEPLAY_FAILURE",
      scenarios: [
        { scenarioId: "bad", required: true, execution: "executed", outcome: "GAMEPLAY_FAILURE" },
        { scenarioId: "missing", required: true, execution: { status: "not-executed", reason: "x" } },
      ],
    });
    expect(r).toEqual({ status: "fail", detail: "GAMEPLAY_FAILURE" });
  });
});

describe("PlaytestEventSchema（票 03 Q5：params 按类型）", () => {
  const base = { v: 1, seq: 1, t: 10, frame: null, actor: "pickup[2]", source: "poll" };
  it("接受合法 pickup 事件", () => {
    expect(PlaytestEventSchema.parse({ ...base, type: "pickup", params: { count: 1, indexes: [2], collected: 3, ambiguous: false } }).type).toBe("pickup");
  });
  it("拒绝混入未声明字段 / 缺字段", () => {
    expect(() => PlaytestEventSchema.parse({ ...base, type: "pickup", params: { count: 1, bogus: true } })).toThrow();
    expect(() => PlaytestEventSchema.parse({ ...base, type: "land", params: {} })).toThrow();
  });
  it("runtime-error 必须来自 cdp，不得伪装成 poll", () => {
    expect(() => PlaytestEventSchema.parse({ ...base, type: "runtime-error", params: { kind: "console", text: "x" } })).toThrow();
    expect(PlaytestEventSchema.parse({ ...base, source: "cdp", type: "runtime-error", params: { kind: "console", text: "x" } }).source).toBe("cdp");
  });
});

describe("PlaytestReportSchema", () => {
  it("接受未归因的观测报告（outcome/aggregate 缺席）", () => {
    const parsed = PlaytestReportSchema.parse(report());
    expect(parsed.aggregate).toBeUndefined();
    expect(parsed.scenarios[0]!.outcome).toBeUndefined();
  });
  it("接受已归因报告，并要求 aggregate 与场景一致", () => {
    const r = report({
      aggregate: "SUCCESS",
      scenarios: [scenario({ outcome: "SUCCESS" })],
    });
    expect(PlaytestReportSchema.parse(r).aggregate).toBe("SUCCESS");
    const bad = { ...r, aggregate: "GAMEPLAY_FAILURE" };
    expect(() => PlaytestReportSchema.parse(bad)).toThrow();
  });
  it("拒绝部分归因", () => {
    const r = report({
      aggregate: "SUCCESS",
      scenarios: [
        scenario({ scenarioId: "a", outcome: "SUCCESS" }),
        scenario({ scenarioId: "b", required: false }),
      ],
    });
    expect(() => PlaytestReportSchema.parse(r)).toThrow();
  });
  it("SUCCESS 必须有终止条件、至少一条实质断言、全部 pass", () => {
    expect(() => PlaytestReportSchema.parse(report({
      aggregate: "SUCCESS", scenarios: [scenario({ outcome: "SUCCESS", terminationReached: false })],
    }))).toThrow();
    expect(() => PlaytestReportSchema.parse(report({
      aggregate: "SUCCESS", scenarios: [scenario({ outcome: "SUCCESS", assertions: [] })],
    }))).toThrow();
    expect(() => PlaytestReportSchema.parse(report({
      aggregate: "SUCCESS", scenarios: [scenario({ outcome: "SUCCESS", assertions: [{ id: "x", kind: "state", requires: ["won"], result: "unknown", insufficientEvidence: { ruleId: "r", missingObservation: "m", affectedAssertionIds: ["x"], explanation: "e" }, evidence: ["ev"] }] })],
    }))).toThrow();
  });
  it("UNKNOWN 必须有结构化缺口", () => {
    expect(() => PlaytestReportSchema.parse(report({
      aggregate: "UNKNOWN", scenarios: [scenario({ outcome: "UNKNOWN", evidence: ["ev"] })],
    }))).toThrow();
  });
});

describe("DeliveryPlaytestSchema / delivery 不变量", () => {
  it("pass 摘要 + pass 检查项 + 证据可解析 ⇒ 通过", () => {
    const d = delivery({ playtest: passSummary });
    const parsed = DeliveryReportSchema.parse(d);
    expect(parsed.verdict).toBe("pass");
    expect(buildDeliveryReport({ ...d, checks: d.checks as never, playtest: passSummary } as never).verdict).toBe("pass");
  });
  it("旧报告没有 playtest 仍可解析", () => {
    const d = delivery({ checks: checks("incomplete") });
    expect(DeliveryReportSchema.parse(d).playtest).toBeUndefined();
  });
  it("有 playtest 时检查项必须匹配映射；缺失的必需场景不能 pass", () => {
    const blockedSummary: DeliveryPlaytest = {
      ...passSummary,
      scenarios: [
        { scenarioId: "ok", required: true, execution: "executed", outcome: "SUCCESS", evidence: ["playtest-events"] },
        { scenarioId: "missing", required: true, execution: { status: "not-executed", reason: "x" }, evidence: [] },
      ],
    };
    expect(() => DeliveryReportSchema.parse(delivery({ playtest: blockedSummary }))).toThrow();
    const d = delivery({ playtest: blockedSummary, checks: checks("blocked") });
    // detail 必须与 mapPlaytest 一致
    d.checks = d.checks.map((c) => c.key === "playable-smoke" ? { ...c, detail: mapPlaytest(blockedSummary).detail } : c);
    expect(DeliveryReportSchema.parse(d).checks.find((c) => c.key === "playable-smoke")?.status).toBe("blocked");
  });
  it("fail 只能来自 GAMEPLAY_FAILURE", () => {
    const env: DeliveryPlaytest = { ...passSummary, aggregate: "ENVIRONMENT_FAILURE", scenarios: [{ scenarioId: "s", required: true, execution: "executed", outcome: "ENVIRONMENT_FAILURE", evidence: ["playtest-events"] }] };
    expect(mapPlaytest(env).status).toBe("blocked");
    expect(() => DeliveryReportSchema.parse(delivery({ playtest: env, checks: checks("fail") }))).toThrow();
  });
  it("playtest.report 必须与 playtest-result 的路径一致", () => {
    const bad = { ...passSummary, report: "other/result.json" };
    expect(() => DeliveryReportSchema.parse(delivery({ playtest: bad }))).toThrow();
  });
  it("UNKNOWN 场景必须带场景级 insufficientEvidence", () => {
    const bad: DeliveryPlaytest = {
      ...passSummary, aggregate: "UNKNOWN",
      scenarios: [{ scenarioId: "s", required: true, execution: "executed", outcome: "UNKNOWN", evidence: ["playtest-events"] }],
    };
    expect(() => DeliveryPlaytestSchema.parse(bad)).toThrow();
  });
  it("applyVisualReview 保留 playtest 摘要（只动视觉三处）", () => {
    const d = DeliveryReportSchema.parse(delivery({ playtest: passSummary }));
    const next = applyVisualReview(d, { status: "fail", reviewer: "human" });
    expect(next.playtest).toEqual(passSummary);
    expect(next.verdict).toBe("fail");
  });
  it("baseline=changed 不改变状态（纯观察）", () => {
    const withBaseline = { ...passSummary, baseline: { result: "changed" as const } };
    expect(mapPlaytest(withBaseline)).toEqual({ status: "pass", detail: "SUCCESS" });
    expect(DeliveryReportSchema.parse(delivery({ playtest: withBaseline })).verdict).toBe("pass");
  });
});

describe("场景契约", () => {
  it("接受首版 success-basic 形状，拒绝未知格式版本", () => {
    const s = {
      formatVersion: PLAYTEST_SCENARIO_VERSION, id: "success-basic", version: 1, required: true,
      expectedOutcome: "SUCCESS", baselineEligible: true, target: { siteVersion: 1 },
      harnessCondition: "none", setup: { kind: "none" },
      actions: [{ kind: "move_to", target: { kind: "gate" } }, { kind: "wait_until", condition: { kind: "won" }, timeoutMs: 45000 }],
      assertions: [
        { id: "collected", kind: "state", requires: ["collected"], expect: { kind: "state", path: "collected", op: "eq", value: 6 }, withinMs: 45000, onInsufficient: "unknown" },
        { id: "won", kind: "state", requires: ["won"], expect: { kind: "state", path: "won", op: "eq", value: true }, withinMs: 45000, onInsufficient: "unknown" },
      ],
      termination: { kind: "won" }, timeoutMs: 45000, pollIntervalMs: 50, stepDelayMs: 35,
      comparableEvents: ["pickup", "win"],
    };
    expect(PlaytestScenarioSchema.parse(s).id).toBe("success-basic");
    expect(() => PlaytestScenarioSchema.parse({ ...s, formatVersion: "playtest-scenario/v2" })).toThrow();
  });
});

describe("规范化投影", () => {
  it("忽略位置/时间/事件顺序，只比较判定与显式事件计数", () => {
    const a = scenario({ eventCounts: { pickup: 6, win: 1 }, endState: { collected: 6, won: true, hits: 0, chestsOpened: 2, activePickups: 0, playerX: 1380 } });
    const b = scenario({ eventCounts: { win: 1, pickup: 6 }, endState: { collected: 6, won: true, hits: 0, chestsOpened: 2, activePickups: 0, playerX: 1379 } });
    expect(samePlaytestProjection(playtestProjectionOf(a), playtestProjectionOf(b))).toBe(true);
    expect(canonicalProjection(playtestProjectionOf(a))).toBe(canonicalProjection(playtestProjectionOf(b)));
  });
  it("显式比较的事件计数不同 ⇒ 不同投影", () => {
    const a = scenario({ eventCounts: { pickup: 6, win: 1 } });
    const b = scenario({ eventCounts: { pickup: 5, win: 1 } });
    expect(samePlaytestProjection(playtestProjectionOf(a), playtestProjectionOf(b))).toBe(false);
  });
});

describe("playtestSummaryOf", () => {
  it("从已归因报告投影出交付摘要（不决定 verdict）", () => {
    const r = report({ aggregate: "SUCCESS", scenarios: [scenario({ outcome: "SUCCESS" })] });
    const s = playtestSummaryOf(r, "g/run/v1/playtest/v1/result.json");
    expect(s.report).toBe("g/run/v1/playtest/v1/result.json");
    expect(s.aggregate).toBe("SUCCESS");
    expect(s.scenarios[0]!.outcome).toBe("SUCCESS");
    expect(s.evidence).toEqual(["playtest-result", "playtest-events"]);
  });
});
