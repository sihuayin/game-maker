/**
 * I02-D5B · 累计 cut 预算基准 —— ⚠️ SCRATCH 代理（THROWAWAY）。
 *
 * 目标：量出 D3/D10 形状（脚点整数格 × 相位格）下：
 *   - 每条 edge / check 的 cut 点数与解析段数；
 *   - U2 每档 lag 的累计 cut / segment；
 *   - Witness 转移数与体积量级。
 *
 * 语义来源（只读）：
 *   - 三角波 / AABB / 连续求交：../03-continuous-intersection/core.mjs
 *   - 语料扫描：../05-performance/core.mjs
 *   - D3：状态 (footX,k)、脚点整数格、wait/move 两种段
 *   - D5：N = min(N_max, floor(maxStates/xPositions))；每档 lag 独立预算
 *
 * ⚠️ 不是生产实现；不对应 I-02 的真实搜索顺序、静态 solids、走廊派生、
 *    Goal Rect 内缩或 U9/W 的完整证明义务。只用于预算量级与分布。
 */
import {
  segmentCollides, turnaroundCuts,
} from "../03-continuous-intersection/core.mjs";
import { scanCorpus, environment, dist, round, sha256File, ROOT } from "../05-performance/core.mjs";

export { scanCorpus, environment, dist, round, sha256File, ROOT };

const EPS = 1e-9;
const FLOOR_Y = 250;

const finite = (x) => typeof x === "number" && Number.isFinite(x);

/** 玩家脚点 → 玩家盒左边缘（D2：脚点 = 盒底边中点）。 */
const leftOfFoot = (foot, width, anchorX) => foot - (0.5 - anchorX) * width;
const footOfLeft = (left, width, anchorX) => left + (0.5 - anchorX) * width;

/** 由语料行构造 D3 形状的代理 config。 */
export function corpusCase(row, speed, lagMs, limits) {
  const pw = row.playerGeometry.w;
  const ph = row.playerGeometry.h;
  const aw = row.playerGeometry.anchorX;
  const playerTop = FLOOR_Y - row.playerGeometry.anchorY * ph;
  const hazardTop = FLOOR_Y - row.hazardGeometry.anchorY * row.hazardGeometry.h;
  const xMaxLeft = row.visualWidth - pw;
  return {
    label: `corpus/${row.config}#${row.hazardId}/speed=${speed}/lag=${lagMs}`,
    kind: "corpus",
    config: row.config,
    contentHash: row.contentHash,
    hazardId: row.hazardId,
    lagMs,
    speed,
    player: { width: pw, height: ph, anchorX: aw, y: playerTop },
    hazard: {
      at: row.hazardAtX, distance: row.distance, periodMs: row.periodMs,
      anchorX: row.hazardGeometry.anchorX, width: row.hazardGeometry.w,
      height: row.hazardGeometry.h, y: hazardTop,
    },
    world: { xMin: 0, xMax: xMaxLeft },
    startFoot: row.startX,
    goalFoot: footOfLeft(row.goalX, pw, aw),
    xStep: 1,
    limits,
  };
}

/** 合成最坏用例（goal 在右边界，hazard 在 goal 附近往返）。 */
export function syntheticCase(s, lagMs) {
  const pw = s.playerWidth ?? 20;
  const ph = s.playerHeight ?? 48;
  const aw = 0.5;
  const xMaxLeft = s.visualWidth - pw;
  const goalLeft = xMaxLeft - pw;
  return {
    label: `synthetic/${s.id}/lag=${lagMs}`,
    kind: "synthetic",
    id: s.id,
    lagMs,
    speed: s.maxSpeed,
    player: { width: pw, height: ph, anchorX: aw, y: 200 },
    hazard: {
      at: goalLeft, distance: s.distance, periodMs: s.periodMs,
      anchorX: 0.5, width: Math.max(2 * s.distance, 2 * pw), height: ph, y: 200,
    },
    world: { xMin: 0, xMax: xMaxLeft },
    startFoot: 40,
    goalFoot: footOfLeft(goalLeft, pw, aw),
    xStep: 1,
    limits: s.limits,
  };
}

/** 安全路径用例：hazard 与玩家 y 分离，BFS 会找到一条最短 witness（只用于体积计量）。 */
export function safeCase({ visualWidth, maxStates = 4_000_000 }) {
  const pw = 20;
  const ph = 48;
  const aw = 0.5;
  const xMaxLeft = visualWidth - pw;
  return {
    label: `witness/W${visualWidth}`,
    kind: "witness",
    speed: 0.16,
    player: { width: pw, height: ph, anchorX: aw, y: 200 },
    hazard: {
      at: 0, distance: 20, periodMs: 4000,
      anchorX: 0.5, width: 40, height: 10, y: 0,
    },
    world: { xMin: 0, xMax: xMaxLeft },
    startFoot: 40,
    goalFoot: footOfLeft(xMaxLeft, pw, aw),
    xStep: 1,
    limits: { maxStates, timeBudgetMs: 60_000 },
  };
}

