/**
 * I02-03 · X 轴三角波 + AABB 连续时间解析求交 —— ⚠️ SCRATCH 原型（THROWAWAY）。
 *
 * 只服务 I02-03 的证据采集：验证连续时间解析求交的数学与数值稳定性。
 * **不是生产实现**；不得被 `packages/**` 引用；不构成生产验收。
 *
 * 语义基线（冻结，只读）：
 *   - 相切语义 = `packages/contracts/src/playability/geometry.ts:14-15` 的 `overlapsStrict`
 *     （贴着不算撞；有正面积重叠才算）。
 *   - 容差 = `docs/v7.8/移动-I00.md:90` 的单一常量
 *     ε = max(1e-9, 1e-9 × (xMax − xMin))。本文件**不**用 ε 缩小碰撞谓词；
 *     ε 只作为“区间是否宽到能成为证据”的显式参数 `intervalTol`，默认 0。
 *   - 三角波 = `docs/v7.8/移动-I00.md:70-71`：t=0 在 `at`；`periodMs` 为往返整周期；
 *     折返点在 `periodMs/2`；两端不停留。
 *
 * 坐标系：AABB 的 `y` 是**上边缘**（与 `contracts/playability/geometry.ts` 的 `Aabb` 一致）；
 * `x` 是左边缘。
 */

export const EPS_FLOOR = 1e-9;

/** I-00 §6.4 冻结常量；world 是 `{xMin, xMax}`。 */
export const epsilonFor = (world) =>
  Math.max(EPS_FLOOR, EPS_FLOOR * (world.xMax - world.xMin));

export const finite = (x) => typeof x === "number" && Number.isFinite(x);

/* ------------------------------------------------------------------ *
 * 1. 三角波
 * ------------------------------------------------------------------ */

/**
 * 位置。`distance <= 0` 或失效周期 ⇒ 原地不动（P0 同义）。
 * 负时间与多周期一律走模运算；三角波对 t 是偶函数（p(−t) = p(t)）。
 */
export function trianglePosition(at, distance, periodMs, t) {
  if (!finite(at) || !finite(distance) || !finite(periodMs) || !finite(t)) return NaN;
  if (!(distance > 0) || !(periodMs > 0)) return at;
  const phase = ((t % periodMs) + periodMs) % periodMs;
  const u = phase / periodMs;
  return at + (u < 0.5 ? 2 * u : 2 - 2 * u) * distance;
}

/** 速度绝对值恒为 2·distance/periodMs。 */
export const triangleSpeed = (distance, periodMs) =>
  finite(distance) && finite(periodMs) && distance > 0 && periodMs > 0
    ? (2 * distance) / periodMs
    : 0;

/**
 * 单调段斜率（±v）。只在**段内部**取值：`tMid` 必须严格落在两个折返点之间。
 * 折返点上导数不存在，本模型不给“折返点速度”下定义，只给左右极限。
 */
export function pieceSlope(distance, periodMs, tMid) {
  if (!(distance > 0) || !(periodMs > 0)) return 0;
  const phase = ((tMid % periodMs) + periodMs) % periodMs;
  return phase / periodMs < 0.5
    ? (2 * distance) / periodMs
    : -(2 * distance) / periodMs;
}

/* ------------------------------------------------------------------ *
 * 2. AABB 与严格相交
 * ------------------------------------------------------------------ */

export const overlapsStrict = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export const playerBoxAt = (player, x) => ({
  x,
  y: player.y,
  w: player.width,
  h: player.height,
});

/**
 * Hazard 盒子。`lagMs` 的两种处理：
 *   - "none"：检测位姿就在 t。
 *   - "pad" ：P0 兼容的**对称**扫掠带 [p − v·lag, p + v·lag]。它是 ∃δ 的
 *             **保守超集**（真实可达集只在运动反方向），可用于安全证伪，不可用于 PU。
 * 精确 ∃δ 的可达集是方向性的，且在折返点附近是两段并集；连续时间求交需要额外
 * 切点。本原型**不**在连续求解器里实现 exact-δ，只提供逐点查询（见 exactReachableSpanAt）。
 */
