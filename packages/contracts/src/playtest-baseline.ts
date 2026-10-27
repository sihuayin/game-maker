// 试玩回归基线（Playtest V1 · 票 09）—— 自足 JSON + 三值比较器 + 晋升校验。
//
// ⚠️ **纯观察**（票 05 Q4）：比较结果不改 `PlaytestOutcome`、断言三值、`DeliveryCheckStatus` 或
//   `DeliveryVerdict`；`changed` 只能叫「与基线不同」，不是「回归失败」。
// ⚠️ **身份不匹配 ⇒ `not-comparable`**，不是 `changed` / `match`；覆盖外字段一律不比较。
// ⚠️ `not-comparable` 不得被读成 `match`；覆盖字段缺失/unknown 也归 `not-comparable`。
import { z } from "zod/v4";
import {
  PlaytestEventType, PlaytestOutcome,
  type PlaytestOutcome as Outcome, type PlaytestReport, type PlaytestScenarioReport,
} from "./playtest.js";

export const PLAYTEST_BASELINE_FORMAT = "playtest-baseline/v1";
const SHA256 = /^sha256:[0-9a-f]{64}$/;

export const PlaytestBaselineIdentitySchema = z.strictObject({
  scenarioFormatVersion: z.string().min(1),
  scenarioId: z.string().min(1),
  scenarioVersion: z.number().int().positive(),
  siteVersion: z.number().int().positive(),
  packId: z.string().min(1),
  packVersion: z.number().int().positive(),
  packChecksum: z.string().regex(SHA256).optional(),
  configChecksum: z.string().regex(SHA256).optional(),
  shellVersion: z.string().min(1),
  harnessVersion: z.string().min(1),
  rulesVersion: z.string().min(1),
});
export type PlaytestBaselineIdentity = z.infer<typeof PlaytestBaselineIdentitySchema>;

export const PlaytestBaselineCoverageSchema = z.strictObject({
  assertions: z.array(z.string().min(1)).default([]),
  endState: z.array(z.enum(["collected", "won", "hits", "chestsOpened", "activePickups"])).default([]),
  events: z.array(PlaytestEventType).default([]),
}).superRefine((c, ctx) => {
  if (c.assertions.length === 0 && c.endState.length === 0 && c.events.length === 0)
    ctx.addIssue({ code: "custom", path: [], message: "coverage 不能为空 —— 没有比较范围就没有基线" });
});
export type PlaytestBaselineCoverage = z.infer<typeof PlaytestBaselineCoverageSchema>;

const EndValue = z.union([z.number(), z.boolean()]);
export const PlaytestBaselineExpectedSchema = z.strictObject({
  outcome: PlaytestOutcome,
  assertions: z.record(z.string(), z.enum(["pass", "fail", "unknown"])).default({}),
  endState: z.record(z.string(), EndValue).default({}),
  eventCounts: z.record(z.string(), z.number().int().nonnegative()).default({}),
});
export type PlaytestBaselineExpected = z.infer<typeof PlaytestBaselineExpectedSchema>;

export const PlaytestBaselineSourceSchema = z.strictObject({
  runId: z.string().min(1),
  reportPath: z.string().min(1),
  reportChecksum: z.string().regex(SHA256),
  secondRunId: z.string().min(1),
  secondReportPath: z.string().min(1),
  secondReportChecksum: z.string().regex(SHA256),
  promotedBy: z.string().min(1),
  promotedAt: z.string().min(1),
  reason: z.string().min(1),
});
export type PlaytestBaselineSource = z.infer<typeof PlaytestBaselineSourceSchema>;

export const PlaytestBaselineSchema = z.strictObject({
  baselineFormatVersion: z.literal(PLAYTEST_BASELINE_FORMAT),
  baselineId: z.string().min(1),
  identity: PlaytestBaselineIdentitySchema,
  coverage: PlaytestBaselineCoverageSchema,
  expected: PlaytestBaselineExpectedSchema,
  source: PlaytestBaselineSourceSchema,
}).superRefine((b, ctx) => {
  for (const id of b.coverage.assertions)
    if (!(id in b.expected.assertions)) ctx.addIssue({ code: "custom", path: ["expected", "assertions"], message: `覆盖断言缺 expected：${id}` });
  for (const k of b.coverage.endState)
    if (!(k in b.expected.endState)) ctx.addIssue({ code: "custom", path: ["expected", "endState"], message: `覆盖终态缺 expected：${k}` });
  for (const t of b.coverage.events)
    if (!(t in b.expected.eventCounts)) ctx.addIssue({ code: "custom", path: ["expected", "eventCounts"], message: `覆盖事件缺 expected：${t}` });
  for (const id of Object.keys(b.expected.assertions))
    if (!b.coverage.assertions.includes(id)) ctx.addIssue({ code: "custom", path: ["expected", "assertions"], message: `expected 含覆盖外断言：${id}` });
  for (const k of Object.keys(b.expected.endState))
    if (!(b.coverage.endState as readonly string[]).includes(k)) ctx.addIssue({ code: "custom", path: ["expected", "endState"], message: `expected 含覆盖外终态：${k}` });
  for (const t of Object.keys(b.expected.eventCounts))
    if (!(b.coverage.events as readonly string[]).includes(t)) ctx.addIssue({ code: "custom", path: ["expected", "eventCounts"], message: `expected 含覆盖外事件：${t}` });
});
export type PlaytestBaseline = z.infer<typeof PlaytestBaselineSchema>;

