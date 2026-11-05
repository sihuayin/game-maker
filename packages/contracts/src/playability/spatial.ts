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

import { playerMoveOf } from "../game-config.js";
import type { GameConfig } from "../game-config.js";
import type { AssetPackManifest } from "../assetpack.js";
import type { Aabb, Vec } from "./geometry.js";
import { boxFromFoot, overlapsInclusive, overlapsStrict } from "./geometry.js";
import {
  buildMovementGraph, hopEdges, movementNeighbors,
} from "./graph.js";
import type { MovementGraph } from "./graph.js";
import { FIXED_RUNTIME_PROFILE, chestInteractionBox, runtimeEntityGeometry } from "./profile.js";
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
} as const;

export type SpatialJudgmentId = (typeof SPATIAL_JUDGMENTS)[keyof typeof SPATIAL_JUDGMENTS];

/**
 * 不构成确定性阻断的判据 —— 它们只把层内 verdict 拉到 `INSUFFICIENT_EVIDENCE`。
 * ⚠️ 出生点两项都在这里；`SPAWN_IN_TERRAIN` 永远不接入硬拒（LP-00 复核）。
 */
export const SPATIAL_NON_BLOCKING: ReadonlySet<string> = new Set<string>([
  SPATIAL_JUDGMENTS.spawnInTerrain,
  SPATIAL_JUDGMENTS.spawnNoFoothold,
]);

/** 建模不了 / 判不了的缺口；不产 issue，只把 coverage 与 verdict 拉向证据不足。 */
export type SpatialGap = { readonly missing: string; readonly target?: string };

export type SpatialResult = LayerResult & { readonly gaps: readonly SpatialGap[] };

type Subject = "PICKUP" | "CHEST" | "GATE";

type SpatialTarget = {
  readonly id: string;
  readonly subject: Subject;
  readonly rect: Aabb;
  readonly assetId: string;
};

const coverageOf = (spatial: CoverageState): PlayabilityCoverage => ({
  spatial, mechanic: "not-checked", completion: "not-checked",
});

const outOfWorld = (rect: Aabb, width: number, height: number): boolean =>
  rect.x < 0 || rect.y < 0 || rect.x + rect.w > width || rect.y + rect.h > height;

