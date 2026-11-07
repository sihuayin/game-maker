/**
 * P0-02 最小时序模型原型 —— ⚠️ THROWAWAY PROTOTYPE，不进生产包、不进 `pnpm test`。
 *
 * 问题：单个 x 轴移动 Hazard 是否存在玩家可等待、可通过的安全窗口；能否在不依赖
 * 离散采样假阴性的前提下给出「安全」或「确定不可玩」的结论。
 *
 * 依据：[`../evidence/01r-ruling.md`](../evidence/01r-ruling.md)（P0-01R 硬约束）。
 *
 * 结果只有三态，与现有 Playability Verdict 同名：
 *   - `NO_PROVEN_BLOCKER`：找到并**逐段连续验证**了一条安全轨迹（附带 witness）。
 *   - `PROVEN_UNPLAYABLE`：只允许由「永久封锁门」证明给出（见 `provePermanentGate`）。
 *   - `INSUFFICIENT_EVIDENCE`：其余一切——包括搜索预算耗尽、找不到 witness、未知/不支持输入。
 *
 * 本原型**不宣称**与真实 Runtime 等价；模拟器只服务算法回归。
 *
 * 关键建模纪律：
 *   - 时间只用 game-time T（ms），不用墙钟。
 *   - hazard 轨迹 = 三角波；`periodMs` 是往返整周期；t=0 在 start。
 *   - 碰撞位姿存在一帧滞后：`lagMs` 必须由调用方给出；本原型用 `speed * lagMs` 的
 *     扫掠带保守覆盖（P 的 Lipschitz 上界），绝不使用精确帧时刻。
 *   - safety witness 必须对每个线段做**连续区间**相交判定，采样点不作为证明。
 *   - 无 swept collision 的 Runtime 事实：本原型只检查连续区间内是否真的相交，
 *     不假设 hazard 会「扫过」路径；相交判定就是 AABB 在时间区间上的解析解。
 *   - 单 hazard、x 轴、无垂直规避（证明不可玩时必须显式声明 `verticalEvasionImpossible`）。
 */

const EPS = 1e-9;

/** @typedef {"NO_PROVEN_BLOCKER"|"PROVEN_UNPLAYABLE"|"INSUFFICIENT_EVIDENCE"} Verdict */

export const Verdict = Object.freeze({
  SAFE: "NO_PROVEN_BLOCKER",
  UNPLAYABLE: "PROVEN_UNPLAYABLE",
  INSUFFICIENT: "INSUFFICIENT_EVIDENCE",
});

/**
 * 三角波轨迹：`start → start+distance → start`，周期 `periodMs`。
 * `t=0` 在 `start`，向 +x 出发；`periodMs` 是往返整周期（单程 = periodMs/2）。
 * @param {number} start
 * @param {number} distance 必须 > 0 才运动；<= 0 原地不动
 * @param {number} periodMs 必须 > 0
 * @param {number} t game-time（ms），允许为负 / 超过一个周期
 * @returns {number}
 */
export function trianglePosition(start, distance, periodMs, t) {
  if (!(distance > 0) || !(periodMs > 0)) return start;
  const phase = (((t % periodMs) + periodMs) % periodMs) / periodMs;
  const k = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return start + k * distance;
}

/**
 * Hazard 的最大速度（px/ms）。三角波速度恒为 `2*distance/periodMs`。
 * @param {{distance:number, periodMs:number}} h
 * @returns {number}
 */
export function hazardSpeed(h) {
  return h.distance > 0 && h.periodMs > 0 ? (2 * h.distance) / h.periodMs : 0;
}

/**
 * 一个时间区间内三角波位置的最小/最大值（用于永久封锁门。
 * 区间足够长时直接返回整段行程端点。）
 * @param {{startX:number, distance:number, periodMs:number}} h
 * @param {number} a
 * @param {number} b
 * @returns {{minP:number, maxP:number}}
 */
