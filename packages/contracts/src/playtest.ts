// `playtest` —— 试玩报告、场景契约、交付摘要与**纯映射**（Playtest V1 · 票 07）。
//
// ⚠️ 三层分工（票 06 Q7）：
//   ① `PlaytestReportSchema`：harness 落盘的完整报告（身份、执行、场景、断言三值、事件计数）。
//      ⚠️ 票 07 只产「观测报告」——`outcome` / `aggregate` 可以缺席，由票 08 的归因器填入；
//      缺席 ≠ UNKNOWN，缺席是「还没归因」。
//   ② `DeliveryPlaytestSchema`：交付报告里的**最小摘要**，不是第二份报告。
//   ③ `mapPlaytest` / `aggregatePlaytestOutcome` / `aggregateAssertions`：纯函数，零 I/O。
//
// ⚠️ **观测是证据，不是判据**（票 03）：断言级三值不得越权替代五态归因；
//   这里只定义「报告长什么样、怎么聚合、怎么映射成交付状态」，不实现阶段化归因决策表（票 08）。
import { z } from "zod/v4";
import type { DeliveryCheckStatus } from "./delivery.js";

// ─────────────────────────────────────────────────────────────────────────────
// 一、版本与闭集
// ─────────────────────────────────────────────────────────────────────────────

export const PLAYTEST_REPORT_VERSION = "playtest-report/v1";
export const PLAYTEST_SCENARIO_VERSION = "playtest-scenario/v1";
export const PLAYTEST_HARNESS_VERSION = "playtest-harness/v1";
export const PLAYTEST_RULES_VERSION = "playtest-rules/v1";

/** 票 04 的五态 + `UNKNOWN`（归因不成立，不是第六种原因）。 */
export const PlaytestOutcome = z.enum([
  "SUCCESS",
  "GAMEPLAY_FAILURE",
  "ENVIRONMENT_FAILURE",
  "AGENT_LIMITATION",
  "TIMEOUT",
  "UNKNOWN",
]);
export type PlaytestOutcome = z.infer<typeof PlaytestOutcome>;

/** 执行状态：`not-executed` 不是 `PlaytestOutcome`（票 04 Q1）。 */
export const PlaytestExecutionSchema = z.union([
  z.literal("executed"),
  z.strictObject({ status: z.literal("not-executed"), reason: z.string().min(1) }),
]);
export type PlaytestExecution = z.infer<typeof PlaytestExecutionSchema>;

/** 票 03 的 11 类闭事件集。事件是状态差推导的边，不是外壳埋点。 */
export const PLAYTEST_EVENT_TYPES = [
  "scene-ready",
  "spawn",
  "pickup",
  "win",
  "chest-open",
  "danger-hit",
  "danger-erupt",
  "land",
  "jump",
  "reset",
  "runtime-error",
] as const;
export const PlaytestEventType = z.enum(PLAYTEST_EVENT_TYPES);
export type PlaytestEventType = z.infer<typeof PlaytestEventType>;

export const PlaytestEventSource = z.enum(["poll", "cdp"]);
export type PlaytestEventSource = z.infer<typeof PlaytestEventSource>;

/** 票 04 Q8 的结构化证据不足记录；`UNKNOWN` 的必填项。 */
export const InsufficientEvidenceSchema = z.strictObject({
  ruleId: z.string().min(1),
  missingObservation: z.string().min(1),
  affectedAssertionIds: z.array(z.string().min(1)),
  explanation: z.string().min(1),
});
export type InsufficientEvidence = z.infer<typeof InsufficientEvidenceSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 二、事件与断言三值
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_V = 1;

/**
 * `events.jsonl` 的一行。字段集见票 03 Q5；`source` 必须表达真实来源。
 * ⚠️ `params` **按事件类型**校验（票 03 Q5 约束 3）：不许任意字段混入后被下游当成可靠证据。
 */
