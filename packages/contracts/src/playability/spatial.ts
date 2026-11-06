// **空间可达性判据**（LP-02）—— PRD §4.3；唯一空间底座是 `graph.ts`（LP-01）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、只报「证明走不通」，不报「能走通」
//
//   可达集是玩家能力的**上界**（walk / walk-off / fall / 真实抛物线 hop，全部往「玩家更强」
//   一侧偏）。⇒ 「不在可达集里」是可靠的那半句话；「在里面」什么都不保证。
//   本模块**只产出一条坏消息**：某个目标从出生点出发、用最宽的能力上界都碰不到。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、目标几何一律走 `profile.ts`，不在这里解释碰撞语义
//
//   pickup / goal 用**帧几何**（Runtime 忽略 `body`）⇒ coverage `partial`；
//   chest 用 `body ?? size` 再四边外扩 `range`，与玩家盒**严格**相交；
//   solid 的 `motion` 按静态原位（LP-01 已定）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、出生点：只诊断，不阻断（LP-00 复核裁定，2026-11-05）
//
//   P4 被源码推翻：Runtime **没有**出生点专用分离。⇒ `SPAWN_IN_TERRAIN` 只保留窄口径诊断
//   （脚点 + 锚点 offset + 附近无 standable），verdict 固定 `INSUFFICIENT_EVIDENCE`，
//   **绝不**接入 deterministic / Publish Gate。纯盒重叠连诊断都不算。
//   `SPAWN_NO_FOOTHOLD` 同理：掉出世界是否失败/复位未定义 ⇒ coverage-gap。
//
// ─────────────────────────────────────────────────────────────────────────────
// 四、BLOCKED 与 UNREACHABLE 同一目标互斥，BLOCKED 优先
//
//   BLOCKED = 目标的「可重叠脚点矩形」里没有任何自由玩家位置（不要求站得住）；
//   空腔里的目标不是 BLOCKED，是 UNREACHABLE（`blocked` 与 `no-path` 两种根因要分开）。
//
//   ⚠️ 判定用**开区间**（贴着不算撞），与 Runtime 的严格 AABB 同义；不再额外外扩 1px ——
//     外扩会把「脚点刚好贴着实心体顶面」的自由格算进来，反而把真 BLOCKED 判成不 BLOCKED。
//
// ─────────────────────────────────────────────────────────────────────────────
// 五、UNREACHABLE 之前必须排除 mid-air touch-only（LP-02 复核裁定 Q3(a)）
//
//   BFS 没找到路径**本身不是**不可达的充分证据：玩家可能只在一条**不落到任何落脚点**的
//   跳跃弧 / 走出悬崖后的下落弧上碰到目标（碰完就掉出世界）。这种弧不会被 hopEdges /
//   walk-off 覆盖，却足以让目标「可接触」。
//
//   ⇒ 对每个未覆盖、且不被 BLOCKED 封死的目标，扫一遍「不撞实心体、不要求落地」的弧线：
//     只要存在一条让玩家盒与目标盒严格相交的弧，就降级为 `INSUFFICIENT_EVIDENCE`，
//     **不**判 UNREACHABLE，也**不**把它写进可达集。这是保护误拒绝，不是扩大可达性模型。

import { playerMoveOf } from "../game-config.js";
import type { GameConfig } from "../game-config.js";
import type { AssetPackManifest } from "../assetpack.js";
import { buildMovementGraph } from "./graph.js";
import type { MovementGraph } from "./graph.js";
import { assessReachability, blockedBySolids } from "./reach.js";
import type { ReachAssessment } from "./reach.js";
import { TARGET_NOUN, collectTargets, formatRect } from "./targets.js";
import type { TargetGap } from "./targets.js";
import { FIXED_RUNTIME_PROFILE } from "./profile.js";
import type { FixedRuntimeProfile } from "./profile.js";
import type {
  CoverageState, LayerResult, PlayabilityCoverage, PlayabilityEvidence,
} from "./verdict.js";
import { aggregateLayer } from "./verdict.js";

// ── 判据 id（封闭注册表；framework §5.1 的命名规则）────────────────────────
export const SPATIAL_JUDGMENTS = {
  spawnInTerrain: "PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN",
  spawnNoFoothold: "PLAYABILITY_SPATIAL_SPAWN_NO_FOOTHOLD",
  pickupUnreachable: "PLAYABILITY_SPATIAL_PICKUP_UNREACHABLE",
  pickupBlocked: "PLAYABILITY_SPATIAL_PICKUP_BLOCKED",
  chestUnreachable: "PLAYABILITY_SPATIAL_CHEST_UNREACHABLE",
  chestBlocked: "PLAYABILITY_SPATIAL_CHEST_BLOCKED",
  gateUnreachable: "PLAYABILITY_SPATIAL_GATE_UNREACHABLE",
  gateBlocked: "PLAYABILITY_SPATIAL_GATE_BLOCKED",
  /** 未覆盖目标存在不撞实心体的不落地弧线 ⇒ 不能证明不可达（保守降级，见文件头五）。 */
  midAirUnproven: "PLAYABILITY_SPATIAL_MIDAIR_TOUCH_UNPROVEN",
} as const;

