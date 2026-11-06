// **共享可达 + 覆盖评估**（LP-02 抽出的空间底座；LP-03 的机制层直接复用）。
//
//   LP-02 的空间判据与 LP-03 的机制判据必须用同一套 BFS / 覆盖 / mid-air 保护；
//   两份实现漂移会让「空间说可达、机制说不可达」这种自相矛盾的证据出现。
//
//   `MovementGraph` 可以带一个**不可穿越但不提供支撑**的 `forbiddenBoxes` 掩码：
//   LP-03 用它把静止 hazard 当作禁区，而不是把 hazard 改成 solid（hazard 顶不是地板）。

import { jumpSpan, maxJumpHeight } from "../game-config.js";
import type { Aabb, Vec } from "./geometry.js";
import { boxFromFoot, overlapsInclusive, overlapsStrict } from "./geometry.js";
import type { MovementGraph, MoveParams } from "./graph.js";
import { hopEdges, movementNeighbors } from "./graph.js";

export type ReachTarget = { readonly id: string; readonly rect: Aabb };

export type ReachAssessment = {
  /** 出生点接位（空 = spawn-no-foothold）。 */
  readonly seeds: readonly Vec[];
  /** 被覆盖的目标下标。 */
  readonly covered: ReadonlySet<number>;
  /** BFS 访问过的脚点格（键 `"x,y"`）。 */
  readonly seen: ReadonlySet<string>;
  /** BFS 访问顺序（含所有落脚点；机械层做弧线扫描用）。 */
  readonly queue: readonly Vec[];
  /** 走出悬崖的那一步（`vy = 0` 的弧线起点）。 */
  readonly walkOffStarts: readonly Vec[];
  /** 未覆盖、非 BLOCKED 目标里，存在不落地触达弧的下标。 */
  readonly midAir: ReadonlySet<number>;
};

export type BlockedInfo = {
  readonly blocked: boolean;
  readonly overlapFoot: Aabb;
  readonly solids: string[];
};

/**
 * 目标的「可重叠脚点矩形」里有没有自由位置。
 *
 * 玩家盒以脚点 `(x, y)` 为中心、底边对齐 ⇒ 与目标盒严格相交的充要条件是
 * `x ∈ (T.x - pw/2, T.x + T.w + pw/2)`、`y ∈ (T.y, T.y + T.h + ph)`。
 * 整数格取开区间的整数部分；**不额外外扩**（贴着不算撞）。
 */
export function overlapFootRect(graph: MovementGraph, rect: Aabb): Aabb {
  const pw = graph.player.size.w;
  const ph = graph.player.size.h;
  const x0 = Math.max(0, Math.floor(rect.x - pw / 2) + 1);
  const x1 = Math.min(graph.width, Math.ceil(rect.x + rect.w + pw / 2) - 1);
  const y0 = Math.max(0, Math.floor(rect.y) + 1);
  const y1 = Math.min(graph.height, Math.ceil(rect.y + rect.h + ph) - 1);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0 + 1), h: Math.max(0, y1 - y0 + 1) };
}

export function blockedBySolids(graph: MovementGraph, rect: Aabb): BlockedInfo {
  const pw = graph.player.size.w;
  const ph = graph.player.size.h;
  const overlapFoot = overlapFootRect(graph, rect);
  const x0 = overlapFoot.x;
  const x1 = overlapFoot.x + overlapFoot.w - 1;
  const y0 = overlapFoot.y;
  const y1 = overlapFoot.y + overlapFoot.h - 1;
  const solids = graph.solids.filter((s) => overlapsInclusive(s.box, rect)).map((s) => s.id);

  if (x0 > x1 || y0 > y1) return { blocked: false, overlapFoot, solids };
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      if (graph.freeAt(x, y)) return { blocked: false, overlapFoot, solids };
  return { blocked: true, overlapFoot, solids };
}

/**
 * 从出生点做一次可达 + 覆盖评估。
 *
 * 覆盖 = 任一可达落脚点、或 walk-off / fall 的下落段、或可落地跳跃弧上的采样，
 * 玩家盒与目标盒**严格相交**。只往「玩家更强」一侧偏。
 *
 * `midAir` 默认开启：未覆盖、非 BLOCKED 的目标再扫一遍不落地弧线（LP-02 复核 Q3(a)）。
 * 机制层用它保证「不能因为 BFS 没找到落点就误拒」。
 */