const eventBase = {
  v: z.literal(EVENT_V),
  seq: z.number().int().nonnegative(),
  t: z.number().nonnegative(),
  frame: z.number().int().nonnegative().nullable(),
  actor: z.string().min(1).nullable(),
};
const pollEvent = (type: PlaytestEventType, params: z.ZodTypeAny) =>
  z.strictObject({ ...eventBase, type: z.literal(type), params, source: z.literal("poll") });

export const PlaytestEventSchema = z.discriminatedUnion("type", [
  pollEvent("scene-ready", z.strictObject({ x: z.number(), y: z.number(), onFloor: z.boolean() })),
  pollEvent("spawn", z.strictObject({ inferred: z.literal(true), x: z.number(), y: z.number(), onFloor: z.boolean() })),
  pollEvent("pickup", z.strictObject({
    count: z.number().int().positive(), indexes: z.array(z.number().int().nonnegative()),
    collected: z.number().int().nonnegative(), ambiguous: z.boolean(),
  })),
  pollEvent("win", z.strictObject({ collected: z.number().int().nonnegative() })),
  pollEvent("chest-open", z.strictObject({ collected: z.number().int().nonnegative() })),
  pollEvent("danger-hit", z.strictObject({ count: z.number().int().positive(), hits: z.number().int().nonnegative() })),
  pollEvent("danger-erupt", z.strictObject({ state: z.literal("active") })),
  pollEvent("land", z.strictObject({ inferred: z.literal(true) })),
  pollEvent("jump", z.strictObject({ inferred: z.literal(true) })),
  pollEvent("reset", z.strictObject({ fromX: z.number(), toX: z.number() })),
  z.strictObject({
    ...eventBase, type: z.literal("runtime-error"),
    params: z.strictObject({ kind: z.enum(["console", "exception"]), text: z.string() }),
    source: z.literal("cdp"),
  }),
]);
export type PlaytestEvent = z.infer<typeof PlaytestEventSchema>;

/** `input.jsonl` 的一行（票 05 Q1：实际发出的输入，不是状态快照 `trace`）。 */
export const PlaytestInputEventSchema = z.strictObject({
  type: z.enum(["keyDown", "keyUp"]),
  key: z.string().min(1),
  code: z.string().min(1),
  t: z.number().nonnegative(),
  seq: z.number().int().nonnegative(),
  source: z.string().min(1),
});
export type PlaytestInputEvent = z.infer<typeof PlaytestInputEventSchema>;

export const PlaytestAssertionResultSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(["state", "event", "invariant"]),
  requires: z.array(z.string().min(1)),
  result: z.enum(["pass", "fail", "unknown"]),
  observed: z.unknown().optional(),
  insufficientEvidence: InsufficientEvidenceSchema.optional(),
  evidence: z.array(z.string().min(1)).default([]),
}).superRefine((a, ctx) => {
  if (a.result === "unknown" && a.insufficientEvidence === undefined)
    ctx.addIssue({ code: "custom", path: ["insufficientEvidence"], message: "断言结果为 unknown 时必须给出结构化 InsufficientEvidence" });
  if (a.result !== "pass" && a.evidence.length === 0)
    ctx.addIssue({ code: "custom", path: ["evidence"], message: "非 pass 断言必须引用至少一条证据" });
});
export type PlaytestAssertionResult = z.infer<typeof PlaytestAssertionResultSchema>;

/** 场景级三值：任一 fail → fail；否则任一 unknown → unknown；全 pass → pass（票 02）。 */
export function aggregateAssertions(results: ReadonlyArray<{ result: "pass" | "fail" | "unknown" }>): "pass" | "fail" | "unknown" {
  if (results.some((r) => r.result === "fail")) return "fail";
  if (results.length === 0 || results.some((r) => r.result === "unknown")) return "unknown";
  return "pass";
}

// ─────────────────────────────────────────────────────────────────────────────
// 三、完整试玩报告（harness 落盘 / 票 08 归因后）
// ─────────────────────────────────────────────────────────────────────────────