export function hazardSpanAt(h, t, lagMs = 0, lagMode = "none") {
  const p = trianglePosition(h.at, h.distance, h.periodMs, t);
  const pad = lagMode === "pad" ? triangleSpeed(h.distance, h.periodMs) * lagMs : 0;
  return {
    p,
    pad,
    left: p - pad - h.anchorX * h.width,
    right: p + pad + (1 - h.anchorX) * h.width,
  };
}

/** 区间 [a,b] 上三角波位置的 min/max（P0 `hazardPositionRange` 的同义实现）。 */
export function positionRangeOver(h, a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let minP = Math.min(
    trianglePosition(h.at, h.distance, h.periodMs, lo),
    trianglePosition(h.at, h.distance, h.periodMs, hi),
  );
  let maxP = Math.max(
    trianglePosition(h.at, h.distance, h.periodMs, lo),
    trianglePosition(h.at, h.distance, h.periodMs, hi),
  );
  if (!(h.distance > 0) || !(h.periodMs > 0)) return { minP, maxP };
  if (hi - lo >= h.periodMs) {
    minP = Math.min(minP, h.at, h.at + h.distance);
    maxP = Math.max(maxP, h.at, h.at + h.distance);
    return { minP, maxP };
  }
  const half = h.periodMs / 2;
  const k0 = Math.floor(lo / half) - 1;
  const k1 = Math.ceil(hi / half) + 1;
  for (let k = k0; k <= k1; k += 1) {
    const t = k * half;
    if (t < lo || t > hi) continue;
    const p = trianglePosition(h.at, h.distance, h.periodMs, t);
    minP = Math.min(minP, p);
    maxP = Math.max(maxP, p);
  }
  return { minP, maxP };
}

/** 逐点精确 ∃δ∈[0,lagMs] 的可达 x 区间（方向性、含折返）。 */
export function exactReachableSpanAt(h, t, lagMs) {
  const { minP, maxP } = positionRangeOver(h, t - lagMs, t);
  return {
    left: minP - h.anchorX * h.width,
    right: maxP + (1 - h.anchorX) * h.width,
    minP,
    maxP,
  };
}

/* ------------------------------------------------------------------ *
 * 3. 输入校验（非有限值必须显式报错，不得静默返回 false）
 * ------------------------------------------------------------------ */

export function validate(seg, cfg, opts = {}) {
  if (!seg || !cfg || !cfg.player || !cfg.hazard) return "malformed";
  const p = cfg.player;
  const h = cfg.hazard;
  for (const [k, v] of [
    ["player.width", p.width], ["player.height", p.height], ["player.y", p.y],
    ["hazard.at", h.at], ["hazard.distance", h.distance], ["hazard.periodMs", h.periodMs],
    ["hazard.width", h.width], ["hazard.height", h.height],
    ["hazard.anchorX", h.anchorX], ["hazard.y", h.y],
    ["segment.t0", seg.t0], ["segment.t1", seg.t1],
    ["segment.x0", seg.x0], ["segment.x1", seg.x1],
    ["opts.lagMs", opts.lagMs ?? 0],
  ]) {
    if (!finite(v)) return `${k}-not-finite`;
  }
  if (p.width < 0 || p.height < 0) return "player-negative-size";
  if (h.width < 0 || h.height < 0) return "hazard-negative-size";
  if (h.anchorX < 0 || h.anchorX > 1) return "anchor-x-out-of-range";
  if (h.distance > 0 && !(h.periodMs > 0)) return "invalid-period";
  if ((opts.lagMs ?? 0) < 0) return "negative-lag";
  if (seg.t1 < seg.t0) return "segment-time-reversed";
  return null;
}

/* ------------------------------------------------------------------ *
 * 4. 解析求交
 * ------------------------------------------------------------------ */

