import { describe, expect, it } from "vitest";
import {
  PLAYTEST_STOP_REASONS, attribute, attributeReport,
  type PlaytestAttributionEvidence, type PlaytestAttributionResult,
} from "../src/index.js";
import { aggregateAssertions, type PlaytestScenarioReport } from "../src/playtest.js";

const passAssertion = {
  id: "won", kind: "state" as const, requires: ["won"], result: "pass" as const,
  observed: true, expect: { kind: "state", path: "won", op: "eq", value: true }, withinMs: 1000, evidence: [],
};

function scenario(over: Partial<PlaytestScenarioReport> = {}): PlaytestScenarioReport {
  const assertions = over.assertions ?? [passAssertion];
  return {
    scenarioId: "s", scenarioVersion: 1, required: true, harnessCondition: "none",
    expectedOutcome: "SUCCESS", baselineEligible: true, execution: "executed", terminationReached: true,
    assertions, assertionAggregate: aggregateAssertions(assertions),
    endState: { collected: 6, won: true, hits: 0, chestsOpened: 2, activePickups: 0, playerX: 1380 },
    initialState: { collected: 0, won: false, hits: 0, chestsOpened: 0, activePickups: 4, playerX: 40 },
    actions: [], comparableEvents: [], eventCounts: {}, evidence: ["scenario-ev"], ...over,
  };
}

function evidence(over: Partial<PlaytestAttributionEvidence> = {}): PlaytestAttributionEvidence {
  return {
    scenario: scenario(), stage: "execute",
    environment: { healthy: true, chromeAvailable: true, sceneReadyObserved: true, pollGaps: 0, failures: [] },
    runtimeErrors: [],
    action: { attempted: 1, completed: 1, timedOut: 0, explorationExhausted: false, stuck: false, progressPx: 100 },
    deadlineHit: false, structuralUndecidable: false, evidence: ["run-ev"], ...over,
  };
}

const outcomeOf = (r: PlaytestAttributionResult) => r.execution === "executed" ? r.outcome : "not-executed";