const SHA256 = /^sha256:[0-9a-f]{64}$/;

export const PlaytestIdentitySchema = z.strictObject({
  /** 场景契约格式版本（解析格式）；每份场景自己的修订号住在场景报告里。 */
  scenarioFormatVersion: z.literal(PLAYTEST_SCENARIO_VERSION),
  /** 实际运行的 site / pack / config / shell 身份（票 02 Q3：主绑 site，不复制场景里的预期值）。 */
  siteVersion: z.number().int().positive(),
  packId: z.string().min(1),
  packVersion: z.number().int().positive(),
  packChecksum: z.string().regex(SHA256).optional(),
  configChecksum: z.string().regex(SHA256).optional(),
  shellVersion: z.string().min(1),
  harnessVersion: z.string().min(1),
  /** 判定规则版本：归因规则变了，旧报告不再按新规则解释。 */
  rulesVersion: z.string().min(1),
});
export type PlaytestIdentity = z.infer<typeof PlaytestIdentitySchema>;

export const PlaytestEndStateSchema = z.strictObject({
  collected: z.number().int().nonnegative(),
  won: z.boolean(),
  hits: z.number().int().nonnegative(),
  chestsOpened: z.number().int().nonnegative(),
  activePickups: z.number().int().nonnegative(),
  playerX: z.number().nullable(),
});
export type PlaytestEndState = z.infer<typeof PlaytestEndStateSchema>;

export const PlaytestBaselineComparisonSchema = z.strictObject({
  result: z.enum(["match", "changed", "not-comparable"]),
  baselineId: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  diff: z.unknown().optional(),
});
export type PlaytestBaselineComparison = z.infer<typeof PlaytestBaselineComparisonSchema>;

export const PlaytestScenarioReportSchema = z.strictObject({
  scenarioId: z.string().min(1),
  scenarioVersion: z.number().int().positive(),
  required: z.boolean(),
  /** 票 02 的层标记：harness 条件场景（no-chrome / hang）不进真实游戏交付聚合（票 04 Q2）。 */
  harnessCondition: z.enum(["none", "no-chrome", "hang"]).default("none"),
  /** 场景**设计意图**；与实际归因独立（票 02）。保留供 harness 自检，不参与归因。 */
  expectedOutcome: PlaytestOutcome,
  baselineEligible: z.boolean(),
  execution: PlaytestExecutionSchema,
  terminationReached: z.boolean(),
  assertions: z.array(PlaytestAssertionResultSchema),
  assertionAggregate: z.enum(["pass", "fail", "unknown"]),
  endState: PlaytestEndStateSchema,
  /** 初始观测（票 04：`failure-missing-pickup` 的断言必须落在初始态 pickup 缺失）。 */
  initialState: z.strictObject({
    collected: z.number().int().nonnegative(),
    won: z.boolean(),
    hits: z.number().int().nonnegative(),
    chestsOpened: z.number().int().nonnegative(),
    activePickups: z.number().int().nonnegative(),
  }),
  /** 语义动作的执行摘要（实际按键轨迹在 `input.jsonl`；票 02 要求动作轨迹可追溯）。 */
  actions: z.array(z.strictObject({
    kind: z.string().min(1),
    outcome: z.enum(["completed", "timeout", "failed", "skipped"]),
    durationMs: z.number().nonnegative(),
    steps: z.number().int().nonnegative(),
  })).default([]),
  /** 票 08 填入；票 07 的观测报告可以为缺席。 */
  outcome: PlaytestOutcome.optional(),
  insufficientEvidence: InsufficientEvidenceSchema.optional(),
  /** 本场景声明为「可靠且可比较」的事件计数（只统计这些类型；票 05 Q2 收紧）。 */
  comparableEvents: z.array(PlaytestEventType).default([]),
  eventCounts: z.record(z.string(), z.number().int().nonnegative()).default({}),
  evidence: z.array(z.string().min(1)).default([]),
  durationMs: z.number().nonnegative().optional(),
  steps: z.number().int().nonnegative().optional(),
}).superRefine((s, ctx) => {
  const aggregate = aggregateAssertions(s.assertions);
  if (s.assertionAggregate !== aggregate)
    ctx.addIssue({ code: "custom", path: ["assertionAggregate"], message: `断言聚合应为 ${aggregate}，实际 ${s.assertionAggregate}` });
  if (s.execution !== "executed" && s.outcome !== undefined)
    ctx.addIssue({ code: "custom", path: ["outcome"], message: "not-executed 场景不得带 outcome" });
  if (s.outcome === "UNKNOWN" && s.insufficientEvidence === undefined)
    ctx.addIssue({ code: "custom", path: ["insufficientEvidence"], message: "场景结果为 UNKNOWN 时必须给出结构化 InsufficientEvidence" });
  if (s.outcome !== undefined && s.outcome !== "SUCCESS" && s.evidence.length === 0)
    ctx.addIssue({ code: "custom", path: ["evidence"], message: "非 SUCCESS 场景必须引用至少一条证据" });
  if (s.outcome === "SUCCESS") {
    if (!s.terminationReached) ctx.addIssue({ code: "custom", path: ["terminationReached"], message: "SUCCESS 必须达成场景终止条件" });
    if (s.assertions.length === 0) ctx.addIssue({ code: "custom", path: ["assertions"], message: "SUCCESS 必须有至少一条实质断言" });
    if (s.assertions.some((a) => a.result !== "pass"))
      ctx.addIssue({ code: "custom", path: ["assertions"], message: "SUCCESS 要求全部断言 pass，且不得有 unknown/fail" });
  }
});
export type PlaytestScenarioReport = z.infer<typeof PlaytestScenarioReportSchema>;