export type BaselineDiff = { path: string; baseline: unknown; current: unknown };
export type PlaytestBaselineCompareResult = {
  result: "match" | "changed" | "not-comparable";
  baselineId?: string;
  reason?: string;
  diff?: BaselineDiff[];
};

function identityMismatch(report: PlaytestReport, scenario: PlaytestScenarioReport, b: PlaytestBaseline): string | undefined {
  const id = report.identity;
  const checks: Array<[string, unknown, unknown]> = [
    ["scenarioFormatVersion", id.scenarioFormatVersion, b.identity.scenarioFormatVersion],
    ["scenarioId", scenario.scenarioId, b.identity.scenarioId],
    ["scenarioVersion", scenario.scenarioVersion, b.identity.scenarioVersion],
    ["siteVersion", id.siteVersion, b.identity.siteVersion],
    ["packId", id.packId, b.identity.packId],
    ["packVersion", id.packVersion, b.identity.packVersion],
    ["packChecksum", id.packChecksum, b.identity.packChecksum],
    ["configChecksum", id.configChecksum, b.identity.configChecksum],
    ["shellVersion", id.shellVersion, b.identity.shellVersion],
    ["harnessVersion", id.harnessVersion, b.identity.harnessVersion],
    ["rulesVersion", id.rulesVersion, b.identity.rulesVersion],
  ];
  for (const [k, a, c] of checks) {
    if (a === undefined && c === undefined) continue;
    if (a !== c) return `${k} 不匹配：报告 ${String(a)} / 基线 ${String(c)}`;
  }
  return undefined;
}

/** 比较一份报告里的基线场景。**纯观察**：只返回三值 + diff，不改任何状态。 */
export function comparePlaytestToBaseline(report: PlaytestReport, baseline: PlaytestBaseline): PlaytestBaselineCompareResult {
  const scenario = report.scenarios.find((s) => s.scenarioId === baseline.identity.scenarioId);
  if (scenario === undefined)
    return { result: "not-comparable", baselineId: baseline.baselineId, reason: `报告里没有场景 ${baseline.identity.scenarioId}` };
  const mismatch = identityMismatch(report, scenario, baseline);
  if (mismatch !== undefined) return { result: "not-comparable", baselineId: baseline.baselineId, reason: mismatch };
  if (scenario.execution !== "executed")
    return { result: "not-comparable", baselineId: baseline.baselineId, reason: "场景未执行，不能比较" };
  if (scenario.outcome === undefined)
    return { result: "not-comparable", baselineId: baseline.baselineId, reason: "场景未归因，不能比较" };

  const diff: BaselineDiff[] = [];
  if (scenario.outcome !== baseline.expected.outcome)
    diff.push({ path: "outcome", baseline: baseline.expected.outcome, current: scenario.outcome });

  for (const id of baseline.coverage.assertions) {
    const a = scenario.assertions.find((x) => x.id === id);
    if (a === undefined) return { result: "not-comparable", baselineId: baseline.baselineId, reason: `覆盖断言缺失：${id}` };
    if (a.result === "unknown") return { result: "not-comparable", baselineId: baseline.baselineId, reason: `覆盖断言 unknown：${id}` };
    const expected = baseline.expected.assertions[id];
    if (a.result !== expected) diff.push({ path: `assertions.${id}`, baseline: expected, current: a.result });
  }
  for (const k of baseline.coverage.endState) {
    const current = scenario.endState[k];
    if (current === undefined) return { result: "not-comparable", baselineId: baseline.baselineId, reason: `覆盖终态缺失：${k}` };
    const expected = baseline.expected.endState[k];
    if (current !== expected) diff.push({ path: `endState.${k}`, baseline: expected, current });
  }
  for (const t of baseline.coverage.events) {
    if (!Object.prototype.hasOwnProperty.call(scenario.eventCounts, t))
      return { result: "not-comparable", baselineId: baseline.baselineId, reason: `覆盖事件计数缺失：${t}` };
    const current = scenario.eventCounts[t];
    const expected = baseline.expected.eventCounts[t];
    if (current !== expected) diff.push({ path: `eventCounts.${t}`, baseline: expected, current });
  }
  return diff.length === 0
    ? { result: "match", baselineId: baseline.baselineId }
    : { result: "changed", baselineId: baseline.baselineId, diff };
}

