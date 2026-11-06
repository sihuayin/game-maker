// **关卡完成性判据**（LP-04）—— PRD §4.5；在 LP-01/02/03 的移动图上做**带标签的 mask DP**。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、完成性加的是「同一条走法」，不是新的移动假设
//
//   空间层只回答「每个目标单独从出生点够不够得到」；本层要求：
//     存在一条单次游玩走法，收齐**全部**必需 pickup / chest，再到达 `objective.gate`。
//   收集是强制的（经过即收集）；一次跳跃可以同时收多个；gate 提前碰到不结算。
//   hazard / danger 仍当空气，只额外提供一条**复位回出生点、计数保留**的边。
//
//   移动模型仍是同一套上界（walk / walk-off / fall / 真实抛物线 hop）；本层不新增几何。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、状态 = (落脚点, 已收集 mask)
//
//   `R[mask]` = 收齐 `mask` 后可能站到的落脚点集合。
//   闭包：只走 S(e) ⊆ mask 的边（不引入新目标），含复位边。
//   转移：走 S(e) ⊄ mask 的边，落到 `R[mask | S(e)]`。
//   找到 `R[full]` 中的 gate 前缀 ⇒ 完成；否则 no-walk。
//
//   ⚠️ 这是完成可能性的**上界**：不同顺序的落点并在一起，只会漏掉可行顺序，
//     不会把不可行顺序说成可行 ⇒ 「no-walk」是可靠的那半句话。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、V1 边界
//
//   k = pickup + chest 数量；k > 12 ⇒ `INSUFFICIENT_EVIDENCE`（不硬拒）。
//   目标缺失 / 越界 / gate 缺失 ⇒ 引用族 / 空间层负责，本层不重复报。
//   LP-02 / LP-03 已证明某个必需目标或 gate 不可达 ⇒ 本层抑制，不把 air 模型的「可行」当反证。
//   必需目标只在 mid-air touch-only 弧上可触达 ⇒ `INSUFFICIENT_EVIDENCE`（不硬拒）。
//   搜索预算超限 ⇒ `INSUFFICIENT_EVIDENCE`。

import { playerMoveOf } from "../game-config.js";
import type { GameConfig, Motion } from "../game-config.js";
import type { AssetPackManifest } from "../assetpack.js";
import type { Aabb, Vec } from "./geometry.js";
import { boxFromFoot, overlapsInclusive, overlapsStrict } from "./geometry.js";
import { buildMovementGraph, hopEdges, movementNeighbors } from "./graph.js";
import { assessReachability } from "./reach.js";
import { FIXED_RUNTIME_PROFILE, runtimeEntityGeometry } from "./profile.js";
import type { FixedRuntimeProfile } from "./profile.js";
import { collectTargets } from "./targets.js";
import type { TargetGap } from "./targets.js";
import { auditSpatial, SPATIAL_JUDGMENTS, SPATIAL_NON_BLOCKING } from "./spatial.js";
import type { SpatialResult } from "./spatial.js";
import { auditMechanic } from "./mechanic.js";
import type { MechanicResult } from "./mechanic.js";
import type { CoverageState, LayerResult, PlayabilityEvidence } from "./verdict.js";
import { aggregateLayer } from "./verdict.js";

export const COMPLETION_JUDGMENTS = {
  gateNotReachableAfterCollect: "PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT",
} as const;

export type CompletionGap = TargetGap;
export type CompletionResult = LayerResult & { readonly gaps: readonly CompletionGap[] };
export type CompletionPrior = {
  readonly spatial?: SpatialResult;
  readonly mechanic?: MechanicResult;
};

/** mask DP 的硬上限（研究语料最大 k=9；12 是批准上限）。 */
const MAX_COLLECTIBLES = 12;
/** 搜索预算：超限 ⇒ 证据不足，而不是超时或随机失败。 */
const EDGE_BUDGET = 40_000_000;

type NodeLabel = { readonly mask: number; readonly gate: boolean; readonly reset: boolean };
type EdgeLabel = NodeLabel & { readonly gateHits: readonly number[] };
type CompletionEdge = EdgeLabel & { readonly to: number };

/**
 * 完成性判定。
 *
 * @param prior 可选：LP-05 组合三层时传入已算好的空间 / 机制结果，避免重复建图。
 */