export const PlaytestReportSchema = z.strictObject({
  reportVersion: z.literal(PLAYTEST_REPORT_VERSION),
  identity: PlaytestIdentitySchema,
  command: z.string().min(1),
  exitCode: z.number().int(),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  execution: PlaytestExecutionSchema,
  scenarios: z.array(PlaytestScenarioReportSchema).min(1),
  /** 票 08 填入；观测报告缺席。 */
  aggregate: PlaytestOutcome.optional(),
  runtime: z.strictObject({
    pollIntervalMs: z.number().int().positive(),
    stepDelayMs: z.number().int().positive(),
    scenarioTimeoutMs: z.number().int().positive(),
    viewport: z.strictObject({ w: z.number().int().positive(), h: z.number().int().positive() }),
    deviceScaleFactor: z.number().positive(),
    chromeFlags: z.array(z.string()),
    renderer: z.string().min(1).optional(),
  }),
  evidence: z.array(z.string().min(1)).default([]),
  baseline: PlaytestBaselineComparisonSchema.optional(),
}).superRefine((r, ctx) => {
  const executed = r.scenarios.filter((s) => s.execution === "executed");
  if (r.execution === "executed" && executed.length === 0)
    ctx.addIssue({ code: "custom", path: ["execution"], message: "整体 executed 但没有任何场景 executed" });
  if (r.execution !== "executed" && executed.length > 0)
    ctx.addIssue({ code: "custom", path: ["execution"], message: "整体 not-executed 但有场景 executed" });

  const withOutcome = executed.filter((s) => s.outcome !== undefined);
  if (withOutcome.length > 0 && withOutcome.length !== executed.length)
    ctx.addIssue({ code: "custom", path: ["scenarios"], message: "已执行场景要么都有 outcome，要么都没有（不得部分归因）" });
  if (withOutcome.length > 0) {
    if (r.aggregate === undefined)
      ctx.addIssue({ code: "custom", path: ["aggregate"], message: "场景已归因但报告没有 aggregate" });
    else {
      const expected = aggregatePlaytestOutcome(executed.map((s) => s.outcome!));
      if (expected !== r.aggregate)
        ctx.addIssue({ code: "custom", path: ["aggregate"], message: `aggregate 应为 ${expected}，实际 ${r.aggregate}` });
    }
  } else if (r.aggregate !== undefined) {
    ctx.addIssue({ code: "custom", path: ["aggregate"], message: "没有场景 outcome 却有 aggregate —— 归因从哪来？" });
  }
});
export type PlaytestReport = z.infer<typeof PlaytestReportSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 四、场景契约（声明式数据 + 薄解释器 / 票 02）
// ─────────────────────────────────────────────────────────────────────────────