/** 相位网格与容量（D5 §4）。 */
export function gridOf(c, maxStates) {
  const pw = c.player.width;
  const aw = c.player.anchorX;
  const footMin = Math.ceil(footOfLeft(0, pw, aw) - EPS);
  const footMax = Math.floor(footOfLeft(c.world.xMax, pw, aw) + EPS);
  const xPositions = footMax - footMin + 1;
  const N_max = Math.floor((c.speed * c.hazard.periodMs) / c.xStep + EPS);
  const N = Math.min(N_max, Math.floor(maxStates / xPositions));
  const dt = c.hazard.periodMs / N;
  const maxStepPx = c.speed * dt;
  const stateCapacity = xPositions * N;
  return { footMin, footMax, xPositions, N_max, N, dt, maxStepPx, stateCapacity, phaseGridCapped: N < N_max };
}

const emptyHist = () => new Map();
const bump = (h, v) => h.set(v, (h.get(v) ?? 0) + 1);
const histSummary = (h) => {
  const entries = [...h.entries()].sort((a, b) => a[0] - b[0]);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const q = (p) => {
    if (!total) return null;
    let acc = 0;
    for (const [v, n] of entries) { acc += n; if (acc >= p * total) return v; }
    return entries[entries.length - 1][0];
  };
  return { total, p50: q(0.5), p90: q(0.9), p99: q(0.99), max: entries.length ? entries[entries.length - 1][0] : null, values: entries.slice(0, 12) };
};

/**
 * BFS 代理：wait / move(-maxCells..+maxCells) 两种转移；每步 dt。
 * 记录每次检查的 cut 点数与解析段数；不实现静态 solids / 走廊 / Goal 内缩。
 */
export function runProxy(c, opts = {}) {
  const maxStates = c.limits.maxStates;
  const timeBudgetMs = c.limits.timeBudgetMs;
  const grid = gridOf(c, maxStates);
  const { footMin, footMax, xPositions, N, dt, maxStepPx, stateCapacity, N_max, phaseGridCapped } = grid;
  const started = process.hrtime.bigint();
  const cutsHist = emptyHist();
  const segHist = emptyHist();
  const stats = {
    xPositions, N, N_max, dtMs: round(dt, 6), maxStepPx: round(maxStepPx, 6), stateCapacity,
    phaseGridCapped, phaseCapReason: phaseGridCapped ? "state-capacity" : null,
    statesEnqueued: 0, statesVisited: 0, edgesChecked: 0,
    cutsTotal: 0, segmentsTotal: 0, cutsMax: 0,
    waitEdges: 0, moveEdges: 0, startFoot: c.startFoot, goalFoot: c.goalFoot,
    witnessTransitions: null, wallMs: null, budgetStopped: null,
  };
  const fail = (reason, extra = {}) => ({ verdict: "INSUFFICIENT_EVIDENCE", reason, stats: { ...stats, ...extra }, cutsHist, segHist });

  if (!(xPositions > 0) || !(N >= 2) || !(dt > 0)) return fail("grid-infeasible", { gridInfeasible: true });
  if (!finite(c.startFoot) || !finite(c.goalFoot)) return fail("non-finite-endpoints");

  const startFoot = Math.round(c.startFoot);
  const goalFoot = Math.round(c.goalFoot);
  const startIdxFoot = Math.min(footMax, Math.max(footMin, startFoot));
  if (startIdxFoot !== startFoot) stats.spawnRounded = true;
  if (goalFoot < startIdxFoot) return fail("goal-behind-start");

  const maxCells = Math.max(0, Math.floor(maxStepPx / c.xStep + EPS));
  const states = xPositions * N;
  const visited = new Uint8Array(states);
  const depth = new Int32Array(states);
  const queue = new Int32Array(maxStates + 2);
  const startIdx = (startIdxFoot - footMin) * N;
  visited[startIdx] = 1;
  depth[startIdx] = 0;
  queue[0] = startIdx;
  let head = 0;
  let tail = 1;
  stats.statesEnqueued = 1;

  const playerCfg = {
    width: c.player.width, height: c.player.height, y: c.player.y,
  };

  const check = (foot, nextFoot, t0, t1) => {
    const x0 = leftOfFoot(foot, c.player.width, c.player.anchorX);
    const x1 = leftOfFoot(nextFoot, c.player.width, c.player.anchorX);
    const cutRes = turnaroundCuts(t0, t1, c.hazard.periodMs);
    const cuts = cutRes.error ? 0 : cutRes.cuts.length;
    const segments = cuts + 1;
    bump(cutsHist, cuts);
    bump(segHist, segments);
    stats.edgesChecked += 1;
    stats.cutsTotal += cuts;
    stats.segmentsTotal += segments;
    if (cuts > stats.cutsMax) stats.cutsMax = cuts;
    const res = segmentCollides(
      { t0, x0, t1, x1 },
      { player: playerCfg, hazard: c.hazard },
      { lagMs: c.lagMs, lagMode: "pad" },
    );
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, hit: res.hit };
  };

  while (head < tail) {
    const idx = queue[head];
    head += 1;
    stats.statesVisited += 1;
    const d = depth[idx];
    const k = idx % N;
    const fi = (idx - k) / N;
    const foot = footMin + fi;
    const nextK = (k + 1) % N;
    const t0 = d * dt;
    const t1 = t0 + dt;

    if ((stats.edgesChecked & 1023) === 0 && Number(process.hrtime.bigint() - started) / 1e6 > timeBudgetMs) {
      return fail("wall-clock-abort", { wallClockAbort: true });
    }

    // wait 边
    {
      const r = check(foot, foot, t0, t1);
      if (!r.ok) return fail(`check-error:${r.error}`);
      stats.waitEdges += 1;
      if (!r.hit) {
        const nIdx = fi * N + nextK;
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          depth[nIdx] = d + 1;
          queue[tail++] = nIdx;
          stats.statesEnqueued += 1;
          if (stats.statesEnqueued > maxStates) return fail("state-budget", { stateBudgetStopped: true });
        }
      }
    }

    // move 边
    for (let step = -maxCells; step <= maxCells; step += 1) {
      if (step === 0) continue;
      const nextFoot = foot + step;
      if (nextFoot < footMin || nextFoot > footMax) continue;
      const r = check(foot, nextFoot, t0, t1);
      if (!r.ok) return fail(`check-error:${r.error}`);
      stats.moveEdges += 1;
      if (r.hit) continue;
      if (nextFoot >= goalFoot) {
        const transitions = d + 1;
        stats.witnessTransitions = transitions;
        stats.wallMs = round(Number(process.hrtime.bigint() - started) / 1e6, 3);
        return { verdict: "NO_PROVEN_BLOCKER", reason: "witness-found", stats, cutsHist, segHist };
      }
      const nIdx = (nextFoot - footMin) * N + nextK;
      if (!visited[nIdx]) {
        visited[nIdx] = 1;
        depth[nIdx] = d + 1;
        queue[tail++] = nIdx;
        stats.statesEnqueued += 1;
        if (stats.statesEnqueued > maxStates) return fail("state-budget", { stateBudgetStopped: true });
      }
    }
  }

  stats.wallMs = round(Number(process.hrtime.bigint() - started) / 1e6, 3);
  return { verdict: "INSUFFICIENT_EVIDENCE", reason: "no-witness-found", stats, cutsHist, segHist };
}