export function hazardPositionRange(h, a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const pLo = trianglePosition(h.startX, h.distance, h.periodMs, lo);
  const pHi = trianglePosition(h.startX, h.distance, h.periodMs, hi);
  const endA = h.startX;
  const endB = h.startX + h.distance;
  let minP = Math.min(pLo, pHi);
  let maxP = Math.max(pLo, pHi);

  // 一个周期内必经过两个端点
  if (h.periodMs > 0 && hi - lo >= h.periodMs) {
    minP = Math.min(minP, endA, endB);
    maxP = Math.max(maxP, endA, endB);
    return { minP, maxP };
  }

  // 折返点 t = k * periodMs / 2
  if (h.periodMs > 0) {
    const half = h.periodMs / 2;
    const k0 = Math.floor(lo / half);
    const k1 = Math.ceil(hi / half);
    for (let k = k0; k <= k1; k += 1) {
      const t = k * half;
      if (t < lo - EPS || t > hi + EPS) continue;
      const p = trianglePosition(h.startX, h.distance, h.periodMs, t);
      minP = Math.min(minP, p);
      maxP = Math.max(maxP, p);
    }
  }
  return { minP, maxP };
}

/**
 * 碰撞位姿的保守扫掠带。真实检测使用 `P(t - δ)`，δ ∈ [0, lagMs]；
 * 由于 P 的 Lipschitz 常数为 `hazardSpeed`，`P(t-δ) ∈ [P(t)-pad, P(t)+pad]`。
 * @param {object} h hazard
 * @param {number} t 检测时刻（game-time）
 * @param {number} lagMs 必须由调用方给出；不得假设为 0
 * @returns {{left:number, right:number, pad:number, p:number}}
 */
export function hazardSpanAt(h, t, lagMs) {
  const pad = hazardSpeed(h) * lagMs;
  const p = trianglePosition(h.startX, h.distance, h.periodMs, t);
  return {
    left: p - pad - h.anchorX * h.width,
    right: p + pad + (1 - h.anchorX) * h.width,
    pad,
    p,
  };
}

/**
 * 玩家与 hazard 的垂直区间是否严格相交。本原型不建模跳跃/下落：
 * 只回答「玩家当前竖直占据区间是否与 hazard 相交」。
 * @param {{y:number, height:number}} player
 * @param {{y:number, height:number}} hazard
 * @returns {boolean}
 */
export function verticallyOverlaps(player, hazard) {
  return player.y < hazard.y + hazard.height - EPS && player.y + player.height > hazard.y + EPS;
}

/**
 * 在给定时刻点，玩家左边缘 x 的盒子是否与 hazard 扫掠带严格相交。
 * @param {object} config
 * @param {number} x 玩家左边缘
 * @param {number} t
 * @param {number} lagMs
 * @returns {boolean}
 */
export function pointCollides(config, x, t, lagMs) {
  const p = config.player;
  const h = config.hazard;
  if (!verticallyOverlaps(p, h)) return false;
  const span = hazardSpanAt(h, t, lagMs);
  return x < span.right - EPS && x + p.width > span.left + EPS;
}

/**
 * 解 `c0 + c1*u > 0` 在 `u ∈ [0, dt]` 上的开区间。
 * @returns {[number, number]|null}
 */
function positiveInterval(c0, c1, dt) {
  if (Math.abs(c1) < EPS) return c0 > EPS ? [0, dt] : null;
  const root = -c0 / c1;
  let lo = 0;
  let hi = dt;
  if (c1 > 0) lo = Math.max(lo, root);
  else hi = Math.min(hi, root);
  return lo < hi - EPS ? [lo, hi] : null;
}

/**
 * 玩家线段（左边缘线性移动）与 hazard 的连续相交判定。
 * 把线段按 hazard 折返点切成 P 线性的子区间，在每个子区间内解析求交。
 * 这是「连续包络」，不是采样：只要区间内存在严格 AABB 相交就返回碰撞。
 *
 * @param {{t0:number, t1:number, x0:number, x1:number}} seg 玩家左边缘线段
 * @param {object} config
 * @param {number} lagMs
 * @returns {{t:number, x:number, hazardLeft:number, hazardRight:number}|null}
 */