/**
 * 解 `c0 + c1·u > 0`，u ∈ [0, dt]，返回开区间 [lo, hi]（`hi > lo` 才有内容）。
 *
 * `slopeClamp > 0` 只用于**复现 P0**：P0 用绝对量 1e-9 判定“速度差为零”，
 * 这在量纲上不成立（速度差单位 px/ms）。生产语义必须用精确的 `c1 === 0`。
 */
export function positiveOpenInterval(c0, c1, dt, slopeClamp = 0, constTol = 0) {
  const isConstant = slopeClamp > 0 ? Math.abs(c1) < slopeClamp : c1 === 0;
  if (isConstant) {
    return c0 > constTol ? [0, dt] : null;
  }
  const root = -c0 / c1;
  let lo;
  let hi;
  if (c1 > 0) {
    lo = Math.max(0, root);
    hi = dt;
  } else {
    lo = 0;
    hi = Math.min(dt, root);
  }
  return lo < hi ? [lo, hi] : null;
}

/** 折返点切点：t = k·periodMs/2，只取严格落在 (t0, t1) 内部的。 */
export function turnaroundCuts(t0, t1, periodMs, limit = 1e6) {
  if (!(periodMs > 0)) return { cuts: [] };
  const half = periodMs / 2;
  const k0 = Math.floor(t0 / half);
  const k1 = Math.ceil(t1 / half);
  if (k1 - k0 > limit) return { error: "too-many-cuts", count: k1 - k0 };
  const cuts = [];
  for (let k = k0; k <= k1; k += 1) {
    const t = k * half;
    if (t > t0 && t < t1) cuts.push(t);
  }
  return { cuts };
}

/**
 * 连续时间求交（解析，不采样）。
 *
 * @param {{t0:number,x0:number,t1:number,x1:number}} seg 玩家左边缘线性段
 * @param {{player:object,hazard:object}} cfg
 * @param {object} opts
 *   - lagMs: 检测滞后（仅 "none" / "pad"）
 *   - lagMode: "none" | "pad"
 *   - intervalTol: 碰撞开区间必须宽于该值才算命中（默认 0 = 纯严格语义）
 *   - slopeClamp / constTol / cutEps / yMode: **仅用于复现 P0**，默认关闭
 * @returns {{ok:true,hit:boolean,intervals:number[][],cuts:number[],reason?:string}
 *          |{ok:false,error:string}}
 */
