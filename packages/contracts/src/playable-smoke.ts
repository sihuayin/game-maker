// **试玩结果 → 交付检查项的映射**（FPVS-V1-P1 · 票 09）。
//
// ⚠️ 这里只做**解释**，不跑 smoke、不改 `playable-smoke.mjs`（票 05 Q4：现有 stage + reason +
//   截图 + console/exceptions 已是当前版本的证据粒度）。输入是 `playable-smoke.mjs` 已经落盘的
//   `<out>/playable/result.json`（**松散形状，不是契约** —— 它是探针产出，不是交付产物）。
//
// ⚠️ **失败归因只有三档**（票 05 Q2）：`GAMEPLAY_FAILURE` / `AGENT_LIMITATION` / `UNKNOWN`。
//   本映射**永远不产 `AGENT_LIMITATION`**（票 05 Q3：没有真人实测通关或确定性无碰撞通路证据，
//   就不提前把「推测试玩器受限」写成确定结论）。
//
// ⚠️ **确定性玩法失败** = `playable-smoke.mjs` 里那些**非超时**的失败 stage（不是「跑不动了」，
//   是「观察到了一个具体的坏行为」）：
//     `floor`   —— 玩家掉穿地面（碰撞/地面 bug）
//     `win`     —— 到 gate 但 `won=false`，或 `won=true` 但 `collected < expected`（胜利判定 bug）
//     `runtime` —— 核心循环完成但页面有 console.error / 未捕获异常（运行时 bug）
//   超时阶段 `move` / `pickup` / `navigate` 是「没跑完、原因未定」⇒ 归 UNKNOWN，不自动归因。
import type { DeliveryCheckStatus, DeliveryEvidence } from "./delivery.js";

/** `playable-smoke.mjs` 落盘的那份 `result.json` 里，映射只认这五个字段（其余一概不碰）。 */
export type PlayableSmokeResult = {
  ok: boolean;
  stage?: string;
  reason?: string;
  expected?: string;
};

/** 失败归因的三档（票 05 Q2）。⚠️ `AGENT_LIMITATION` 本映射不产（见文件头）。 */
export type PlayableSmokeAttribution = "GAMEPLAY_FAILURE" | "AGENT_LIMITATION" | "UNKNOWN";

/** 确定性玩法失败的那几个 stage（非超时）。 */
export const PLAYABLE_SMOKE_GAMEPLAY_FAILURE_STAGES = ["floor", "win", "runtime"] as const;

/**
 * smoke 结果 → `playable-smoke` 检查项的状态与归因。
 *
 *   `undefined`（没跑，前置失败）→ `blocked`
 *   `ok:true`（核心循环跑通）    → `pass`
 *   `ok:false` + 确定性失败 stage → `fail` + `GAMEPLAY_FAILURE`
 *   `ok:false` 其余（超时等）     → `incomplete` + `UNKNOWN`（默认，不自动归因）
 *
 * ⚠️ 「不适用」不在这里 —— 那是调用方按游戏类型决定的事；本图 `playable-smoke` 恒必需，
 *   标 `not-required` 会被 `DeliveryReportSchema` 拒（票 08）。
 */
export function mapPlayableSmoke(
  result: PlayableSmokeResult | undefined,
): { status: DeliveryCheckStatus; detail?: PlayableSmokeAttribution } {
  if (result === undefined) return { status: "blocked" };
  if (result.ok) return { status: "pass" };
  if (result.stage !== undefined && (PLAYABLE_SMOKE_GAMEPLAY_FAILURE_STAGES as readonly string[]).includes(result.stage))
    return { status: "fail", detail: "GAMEPLAY_FAILURE" };
  return { status: "incomplete", detail: "UNKNOWN" };
}

/**
 * 已知限制（票 05 Q3 更严格证据标准）：`navigate` 超时 = 自动玩家卡在移动宽巡逻，**归 UNKNOWN 而非
 * AGENT_LIMITATION**。措辞事实化，不把「推测」写成「确定」。
 *
 * ⚠️ 这条措辞**特指**已知的 3/4 场景（`stage:"navigate"`、`collected=1/4`、宽巡逻）。若将来 `navigate`
 *   对应的是别的场景，这条措辞得跟着改 —— 它**不是**「navigate 恒等于宽巡逻」的通用规则。
 */
export const PLAYABLE_SMOKE_NAVIGATE_KNOWN_LIMITATION =
  "自动玩家在移动宽巡逻处未完成核心循环；存在试玩器受限的可能（跳 ~66px < 巡逻 100px 且巡逻移动），" +
  "但无真人实测通关或无碰撞通路证据，原因未确定";

export function playableSmokeKnownLimitations(result: PlayableSmokeResult | undefined): string[] {
  if (result === undefined || result.ok || result.stage !== "navigate") return [];
  return [PLAYABLE_SMOKE_NAVIGATE_KNOWN_LIMITATION];
}

/**
 * smoke 证据引用（票 09 项 2）：`result.json` / `console.json` / `exceptions.json` 恒有；
 * 失败再补一张 `fail-<stage>.png`。⚠️ 路径用 `/` 拼（与 `rel()` 同一套 POSIX 风格）。
 */
export function playableSmokeEvidence(
  result: PlayableSmokeResult | undefined,
  smokeDir: string,
): DeliveryEvidence[] {
  const dir = smokeDir.replace(/\/+$/, "");
  const evidence: DeliveryEvidence[] = [
    { ref: "smoke-result", path: `${dir}/result.json` },
    { ref: "smoke-console", path: `${dir}/console.json` },
    { ref: "smoke-exceptions", path: `${dir}/exceptions.json` },
  ];
  if (result !== undefined && !result.ok && result.stage !== undefined)
    evidence.push({ ref: "smoke-screenshot", path: `${dir}/fail-${result.stage}.png` });
  return evidence;
}