export function segmentCollides(seg, config, lagMs) {
  const p = config.player;
  const h = config.hazard;
  if (!verticallyOverlaps(p, h)) return null;
  const dtSeg = seg.t1 - seg.t0;
  if (!(dtSeg > EPS)) {
    return pointCollides(config, seg.x0, seg.t0, lagMs)
      ? { t: seg.t0, x: seg.x0, hazardLeft: hazardSpanAt(h, seg.t0, lagMs).left, hazardRight: hazardSpanAt(h, seg.t0, lagMs).right }
      : null;
  }

  const cuts = [seg.t0, seg.t1];
  if (h.periodMs > 0) {
    const half = h.periodMs / 2;
    const k0 = Math.floor(seg.t0 / half);
    const k1 = Math.ceil(seg.t1 / half);
    for (let k = k0; k <= k1; k += 1) {
      const t = k * half;
      if (t > seg.t0 + EPS && t < seg.t1 - EPS) cuts.push(t);
    }
  }
  cuts.sort((a, b) => a - b);

  const slopeX = (seg.x1 - seg.x0) / dtSeg;
  const pad = hazardSpeed(h) * lagMs;
  const halfW = h.anchorX * h.width;
  const otherW = (1 - h.anchorX) * h.width;

  for (let i = 0; i < cuts.length - 1; i += 1) {
    const a = cuts[i];
    const b = cuts[i + 1];
    const dt = b - a;
    if (!(dt > EPS)) continue;
    const pa = trianglePosition(h.startX, h.distance, h.periodMs, a);
    const pb = trianglePosition(h.startX, h.distance, h.periodMs, b);
    const slopeP = (pb - pa) / dt;
    const xa = seg.x0 + slopeX * (a - seg.t0);
    const leftA = pa - pad - halfW;
    const rightA = pa + pad + otherW;
    // (x + pw) > hLeft  =>  (xa + pw - leftA) + (slopeX - slopeP) * u > 0
    const i1 = positiveInterval(xa + p.width - leftA, slopeX - slopeP, dt);
    if (!i1) continue;
    // x < hRight  =>  (rightA - xa) + (slopeP - slopeX) * u > 0
    const i2 = positiveInterval(rightA - xa, slopeP - slopeX, dt);
    if (!i2) continue;
    const lo = Math.max(i1[0], i2[0]);
    const hi = Math.min(i1[1], i2[1]);
    if (lo < hi - EPS) {
      const u = (lo + hi) / 2;
      const t = a + u;
      const span = hazardSpanAt(h, t, lagMs);
      return { t, x: xa + slopeX * u, hazardLeft: span.left, hazardRight: span.right };
    }
  }
  return null;
}

/**
 * 永久封锁门证明。
 *
 * ⚠️ 不可玩证明需要的是「所有可能位姿的**交集**」，不是并集。
 * 设 hazard 在所有时刻的位置范围为 [minP, maxP]（一个周期内取到）；对任意可能的
 * 检测位姿 P(T-δ)（δ ∈ [0, lagMs]），点 g 都被覆盖 ⇔
 *   g >= P - anchorX*w 且 g <= P + (1-anchorX)*w  对所有 P ∈ [minP, maxP]
 * ⇔ g ∈ [maxP - anchorX*w, minP + (1-anchorX)*w]。
 * 该交集**不带 lag pad**：lag 的不确定性只会让可证明的门变窄，绝不会变宽。
 * 安全 witness 用的是并集（扫掠带），两者方向相反，不可混用。
 *
 * 若 C = [L, R] 是正宽度（L < R），且玩家起点盒完全在 C 左侧、终点在 C 右侧
 * （或反过来），则玩家从起点到终点必须让盒子跨过 C 中某点；而该点在任何时刻、
 * 任何可能 lag 位姿下都被 hazard 覆盖 ⇒ 必然严格相交。
 *
 * 单点门（L == R）不构成证明：严格 AABB 下玩家可能在恰好相切的瞬间穿过。
 *
 * ⚠️ 该证明假设玩家**无法垂直规避**（跳过/绕下）。调用方必须显式声明
 * `assumptions.verticalEvasionImpossible === true`，否则本原型只返回
 * `INSUFFICIENT_EVIDENCE`，不得据此判不可玩。
 *
 * @param {object} config
 * @returns {{kind:string, gateLo:number, gateHi:number, minP:number, maxP:number}|null}
 */
