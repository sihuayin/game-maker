// 五态归因器（Playtest V1 · 票 08）—— **纯函数，只吃运行证据**。
//
// ⚠️ 不吃 `expectedOutcome`、不吃场景名、不读文件：场景的**设计意图**与实际结果无关（票 02/04）。
// ⚠️ 阶段化决策（票 04 Q2）：prepare（not-executed / 环境故障）→ boot（环境故障 / UNKNOWN）→
//   execute（游戏失败 / 代理限制 / 超时 / UNKNOWN）→ evaluate（游戏失败 / UNKNOWN）。
//   `TIMEOUT` 只在 execute；超时与结构性不可判主因不可分时 `UNKNOWN` 优先。
// ⚠️ 断言 fail **不自动**升级为 GAMEPLAY_FAILURE：只有「环境健康 + 正面游戏故障证据」才成立。
// ⚠️ `AGENT_LIMITATION` 需要正面、可复现的能力边界证据，永不映射 fail/pass。
import {
  aggregatePlaytestOutcome, type InsufficientEvidence, type PlaytestOutcome,
  type PlaytestScenarioReport,
} from "./playtest.js";

export type PlaytestAttributionStage = "prepare" | "boot" | "execute" | "evaluate";
export type RuntimeErrorOrigin = "game" | "environment" | "unknown";

export type PlaytestRuntimeErrorEvidence = {
  kind: "console" | "exception";
  text: string;
  origin: RuntimeErrorOrigin;
};

/** 归因输入：**本次运行**的证据，不是场景契约的预期。 */
export type PlaytestAttributionEvidence = {
  scenario: PlaytestScenarioReport;
  /** 实际到达的最远阶段；prepare = 没开始。 */
  stage: PlaytestAttributionStage;
  environment: {
    healthy: boolean;
    chromeAvailable: boolean;
    sceneReadyObserved: boolean;
    pollGaps: number;
    /** 具体环境故障（Chrome 启动失败、站点加载失败、资源加载失败…）。 */
    failures: string[];
  };
  runtimeErrors: PlaytestRuntimeErrorEvidence[];
  action: {
    attempted: number;
    completed: number;
    timedOut: number;
    /** 场景声明的可行动作是否都已尝试（票 04 Q5 的「探索耗尽」）。 */
    explorationExhausted: boolean;
    /** 反复尝试 / 无进展的轨迹证据。 */
    stuck: boolean;
    progressPx: number;
    /** 能力参数 vs 关卡几何的可计算矛盾（>0 = 过不去）。 */
    capabilityGapPx?: number;
  };
  deadlineHit: boolean;
  /** 轮询断档 / 结构性不可判；与超时同时存在时 UNKNOWN 优先。 */
  structuralUndecidable: boolean;
  evidence: string[];
};

export type PlaytestAttributionResult =
  | { execution: "not-executed"; stage: "prepare"; reason: string; evidence: string[] }
  | {
      execution: "executed";
      stage: PlaytestAttributionStage;
      outcome: PlaytestOutcome;
      evidence: string[];
      insufficientEvidence?: InsufficientEvidence;
    };

const executed = (
  ev: PlaytestAttributionEvidence, stage: PlaytestAttributionStage, outcome: PlaytestOutcome,
  extra: { insufficientEvidence?: InsufficientEvidence } = {},
): PlaytestAttributionResult => ({
  execution: "executed", stage, outcome, evidence: [...ev.evidence],
  ...(extra.insufficientEvidence === undefined ? {} : { insufficientEvidence: extra.insufficientEvidence }),
});

const unknown = (
  ev: PlaytestAttributionEvidence, stage: PlaytestAttributionStage,
  ruleId: string, missingObservation: string, explanation: string,
): PlaytestAttributionResult => executed(ev, stage, "UNKNOWN", {
  insufficientEvidence: {
    ruleId,
    missingObservation,
    affectedAssertionIds: ev.scenario.assertions.filter((a) => a.result === "unknown").map((a) => a.id),
    explanation,
  },
});

function matcherPath(a: PlaytestScenarioReport["assertions"][number]): string | undefined {
  const e = a.expect as { kind?: string; path?: unknown; type?: unknown } | undefined;
  return e && typeof e.path === "string" ? e.path : undefined;
}

function envFailure(ev: PlaytestAttributionEvidence): boolean {
  if (!ev.environment.healthy && ev.environment.failures.length > 0) return true;
  if (!ev.environment.chromeAvailable) return true;
  return ev.runtimeErrors.some((e) => e.origin === "environment");
}

/**
 * 归因一个场景。**阶段优先、环境健康前置门、正面证据门槛**。
 */