export const PlaytestStatePath = z.enum(["collected", "won", "hits", "chestsOpened", "activePickups", "initialActivePickups"]);
export type PlaytestStatePath = z.infer<typeof PlaytestStatePath>;

const MatcherSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("state"),
    path: PlaytestStatePath,
    op: z.enum(["eq", "gte", "lte"]),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.strictObject({
    kind: z.literal("event"),
    type: PlaytestEventType,
    op: z.enum(["eq", "gte", "lte"]),
    value: z.number().int().nonnegative(),
  }),
  z.strictObject({
    kind: z.literal("invariant"),
    path: PlaytestStatePath,
    op: z.literal("eq"),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
]);
export type PlaytestMatcher = z.infer<typeof MatcherSchema>;

export const PlaytestAssertionSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(["state", "event", "invariant"]),
  /** 只能来自票 03 的闭事件集 + 状态快照字段。 */
  requires: z.array(z.string().min(1)),
  expect: MatcherSchema,
  withinMs: z.number().int().positive(),
  /** 写死：作者无权把「没证据」改判成 pass/fail。 */
  onInsufficient: z.literal("unknown").default("unknown"),
});
export type PlaytestAssertion = z.infer<typeof PlaytestAssertionSchema>;

export const PlaytestActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("move_to"), target: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("gate") }),
    z.strictObject({ kind: z.literal("pickup"), index: z.number().int().nonnegative() }),
  ]) }),
  z.strictObject({ kind: z.literal("jump_over"), target: z.strictObject({ kind: z.literal("hazard"), index: z.number().int().nonnegative() }) }),
  z.strictObject({ kind: z.literal("wait_until"), condition: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("won") }),
    z.strictObject({ kind: z.literal("collected"), value: z.number().int().nonnegative() }),
  ]), timeoutMs: z.number().int().positive() }),
  z.strictObject({ kind: z.literal("reach_goal") }),
  z.strictObject({ kind: z.literal("assert_state"), assertionId: z.string().min(1) }),
]);
export type PlaytestAction = z.infer<typeof PlaytestActionSchema>;

export const PlaytestSetupSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("none") }),
  z.strictObject({ kind: z.literal("remove-pickup"), index: z.number().int().nonnegative().default(0) }),
  z.strictObject({ kind: z.literal("mutate-hazard"), index: z.number().int().nonnegative().default(0), distance: z.number().nonnegative(), periodMs: z.number().int().positive().optional() }),
]);
export type PlaytestSetup = z.infer<typeof PlaytestSetupSchema>;