export function provePermanentGate(config) {
  const p = config.player;
  const h = config.hazard;
  if (!verticallyOverlaps(p, h)) return null;
  if (h.axis !== "x") return null;
  if (!(h.periodMs > 0)) return null;

  const { minP, maxP } = hazardPositionRange(h, 0, h.periodMs);
  const L = maxP - h.anchorX * h.width;
  const R = minP + (1 - h.anchorX) * h.width;
  // 必须是**正宽度**门：L == R 时玩家可以在「恰好相切」的瞬间穿过（严格 AABB 不算碰撞），
  // 该证明不成立，只返回 null（交由 IE）。
  if (!(L < R - EPS)) return null;

  const s = p.startX;
  const g = p.goalX;
  const pw = p.width;
  let holds = false;
  if (g > s) holds = s + pw < L - EPS && g > R + EPS;
  else if (g < s) holds = g + pw < L - EPS && s > R + EPS;
  if (!holds) return null;

  return { kind: "permanent-gate", gateLo: L, gateHi: R, minP, maxP };
}

/** 二分下界。 */
function lowerBound(arr, v) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** 构造玩家左边缘的 x 网格（含 start / goal）。 */
function buildXGrid(config) {
  const { xMin, xMax } = config.world;
  const p = config.player;
  const maxLeft = xMax - p.width;
  const step = config.options?.xStep ?? 2;
  const values = new Set([xMin, maxLeft, p.startX, p.goalX]);
  const n = Math.floor((maxLeft - xMin) / step);
  for (let i = 0; i <= n; i += 1) {
    const x = xMin + i * step;
    if (x <= maxLeft + EPS) values.add(Math.round(x * 1e6) / 1e6);
  }
  return [...values].filter((x) => x >= xMin - EPS && x <= maxLeft + EPS).sort((a, b) => a - b);
}

/** 从父链重建 witness 线段。 */
function reconstruct(endEntry, dt, startedAt) {
  const segments = [];
  let cur = endEntry;
  while (cur && cur.parent) {
    segments.push({ t0: cur.parent.depth * dt, t1: cur.depth * dt, x0: cur.parent.x, x1: cur.x });
    cur = cur.parent;
  }
  segments.reverse();
  let departAt = 0;
  for (const s of segments) {
    if (Math.abs(s.x1 - s.x0) > EPS) { departAt = s.t0; break; }
  }
  const arriveAt = segments.length ? segments[segments.length - 1].t1 : 0;
  return { segments, departAt, arriveAt, elapsedMs: Date.now() - startedAt };
}

/**
 * 分析入口。
 * @param {object} config
 * @returns {{verdict:Verdict, reason:string, witness?:object, proof?:object, stats:object, assumptions:string[]}}
 */