const NOUN: Record<Subject, string> = { PICKUP: "拾取物", CHEST: "宝箱", GATE: "终点" };

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
): SpatialResult {
  const { w: width, h: height } = config.world.size;
  const move = playerMoveOf(config);

  const graph = buildMovementGraph(config, manifest, profile);
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
  const gaps: SpatialGap[] = [];
  const targets: SpatialTarget[] = [];

  // ── 靶子：运行时把**每一个** pickup / chest 都算进胜利计数，goal 只认 objective.gate ──
  for (const entity of config.entities) {
    if (entity.kind !== "pickup" && entity.kind !== "chest") continue;
    const geometry = runtimeEntityGeometry(entity, manifest, profile);
    if (!geometry) {
      gaps.push({ missing: "target-asset-missing", target: entity.id });
      continue;
    }
    const rect = entity.kind === "chest" ? chestInteractionBox(geometry, entity.range ?? 0) : geometry.box;
    // ⚠️ 越界看**实体盒**，不看 chest 的交互盒：`range` 合法地可以把交互区伸到世界外
    //   （运行时只要求玩家盒与交互盒相交）。越界仍归 `auditGameConfig.inWorld`，这里不重复报。
    if (outOfWorld(geometry.box, width, height)) {
      gaps.push({ missing: "target-out-of-world", target: entity.id });
      continue;
    }
    targets.push({
      id: entity.id, subject: entity.kind === "chest" ? "CHEST" : "PICKUP",
      rect, assetId: entity.asset,
    });
  }

  const gate = config.entities.find((e) => e.kind === "goal" && e.id === config.objective.gate);
  if (!gate) {
    gaps.push({ missing: "gate-missing" });
  } else {
    const geometry = runtimeEntityGeometry(gate, manifest, profile);
    if (!geometry) {
      gaps.push({ missing: "target-asset-missing", target: gate.id });
    } else if (outOfWorld(geometry.box, width, height)) {
      gaps.push({ missing: "target-out-of-world", target: gate.id });
    } else {
      targets.push({ id: gate.id, subject: "GATE", rect: geometry.box, assetId: gate.asset });
    }
  }

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

  // ── 可达 + 覆盖：一次 BFS，弧线与下落段都按脚点采样做严格 AABB 覆盖 ────────
  const covered = new Set<number>();
  const coverAt = (x: number, y: number): void => {
    if (covered.size === targets.length) return;
    const playerBox = boxFromFoot({ x, y }, graph.player.size);
    for (const [i, target] of targets.entries())
      if (!covered.has(i) && overlapsStrict(playerBox, target.rect)) covered.add(i);
  };

  const seen = new Set<string>();
  const queue: Vec[] = [];
  const add = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    queue.push({ x, y });
    coverAt(x, y);
  };

  for (const seed of seeds) add(seed.x, seed.y);
  // 出生点本身也可能正好碰到目标（不要求落位成功）。
  coverAt(Math.round(graph.player.foot.x), Math.round(graph.player.foot.y));

  for (let head = 0; head < queue.length && covered.size < targets.length; head++) {
    const cell = queue[head]!;
    for (const edge of movementNeighbors(graph, cell.x, cell.y)) {
      if (edge.kind !== "walk") {
        // 迈出悬崖那一步，以及整段竖直下落；中途碰到目标也算够到。
        if (edge.x !== cell.x) coverAt(edge.x, cell.y);
        for (let y = cell.y + 1; y <= edge.y; y++) coverAt(edge.x, y);
      }
      add(edge.x, edge.y);
    }
    for (const edge of hopEdges(graph, cell.x, cell.y, move)) {
      for (const sample of edge.samples) coverAt(sample.x, sample.y);
      add(edge.x, edge.y);
    }
  }

  // ── 每个没被覆盖的目标：先判 BLOCKED（更强根因），否则 UNREACHABLE ────────
  const reachableSummary = `spawn-bfs/${seen.size}`;
  const reachedTargets = targets.filter((_, i) => covered.has(i)).map((t) => t.id);
  for (const [i, target] of targets.entries()) {
    if (covered.has(i)) continue;
    const block = blockedBySolids(graph, target.rect);
    if (block.blocked) {
      evidence.push({
        judgmentId: `PLAYABILITY_SPATIAL_${target.subject}_BLOCKED`,
        target: `entity "${target.id}"`,
        detail: `这个${NOUN[target.subject]}的交互区完全落在实心体内：玩家盒在任何一个不撞墙的位置都无法与它相交` +
          `（目标盒 ${fmtRect(target.rect)}；实心体 ${block.solids.join(", ") || "（未列出）"}）。`,
        witness: { kind: "blocked", rect: target.rect, overlapFoot: block.overlapFoot, solids: block.solids },
        coverage: coverageOf(coverage),
        assetId: target.assetId,
        expected: "存在一个自由玩家位置与目标盒严格相交",
        actual: "没有",
      });
      continue;
    }
    evidence.push({
      judgmentId: `PLAYABILITY_SPATIAL_${target.subject}_UNREACHABLE`,
      target: `entity "${target.id}"`,
      detail: `够不到 —— 从出生点出发，用最宽的能力上界（walk / walk-off / fall / 真实抛物线跳跃）都碰不到这个${NOUN[target.subject]}。` +
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

const fmtRect = (r: Aabb): string =>
  `x=${r.x}, y=${r.y}, w=${r.w}, h=${r.h}`;

/**
 * 目标的「可重叠脚点矩形」里有没有自由位置。
 *
 * 玩家盒以脚点 `(x, y)` 为中心、底边对齐 ⇒ 与目标盒严格相交的充要条件是
 * `x ∈ (T.x - pw/2, T.x + T.w + pw/2)`、`y ∈ (T.y, T.y + T.h + ph)`。
 * 整数格取开区间的整数部分；**不再外扩**（见文件头四）。
 */
function blockedBySolids(
  graph: MovementGraph, rect: Aabb,
): { blocked: boolean; overlapFoot: Aabb; solids: string[] } {
  const pw = graph.player.size.w;
  const ph = graph.player.size.h;
  const x0 = Math.max(0, Math.floor(rect.x - pw / 2) + 1);
  const x1 = Math.min(graph.width, Math.ceil(rect.x + rect.w + pw / 2) - 1);
  const y0 = Math.max(0, Math.floor(rect.y) + 1);
  const y1 = Math.min(graph.height, Math.ceil(rect.y + rect.h + ph) - 1);
  const overlapFoot: Aabb = {
    x: x0, y: y0, w: Math.max(0, x1 - x0 + 1), h: Math.max(0, y1 - y0 + 1),
  };
  const solids = graph.solids.filter((s) => overlapsInclusive(s.box, rect)).map((s) => s.id);

  if (x0 > x1 || y0 > y1) return { blocked: false, overlapFoot, solids };
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      if (graph.freeAt(x, y)) return { blocked: false, overlapFoot, solids };
  return { blocked: true, overlapFoot, solids };
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
