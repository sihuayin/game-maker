// U1 / R1：预算骨架与确定性签名（U1 前置，不是 U5 硬化）。
//
// ⚠️ 只覆盖 U1：默认 / 硬上限、非法预算、派生溢出、单次 check 的 cut 预算、
//   注入时钟的 wall-clock abort、签名与完整规范化序列化。
// ⚠️ 不测 `maxCutsPerBranch` 的搜索执行、Witness 体积、相位网格 —— 那些是 U2 / U5。
import { describe, expect, it } from "vitest";
import {
  BUDGET_DEFAULTS,
  BUDGET_HARD_CAPS,
  createBudgetTracker,
  deriveMaxBranching,
  deriveMaxEdges,
  resolveBudgetProfile,
} from "../src/playability/temporal-budget.js";
import type { BudgetProfile, TemporalInternalResult } from "../src/playability/temporal-result.js";
import { determinismSignature } from "../src/playability/temporal.js";
import { createWitnessWorkBudget } from "../src/playability/temporal-witness.js";
import {
  budgetProfileFixture,
  canonicalJson,
  deterministicView,
  internalResultFixture,
} from "./playability-temporal-fixtures.js";

type ResolveArgs = Parameters<typeof resolveBudgetProfile>[0];

const resolved = (args: ResolveArgs): BudgetProfile => {
  const result = resolveBudgetProfile(args);
  if (!result.ok) throw new Error(`expected ok, got ${result.degradationReason}`);
  return result.profile;
};

const reasonOf = (args: ResolveArgs): string => {
  const result = resolveBudgetProfile(args);
  return result.ok ? "ok" : result.degradationReason;
};