export function analyze(config) {
  const startedAt = Date.now();
  const options = config.options ?? {};
  const limits = {
    maxStates: options.limits?.maxStates ?? 200000,
    timeBudgetMs: options.limits?.timeBudgetMs ?? 5000,
  };
  const stats = {
    xPositions: 0,
    phaseSteps: 0,
    dtMs: 0,
    maxStepPx: 0,
    statesEnqueued: 0,
    statesVisited: 0,
    edgesChecked: 0,
    elapsedMs: 0,
    limits,
    budgetExceeded: false,
  };
  const assumptions = [
    "x-axis-only hazard",
    "single hazard",
    "no vertical evasion modelled",
    "game-time T only (no wall clock for physics)",
  ];

  const ie = (reason, extra = {}) => {
    stats.elapsedMs = Date.now() - startedAt;
    return { verdict: Verdict.INSUFFICIENT, reason, stats, assumptions, ...extra };
  };

  // ---- 输入门 ----
  if (!config || !config.player || !config.hazard || !config.world) return ie("malformed-config");
  if (Array.isArray(config.hazard) || Array.isArray(config.hazards)) return ie("multiple-hazards-out-of-scope");
  if (config.hazard.axis !== "x") return ie("y-axis-not-modelled");
  if (config.certainty?.phase !== "known") return ie("phase-uncertain");
  if (config.certainty?.hitbox !== "known") return ie("hitbox-uncertain");
  const lagMs = options.lagMs;
  if (!(typeof lagMs === "number" && Number.isFinite(lagMs) && lagMs >= 0)) {
    return ie("lag-bound-unspecified");
  }
  const p = config.player;
  const h = config.hazard;
  const { xMin, xMax } = config.world;
  if (!(p.width > 0) || !(p.height > 0) || !(p.maxSpeed > 0)) return ie("invalid-player");
  if (!(h.width > 0) || !(h.height > 0)) return ie("invalid-hazard");
  if (h.distance > 0 && !(h.periodMs > 0)) return ie("invalid-hazard-period");
  if (p.startX < xMin - EPS || p.startX > xMax - p.width + EPS) return ie("start-outside-world");
  if (p.goalX < xMin - EPS || p.goalX > xMax - p.width + EPS) return ie("goal-outside-world");
  if (!(options.phaseSteps >= 2)) return ie("invalid-phase-steps");

  // 起点已在碰撞中：属出生点语义，超出本模型范围。
  if (pointCollides(config, p.startX, 0, lagMs)) return ie("start-in-collision");

  // ---- 不可玩证明（唯一合法来源） ----
  const proof = provePermanentGate(config);
  if (proof) {
    if (config.assumptions?.verticalEvasionImpossible !== true) {
      return ie("unplayable-proof-requires-vertical-evasion-assumption", { proof });
    }
    stats.elapsedMs = Date.now() - startedAt;
    return {
      verdict: Verdict.UNPLAYABLE,
      reason: "permanent-gate",
      proof,
      stats,
      assumptions: [...assumptions, "vertical evasion impossible (declared by caller)"],
    };
  }

  // ---- 安全 witness 搜索 ----
  const N = options.phaseSteps;
  const dt = h.periodMs / N;
  const maxStep = p.maxSpeed * dt;
  const xs = buildXGrid(config);
  const startIdx = xs.indexOf(p.startX);
  const goalIdx = xs.indexOf(p.goalX);
  if (startIdx < 0 || goalIdx < 0) return ie("grid-alignment-error");
  stats.xPositions = xs.length;
  stats.phaseSteps = N;
  stats.dtMs = dt;
  stats.maxStepPx = maxStep;

  if (startIdx === goalIdx) {
    stats.elapsedMs = Date.now() - startedAt;
    return {
      verdict: Verdict.SAFE,
      reason: "start-equals-goal",
      witness: { segments: [], departAt: 0, arriveAt: 0, elapsedMs: 0 },
      stats,
      assumptions,
    };
  }

  const visited = new Uint8Array(xs.length * N);
  const startEntry = { i: startIdx, x: p.startX, depth: 0, parent: null };
  visited[startIdx * N + 0] = 1;
  const queue = [startEntry];
  stats.statesEnqueued = 1;

  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head];
    stats.statesVisited += 1;
    if ((stats.statesVisited & 1023) === 0 && Date.now() - startedAt > limits.timeBudgetMs) {
      stats.budgetExceeded = true;
      return ie("search-budget-exhausted", { stats });
    }
    const nextDepth = cur.depth + 1;
    const phase = nextDepth % N;
    const t0 = cur.depth * dt;
    const t1 = nextDepth * dt;
    const lo = lowerBound(xs, cur.x - maxStep - EPS);
    const hi = lowerBound(xs, cur.x + maxStep + EPS);
    for (let j = lo; j < hi; j += 1) {
      stats.edgesChecked += 1;
      const x1 = xs[j];
      const seg = { t0, t1, x0: cur.x, x1 };
      if (segmentCollides(seg, config, lagMs)) continue;
      if (j === goalIdx) {
        const entry = { i: j, x: x1, depth: nextDepth, parent: cur };
        const witness = reconstruct(entry, dt, startedAt);
        stats.elapsedMs = Date.now() - startedAt;
        return { verdict: Verdict.SAFE, reason: "witness-found", witness, stats, assumptions };
      }
      const key = j * N + phase;
      if (visited[key]) continue;
      visited[key] = 1;
      queue.push({ i: j, x: x1, depth: nextDepth, parent: cur });
      stats.statesEnqueued += 1;
      if (stats.statesEnqueued > limits.maxStates) {
        stats.budgetExceeded = true;
        return ie("search-budget-exhausted", { stats });
      }
    }
  }

  return ie("no-witness-found");
}

/** 独立验证一个 witness：逐段连续判定，返回第一处碰撞或 null。 */
export function verifyWitness(config, witness, lagMs) {
  for (const seg of witness.segments) {
    const hit = segmentCollides(seg, config, lagMs);
    if (hit) return hit;
  }
  return null;
}