/** U9 的等待成本（每次尝试）：N 个相位格 ×（残差等待 dt + 整周期 P）。 */
export function u9WaitCost(c) {
  const grid = gridOf(c, c.limits.maxStates);
  if (!(grid.N >= 2)) return null;
  const residualCuts = turnaroundCuts(0, grid.dt, c.hazard.periodMs);
  const periodCuts = turnaroundCuts(0, c.hazard.periodMs, c.hazard.periodMs);
  const residual = residualCuts.error ? null : residualCuts.cuts.length;
  const period = periodCuts.error ? null : periodCuts.cuts.length;
  if (residual == null || period == null) return null;
  const segmentsPerPhase = (residual + 1) + (period + 1);
  return {
    N: grid.N, dtMs: round(grid.dt, 6),
    residualCuts: residual, residualSegments: residual + 1,
    periodCuts: period, periodSegments: period + 1,
    segmentsPerPhase, segmentsAllPhases: segmentsPerPhase * grid.N,
    cutsAllPhases: (residual + period) * grid.N,
  };
}

/** Witness 体积代理：每转移的记录形状（字段来自 D9 上游裁定，非最终契约）。 */
export const WITNESS_TRANSITION_SAMPLE = {
  from: { footX: 1234, k: 56 },
  to: { footX: 1235, k: 57 },
  t0: 123.456, t1: 129.706,
  playerBox: { x: 1200.5, y: 202, w: 20, h: 48 },
  hazardBox: { x: 1180.25, y: 202, w: 40, h: 48 },
  verification: "pass",
};
export const WITNESS_TRANSITION_BYTES = Buffer.byteLength(JSON.stringify(WITNESS_TRANSITION_SAMPLE));
/** 紧凑记录：只保留 from/to 脚点格、时间区间与验证位。 */
export const WITNESS_COMPACT_SAMPLE = [1234, 56, 1235, 57, 123.456, 129.706, 1];
export const WITNESS_COMPACT_BYTES = Buffer.byteLength(JSON.stringify(WITNESS_COMPACT_SAMPLE));
export const witnessEstimate = (transitions) => ({
  transitions,
  bytes: transitions == null ? null : transitions * WITNESS_TRANSITION_BYTES,
});

export const summarizeRun = (r) => ({
  label: r.label, verdict: r.verdict, reason: r.reason,
  stats: r.stats,
  edgeCuts: histSummary(r.cutsHist),
  edgeSegments: histSummary(r.segHist),
  witness: witnessEstimate(r.stats.witnessTransitions),
});