export function assessReachability(
  graph: MovementGraph,
  move: MoveParams,
  targets: readonly ReachTarget[],
  options: { readonly midAir?: boolean; readonly full?: boolean } = {},
): ReachAssessment {
  const seeds = graph.startCells();
  const covered = new Set<number>();
  const seen = new Set<string>();
  const queue: Vec[] = [];
  const walkOffStarts: Vec[] = [];

  if (seeds.length === 0) {
    return { seeds, covered, seen, queue, walkOffStarts, midAir: new Set<number>() };
  }

  const coverAt = (x: number, y: number): void => {
    if (covered.size === targets.length) return;
    const playerBox = boxFromFoot({ x, y }, graph.player.size);
    for (const [i, target] of targets.entries())
      if (!covered.has(i) && overlapsStrict(playerBox, target.rect)) covered.add(i);
  };

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

  for (let head = 0; head < queue.length && (options.full === true || covered.size < targets.length); head++) {
    const cell = queue[head]!;
    for (const edge of movementNeighbors(graph, cell.x, cell.y)) {
      if (edge.kind !== "walk") {
        // 迈出悬崖那一步，以及整段竖直下落；中途碰到目标也算够到。
        if (edge.x !== cell.x) {
          coverAt(edge.x, cell.y);
          if (edge.kind === "walk-off") walkOffStarts.push({ x: edge.x, y: cell.y });
        }
        for (let y = cell.y + 1; y <= edge.y; y++) coverAt(edge.x, y);
      }
      add(edge.x, edge.y);
    }
    for (const edge of hopEdges(graph, cell.x, cell.y, move)) {
      for (const sample of edge.samples) coverAt(sample.x, sample.y);
      add(edge.x, edge.y);
    }
  }

  // mid-air 保守保护：只对未覆盖、且不被 BLOCKED 封死的目标。
  const midAir = new Set<number>();
  if (options.midAir !== false) {
    const candidates: number[] = [];
    for (const [i, target] of targets.entries())
      if (!covered.has(i) && !blockedBySolids(graph, target.rect).blocked) candidates.push(i);
    for (const hit of midAirTouchableTargets(graph, queue, walkOffStarts, move, targets, candidates))
      midAir.add(hit);
  }

  return { seeds, covered, seen, queue, walkOffStarts, midAir };
}

/**
 * 未覆盖目标是否存在**不落地弧线**的触达可能（LP-02 复核 Q3(a)）。
 *
 * 两类起点：
 *   jump —— 每个可达落脚点，`vy = jumpVelocity`；
 *   fall —— 每个 walk-off 悬崖点，`vy = 0`（走出边缘后可以水平漂移）。
 *
 * 对每个起点扫 `vx ∈ [-speed, speed]` 的弧线；弧线按 60Hz 采样、逐点查 `forbidden`。
 * 只要某条不撞禁区的弧上，玩家盒与目标盒**严格相交**，就算「合理触达可能」。
 *
 * ⚠️ 这是**保守保护**，不是可达性证明：命中只用于把 UNREACHABLE 降级为
 *   `INSUFFICIENT_EVIDENCE`，绝不把该弧线写进可达集。
 */
function midAirTouchableTargets(
  graph: MovementGraph,
  jumpStarts: readonly Vec[],
  walkOffStarts: readonly Vec[],
  move: MoveParams,
  targets: readonly ReachTarget[],
  candidates: readonly number[],
): Set<number> {
  const hits = new Set<number>();
  if (candidates.length === 0) return hits;

  const pw = graph.player.size.w;
  const ph = graph.player.size.h;
  const apex = maxJumpHeight(move);
  const maxDx = Math.ceil(jumpSpan(move, graph.height));
  const bottom = graph.height + ph;   // 脚点超过它，玩家盒已完全离开世界

  /** 粗筛：从 `from` 出发的弧线有没有可能碰到目标（边界放宽，宁可多扫）。 */
  const couldReach = (from: Vec, idx: number): boolean => {
    const target = targets[idx]!;
    const left = target.rect.x - pw / 2;
    const right = target.rect.x + target.rect.w + pw / 2;
    if (right + maxDx < from.x || left - maxDx > from.x) return false;
    if (target.rect.y > bottom) return false;
    if (target.rect.y + target.rect.h + ph < from.y - apex - ph) return false;
    return true;
  };

  const scan = (from: Vec, vy0: number, tEnd: number, idxs: readonly number[]): void => {
    const steps = 32;
    const n = Math.max(6, Math.min(240, Math.ceil(tEnd * 60)));
    for (let s = 0; s <= steps; s++) {
      const vx = -move.speed + (2 * move.speed * s) / steps;
      for (let i = 1; i <= n; i++) {
        const t = (tEnd * i) / n;
        const px = Math.round(from.x + vx * t);
        const py = Math.round(from.y - (vy0 * t - (move.gravity * t * t) / 2));
        if (py > bottom) break;
        // 世界外的采样点当自由空间（Runtime 没有世界边界碰撞）；世界内按 forbidden 栅格。
        if (px >= 0 && px <= graph.width && py >= 0 && py <= graph.height &&
            !graph.freeAt(px, py)) break;
        const playerBox = boxFromFoot({ x: px, y: py }, graph.player.size);
        for (const idx of idxs)
          if (!hits.has(idx) && overlapsStrict(playerBox, targets[idx]!.rect)) hits.add(idx);
        if (hits.size >= candidates.length) return;
      }
    }
  };

  for (const from of jumpStarts) {
    const idxs = candidates.filter((idx) => !hits.has(idx) && couldReach(from, idx));
    if (idxs.length === 0) continue;
    const disc = move.jumpVelocity * move.jumpVelocity + 2 * move.gravity * Math.max(0, bottom - from.y);
    const tEnd = (move.jumpVelocity + Math.sqrt(disc)) / move.gravity;
    scan(from, move.jumpVelocity, tEnd, idxs);
  }
  for (const from of walkOffStarts) {
    if (from.y >= bottom) continue;
    const idxs = candidates.filter((idx) => !hits.has(idx) && couldReach(from, idx));
    if (idxs.length === 0) continue;
    const tEnd = Math.sqrt((2 * (bottom - from.y)) / move.gravity);
    scan(from, 0, tEnd, idxs);
  }
  return hits;
}