export type SpatialJudgmentId = (typeof SPATIAL_JUDGMENTS)[keyof typeof SPATIAL_JUDGMENTS];

/**
 * 不构成确定性阻断的判据 —— 它们只把层内 verdict 拉到 `INSUFFICIENT_EVIDENCE`。
 * ⚠️ 出生点两项都在这里；`SPAWN_IN_TERRAIN` 永远不接入硬拒（LP-00 复核）。
 */
export const SPATIAL_NON_BLOCKING: ReadonlySet<string> = new Set<string>([
  SPATIAL_JUDGMENTS.spawnInTerrain,
  SPATIAL_JUDGMENTS.spawnNoFoothold,
  SPATIAL_JUDGMENTS.midAirUnproven,
]);

/** 建模不了 / 判不了的缺口；不产 issue，只把 coverage 与 verdict 拉向证据不足。 */
export type SpatialGap = TargetGap;

export type SpatialResult = LayerResult & { readonly gaps: readonly SpatialGap[] };

const coverageOf = (spatial: CoverageState): PlayabilityCoverage => ({
  spatial, mechanic: "not-checked", completion: "not-checked",
});

/**
 * 空间可达性判定。
 *
 * @returns 层内 verdict + evidence + coverage + gaps。
 *   ⚠️ `coverage` 与 `verdict` 必须一起看：`NO_PROVEN_BLOCKER` 只表示「这一层没找到阻断」，
 *   不表示「看全了」（见 `verdict.ts` 文件头二）。
 */
export function auditSpatial(
  config: GameConfig,
  manifest: AssetPackManifest,
  profile: FixedRuntimeProfile = FIXED_RUNTIME_PROFILE,
  base?: { readonly graph: MovementGraph; readonly assessment: ReachAssessment },
): SpatialResult {
  const move = playerMoveOf(config);

  const graph = base?.graph ?? buildMovementGraph(config, manifest, profile);
  if (!graph) {
    const gaps: SpatialGap[] = [{ missing: "player-asset-missing" }];
    const evidence: PlayabilityEvidence[] = [];
    return {
      verdict: aggregateLayer({ coverage: "partial", evidence, gaps: gaps.map((g) => g.missing) }),
      evidence, coverage: "partial", gaps,
    };
  }

  const coverage = graph.coverage;
  const evidence: PlayabilityEvidence[] = [];
  const { targets, gaps: targetGaps } = collectTargets(config, manifest, profile);
  const gaps: SpatialGap[] = [...targetGaps];

  // ── 出生点诊断（窄口径；只观察，不阻断）────────────────────────────────
  const spawnDiagnostic = spawnInTerrain(config, graph);
  if (spawnDiagnostic) evidence.push(spawnDiagnostic);

  const seeds = graph.startCells();
  if (seeds.length === 0) {
    gaps.push({ missing: "spawn-no-foothold" });
    evidence.push({
      judgmentId: SPATIAL_JUDGMENTS.spawnNoFoothold,
      target: "player.at",
      detail: "出生点附近没有任何可站立表面；当前 profile 没有定义「掉出世界是否失败 / 复位」，因此这里只能给出证据不足，不能判不可玩。",
      witness: { kind: "coverage-gap", missing: "spawn-support" },
      coverage: coverageOf(coverage),
      expected: "出生点附近存在可站立表面",
      actual: "没有",
    });
    return {
      verdict: aggregateLayer({ coverage, evidence, nonBlocking: SPATIAL_NON_BLOCKING, gaps: gaps.map((g) => g.missing) }),
      evidence, coverage, gaps,
    };
  }

  // ── 可达 + 覆盖：共享底座（`reach.ts`）；覆盖 = 落脚点 / 下落段 / 跳跃弧采样 / mid-air 保护 ──
  const assessment = base?.assessment ?? assessReachability(graph, move, targets);
  const { covered, seen, midAir } = assessment;

  // ── 每个没被覆盖的目标：BLOCKED（更强根因）→ mid-air 保守降级 → UNREACHABLE ──
  const reachableSummary = `spawn-bfs/${seen.size}`;
  const reachedTargets = targets.filter((_, i) => covered.has(i)).map((t) => t.id);

  for (const [i, target] of targets.entries()) {
    if (covered.has(i)) continue;
    const block = blockedBySolids(graph, target.rect);
    if (block.blocked) {
      evidence.push({
        judgmentId: `PLAYABILITY_SPATIAL_${target.subject}_BLOCKED`,
        target: `entity "${target.id}"`,
        detail: `这个${TARGET_NOUN[target.subject]}的交互区完全落在实心体内：玩家盒在任何一个不撞墙的位置都无法与它相交` +
          `（目标盒 ${formatRect(target.rect)}；实心体 ${block.solids.join(", ") || "（未列出）"}）。`,
        witness: { kind: "blocked", rect: target.rect, overlapFoot: block.overlapFoot, solids: block.solids },
        coverage: coverageOf(coverage),
        assetId: target.assetId,
        expected: "存在一个自由玩家位置与目标盒严格相交",
        actual: "没有",
      });
      continue;
    }

    if (midAir.has(i)) {
      gaps.push({ missing: "mid-air-touch-only", target: target.id });
      evidence.push({
        judgmentId: SPATIAL_JUDGMENTS.midAirUnproven,
        target: `entity "${target.id}"`,
        detail: `没有证明可达，但也**不能**判不可达：存在一条不撞实心体、不要求落地的弧线，玩家盒能在空中与这个${TARGET_NOUN[target.subject]}严格相交。` +
          "⚠️ 这条只是保守降级（mid-air touch-only 不在 V1 的确定性判定范围），不把该弧线写进可达集。",
        witness: { kind: "coverage-gap", missing: "mid-air-touch-only" },
        coverage: coverageOf(coverage),
        assetId: target.assetId,
        expected: "不存在任何可达的（含不落地）触达弧",
        actual: "存在不落地触达弧",
      });
      continue;
    }

    evidence.push({
      judgmentId: `PLAYABILITY_SPATIAL_${target.subject}_UNREACHABLE`,
      target: `entity "${target.id}"`,
      detail: `够不到 —— 从出生点出发，用最宽的能力上界（walk / walk-off / fall / 真实抛物线跳跃）都碰不到这个${TARGET_NOUN[target.subject]}。` +
        "⚠️ 这条只证明「到不了」：没有哪一种设计意图能把「走不通」变成对的。要去的地方：地形 / 这一关的布局，不是再抽一次奖。",
      witness: { kind: "no-path", reachableSet: reachableSummary, blockedAt: target.id, targetsReached: reachedTargets },
      coverage: coverageOf(coverage),
      assetId: target.assetId,
      expected: "可达玩家位置与目标盒严格相交",
      actual: "没有可达重叠",
    });
  }

  return {
    verdict: aggregateLayer({
      coverage, evidence, nonBlocking: SPATIAL_NON_BLOCKING, gaps: gaps.map((g) => g.missing),
    }),
    evidence, coverage, gaps,
  };
}