export function auditCompletion(
  config: GameConfig,
  manifest: AssetPackManifest,
  profile: FixedRuntimeProfile = FIXED_RUNTIME_PROFILE,
  prior: CompletionPrior = {},
): CompletionResult {
  const move = playerMoveOf(config);
  const gaps: CompletionGap[] = [];
  let completion: CoverageState = "checked";
  const addGap = (missing: string, target?: string): void => {
    gaps.push(target === undefined ? { missing } : { missing, target });
    completion = "partial";
  };

  const spatial = prior.spatial ?? auditSpatial(config, manifest, profile);
  const mechanic = prior.mechanic ?? auditMechanic(config, manifest, profile);
  const { targets, gaps: targetGaps } = collectTargets(config, manifest, profile);
  const collectibles = targets.filter((t) => t.subject !== "GATE");
  const gate = targets.find((t) => t.subject === "GATE");

  // ── 引用族 / 空间层缺口：不重复报，也不硬拒 ─────────────────────────────
  if (targetGaps.length > 0) {
    for (const g of targetGaps) gaps.push(g);
    return finish([], gaps, "partial", spatial, mechanic);
  }
  if (!gate) { addGap("gate-missing"); return finish([], gaps, "partial", spatial, mechanic); }
  if (collectibles.length === 0) {
    addGap("no-required-collectibles");
    return finish([], gaps, "partial", spatial, mechanic);
  }
  if (collectibles.length > MAX_COLLECTIBLES) {
    addGap("k-over-limit");
    return finish([], gaps, "partial", spatial, mechanic);
  }

  // ── 抑制：LP-02 / LP-03 已证明的根因，本层不重复报 ─────────────────────
  const gateLabel = `entity "${gate.id}"`;
  const requiredLabels = collectibles.map((t) => `entity "${t.id}"`);
  const spatialBlocking = new Set(
    spatial.evidence.filter((e) => !SPATIAL_NON_BLOCKING.has(e.judgmentId)).map((e) => e.target),
  );
  const spatialMidAir = new Set(
    spatial.evidence.filter((e) => e.judgmentId === SPATIAL_JUDGMENTS.midAirUnproven).map((e) => e.target),
  );
  const mechanicBlocking = new Set(mechanic.evidence.map((e) => e.target));
  if ([...requiredLabels, gateLabel].some((l) => spatialBlocking.has(l) || mechanicBlocking.has(l))) {
    addGap("suppressed-by-spatial-or-mechanic");
    return finish([], gaps, "partial", spatial, mechanic);
  }
  if ([...requiredLabels, gateLabel].some((l) => spatialMidAir.has(l))) {
    addGap("mid-air-touch-only");
    return finish([], gaps, "partial", spatial, mechanic);
  }

  // ── 建全量可达图（不因「目标都覆盖了」提前停）──────────────────────────
  const graph = buildMovementGraph(config, manifest, profile);
  if (!graph) { addGap("player-asset-missing"); return finish([], gaps, "partial", spatial, mechanic); }
  const reach = assessReachability(graph, move, targets, { full: true });
  if (reach.seeds.length === 0) {
    addGap("spawn-no-foothold");
    return finish([], gaps, "partial", spatial, mechanic);
  }

  // ── 复位区域（hazard / danger）：移动 hazard 用扫过包络（玩家可以等它过来）──
  const resetBoxes: Aabb[] = [];
  for (const entity of config.entities) {
    if (entity.kind !== "hazard" && entity.kind !== "danger") continue;
    const geometry = runtimeEntityGeometry(entity, manifest, profile);
    if (!geometry) { addGap("reset-geometry-missing", entity.id); continue; }
    resetBoxes.push(entity.motion ? sweptBox(geometry.box, entity.motion) : geometry.box);
  }
  if (gaps.some((g) => g.missing === "reset-geometry-missing"))
    return finish([], gaps, "partial", spatial, mechanic);

  // ── 节点 / 边标签 ───────────────────────────────────────────────────────
  const nodes = reach.queue;
  const index = new Map<string, number>();
  nodes.forEach((n, i) => index.set(`${n.x},${n.y}`, i));
  const nodeMask = new Int32Array(nodes.length);
  const nodeGate = new Uint8Array(nodes.length);
  const nodeReset = new Uint8Array(nodes.length);

  const labelAt = (x: number, y: number): NodeLabel => {
    const playerBox = boxFromFoot({ x, y }, graph.player.size);
    let mask = 0;
    for (const [i, t] of collectibles.entries())
      if (overlapsStrict(playerBox, t.rect)) mask |= (1 << i);
    return {
      mask,
      gate: overlapsStrict(playerBox, gate.rect),
      reset: resetBoxes.some((b) => overlapsInclusive(playerBox, b)),
    };
  };
  /**
   * 一条边上的采样标签。`gateHits` 记录**每次碰到 gate 时已收集的目标 mask**：
   * 只有在「本次新收的目标都已经收齐」之后碰到的 gate 才算完成（否则是提前碰到 gate）。
   */
  const labelSamples = (
    samples: readonly Vec[], destMask: number, destGate: boolean, destReset: boolean,
  ): EdgeLabel => {
    let mask = 0;
    let resetHit = destReset;
    const gateHits: number[] = [];
    for (const s of samples) {
      const l = labelAt(s.x, s.y);
      mask |= l.mask;
      resetHit ||= l.reset;
      if (l.gate) gateHits.push(mask);
    }
    mask |= destMask;
    // 落点上的 gate 在整条边收完之后；用最终 mask 记一次。
    if (destGate) gateHits.push(mask);
    return { mask, gate: gateHits.length > 0, reset: resetHit, gateHits };
  };

  for (const [i, n] of nodes.entries()) {
    const l = labelAt(n.x, n.y);
    nodeMask[i] = l.mask;
    nodeGate[i] = l.gate ? 1 : 0;
    nodeReset[i] = l.reset ? 1 : 0;
  }

  const adj: CompletionEdge[][] = nodes.map(() => []);
  for (const [i, n] of nodes.entries()) {
    for (const edge of movementNeighbors(graph, n.x, n.y)) {
      const to = index.get(`${edge.x},${edge.y}`);
      if (to === undefined) continue;
      let samples: Vec[];
      if (edge.kind === "walk") {
        samples = [{ x: edge.x, y: edge.y }];
      } else if (edge.kind === "walk-off") {
        samples = [{ x: edge.x, y: n.y }];
        for (let y = n.y + 1; y <= edge.y; y++) samples.push({ x: edge.x, y });
      } else {
        samples = [];
        for (let y = n.y + 1; y <= edge.y; y++) samples.push({ x: edge.x, y });
      }
      const l = labelSamples(samples, nodeMask[to]!, nodeGate[to] === 1, nodeReset[to] === 1);
      adj[i]!.push({ to, ...l });
    }
    for (const edge of hopEdges(graph, n.x, n.y, move)) {
      const to = index.get(`${edge.x},${edge.y}`);
      if (to === undefined) continue;
      const l = labelSamples(edge.samples, nodeMask[to]!, nodeGate[to] === 1, nodeReset[to] === 1);
      adj[i]!.push({ to, ...l });
    }
  }

  // ── mask DP ─────────────────────────────────────────────────────────────
  const k = collectibles.length;
  const full = (1 << k) - 1;
  const seedIdx: number[] = [];
  for (const s of reach.seeds) {
    const i = index.get(`${s.x},${s.y}`);
    if (i !== undefined) seedIdx.push(i);
  }
  if (seedIdx.length === 0) { addGap("spawn-no-foothold"); return finish([], gaps, "partial", spatial, mechanic); }

  let startMask = labelAt(Math.round(graph.player.foot.x), Math.round(graph.player.foot.y)).mask;
  for (const i of seedIdx) startMask |= nodeMask[i]!;

  const size = 1 << k;
  const R: (Set<number> | undefined)[] = new Array(size);
  const queued = new Uint8Array(size);
  const pending: number[] = [];
  const addToR = (mask: number, node: number): void => {
    let set = R[mask];
    if (!set) { set = new Set<number>(); R[mask] = set; }
    if (set.has(node)) return;
    set.add(node);
    if (queued[mask] === 0) { queued[mask] = 1; pending.push(mask); }
  };
  for (const i of seedIdx) addToR(startMask, i);

  let gateReached = false;
  let budgetExceeded = false;
  let edgeVisits = 0;

  while (pending.length > 0 && !gateReached && !budgetExceeded) {
    const mask = pending.pop()!;
    queued[mask] = 0;
    const start = R[mask];
    if (!start) continue;

    // 闭包：只走 S(e) ⊆ mask 的边，含复位回 seeds
    const closed = new Set(start);
    const q = [...start];
    let gate = false;
    for (let head = 0; head < q.length; head++) {
      const n = q[head]!;
      if (nodeGate[n] === 1) gate = true;
      if (nodeReset[n] === 1)
        for (const s of seedIdx) if (!closed.has(s)) { closed.add(s); q.push(s); }
      for (const e of adj[n]!) {
        if (++edgeVisits > EDGE_BUDGET) { budgetExceeded = true; break; }
        if ((e.mask & ~mask) !== 0) continue;
        if (e.gate) gate = true;
        if (e.reset) for (const s of seedIdx) if (!closed.has(s)) { closed.add(s); q.push(s); }
        if (!closed.has(e.to)) { closed.add(e.to); q.push(e.to); }
      }
      if (budgetExceeded) break;
    }
    R[mask] = closed;
    if (budgetExceeded) break;
    if (mask === full && gate) { gateReached = true; break; }

    // 转移：走 S(e) ⊄ mask 的边
    for (const n of closed) {
      if ((nodeMask[n]! & ~mask) !== 0) {
        const nm = mask | nodeMask[n]!;
        addToR(nm, n);
        if (nodeReset[n] === 1) { for (const s of seedIdx) addToR(nm, s); for (const s of seedIdx) addToR(mask, s); }
      }
      for (const e of adj[n]!) {
        if (++edgeVisits > EDGE_BUDGET) { budgetExceeded = true; break; }
        const nm = mask | e.mask;
        if (nm === mask) continue;
        addToR(nm, e.to);
        if (e.reset) { for (const s of seedIdx) addToR(nm, s); for (const s of seedIdx) addToR(mask, s); }
        // 只有「这次新收的目标都收齐之后」碰到的 gate 才算；提前碰到 gate 不结算。
        const newBits = e.mask & ~mask;
        if (nm === full && e.gateHits.some((hit) => (newBits & ~hit) === 0)) gateReached = true;
      }
      if (budgetExceeded || gateReached) break;
    }
  }

  if (budgetExceeded) {
    addGap("completion-budget-exceeded");
    return finish([], gaps, "partial", spatial, mechanic);
  }
  if (gateReached) return finish([], gaps, completion, spatial, mechanic);

  const required = requiredLabels;
  const evidence: PlayabilityEvidence = {
    judgmentId: COMPLETION_JUDGMENTS.gateNotReachableAfterCollect,
    target: gateLabel,
    detail: `必需收集物都能单独取得，但不存在一条走法能收齐后到达终点（gate "${gate.id}"）；` +
      "已建模 hazard / danger 复位边（复位保留已收集计数）。",
    witness: {
      kind: "no-path",
      reachableSet: `completion-mask/${full}`,
      blockedAt: gate.id,
      targetsReached: collectibles.map((t) => t.id),
      required,
      collectableAlone: collectibles.map((t) => `entity "${t.id}"`),
      gatePre: true,
      usedResetEdges: resetBoxes.length > 0,
    },
    coverage: { spatial: spatial.coverage, mechanic: mechanic.coverage, completion },
    assetId: gate.assetId,
    expected: "collect all required targets, then reach the gate",
    actual: "exists a walk collecting everything but no walk reaches the gate afterwards",
  };
  return finish([evidence], gaps, completion, spatial, mechanic);

  function finish(
    raw: PlayabilityEvidence[], gapList: CompletionGap[], coverage: CoverageState,
    spatialResult: SpatialResult, mechanicResult: MechanicResult,
  ): CompletionResult {
    const evidence = raw.map((e) => ({
      ...e,
      coverage: { spatial: spatialResult.coverage, mechanic: mechanicResult.coverage, completion: coverage },
    } satisfies PlayabilityEvidence));
    return {
      verdict: aggregateLayer({ coverage, evidence, gaps: gapList.map((g) => g.missing) }),
      evidence, coverage, gaps: gapList,
    };
  }
}

/** 移动实体的整段行程包络（玩家可以等它过来再接触；复位边只往宽松方向加）。 */
function sweptBox(box: Aabb, motion: Motion): Aabb {
  const d = motion.distance;
  if (motion.axis === "x")
    return { x: Math.min(box.x, box.x + d), y: box.y, w: box.w + Math.abs(d), h: box.h };
  return { x: box.x, y: Math.min(box.y, box.y + d), w: box.w, h: box.h + Math.abs(d) };
}