const fnv1a32 = (text: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

describe("I02-01 预算默认值与硬上限（U1 前置）", () => {
  it("[I02-01][budget] 默认值冻结", () => {
    expect(BUDGET_DEFAULTS).toEqual({
      maxStates: 500_000,
      timeBudgetMs: 2_000,
      maxCutsPerCheck: 1_000_000,
      maxCutsPerBranch: 5_000_000,
      maxWitnessTransitions: 1_000_000,
      maxWitnessBytes: 64 * 1024 * 1024,
      maxHopSamples: 240,
      timeBudgetCheckpointWork: 1024,
    });
  });

  it("[I02-01][budget] 硬上限冻结", () => {
    expect(BUDGET_HARD_CAPS).toEqual({
      maxStates: 1_000_000,
      timeBudgetMs: 10_000,
      maxCutsPerCheck: 1_000_000,
      maxCutsPerBranch: 10_000_000,
      maxWitnessTransitions: 1_000_000,
      maxWitnessBytes: 64 * 1024 * 1024,
      maxHopSamples: 240,
      timeBudgetCheckpointWork: 1024,
    });
  });

  it("[I02-01][budget] maxBranching / maxEdges 按 D5 §3.2 派生", () => {
    expect(deriveMaxBranching({ maxSpeed: 100, periodMs: 4000, phaseSteps: 40, xStep: 1 }))
      .toBe(20_002);
    expect(deriveMaxEdges(500_000, 20_002)).toBe(10_001_000_000);
  });

  it("[I02-01][budget] 默认解析：maxEdges = maxStates × maxBranching", () => {
    const profile = resolved({ maxBranching: 2 });
    expect(profile.maxStates).toBe(500_000);
    expect(profile.maxEdges).toBe(1_000_000);
    expect(profile.maxCutsPerBranch).toBe(5_000_000);
  });

  it("[I02-01][budget] 测试覆盖合并，maxEdges 随 maxStates 重算", () => {
    const profile = resolved({ maxBranching: 2, overrides: { maxStates: 1_000, timeBudgetMs: 50 } });
    expect(profile.maxStates).toBe(1_000);
    expect(profile.maxEdges).toBe(2_000);
    expect(profile.timeBudgetMs).toBe(50);
    expect(profile.maxCutsPerCheck).toBe(1_000_000);
  });

  it("[I02-01][budget] 硬上限边界可解析", () => {
    const profile = resolved({
      maxBranching: 2,
      overrides: {
        maxStates: 1_000_000,
        timeBudgetMs: 10_000,
        maxCutsPerCheck: 1_000_000,
        maxCutsPerBranch: 10_000_000,
        maxWitnessTransitions: 1_000_000,
        maxWitnessBytes: 64 * 1024 * 1024,
        maxHopSamples: 240,
        timeBudgetCheckpointWork: 1024,
      },
    });
    expect(profile.maxStates).toBe(1_000_000);
    expect(profile.maxEdges).toBe(2_000_000);
  });
});

describe("I02-01 非法预算与派生溢出（U1 前置，AC-11）", () => {
  it("[I02-01][budget][AC-11] 非有限 / 非整数 / ≤0 ⇒ invalid-budget", () => {
    const invalid: ResolveArgs[] = [
      { maxBranching: 0 },
      { maxBranching: -1 },
      { maxBranching: 1.5 },
      { maxBranching: Number.NaN },
      { maxBranching: 2, overrides: { timeBudgetMs: 0 } },
      { maxBranching: 2, overrides: { timeBudgetMs: -1 } },
      { maxBranching: 2, overrides: { timeBudgetMs: Number.NaN } },
      { maxBranching: 2, overrides: { timeBudgetMs: Number.POSITIVE_INFINITY } },
      { maxBranching: 2, overrides: { timeBudgetMs: 1.5 } },
      { maxBranching: 2, overrides: { maxStates: 0 } },
      { maxBranching: 2, overrides: { maxStates: -5 } },
      { maxBranching: 2, overrides: { maxStates: 1.5 } },
      { maxBranching: 2, overrides: { maxCutsPerCheck: -1 } },
      { maxBranching: 2, overrides: { maxWitnessBytes: Number.POSITIVE_INFINITY } },
      { maxBranching: 2, overrides: { timeBudgetCheckpointWork: 0 } },
    ];
    for (const args of invalid) expect(reasonOf(args), JSON.stringify(args)).toBe("invalid-budget");
  });

  it("[I02-01][budget][AC-11] 超过硬上限 ⇒ invalid-budget", () => {
    const overHard = [
      { maxStates: 1_000_001 },
      { timeBudgetMs: 10_001 },
      { maxCutsPerCheck: 1_000_001 },
      { maxCutsPerBranch: 10_000_001 },
      { maxWitnessTransitions: 1_000_001 },
      { maxWitnessBytes: 64 * 1024 * 1024 + 1 },
      { maxHopSamples: 241 },
      { timeBudgetCheckpointWork: 1_025 },
    ];
    for (const overrides of overHard) {
      expect(reasonOf({ maxBranching: 2, overrides }), JSON.stringify(overrides)).toBe("invalid-budget");
    }
  });

  it("[I02-01][budget][AC-11] 派生上界溢出 ⇒ budget-bound-overflow", () => {
    expect(reasonOf({ maxBranching: 1e12, overrides: { maxStates: 1_000_000 } }))
      .toBe("budget-bound-overflow");
    expect(reasonOf({ maxBranching: 2, overrides: { maxEdges: 2_000_001 } }))
      .toBe("budget-bound-overflow");
    expect(reasonOf({ maxBranching: 2, overrides: { maxEdges: Number.MAX_SAFE_INTEGER } }))
      .toBe("budget-bound-overflow");
  });
});

describe("I02-01 工作计数与 cut 预算（U1 前置）", () => {
  const profile = (overrides: Partial<BudgetProfile> = {}): BudgetProfile =>
    resolved({ maxBranching: 2, overrides: { timeBudgetMs: 2_000, ...overrides } });

  it("[I02-01][budget][AC-08] cutPointsTotal / segmentsTotal 按 check 累计", () => {
    const tracker = createBudgetTracker({ profile: profile({ maxCutsPerCheck: 10 }), now: () => 0 });
    expect(tracker.chargeCheck(2).stopped).toBe(false);
    expect(tracker.chargeCheck(3).stopped).toBe(false);
    const snapshot = tracker.snapshot();
    expect(snapshot.cutPointsTotal).toBe(5);
    expect(snapshot.segmentsTotal).toBe(2 + 1 + 3 + 1);
    expect(snapshot.budgetStatus).toBe("complete");
    expect(snapshot.budgetKind).toBeNull();
  });

  it("[I02-01][budget][AC-08] 单次 check 超 maxCutsPerCheck ⇒ exhausted / cut-budget", () => {
    const tracker = createBudgetTracker({ profile: profile({ maxCutsPerCheck: 2 }), now: () => 0 });
    expect(tracker.chargeCheck(2).stopped).toBe(false);
    expect(tracker.chargeCheck(3)).toMatchObject({
      stopped: true,
      budgetStatus: "exhausted",
      budgetKind: "cut-budget",
      degradationReason: "cut-budget-exhausted",
    });
    expect(tracker.snapshot().cutPointsTotal).toBe(2);
  });

  it("[I02-01][budget][AC-08] 预算停止是单向的", () => {
    const tracker = createBudgetTracker({ profile: profile({ maxCutsPerCheck: 1 }), now: () => 0 });
    expect(tracker.chargeCheck(2).stopped).toBe(true);
    expect(tracker.chargeWork(0)).toMatchObject({ stopped: true, budgetKind: "cut-budget" });
    expect(tracker.snapshot().budgetStatus).toBe("exhausted");
    expect(tracker.finish().budgetStatus).toBe("exhausted");
  });

  it("[I02-01][budget] 非法计量参数抛 RangeError", () => {
    const tracker = createBudgetTracker({ profile: profile(), now: () => 0 });
    expect(() => tracker.chargeWork(-1)).toThrow(RangeError);
    expect(() => tracker.chargeWork(1.5)).toThrow(RangeError);
    expect(() => tracker.chargeCheck(-1)).toThrow(RangeError);
    expect(() => tracker.chargeCheck(0.5)).toThrow(RangeError);
  });
});

describe("I02-01 墙钟 abort（U1 前置）", () => {
  const profile = (overrides: Partial<BudgetProfile> = {}): BudgetProfile =>
    resolved({ maxBranching: 2, overrides: { timeBudgetMs: 10, timeBudgetCheckpointWork: 1, ...overrides } });

  it("[I02-01][budget][AC-08] 注入时钟在检查点确定性触发 abort", () => {
    let clock = 0;
    const tracker = createBudgetTracker({ profile: profile(), now: () => clock });
    clock = 9;
    expect(tracker.chargeWork(1).stopped).toBe(false);
    clock = 10;
    expect(tracker.chargeWork(1)).toMatchObject({
      stopped: true,
      budgetStatus: "aborted",
      budgetKind: "wall-clock-abort",
      degradationReason: "wall-clock-abort",
    });
  });

  it("[I02-01][budget] 未到 work 检查点不读墙钟", () => {
    let calls = 0;
    const tracker = createBudgetTracker({
      profile: resolved({ maxBranching: 2, overrides: { timeBudgetCheckpointWork: 1024 } }),
      now: () => { calls += 1; return 0; },
    });
    expect(calls).toBe(1);
    tracker.chargeWork(1023);
    expect(calls).toBe(1);
    tracker.chargeWork(1);
    expect(calls).toBe(2);
  });

  it("[I02-01][budget][AC-08] finish 做最后一次墙钟检查并定格状态", () => {
    let clock = 0;
    const complete = createBudgetTracker({ profile: profile(), now: () => clock });
    clock = 9;
    expect(complete.finish()).toMatchObject({ budgetStatus: "complete", budgetKind: null });
    let later = 0;
    const aborted = createBudgetTracker({ profile: profile(), now: () => later });
    later = 10;
    expect(aborted.finish()).toMatchObject({ budgetStatus: "aborted", budgetKind: "wall-clock-abort" });
  });

  it("[I02-01][budget] wallClockMs 只作诊断，可被快照读出", () => {
    let clock = 0;
    const tracker = createBudgetTracker({ profile: profile({ timeBudgetMs: 100 }), now: () => clock });
    clock = 42;
    expect(tracker.snapshot().wallClockMs).toBe(42);
  });
});

describe("I02-01 确定性签名（U1 前置，AC-10）", () => {
  const covered = (result: TemporalInternalResult) => ({
    internalResult: result.internalResult,
    certificate: result.certificate,
    grid: result.stats.grid,
    work: result.stats.work,
    budget: {
      budgetStatus: result.stats.budget.budgetStatus,
      budgetKind: result.stats.budget.budgetKind,
    },
    diagnostics: {
      degradationReason: result.diagnostics.degradationReason,
      secondaryReasons: result.diagnostics.secondaryReasons,
    },
  });

  it("[I02-01][budget][AC-10] FNV-1a 交叉校验与已知向量", () => {
    expect(fnv1a32("foobar")).toBe("bf9cf968");
    const result = internalResultFixture();
    expect(determinismSignature(result)).toBe(fnv1a32(canonicalJson(covered(result))));
    expect(determinismSignature(result)).toMatch(/^[0-9a-f]{8}$/);
  });

  it("[I02-01][budget][AC-10] 相同输入：签名与完整规范化序列化同时相等", () => {
    const first = internalResultFixture();
    const second = internalResultFixture();
    expect(determinismSignature(first)).toBe(determinismSignature(second));
    expect(canonicalJson(deterministicView(first))).toBe(canonicalJson(deterministicView(second)));
  });

  it("[I02-01][budget][AC-10] 排除 wallClockMs / detail：签名与完整序列化都不变", () => {
    const base = internalResultFixture();
    const noisy = internalResultFixture({
      timing: { wallClockMs: 999 },
      diagnostics: { detail: "different" },
    });
    expect(determinismSignature(noisy)).toBe(determinismSignature(base));
    expect(canonicalJson(deterministicView(noisy))).toBe(canonicalJson(deterministicView(base)));
  });

  it("[I02-01][budget][AC-10] budgetProfile 不进签名，但完整序列化仍能区分", () => {
    const base = internalResultFixture();
    const changed = internalResultFixture({
      budget: { budgetProfile: budgetProfileFixture({ maxStates: 1 }) },
    });
    expect(determinismSignature(changed)).toBe(determinismSignature(base));
    expect(canonicalJson(deterministicView(changed))).not.toBe(canonicalJson(deterministicView(base)));
  });

  it("[I02-01][budget][AC-10] 覆盖 work / grid / 原因码 / 预算状态", () => {
    const base = internalResultFixture();
    const signature = determinismSignature(base);
    const variants = [
      internalResultFixture({ work: { cutPointsTotal: 4 } }),
      internalResultFixture({ grid: { phaseSteps: 11 } }),
      internalResultFixture({ diagnostics: { degradationReason: "no-witness-found" } }),
      internalResultFixture({ budget: { budgetStatus: "exhausted", budgetKind: "cut-budget" } }),
    ];
    for (const variant of variants) expect(determinismSignature(variant)).not.toBe(signature);
  });

  it("[I02-01][budget][AC-10] 键序不影响完整序列化与签名", () => {
    const result = internalResultFixture();
    const reordered = JSON.parse(canonicalJson(result)) as TemporalInternalResult;
    expect(determinismSignature(reordered)).toBe(determinismSignature(result));
    expect(canonicalJson(deterministicView(reordered))).toBe(canonicalJson(deterministicView(result)));
  });
});


// ── U5-02：预算闭合与降级硬化（AC-08） ─────────────────────────────────────
describe("I02-05 预算闭合与降级硬化（U5-02，AC-08）", () => {
  it("[I02-05][AC-08] 状态 / edge 触顶后，累计 cut 不得覆盖已有原因", () => {
    const stateFirst = createWitnessWorkBudget({
      profile: budgetProfileFixture({ maxStates: 1, maxCutsPerBranch: 1 }),
      now: () => 0,
    });
    expect(stateFirst.enqueueState(2)).toMatchObject({
      stopped: true, budgetKind: "state-budget", degradationReason: "state-budget-exhausted",
    });
    expect(stateFirst.recordCheck(5)).toMatchObject({
      stopped: true, budgetKind: "state-budget", degradationReason: "state-budget-exhausted",
    });

    const edgeFirst = createWitnessWorkBudget({
      profile: budgetProfileFixture({ maxEdges: 1, maxCutsPerBranch: 1 }),
      now: () => 0,
    });
    expect(edgeFirst.checkEdge(2)).toMatchObject({
      stopped: true, budgetKind: "edge-budget", degradationReason: "edge-budget-exhausted",
    });
    expect(edgeFirst.recordCheck(5)).toMatchObject({
      stopped: true, budgetKind: "edge-budget", degradationReason: "edge-budget-exhausted",
    });
  });

  it("[I02-05][AC-08] 刚好达上限不算超限；多 1 即触顶", () => {
    const states = createWitnessWorkBudget({
      profile: budgetProfileFixture({ maxStates: 2 }), now: () => 0,
    });
    expect(states.enqueueState(2).stopped).toBe(false);
    expect(states.enqueueState(1)).toMatchObject({ stopped: true, budgetKind: "state-budget" });

    const edges = createWitnessWorkBudget({
      profile: budgetProfileFixture({ maxEdges: 2 }), now: () => 0,
    });
    expect(edges.checkEdge(2).stopped).toBe(false);
    expect(edges.checkEdge(1)).toMatchObject({ stopped: true, budgetKind: "edge-budget" });

    const perCheck = createWitnessWorkBudget({
      profile: budgetProfileFixture({ maxCutsPerCheck: 2 }), now: () => 0,
    });
    expect(perCheck.recordCheck(2).stopped).toBe(false);
    expect(perCheck.recordCheck(3)).toMatchObject({ stopped: true, budgetKind: "cut-budget" });

    // maxCutsPerBranch 按 segments = cutPoints + 1 计：1 + 2 = 3 恰好达上限。
    const branch = createWitnessWorkBudget({
      profile: budgetProfileFixture({ maxCutsPerBranch: 3 }), now: () => 0,
    });
    expect(branch.recordCheck(0).stopped).toBe(false);
    expect(branch.recordCheck(1).stopped).toBe(false);
    expect(branch.recordCheck(0)).toMatchObject({ stopped: true, budgetKind: "cut-budget" });
    expect(branch.snapshot().segmentsTotal).toBe(3);
  });

  it("[I02-05][AC-08] 累计 cut 与状态 / edge 计数分列，且墙钟不进入语义预算", () => {
    const budget = createWitnessWorkBudget({
      profile: budgetProfileFixture(), now: () => 0,
    });
    expect(budget.recordCheck(2).stopped).toBe(false);
    const snapshot = budget.snapshot();
    expect(snapshot.cutPointsTotal).toBe(2);
    expect(snapshot.segmentsTotal).toBe(3);
    expect(snapshot.statesEnqueued).toBe(0);
    expect(snapshot.edgesChecked).toBe(0);
    expect(snapshot.wallClockMs).toBe(0);
  });
});