/**
 * 出生点埋进 terrain 的**窄口径诊断**（LP-00 复核后只观察，绝不阻断）。
 *
 * `foot` 已经在锚点语义下（LP-01 的 `footOf`）；`burial` 扣掉锚点预期偏移，
 * 再要求玩家身体体积内**没有**可站立表面 —— 浅埋 / 锚点嵌入是运行时碰撞分离的正常结果，
 * 纯盒重叠不算（语料上会误伤 11/20）。
 */
function spawnInTerrain(config: GameConfig, graph: MovementGraph): PlayabilityEvidence | null {
  const { w: pw, h: ph } = graph.player.size;
  const foot = graph.player.foot;
  const anchorOffset = (1 - graph.player.anchor.y) * ph;

  for (const [i, terrain] of config.terrain.entries()) {
    const inside =
      foot.x > terrain.x && foot.x < terrain.x + terrain.w &&
      foot.y > terrain.y && foot.y < terrain.y + terrain.h;
    if (!inside) continue;
    const burial = foot.y - terrain.y - anchorOffset;
    if (burial <= 1) continue;

    let nearbyStandable = false;
    const x0 = Math.max(0, Math.floor(foot.x - pw / 2));
    const x1 = Math.min(graph.width, Math.ceil(foot.x + pw / 2));
    const y0 = Math.max(0, Math.floor(foot.y - ph));
    const y1 = Math.min(graph.height, Math.ceil(foot.y));
    for (let x = x0; x <= x1 && !nearbyStandable; x++)
      for (let y = y0; y <= y1; y++)
        if (graph.standableAt(x, y)) { nearbyStandable = true; break; }
    if (nearbyStandable) continue;

    return {
      judgmentId: SPATIAL_JUDGMENTS.spawnInTerrain,
      target: "player.at",
      detail: `出生点的脚点在 terrain#${i} 内，比锚点预期深 ${burial.toFixed(1)}px，且玩家身体范围内没有可站立表面。` +
        "⚠️ 仅诊断：Runtime 没有出生点专用分离语义（LP-00 复核 P4），本项不构成确定性阻断。",
      witness: {
        kind: "blocked",
        rect: { x: terrain.x, y: terrain.y, w: terrain.w, h: terrain.h },
        overlapFoot: { x: foot.x - pw / 2, y: foot.y - ph, w: pw, h: ph },
        solids: [],
      },
      coverage: coverageOf(graph.coverage),
      expected: "burial ≤ 1px 或玩家身体范围内存在可站立表面",
      actual: `burial=${burial.toFixed(1)}px，no standable`,
    };
  }
  return null;
}