export const PlaytestScenarioSchema = z.strictObject({
  formatVersion: z.literal(PLAYTEST_SCENARIO_VERSION),
  id: z.string().min(1),
  version: z.number().int().positive(),
  required: z.boolean().default(true),
  /** 设计意图；实际结果由票 08 从证据独立归因。 */
  expectedOutcome: PlaytestOutcome,
  baselineEligible: z.boolean(),
  /** 版本绑定：主绑目标 site；pack/config 从实际 site 依赖解析（票 02 Q3）。 */
  target: z.strictObject({ siteVersion: z.number().int().positive() }),
  /** harness 条件场景（环境故障 / 超时注入）；正常游戏场景为 none。 */
  harnessCondition: z.enum(["none", "no-chrome", "hang"]).default("none"),
  setup: PlaytestSetupSchema.default({ kind: "none" }),
  actions: z.array(PlaytestActionSchema).min(1),
  assertions: z.array(PlaytestAssertionSchema).min(1),
  termination: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("won") }),
    z.strictObject({ kind: z.literal("collected"), value: z.number().int().nonnegative() }),
    z.strictObject({ kind: z.literal("never") }),
  ]),
  timeoutMs: z.number().int().positive(),
  pollIntervalMs: z.number().int().positive().default(50),
  stepDelayMs: z.number().int().positive().default(35),
  /** 只比较这些事件的计数（票 05 Q2：不是所有事件计数都天然必须一致）。 */
  comparableEvents: z.array(PlaytestEventType).default(["pickup", "win"]),
}).superRefine((s, ctx) => {
  const ids = new Set<string>();
  for (const [i, a] of s.assertions.entries()) {
    if (ids.has(a.id)) ctx.addIssue({ code: "custom", path: ["assertions", i, "id"], message: `断言 id 重复：${a.id}` });
    ids.add(a.id);
  }
  for (const [i, a] of s.actions.entries()) {
    if (a.kind === "assert_state" && !ids.has(a.assertionId))
      ctx.addIssue({ code: "custom", path: ["actions", i, "assertionId"], message: `动作引用了不存在的断言：${a.assertionId}` });
  }
});
export type PlaytestScenario = z.infer<typeof PlaytestScenarioSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 五、交付摘要 + 纯映射（票 06 Q7）
// ─────────────────────────────────────────────────────────────────────────────

export const DeliveryPlaytestScenarioSchema = z.strictObject({
  scenarioId: z.string().min(1),
  required: z.boolean(),
  execution: PlaytestExecutionSchema,
  outcome: PlaytestOutcome.optional(),
  /** refs → `delivery.evidence`；非 pass 场景至少一条。 */
  evidence: z.array(z.string().min(1)).default([]),
  /** UNKNOWN 必须留在场景级，不能只给一个模糊的报告级原因。 */
  insufficientEvidence: InsufficientEvidenceSchema.optional(),
}).superRefine((s, ctx) => {
  if (s.execution !== "executed" && s.outcome !== undefined)
    ctx.addIssue({ code: "custom", path: ["outcome"], message: "not-executed 场景不得带 outcome" });
  if (s.execution === "executed" && s.outcome === undefined)
    ctx.addIssue({ code: "custom", path: ["outcome"], message: "已执行场景必须带 outcome" });
  if (s.outcome === "UNKNOWN" && s.insufficientEvidence === undefined)
    ctx.addIssue({ code: "custom", path: ["insufficientEvidence"], message: "UNKNOWN 场景必须给出结构化 InsufficientEvidence" });
  if (s.outcome !== undefined && s.outcome !== "SUCCESS" && s.evidence.length === 0)
    ctx.addIssue({ code: "custom", path: ["evidence"], message: "非 SUCCESS 场景必须引用至少一条证据" });
});
export type DeliveryPlaytestScenario = z.infer<typeof DeliveryPlaytestScenarioSchema>;

export const DeliveryPlaytestSchema = z.strictObject({
  /** `run/v<N>/playtest/v<K>/result.json`，相对 out 根、POSIX。 */
  report: z.string().min(1),
  reportVersion: z.string().min(1),
  execution: PlaytestExecutionSchema,
  aggregate: PlaytestOutcome.optional(),
  scenarios: z.array(DeliveryPlaytestScenarioSchema).min(1),
  /** 报告级 refs → `delivery.evidence`。 */
  evidence: z.array(z.string().min(1)).default([]),
  /** 纯观察：永不参与 status/verdict（票 05 Q4）。 */
  baseline: PlaytestBaselineComparisonSchema.optional(),
}).superRefine((s, ctx) => {
  const executed = s.scenarios.filter((x) => x.execution === "executed");
  if (s.execution === "executed" && executed.length === 0)
    ctx.addIssue({ code: "custom", path: ["execution"], message: "整体 executed 但没有任何场景 executed" });
  if (s.execution !== "executed" && executed.length > 0)
    ctx.addIssue({ code: "custom", path: ["execution"], message: "整体 not-executed 但有场景 executed" });
  if (s.execution === "executed" && s.aggregate === undefined)
    ctx.addIssue({ code: "custom", path: ["aggregate"], message: "已执行摘要必须有 aggregate" });
  if (s.aggregate !== undefined) {
    const expected = aggregatePlaytestOutcome(executed.map((x) => x.outcome!));
    if (expected !== s.aggregate)
      ctx.addIssue({ code: "custom", path: ["aggregate"], message: `aggregate 应为 ${expected}，实际 ${s.aggregate}` });
  }
  if (s.execution !== "executed" && s.aggregate !== undefined)
    ctx.addIssue({ code: "custom", path: ["aggregate"], message: "not-executed 摘要不得带 aggregate" });
});
export type DeliveryPlaytest = z.infer<typeof DeliveryPlaytestSchema>;