describe("attribute · 五态", () => {
  it("SUCCESS：终止达成 + 全部实质断言 pass + 环境健康 + 无报错", () => {
    expect(attribute(evidence())).toMatchObject({ execution: "executed", outcome: "SUCCESS", stage: "evaluate" });
  });

  it("invariant 断言 fail ⇒ GAMEPLAY_FAILURE（与代理动作无关）", () => {
    const a = { id: "hits", kind: "invariant" as const, requires: ["hits"], result: "fail" as const, observed: 2, expect: { kind: "invariant", path: "hits", op: "eq", value: 0 }, withinMs: 1000, evidence: ["ev"] };
    const r = attribute(evidence({ scenario: scenario({ assertions: [a], assertionAggregate: "fail", terminationReached: false }) }));
    expect(outcomeOf(r)).toBe("GAMEPLAY_FAILURE");
  });

  it("初始态 pickup 缺失 ⇒ GAMEPLAY_FAILURE（票 04 Q4）", () => {
    const a = { id: "missing", kind: "state" as const, requires: ["initialActivePickups"], result: "fail" as const, observed: 3, expect: { kind: "state", path: "initialActivePickups", op: "eq", value: 4 }, withinMs: 1000, evidence: ["ev"] };
    const r = attribute(evidence({ scenario: scenario({ assertions: [a], assertionAggregate: "fail", terminationReached: false }) }));
    expect(outcomeOf(r)).toBe("GAMEPLAY_FAILURE");
  });

  it("到 gate 但 won=false ⇒ GAMEPLAY_FAILURE（否定条件可判）", () => {
    const a = { id: "won", kind: "state" as const, requires: ["won"], result: "fail" as const, observed: false, expect: { kind: "state", path: "won", op: "eq", value: true }, withinMs: 1000, evidence: ["ev"] };
    const r = attribute(evidence({ scenario: scenario({ assertions: [a], assertionAggregate: "fail", terminationReached: false }) }));
    expect(outcomeOf(r)).toBe("GAMEPLAY_FAILURE");
  });

  it("普通 state 断言 fail 不自动升级 GAMEPLAY_FAILURE；有 stuck/耗尽 ⇒ AGENT_LIMITATION", () => {
    const a = { id: "collected", kind: "state" as const, requires: ["collected"], result: "fail" as const, observed: 3, expect: { kind: "state", path: "collected", op: "eq", value: 6 }, withinMs: 1000, evidence: ["ev"] };
    const r = attribute(evidence({
      scenario: scenario({ assertions: [a], assertionAggregate: "fail", terminationReached: false }),
      action: { attempted: 1, completed: 0, timedOut: 1, explorationExhausted: true, stuck: true, progressPx: 3 },
      deadlineHit: true,
    }));
    expect(outcomeOf(r)).toBe("AGENT_LIMITATION");
  });

  it("环境故障优先于游戏失败（即使有 invariant fail）", () => {
    const a = { id: "hits", kind: "invariant" as const, requires: ["hits"], result: "fail" as const, observed: 2, expect: { kind: "invariant", path: "hits", op: "eq", value: 0 }, withinMs: 1000, evidence: ["ev"] };
    const r = attribute(evidence({
      scenario: scenario({ assertions: [a], assertionAggregate: "fail", terminationReached: false }),
      environment: { healthy: false, chromeAvailable: true, sceneReadyObserved: true, pollGaps: 0, failures: ["asset 404"] },
    }));
    expect(outcomeOf(r)).toBe("ENVIRONMENT_FAILURE");
  });

  it("runtime-error 来源未定 ⇒ UNKNOWN；来源为游戏 ⇒ GAMEPLAY_FAILURE", () => {
    const base = scenario({ terminationReached: false, assertionAggregate: "unknown" });
    const unknown = attribute(evidence({ scenario: base, runtimeErrors: [{ kind: "console", text: "boom", origin: "unknown" }] }));
    expect(outcomeOf(unknown)).toBe("UNKNOWN");
    if (unknown.execution === "executed") expect(unknown.insufficientEvidence?.ruleId).toBe("runtime-error-origin-unresolved");
    const game = attribute(evidence({ scenario: base, runtimeErrors: [{ kind: "exception", text: "TypeError: x", origin: "game" }] }));
    expect(outcomeOf(game)).toBe("GAMEPLAY_FAILURE");
  });

  it("单纯超时 ⇒ TIMEOUT；超时 + 结构性不可判 ⇒ UNKNOWN（UNKNOWN 优先）", () => {
    const base = scenario({ terminationReached: false, assertionAggregate: "unknown" });
    expect(outcomeOf(attribute(evidence({ scenario: base, deadlineHit: true })))).toBe("TIMEOUT");
    const r = attribute(evidence({ scenario: base, deadlineHit: true, structuralUndecidable: true }));
    expect(outcomeOf(r)).toBe("UNKNOWN");
    if (r.execution === "executed") expect(r.insufficientEvidence?.ruleId).toBe("timeout-and-undecidable");
  });

  it("无失败证据、无终止、无超时 ⇒ UNKNOWN（沉默不是通过，也不是失败）", () => {
    const unknownAssertion = {
      id: "won", kind: "state" as const, requires: ["won"], result: "unknown" as const,
      expect: { kind: "state", path: "won", op: "eq", value: true }, withinMs: 1000,
      insufficientEvidence: { ruleId: "negative-not-judgeable", missingObservation: "到达 gate", affectedAssertionIds: ["won"], explanation: "未到 gate，否定条件不可判" },
      evidence: ["ev"],
    };
    const r = attribute(evidence({
      scenario: scenario({ terminationReached: false, assertions: [unknownAssertion], assertionAggregate: "unknown" }),
    }));
    expect(outcomeOf(r)).toBe("UNKNOWN");
    if (r.execution === "executed") expect(r.insufficientEvidence?.ruleId).toBe("insufficient-evidence");
  });
});

describe("attribute · not-executed / boot", () => {
  it("prepare 拒绝（无环境故障）⇒ not-executed，不是 UNKNOWN", () => {
    const r = attribute(evidence({
      scenario: scenario({ execution: { status: "not-executed", reason: "site 版本不匹配" }, terminationReached: false }),
      stage: "prepare",
      environment: { healthy: false, chromeAvailable: true, sceneReadyObserved: false, pollGaps: 0, failures: [] },
    }));
    expect(r.execution).toBe("not-executed");
    if (r.execution === "not-executed") expect(r.reason).toContain("版本不匹配");
  });

  it("prepare 有环境故障证据 ⇒ ENVIRONMENT_FAILURE（不是游戏失败）", () => {
    const r = attribute(evidence({
      scenario: scenario({ execution: { status: "not-executed", reason: "Chrome 不可用" }, terminationReached: false }),
      stage: "prepare",
      environment: { healthy: false, chromeAvailable: false, sceneReadyObserved: false, pollGaps: 0, failures: ["找不到系统 Chrome"] },
    }));
    expect(outcomeOf(r)).toBe("ENVIRONMENT_FAILURE");
  });

  it("boot 未 ready 且无环境证据 ⇒ UNKNOWN；有环境证据 ⇒ ENVIRONMENT_FAILURE", () => {
    const s = scenario({ execution: { status: "not-executed", reason: "boot 15s 未 ready" }, terminationReached: false });
    expect(outcomeOf(attribute(evidence({ scenario: s, stage: "boot" })))).toBe("UNKNOWN");
    const env = attribute(evidence({
      scenario: s, stage: "boot",
      environment: { healthy: false, chromeAvailable: true, sceneReadyObserved: false, pollGaps: 0, failures: ["page load failed"] },
    }));
    expect(outcomeOf(env)).toBe("ENVIRONMENT_FAILURE");
  });
});