export function attribute(ev: PlaytestAttributionEvidence): PlaytestAttributionResult {
  const s = ev.scenario;

  // ── prepare / boot：还没进入 execute ─────────────────────────────────────
  if (s.execution !== "executed") {
    if (ev.stage === "prepare") {
      if (ev.environment.failures.length > 0) return executed(ev, "prepare", "ENVIRONMENT_FAILURE");
      return { execution: "not-executed", stage: "prepare", reason: s.execution.reason, evidence: [...ev.evidence] };
    }
    if (ev.stage === "boot") {
      if (envFailure(ev)) return executed(ev, "boot", "ENVIRONMENT_FAILURE");
      return unknown(ev, "boot", "boot-not-ready-unresolved",
        "boot 截止时没有 scene-ready，且没有足够环境故障证据",
        "启动条件未满足；无法区分环境故障与结构性不可判，不能凭超时直接归环境故障或游戏失败");
    }
    return unknown(ev, ev.stage, "not-executed-without-stage",
      "执行状态与阶段不一致", "报告说未执行，但没有可用的阶段/拒绝原因");
  }

  // ── 环境健康前置门（票 04 Q4）────────────────────────────────────────────
  if (envFailure(ev)) return executed(ev, ev.stage, "ENVIRONMENT_FAILURE");
  if (!ev.environment.healthy)
    return unknown(ev, ev.stage, "environment-unhealthy-unexplained",
      "环境健康证据", "环境未证明健康，但没有具体故障；不能把游戏失败或代理限制当成结论");

  // ── runtime-error：来源与严重性判定（票 04 Q4）────────────────────────────
  const gameErrors = ev.runtimeErrors.filter((e) => e.origin === "game");
  const unknownErrors = ev.runtimeErrors.filter((e) => e.origin === "unknown");
  if (gameErrors.length > 0) return executed(ev, ev.stage, "GAMEPLAY_FAILURE");
  if (unknownErrors.length > 0)
    return unknown(ev, ev.stage, "runtime-error-origin-unresolved",
      "runtime-error 的来源与严重性",
      "捕获到错误，但无法判定它来自游戏逻辑还是环境/资源加载；仅有 console.error 不足以判游戏失败");

  const failed = s.assertions.filter((a) => a.result === "fail");

  // ── evaluate / execute：正面游戏失败证据（闭集）──────────────────────────
  // ① 初始态与关卡契约矛盾（例如 initialActivePickups 少于期望）。
  const initialContradiction = failed.find((a) => matcherPath(a) === "initialActivePickups");
  if (initialContradiction !== undefined) return executed(ev, ev.stage, "GAMEPLAY_FAILURE");
  // ② 与代理动作无关的不变量被违反（invariant 断言 fail）。
  const invariantViolation = failed.find((a) => a.kind === "invariant");
  if (invariantViolation !== undefined) return executed(ev, ev.stage, "GAMEPLAY_FAILURE");
  // ③ 终止条件达成但契约断言失败（如 won=true 但 collected < expected）。
  if (s.terminationReached && s.assertionAggregate === "fail")
    return executed(ev, ev.stage, "GAMEPLAY_FAILURE");
  // ④ 代理已到 gate 但 won=false —— 否定条件在窗口内可判（harness 只在可判时才给 fail）。
  const winContract = failed.find((a) => matcherPath(a) === "won");
  if (winContract !== undefined) return executed(ev, ev.stage, "GAMEPLAY_FAILURE");

  // ── SUCCESS：执行到底 + 实质断言 pass + 终止达成 + 零 unknown + 无报错 ───
  if (
    s.terminationReached &&
    s.assertions.length > 0 &&
    s.assertionAggregate === "pass" &&
    s.assertions.every((a) => a.result === "pass") &&
    ev.runtimeErrors.length === 0
  )
    return executed(ev, "evaluate", "SUCCESS");

  // ── 代理限制：正面能力边界证据（不是单纯超时）───────────────────────────
  const positiveLimitation =
    ev.action.attempted > 0 &&
    ((ev.action.explorationExhausted && (ev.action.stuck || (ev.action.capabilityGapPx ?? 0) > 0)) ||
      (ev.action.stuck && ev.action.progressPx < 10 && ev.action.attempted > 0));
  if (positiveLimitation && !s.terminationReached)
    return executed(ev, "execute", "AGENT_LIMITATION");

  // ── 超时 vs 结构性不可判 ─────────────────────────────────────────────────
  if (ev.structuralUndecidable)
    return unknown(ev, "execute", "timeout-and-undecidable",
      "连续轮询 / 可判证据", "截止期与结构性不可判同时存在，无法证明哪个是主因；UNKNOWN 优先");
  if (ev.deadlineHit && !s.terminationReached)
    return executed(ev, "execute", "TIMEOUT");

  // ── 其余：证据不足 ───────────────────────────────────────────────────────
  return unknown(ev, "evaluate", "insufficient-evidence",
    "终止条件或断言证据", "执行已结束但没有终止、没有可判定的失败证据，也没有明确的截止期归因");
}

export type PlaytestAttributionReport = {
  execution: "executed" | { status: "not-executed"; reason: string };
  aggregate?: PlaytestOutcome;
  results: Array<{ scenarioId: string; result: PlaytestAttributionResult }>;
};

/**
 * 多场景聚合（票 04 Q7）。调用方负责只传**交付场景**（harness 条件场景不进真实游戏聚合）。
 * `not-executed` 不参与 outcome 排序；必需场景未执行的资格判断留给 `mapPlaytest`。
 */
export function attributeReport(evidences: readonly PlaytestAttributionEvidence[]): PlaytestAttributionReport {
  const results = evidences.map((ev) => ({ scenarioId: ev.scenario.scenarioId, result: attribute(ev) }));
  const outcomes = results
    .filter((r) => r.result.execution === "executed")
    .map((r) => (r.result as Extract<PlaytestAttributionResult, { execution: "executed" }>).outcome);
  const aggregate = aggregatePlaytestOutcome(outcomes);
  if (aggregate !== undefined) return { execution: "executed", aggregate, results };
  const firstNotExecuted = results.find((r) => r.result.execution === "not-executed");
  const reason = firstNotExecuted?.result.execution === "not-executed" ? firstNotExecuted.result.reason : "没有场景执行";
  return { execution: { status: "not-executed", reason }, results };
}