/** 窄视图：`mapPlaytest` 只吃这些字段，不读文件、不验路径。 */
export type PlaytestReportView = {
  execution: PlaytestExecution;
  aggregate?: PlaytestOutcome;
  scenarios: ReadonlyArray<{
    scenarioId: string;
    required: boolean;
    execution: PlaytestExecution;
    outcome?: PlaytestOutcome;
  }>;
};

/** 五态优先级（票 04 Q2 / 票 06 Q7）：`GAMEPLAY_FAILURE > ENVIRONMENT_FAILURE > TIMEOUT > AGENT_LIMITATION > UNKNOWN > SUCCESS`。 */
const OUTCOME_PRIORITY: readonly PlaytestOutcome[] = [
  "GAMEPLAY_FAILURE", "ENVIRONMENT_FAILURE", "TIMEOUT", "AGENT_LIMITATION", "UNKNOWN", "SUCCESS",
];

/** 已执行场景的 outcome 聚合；没有已执行 outcome ⇒ `undefined`。`not-executed` 不参与排序。 */
export function aggregatePlaytestOutcome(outcomes: readonly PlaytestOutcome[]): PlaytestOutcome | undefined {
  if (outcomes.length === 0) return undefined;
  for (const o of OUTCOME_PRIORITY) if (outcomes.includes(o)) return o;
  return undefined;
}

/**
 * 纯映射：试玩结果 → `playable-smoke` 检查项状态与 detail。
 *
 * 规则（票 06 Q7）：
 *   - 没有报告 ⇒ `blocked`
 *   - 整体 not-executed ⇒ `blocked` + `not-executed`
 *   - aggregate=GAMEPLAY_FAILURE ⇒ `fail`（即使必需场景未执行，fail 优先）
 *   - 必需场景未执行（且无 fail）⇒ `blocked`（`aggregate=SUCCESS` 不等于 pass）
 *   - SUCCESS ⇒ `pass`；ENVIRONMENT_FAILURE ⇒ `blocked`；TIMEOUT/AGENT_LIMITATION/UNKNOWN ⇒ `incomplete`
 */
export function mapPlaytest(view: PlaytestReportView | undefined): { status: DeliveryCheckStatus; detail?: string } {
  if (view === undefined) return { status: "blocked" };
  if (view.execution !== "executed") return { status: "blocked", detail: "not-executed" };

  const executed = view.scenarios.filter((s) => s.execution === "executed" && s.outcome !== undefined);
  const aggregate = view.aggregate ?? aggregatePlaytestOutcome(executed.map((s) => s.outcome!));
  if (aggregate === undefined) return { status: "incomplete", detail: "UNKNOWN" };

  if (aggregate === "GAMEPLAY_FAILURE") return { status: "fail", detail: "GAMEPLAY_FAILURE" };

  const missingRequired = view.scenarios.filter((s) => s.required && s.execution !== "executed");
  if (missingRequired.length > 0)
    return { status: "blocked", detail: `blocked: 必需场景未执行（${missingRequired.map((s) => s.scenarioId).join(", ")}）` };

  switch (aggregate) {
    case "SUCCESS": return { status: "pass", detail: "SUCCESS" };
    case "ENVIRONMENT_FAILURE": return { status: "blocked", detail: "ENVIRONMENT_FAILURE" };
    case "TIMEOUT":
    case "AGENT_LIMITATION":
    case "UNKNOWN":
      return { status: "incomplete", detail: aggregate };
  }
}