describe("attributeReport · 聚合", () => {
  it("按票 04 优先级聚合；not-executed 不参与排序", () => {
    const ok = evidence({ scenario: scenario({ scenarioId: "ok" }) });
    const bad = evidence({ scenario: scenario({ scenarioId: "bad", terminationReached: false, assertionAggregate: "fail", assertions: [{ ...passAssertion, id: "hits", kind: "invariant", result: "fail", observed: 1, expect: { kind: "invariant", path: "hits", op: "eq", value: 0 }, evidence: ["ev"] }] }) });
    const missing = evidence({ scenario: scenario({ scenarioId: "missing", execution: { status: "not-executed", reason: "x" }, terminationReached: false }), stage: "prepare", environment: { healthy: false, chromeAvailable: true, sceneReadyObserved: false, pollGaps: 0, failures: [] } });
    const r = attributeReport([ok, bad, missing]);
    expect(r.execution).toBe("executed");
    expect(r.aggregate).toBe("GAMEPLAY_FAILURE");
    expect(r.results.find((x) => x.scenarioId === "missing")?.result.execution).toBe("not-executed");
  });

  it("全部 not-executed ⇒ execution not-executed，没有 aggregate", () => {
    const missing = evidence({ scenario: scenario({ execution: { status: "not-executed", reason: "x" }, terminationReached: false }), stage: "prepare" });
    const r = attributeReport([missing]);
    expect(r.execution).toMatchObject({ status: "not-executed" });
    expect(r.aggregate).toBeUndefined();
  });
});

describe("attribute · 执行器主动停止（票 08 Q3 B）", () => {
  const stoppedScenario = (reason: (typeof PLAYTEST_STOP_REASONS)[number]) =>
    scenario({ terminationReached: false, stop: { reason, atStep: 120 } });

  it("四个原因都判 AGENT_LIMITATION（不是游戏失败，也不是 TIMEOUT）", () => {
    for (const reason of PLAYTEST_STOP_REASONS) {
      const r = attribute(evidence({ scenario: stoppedScenario(reason), deadlineHit: true }));
      expect(outcomeOf(r), reason).toBe("AGENT_LIMITATION");
    }
  });

  it("主动停止优先于推导出的 deadlineHit（动作被中断仍记 timeout）", () => {
    const r = attribute(evidence({
      scenario: stoppedScenario("wait-limit"),
      action: { attempted: 1, completed: 0, timedOut: 1, explorationExhausted: true, stuck: true, progressPx: 0 },
      deadlineHit: true,
    }));
    expect(outcomeOf(r)).toBe("AGENT_LIMITATION");
  });

  it("主动停止优先于轮询断档（结构性不可判不覆盖停止原因）", () => {
    const r = attribute(evidence({
      scenario: stoppedScenario("no-progress"), structuralUndecidable: true,
      environment: { healthy: true, chromeAvailable: true, sceneReadyObserved: true, pollGaps: 2, failures: [] },
    }));
    expect(outcomeOf(r)).toBe("AGENT_LIMITATION");
  });

  it("无 stop 的 deadline 仍按 TIMEOUT 归因", () => {
    expect(outcomeOf(attribute(evidence({
      scenario: scenario({ terminationReached: false }), deadlineHit: true,
    })))).toBe("TIMEOUT");
  });

  it("已证实的游戏失败 / 环境故障 / SUCCESS 仍优先于 stop", () => {
    const invariantFail = {
      id: "hits", kind: "invariant" as const, requires: ["hits"], result: "fail" as const, observed: 1,
      expect: { kind: "invariant", path: "hits", op: "eq", value: 0 }, withinMs: 1000, evidence: ["ev"],
    };
    const gameFailure = attribute(evidence({
      scenario: scenario({
        terminationReached: false, assertions: [invariantFail], assertionAggregate: "fail",
        stop: { reason: "no-progress", atStep: 120 },
      }),
    }));
    expect(outcomeOf(gameFailure)).toBe("GAMEPLAY_FAILURE");

    const envFailure = attribute(evidence({
      scenario: stoppedScenario("no-progress"),
      environment: { healthy: false, chromeAvailable: true, sceneReadyObserved: true, pollGaps: 0, failures: ["asset 404"] },
    }));
    expect(outcomeOf(envFailure)).toBe("ENVIRONMENT_FAILURE");

    // stop 与 terminationReached 不会同时成立（schema 不变量），这里验证归因优先级本身。
    const success = attribute(evidence({
      scenario: scenario({ stop: { reason: "jump-exhaustion", atStep: 10 } }),
    }));
    expect(outcomeOf(success)).toBe("SUCCESS");
  });
});
