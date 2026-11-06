// **机制可通行性判据**（LP-03）—— PRD §4.4；底座是 LP-02 的共享可达图（`graph.ts` / `reach.ts`）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、V1 只有两条可证的退化判据
//
//   A `PLAYABILITY_MECHANIC_PATH_BLOCKED`
//     静止 hazard 当**不可站立、不可穿越的禁区**：反事实
//     `去掉 hazard 可达 && 加上禁区不可达` 才报。hazard **不是 solid** ——
//     hazard 顶不是地板；把它当 solid 会让玩家「站上去」而漏报。
//
//   B `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW`
//     单个**全高** danger 横切 spawn 与目标：玩家必须在同一段 idle（`periodMs`）内
//     横向穿过 `danger.w + player.w`；`requiredMs > idle + 1 帧` 才报。
//     这只用了「速度上界 + idle 下界」，不需要时序搜索。
//
//   其余一律 `INSUFFICIENT_EVIDENCE`（gap，不产 error）：
//     巡逻 hazard（相位需要时间展开）、moving-platform（运行时未实现）、
//     被 hazard / danger 包住的目标（收集跨复位保留、回调顺序不可证）、
//     多 danger 联合、非全高 danger、薄 hazard、mid-air touch-only。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、几何来源
//
//   hazard 用**运行时图集帧几何**：`runtimeEntityGeometry` 的 frame 源，忽略配置里的
//   `hazard.body`；pack acceptance 不能由审计输入复核 ⇒ `coverage.mechanic = partial`。
//   danger / solid / chest 用 `body ?? size`（Runtime 会消费）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、反事实与去重
//
//   A 只对「base 可达」的目标报；base 也不可达 ⇒ 根因是空间层，归 LP-02，不重复报。
//   B 只在目标位于 danger **远侧**时用穿越时长；同侧不报，目标在 danger 内 → gap。
//   同一目标 A/B 都命中时只留一条（A 优先），另一条并入 detail。

import { playerMoveOf } from "../game-config.js";
import type { GameConfig, GameEntity } from "../game-config.js";
import type { AssetPackManifest } from "../assetpack.js";
import type { Aabb } from "./geometry.js";
import { boxFromFoot, overlapsInclusive, overlapsStrict } from "./geometry.js";
import { buildMovementGraph } from "./graph.js";
import { overlapFootRect, assessReachability } from "./reach.js";
import { FIXED_RUNTIME_PROFILE, runtimeEntityGeometry } from "./profile.js";
import type { FixedRuntimeProfile } from "./profile.js";
import { TARGET_NOUN, collectTargets } from "./targets.js";
import type { PlayabilityTarget, TargetGap } from "./targets.js";
import type {
  CoverageState, LayerResult, PlayabilityCoverage, PlayabilityEvidence,
} from "./verdict.js";
import { aggregateLayer } from "./verdict.js";

export const MECHANIC_JUDGMENTS = {
  pathBlocked: "PLAYABILITY_MECHANIC_PATH_BLOCKED",
  pathNoSafeWindow: "PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW",
} as const;

export type MechanicGap = TargetGap;
export type MechanicResult = LayerResult & { readonly gaps: readonly MechanicGap[] };

/** 1 帧（60Hz）的余量；等号附近不报，避免帧边界误报。 */
const FRAME_MARGIN_MS = 1000 / 60;

/** 薄 hazard 的隧穿保护：低于这个厚度（像素）不拿来证明阻断。 */
const minHazardThickness = (speed: number): number => Math.max(4, speed / 30);

type BoxedEntity = { readonly entity: GameEntity; readonly box: Aabb };

/**
 * 机制可通行性判定。
 *
 * @returns 层内 verdict + evidence + mechanic coverage + gaps。
 */