/**
 * 从完整报告投影交付摘要。⚠️ 只投影，不决定 verdict；身份校验在写回层（票 06 Q7）。
 * `reportPath` 是相对 out 根的 POSIX 路径。
 */
export function playtestSummaryOf(report: PlaytestReport, reportPath: string): DeliveryPlaytest {
  return DeliveryPlaytestSchema.parse({
    report: reportPath,
    reportVersion: report.reportVersion,
    execution: report.execution,
    ...(report.aggregate === undefined ? {} : { aggregate: report.aggregate }),
    scenarios: report.scenarios.map((s) => ({
      scenarioId: s.scenarioId,
      required: s.required,
      execution: s.execution,
      ...(s.outcome === undefined ? {} : { outcome: s.outcome }),
      evidence: [...s.evidence],
      ...(s.insufficientEvidence === undefined ? {} : { insufficientEvidence: s.insufficientEvidence }),
    })),
    // `playtest-result` 是约定 ref；报告自己的 evidence 可以不含它（它由写回层加路径）。
    evidence: ["playtest-result", ...report.evidence.filter((r) => r !== "playtest-result")],
    ...(report.baseline === undefined ? {} : { baseline: report.baseline }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 六、规范化投影（票 05 Q2：判定确定、轨迹不参与）
// ─────────────────────────────────────────────────────────────────────────────

/** 一次运行的规范化投影：只含「必须一致」的字段；位置/时间戳/事件顺序不在内。 */
export const PlaytestProjectionSchema = z.strictObject({
  scenarioId: z.string().min(1),
  outcome: PlaytestOutcome.nullable(),
  assertions: z.array(z.strictObject({ id: z.string().min(1), result: z.enum(["pass", "fail", "unknown"]) })),
  endState: z.strictObject({
    collected: z.number().int().nonnegative(),
    won: z.boolean(),
    hits: z.number().int().nonnegative(),
    chestsOpened: z.number().int().nonnegative(),
    activePickups: z.number().int().nonnegative(),
  }),
  eventCounts: z.record(z.string(), z.number().int().nonnegative()),
});
export type PlaytestProjection = z.infer<typeof PlaytestProjectionSchema>;

export function playtestProjectionOf(scenario: PlaytestScenarioReport): PlaytestProjection {
  const eventCounts: Record<string, number> = {};
  for (const t of scenario.comparableEvents) eventCounts[t] = scenario.eventCounts[t] ?? 0;
  return {
    scenarioId: scenario.scenarioId,
    outcome: scenario.outcome ?? null,
    assertions: scenario.assertions.map((a) => ({ id: a.id, result: a.result })),
    endState: {
      collected: scenario.endState.collected,
      won: scenario.endState.won,
      hits: scenario.endState.hits,
      chestsOpened: scenario.endState.chestsOpened,
      activePickups: scenario.endState.activePickups,
    },
    eventCounts,
  };
}

/** 两个投影是否一致；比较前按断言 id / 事件类型排序，避免声明顺序漂移。 */
export function samePlaytestProjection(a: PlaytestProjection, b: PlaytestProjection): boolean {
  return canonicalProjection(a) === canonicalProjection(b);
}

export function canonicalProjection(p: PlaytestProjection): string {
  const assertions = [...p.assertions].sort((x, y) => x.id.localeCompare(y.id));
  const eventCounts = Object.fromEntries(Object.entries(p.eventCounts).sort(([x], [y]) => x.localeCompare(y)));
  return JSON.stringify({ ...p, assertions, eventCounts });
}