/** 一次干净运行的问题清单；空 = 可以参与晋升。 */
export function baselineCleanRunIssues(report: PlaytestReport, scenarioId: string, coverage: PlaytestBaselineCoverage): string[] {
  const issues: string[] = [];
  const scenario = report.scenarios.find((s) => s.scenarioId === scenarioId);
  if (scenario === undefined) return [`报告里没有场景 ${scenarioId}`];
  if (report.execution !== "executed") issues.push("报告整体未执行");
  if (scenario.execution !== "executed") issues.push("场景未执行");
  if (scenario.outcome === undefined) issues.push("场景未归因");
  if (scenario.outcome === "UNKNOWN") issues.push("场景结果为 UNKNOWN");
  if (scenario.evidence.length === 0) issues.push("场景没有证据引用");
  if ((scenario.eventCounts["runtime-error"] ?? 0) > 0) issues.push("运行期有 runtime-error（未归因运行错误）");
  for (const id of coverage.assertions) {
    const a = scenario.assertions.find((x) => x.id === id);
    if (a === undefined) issues.push(`覆盖断言缺失：${id}`);
    else if (a.result === "unknown") issues.push(`覆盖断言 unknown：${id}`);
  }
  for (const k of coverage.endState) if (scenario.endState[k] === undefined) issues.push(`覆盖终态缺失：${k}`);
  for (const t of coverage.events) if (!Object.prototype.hasOwnProperty.call(scenario.eventCounts, t)) issues.push(`覆盖事件计数缺失：${t}`);
  return issues;
}

/** 从一份干净报告构造 baseline 的 identity / expected（晋升时调用；不写文件）。 */
export function expectedOf(report: PlaytestReport, scenarioId: string, coverage: PlaytestBaselineCoverage): { identity: PlaytestBaselineIdentity; expected: PlaytestBaselineExpected } {
  const scenario = report.scenarios.find((s) => s.scenarioId === scenarioId);
  if (scenario === undefined) throw new Error(`报告里没有场景 ${scenarioId}`);
  if (scenario.execution !== "executed" || scenario.outcome === undefined)
    throw new Error(`场景 ${scenarioId} 未执行/未归因 —— 不能作为基线`);
  const assertions: Record<string, "pass" | "fail" | "unknown"> = {};
  for (const id of coverage.assertions) {
    const a = scenario.assertions.find((x) => x.id === id);
    if (a === undefined) throw new Error(`覆盖断言缺失：${id}`);
    assertions[id] = a.result;
  }
  const endState: Record<string, number | boolean> = {};
  for (const k of coverage.endState) {
    const v = scenario.endState[k];
    if (v === undefined) throw new Error(`覆盖终态缺失：${k}`);
    endState[k] = v;
  }
  const eventCounts: Record<string, number> = {};
  for (const t of coverage.events) {
    const v = scenario.eventCounts[t];
    if (v === undefined) throw new Error(`覆盖事件计数缺失：${t}`);
    eventCounts[t] = v;
  }
  return {
    identity: {
      scenarioFormatVersion: report.identity.scenarioFormatVersion,
      scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      siteVersion: report.identity.siteVersion,
      packId: report.identity.packId,
      packVersion: report.identity.packVersion,
      ...(report.identity.packChecksum === undefined ? {} : { packChecksum: report.identity.packChecksum }),
      ...(report.identity.configChecksum === undefined ? {} : { configChecksum: report.identity.configChecksum }),
      shellVersion: report.identity.shellVersion,
      harnessVersion: report.identity.harnessVersion,
      rulesVersion: report.identity.rulesVersion,
    },
    expected: { outcome: scenario.outcome, assertions, endState, eventCounts },
  };
}

/** 两份 expected 是否完全一致（晋升的「连续两次干净运行投影一致」）。 */
export function sameBaselineExpected(a: PlaytestBaselineExpected, b: PlaytestBaselineExpected): boolean {
  const sort = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y)));
  return JSON.stringify({ ...a, assertions: sort(a.assertions), endState: sort(a.endState), eventCounts: sort(a.eventCounts) }) ===
    JSON.stringify({ ...b, assertions: sort(b.assertions), endState: sort(b.endState), eventCounts: sort(b.eventCounts) });
}