export function auditMechanic(
  config: GameConfig,
  manifest: AssetPackManifest,
  profile: FixedRuntimeProfile = FIXED_RUNTIME_PROFILE,
): MechanicResult {
  const move = playerMoveOf(config);
  const { targets, gaps: targetGaps } = collectTargets(config, manifest, profile);
  const gaps: MechanicGap[] = [...targetGaps];
  let mechanic: CoverageState = "checked";
  const addGap = (missing: string, target?: string): void => {
    gaps.push(target === undefined ? { missing } : { missing, target });
    mechanic = "partial";
  };

  const baseGraph = buildMovementGraph(config, manifest, profile);
  if (!baseGraph) {
    addGap("player-asset-missing");
    return finish([], gaps, "partial");
  }
  const graph = baseGraph;                     // 非空别名：闭包里 TS 不会跨函数边界收窄
  const base = assessReachability(graph, move, targets);
  if (base.seeds.length === 0) {
    addGap("spawn-no-foothold");
    return finish([], gaps, "partial");
  }

  // 同一目标只留一条：A 优先，B 并入 detail。
  const byTarget = new Map<string, PlayabilityEvidence>();
  const addEvidence = (id: string, evidence: PlayabilityEvidence): void => {
    const prev = byTarget.get(id);
    if (!prev) { byTarget.set(id, evidence); return; }
    byTarget.set(id, { ...prev, detail: `${prev.detail} 另有：${evidence.detail}` });
  };
  const evidenceCoverage = (): PlayabilityCoverage => ({
    spatial: graph.coverage, mechanic, completion: "not-checked",
  });
  const baseReachable = (i: number): boolean => base.covered.has(i) || base.midAir.has(i);
  const spawnBox = boxFromFoot(graph.player.foot, graph.player.size);

  // ── 机制覆盖面：巡逻 / moving-platform 先记 gap（不参与 A/B 的硬拒）────────
  const allHazards = config.entities.filter((e) => e.kind === "hazard");
  const staticHazards = allHazards.filter((e) => !e.motion);
  const movingHazards = allHazards.filter((e) => e.motion);
  const movingSolids = config.entities.filter((e) => e.kind === "solid" && e.motion);
  if (movingHazards.length > 0) addGap("moving-hazard-phase");
  if (movingSolids.length > 0) addGap("moving-platform-unsupported");

  // ── 静止 hazard 几何（运行时帧几何；禁用 e.body）────────────────────────
  const staticBoxes: BoxedEntity[] = [];
  for (const entity of staticHazards) {
    const geometry = runtimeEntityGeometry(entity, manifest, profile);
    if (!geometry) { addGap("hazard-asset-missing", entity.id); continue; }
    mechanic = "partial";                       // frame 几何 / acceptance 不可复核
    if (Math.min(geometry.box.w, geometry.box.h) < minHazardThickness(move.speed)) {
      addGap("thin-hazard", entity.id);
      continue;                                 // 薄 hazard 不进禁区，避免误报
    }
    staticBoxes.push({ entity, box: geometry.box });
  }

  // ── A：静止 hazard 禁区 + 反事实 ─────────────────────────────────────────
  const insideHazard = new Set<number>();
  for (const [i, target] of targets.entries()) {
    if (staticBoxes.some((h) => overlapsInclusive(target.rect, h.box))) {
      insideHazard.add(i);
      addGap("target-inside-hazard", target.id);
    }
  }
  const spawnInHazard = staticBoxes.some((h) => overlapsInclusive(spawnBox, h.box));
  if (spawnInHazard) addGap("spawn-in-hazard");

  if (staticBoxes.length > 0 && !spawnInHazard) {
    const maskGraph = buildMovementGraph(config, manifest, profile, {
      forbiddenBoxes: staticBoxes.map((h) => h.box),
    });
    if (!maskGraph) {
      addGap("player-asset-missing");
    } else {
      const mask = assessReachability(maskGraph, move, targets);
      for (const [i, target] of targets.entries()) {
        if (insideHazard.has(i) || !baseReachable(i) || mask.covered.has(i)) continue;
        if (mask.midAir.has(i)) { addGap("mid-air-touch-only", target.id); continue; }

        const blockers = blockingHazards(target, spawnBox, staticBoxes);
        const first = blockers[0];
        if (!first) continue;                   // 理论上不会；保守不报
        addEvidence(target.id, {
          judgmentId: MECHANIC_JUDGMENTS.pathBlocked,
          target: `entity "${target.id}"`,
          detail: `静止 hazard "${blockers.map((b) => b.entity.id).join('", "')}" 封死了通往这个${TARGET_NOUN[target.subject]}的唯一通路：` +
            `把 hazard 当空气时可达，加上「不可站立、不可穿越」的禁区后不可达（hazard 顶不是地板）。`,
          witness: {
            kind: "blocked",
            rect: first.box,
            overlapFoot: overlapFootRect(maskGraph, first.box),
            solids: blockers.map((b) => b.entity.id),
            blockers: blockers.map((b) => ({ id: b.entity.id, rect: b.box })),
          },
          coverage: evidenceCoverage(),
          assetId: target.assetId,
          expected: "without static hazards: reachable; with static hazards: unreachable",
          actual: "with static hazards: unreachable",
        });
      }
    }
  }

  // ── B：单 danger、全列切面、安全窗口下界 ────────────────────────────────
  const dangers = config.entities.filter((e) => e.kind === "danger");
  if (dangers.length > 1) {
    addGap("multiple-dangers-unproven");
  } else if (dangers.length === 1) {
    runDangerWindow(dangers[0]!);
  }

  function runDangerWindow(danger: GameEntity): void {
    const geometry = runtimeEntityGeometry(danger, manifest, profile);
    if (!geometry) { addGap("danger-asset-missing", danger.id); return; }
    const strike = danger.strike;
    if (!strike) { addGap("danger-strike-missing", danger.id); return; }
    const dangerBox = geometry.box;

    const spawnCenter = spawnBox.x + spawnBox.w / 2;
    if (overlapsInclusive(spawnBox, dangerBox)) { addGap("spawn-in-danger"); return; }
    const fromLeft = spawnCenter < dangerBox.x;
    const fromRight = spawnCenter > dangerBox.x + dangerBox.w;
    if (!fromLeft && !fromRight) { addGap("spawn-danger-ambiguous"); return; }

    const maskGraph = buildMovementGraph(config, manifest, profile, { forbiddenBoxes: [dangerBox] });
    if (!maskGraph) { addGap("player-asset-missing"); return; }
    const mask = assessReachability(maskGraph, move, targets);

    for (const [i, target] of targets.entries()) {
      if (!baseReachable(i)) continue;
      if (overlapsStrict(target.rect, dangerBox)) {
        // 被 danger 包住：收集跨复位保留、同帧顺序不可证 ⇒ 不硬拒（PRD V1 边界）。
        addGap("target-inside-danger", target.id);
        continue;
      }
      const farSide = fromLeft
        ? target.rect.x >= dangerBox.x + dangerBox.w
        : target.rect.x + target.rect.w <= dangerBox.x;
      if (!farSide) {
        if (!mask.covered.has(i) && !mask.midAir.has(i)) addGap("danger-target-ambiguous", target.id);
        continue;
      }
      if (mask.covered.has(i)) { addGap("non-full-column-danger", target.id); continue; }
      if (mask.midAir.has(i)) { addGap("mid-air-touch-only", target.id); continue; }

      const requiredMs = ((dangerBox.w + graph.player.size.w) / move.speed) * 1000;
      const idleMs = strike.periodMs;
      if (requiredMs > idleMs + FRAME_MARGIN_MS) {
        addEvidence(target.id, {
          judgmentId: MECHANIC_JUDGMENTS.pathNoSafeWindow,
          target: `entity "${target.id}"`,
          detail: `danger "${danger.id}" 全高封死唯一通路：idle ${idleMs}ms + 1 帧 小于最少穿越 ${requiredMs.toFixed(1)}ms` +
            `（danger 宽 ${dangerBox.w}px + 玩家 ${graph.player.size.w}px，速度 ${move.speed}px/s）。` +
            "玩家在任意安全位置等待也一样：同一段 idle 内穿不过去。",
          witness: {
            kind: "no-safe-window", dangerId: danger.id, box: dangerBox,
            idleMs, activeMs: strike.activeMs, requiredMs,
            speed: move.speed, playerWidth: graph.player.size.w,
            side: "near->far", fullColumnCut: true, targetRegion: target.rect,
          },
          coverage: evidenceCoverage(),
          assetId: target.assetId,
          expected: idleMs,
          actual: requiredMs,
        });
      } else if (requiredMs > idleMs) {
        addGap("danger-window-frame-boundary", target.id);
      }
    }
  }

  return finish([...byTarget.values()], gaps, mechanic);

  function finish(raw: PlayabilityEvidence[], gapList: MechanicGap[], coverage: CoverageState): MechanicResult {
    // 证据里的 mechanic coverage 取**最终**值（gap 可能在证据创建之后才出现）。
    const evidence = raw.map((e) => ({ ...e, coverage: { ...e.coverage, mechanic: coverage } }));
    return {
      verdict: aggregateLayer({ coverage, evidence, gaps: gapList.map((g) => g.missing) }),
      evidence, coverage, gaps: gapList,
    };
  }
}

/**
 * 目标与 spawn 之间、在 x 方向上可能挡路的静止 hazard。
 * 取 spawn 与目标中心之间；一个都找不到时退回全部（保守让 witness 指向真实 hazard）。
 */
function blockingHazards(
  target: PlayabilityTarget, spawnBox: Aabb, hazards: readonly BoxedEntity[],
): readonly BoxedEntity[] {
  const spawnX = spawnBox.x + spawnBox.w / 2;
  const targetX = target.rect.x + target.rect.w / 2;
  const lo = Math.min(spawnX, targetX);
  const hi = Math.max(spawnX, targetX);
  const between = hazards.filter((h) => {
    const c = h.box.x + h.box.w / 2;
    return c >= lo && c <= hi;
  });
  return between.length > 0 ? between : hazards;
}

/** 供测试 / 证据脚本读的常量（不落盘）。 */
export const MECHANIC_LIMITS = {
  frameMarginMs: FRAME_MARGIN_MS,
  minHazardThickness,
};
