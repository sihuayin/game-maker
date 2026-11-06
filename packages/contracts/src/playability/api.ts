// **可玩性统一入口**（LP-05）—— C1 加法导出：`auditPlayability` / `playabilityIssues`。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、三层组合，整关三态
//
//   spatial（LP-02）→ mechanic（LP-03）→ completion（LP-04）。
//   completion 接收已算好的 spatial / mechanic 结果作为 `prior`，避免重复建图。
//
//   整关 verdict = 三层 verdict 的组合（用户 2026-11-06 裁定，LP-04 / LP-06 的 19/16/4）：
//     1. 任一层 PROVEN_UNPLAYABLE ⇒ PROVEN_UNPLAYABLE；
//     2. 否则任一层 INSUFFICIENT_EVIDENCE ⇒ INSUFFICIENT_EVIDENCE；
//     3. 否则 NO_PROVEN_BLOCKER。
//
//   ⚠️ `coverage.spatial` 恒为 partial（玩家 / 帧几何不可见）；`coverage` 与 verdict **分开**
//     暴露。允许 `NO_PROVEN_BLOCKER + coverage.spatial = partial`，但**不得**读成
//     `PROVEN_PLAYABLE`。framework §3.3 的「任一维 partial ⇒ INSUFFICIENT」是更严的默认；
//     用户裁定按层 verdict 组合、让 19/16/4 的案例级分布可复现，coverage 仍作为独立诊断保留。
//     两种读法都不产 issue；只有 PROVEN_UNPLAYABLE 会硬拒。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、issue 只由 PROVEN_UNPLAYABLE 派生
//
//   `playabilityIssues` 只映射**阻断型** evidence（空间诊断 `SPAWN_*` / `MIDAIR_*` 不算），
//   `severity:"error"`、`where = target`、`message = detail`，**不带 `code`**。
//   INSUFFICIENT_EVIDENCE / NO_PROVEN_BLOCKER 一条 issue 都不产。
//
//   同一目标只留一条：层间优先级 spatial > mechanic > completion；另一条根因并入 `detail`。

import type { AssetPackManifest } from "../assetpack.js";
import { playerMoveOf } from "../game-config.js";
import type { ConfigIssue, GameConfig } from "../game-config.js";
import { FIXED_RUNTIME_PROFILE } from "./profile.js";
import type { FixedRuntimeProfile } from "./profile.js";
import { buildMovementGraph } from "./graph.js";
import { assessReachability } from "./reach.js";
import { collectTargets } from "./targets.js";
import { auditSpatial, SPATIAL_NON_BLOCKING } from "./spatial.js";
import { auditMechanic } from "./mechanic.js";
import { auditCompletion } from "./completion.js";
import type {
  PlayabilityCoverage, PlayabilityEvidence, PlayabilityVerdictState,
} from "./verdict.js";

export type PlayabilityVerdict = {
  readonly verdict: PlayabilityVerdictState;
  readonly evidence: readonly PlayabilityEvidence[];
  readonly coverage: PlayabilityCoverage;
};

/** 层间优先级：同一目标保留更基础的根因。 */
const layerRank = (judgmentId: string): number =>
  judgmentId.startsWith("PLAYABILITY_SPATIAL_") ? 0
    : judgmentId.startsWith("PLAYABILITY_MECHANIC_") ? 1
      : 2;

const isBlocking = (judgmentId: string): boolean => !SPATIAL_NON_BLOCKING.has(judgmentId);

/**
 * 三层组合的可玩性判定。
 *
 * @param profile 测试可以注入显式 profile；生产调用方不传。
 * @returns 整关三态 + evidence + 三维 coverage（内部结果，不落盘）。
 */
export function auditPlayability(
  config: GameConfig,
  manifest: AssetPackManifest,
  profile: FixedRuntimeProfile = FIXED_RUNTIME_PROFILE,
): PlayabilityVerdict {
  // 建一次 base 图 + 一次全量可达评估，三层共用（LP-05 的性能约束）。
  const graph = buildMovementGraph(config, manifest, profile);
  const base = graph === null
    ? undefined
    : {
        graph,
        assessment: assessReachability(graph, playerMoveOf(config), collectTargets(config, manifest, profile).targets, { full: true }),
      };
  const spatial = auditSpatial(config, manifest, profile, base);
  const mechanic = auditMechanic(config, manifest, profile, base);
  const completion = auditCompletion(config, manifest, profile, { spatial, mechanic, base });

  const coverage: PlayabilityCoverage = {
    spatial: spatial.coverage,
    mechanic: mechanic.coverage,
    completion: completion.coverage,
  };
  const layers = [spatial, mechanic, completion];
  const verdict: PlayabilityVerdictState =
    layers.some((l) => l.verdict === "PROVEN_UNPLAYABLE")
      ? "PROVEN_UNPLAYABLE"
      : layers.some((l) => l.verdict === "INSUFFICIENT_EVIDENCE")
        ? "INSUFFICIENT_EVIDENCE"
        : "NO_PROVEN_BLOCKER";

  // 同一目标只留一条；另一条阻断 / 诊断并入 detail。
  const byTarget = new Map<string, PlayabilityEvidence>();
  for (const e of [...spatial.evidence, ...mechanic.evidence, ...completion.evidence]) {
    const prev = byTarget.get(e.target);
    if (!prev) { byTarget.set(e.target, e); continue; }
    const keep = layerRank(e.judgmentId) < layerRank(prev.judgmentId) ? e : prev;
    const other = keep === e ? prev : e;
    byTarget.set(e.target, { ...keep, detail: `${keep.detail} 另有：${other.detail}` });
  }

  return { verdict, evidence: [...byTarget.values()], coverage };
}

/**
 * 把整关 verdict 映射为既有 `ConfigIssue[]`。
 *
 * ⚠️ 只有 `PROVEN_UNPLAYABLE` 的**阻断型** evidence 产 error；其余一律空数组。
 *   `severity` 只由 verdict 派生，不从 message / coverage 推断；不带 `code`。
 */
export function playabilityIssues(verdict: PlayabilityVerdict): ConfigIssue[] {
  if (verdict.verdict !== "PROVEN_UNPLAYABLE") return [];
  return verdict.evidence
    .filter((e) => isBlocking(e.judgmentId))
    .map((e) => ({ severity: "error" as const, where: e.target, message: e.detail }));
}

export type { FixedRuntimeProfile } from "./profile.js";
export { FIXED_RUNTIME_PROFILE } from "./profile.js";
export type {
  PlayabilityCoverage, PlayabilityEvidence, PlayabilityVerdictState,
} from "./verdict.js";