export function segmentCollides(seg, cfg, opts = {}) {
  const {
    lagMs = 0,
    lagMode = "none",
    intervalTol = 0,
    slopeClamp = 0,
    constTol = 0,
    cutEps = 0,
    dtEps = 0,
    yMode = "exact",
    mergeGap = 0,
  } = opts;

  const bad = validate(seg, cfg, opts);
  if (bad) return { ok: false, error: bad };

  const p = cfg.player;
  const h = cfg.hazard;

  // 竖直方向在整段上是常量：不满足严格相交 ⇒ 永不碰撞（比 P0 的 EPS 收缩更精确）。
  const yHit =
    yMode === "p0"
      ? p.y < h.y + h.height - 1e-9 && p.y + p.height > h.y + 1e-9
      : p.y < h.y + h.height && h.y < p.y + p.height;
  if (!yHit) return { ok: true, hit: false, intervals: [], cuts: [], reason: "y-separated" };

  const dtSeg = seg.t1 - seg.t0;
  if (!(dtSeg > 0)) {
    const span = hazardSpanAt(h, seg.t0, lagMs, lagMode);
    const hit = overlapsStrict(playerBoxAt(p, seg.x0), {
      x: span.left, y: h.y, w: span.right - span.left, h: h.height,
    });
    return { ok: true, hit, intervals: hit ? [[seg.t0, seg.t0]] : [], cuts: [], reason: "point" };
  }

  const cutRes = turnaroundCuts(seg.t0, seg.t1, h.periodMs);
  if (cutRes.error) return { ok: false, error: cutRes.error };
  const cuts = [seg.t0, ...cutRes.cuts.filter((t) => t > seg.t0 + cutEps && t < seg.t1 - cutEps), seg.t1]
    .sort((a, b) => a - b);

  const slopeX = (seg.x1 - seg.x0) / dtSeg;
  const intervals = [];

  for (let i = 0; i < cuts.length - 1; i += 1) {
    const a = cuts[i];
    const b = cuts[i + 1];
    const dt = b - a;
    if (!(dt > dtEps)) continue;
    const mid = a + dt / 2;
    const pa = trianglePosition(h.at, h.distance, h.periodMs, a);
    const slopeP = pieceSlope(h.distance, h.periodMs, mid);
    const xa = seg.x0 + slopeX * (a - seg.t0);
    const pad = lagMode === "pad" ? triangleSpeed(h.distance, h.periodMs) * lagMs : 0;
    const leftA = pa - pad - h.anchorX * h.width;
    const rightA = pa + pad + (1 - h.anchorX) * h.width;

    // 1) 玩家右边缘 > hazard 左边缘： (xa + pw − leftA) + (slopeX − slopeP)·u > 0
    const i1 = positiveOpenInterval(
      xa + p.width - leftA, slopeX - slopeP, dt, slopeClamp, constTol,
    );
    if (!i1) continue;
    // 2) 玩家左边缘 < hazard 右边缘： (rightA − xa) + (slopeP − slopeX)·u > 0
    const i2 = positiveOpenInterval(
      rightA - xa, slopeP - slopeX, dt, slopeClamp, constTol,
    );
    if (!i2) continue;

    const lo = Math.max(i1[0], i2[0]);
    const hi = Math.min(i1[1], i2[1]);
    if (hi - lo > intervalTol) intervals.push([a + lo, a + hi]);
  }

  intervals.sort((x, y) => x[0] - y[0]);
  const merged = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv[0] - last[1] <= mergeGap) {
      last[1] = Math.max(last[1], iv[1]);
    } else {
      merged.push([iv[0], iv[1]]);
    }
  }

  return { ok: true, hit: merged.length > 0, intervals: merged, cuts: cuts.slice(1, -1) };
}

/** 单点谓词（连续求解器的退化分支也用同一套语义）。 */
export function pointCollides(cfg, x, t, opts = {}) {
  const span = hazardSpanAt(cfg.hazard, t, opts.lagMs ?? 0, opts.lagMode ?? "none");
  return overlapsStrict(playerBoxAt(cfg.player, x), {
    x: span.left,
    y: cfg.hazard.y,
    w: span.right - span.left,
    h: cfg.hazard.height,
  });
}

/* ------------------------------------------------------------------ *
 * 5. 朴素采样（只用于反例演示，永不作证据）
 * ------------------------------------------------------------------ */

export function sampleScan(seg, cfg, count, opts = {}) {
  if (!(count >= 2)) return { times: [seg.t0], hits: [] };
  const times = [];
  for (let i = 0; i < count; i += 1) {
    times.push(seg.t0 + ((seg.t1 - seg.t0) * i) / (count - 1));
  }
  const slopeX = (seg.x1 - seg.x0) / (seg.t1 - seg.t0);
  const hits = [];
  for (const t of times) {
    const x = seg.x0 + slopeX * (t - seg.t0);
    if (pointCollides(cfg, x, t, opts)) hits.push(t);
  }
  return { times, hits };
}

/* ------------------------------------------------------------------ *
 * 6. 永久封锁门的 x 门区（只算几何，不判 PU；用于 ε 临界演示）
 * ------------------------------------------------------------------ */

export function gateInterval(h) {
  const { minP, maxP } = positionRangeOver(h, 0, h.periodMs);
  return { L: maxP - h.anchorX * h.width, R: minP + (1 - h.anchorX) * h.width, minP, maxP };
}
