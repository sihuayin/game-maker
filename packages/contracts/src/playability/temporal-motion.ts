// **I-02 运动原语与连续时间求交**（D2 / I02-03）—— 解析解，不采样。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、三角波
//
//   `p(t)` 是 Hazard **锚点**的 x，不是盒子左上角；`P` 是往返整周期，`t = kP/2`
//   是折返点。负时间 / 多周期由模运算覆盖。折返点处导数不存在 ⇒ `triangleSpeed`
//   返回 `null`，不人为指定 0 或右连续。
//
// 二、碰撞谓词
//
//   唯一谓词是 `geometry.ts` 的 `overlapsStrict`：贴边、角接触、零面积都不算撞。
//   ε **不进入**谓词；它只作为门宽 / 显式区间阈值出现。任何正的碰撞窗口都不能被
//   默认阈值吞掉（`intervalTolerance` 默认 `0`）。
//
// 三、连续求交
//
//   在每个折返点切段；段内 `p(t)` 与玩家左边缘都是线性的，两个严格不等式各给出
//   一个开区间，交集即碰撞窗口。`c1 === 0` 走精确分支，不对速度差设绝对容差。
//   相邻段共享切点时，只有切点姿态本身**真的重叠**才合并 —— 否则保留零测度安全点。
//
// 四、lagPad
//
//   Witness 方向的保守扫掠带 = `hazardSpeed × lagMs`，按右极限方向取单侧区间；
//   **不得**用于门区（D4 的门区不加 pad）。
// ─────────────────────────────────────────────────────────────────────────────
import { boxFromFoot, overlapsStrict } from "./geometry.js";
import type { Aabb, Size, Vec } from "./geometry.js";
import { BUDGET_DEFAULTS } from "./temporal-budget.js";

/** @internal 三角波参数：`at` 是 t=0 的锚点位置，只有 x 随时间变化。 */
export type TriangleMotion = {
  readonly at: Vec;
  readonly distance: number;
  readonly periodMs: number;
};

/** @internal Hazard 盒来源：manifest 的 `size` + `anchor`，忽略 `entity.body`。 */
export type HazardBoxSpec = {
  readonly size: Size;
  readonly anchor: Vec;
};

/** @internal 锚点 x 上的闭区间（lag 扫掠带）。 */
export type AnchorSpan = {
  readonly min: number;
  readonly max: number;
};

/** @internal 碰撞开区间；`end > start` 表示正宽度，`end === start` 表示瞬时点。 */
export type CollisionInterval = {
  readonly start: number;
  readonly end: number;
};

/** @internal 单次连续求交的输入。 */
export type ContinuousCheckInput = {
  readonly motion: TriangleMotion;
  readonly hazard: HazardBoxSpec;
  /** `t0` 时刻的玩家盒（未取整）。 */
  readonly playerBox: Aabb;
  /** 玩家水平速度 [px/ms]；静止为 `0`。 */
  readonly playerSpeedX: number;
  readonly t0: number;
  readonly t1: number;
  /** 显式区间阈值；默认 `0`。不得用 ε 冒充碰撞谓词。 */
  readonly intervalTolerance?: number;
  /** 单次 check 的折返点上限；默认 `maxCutsPerCheck`。 */
  readonly maxCuts?: number;
};

/** @internal 求交失败原因；调用方据此降级为 IE。 */
export type ContinuousCheckReason = "non-finite" | "invalid-input" | "cut-budget";

/** @internal 单次连续求交结果。 */
export type ContinuousCheckResult =
  | {
      readonly ok: true;
      /** 合并后的碰撞区间；时间轴为绝对 game-time。 */
      readonly intervals: readonly CollisionInterval[];
      /** 严格位于 `(t0, t1)` 内的折返点切分数。 */
      readonly cutPoints: number;
      /** `cutPoints + 1`。 */
      readonly segments: number;
    }
  | { readonly ok: false; readonly reason: ContinuousCheckReason };

const requireFinite = (value: number, name: string): void => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
};

const requireMotion = (motion: TriangleMotion): void => {
  requireFinite(motion.at.x, "motion.at.x");
  requireFinite(motion.at.y, "motion.at.y");
  requireFinite(motion.distance, "motion.distance");
  requireFinite(motion.periodMs, "motion.periodMs");
  if (motion.periodMs <= 0) throw new RangeError("motion.periodMs must be > 0");
};

/** 相位 `φ = ((t mod P) + P) mod P`。 */
const phaseOf = (motion: TriangleMotion, t: number): number => {
  const period = motion.periodMs;
  return ((t % period) + period) % period;
};

/** `v_max = 2·distance/periodMs` [px/ms]。 */
export const triangleMaxRate = (motion: TriangleMotion): number => {
  requireMotion(motion);
  return motion.distance > 0 ? (2 * motion.distance) / motion.periodMs : 0;
};

/**
 * @internal 三角波锚点 x：`p(t) = at.x + d·k(u)`。
 *
 * `distance ≤ 0` 按原地不动处理（与 I02-03 证据 §4.1 一致）；非法周期 / 非有限
 * 输入抛 `RangeError`，不静默修复。
 */
export const trianglePosition = (motion: TriangleMotion, t: number): number => {
  requireMotion(motion);
  requireFinite(t, "t");
  if (motion.distance <= 0) return motion.at.x;
  const u = phaseOf(motion, t) / motion.periodMs;
  const k = u < 0.5 ? 2 * u : 2 - 2 * u;
  return motion.at.x + motion.distance * k;
};

/**
 * @internal 有符号速度 [px/ms]；折返点返回 `null`（导数不存在）。
 *
 * 只定义在单调段的开区间上，不是全局速度函数。
 */
export const triangleSpeed = (motion: TriangleMotion, t: number): number | null => {
  requireMotion(motion);
  requireFinite(t, "t");
  if (motion.distance <= 0) return 0;
  const phase = phaseOf(motion, t);
  const half = motion.periodMs / 2;
  if (phase === 0 || phase === half) return null;
  const rate = triangleMaxRate(motion);
  return phase < half ? rate : -rate;
};

/** `(tStart, tEnd)` 内是否含折返点。 */
const containsTurn = (motion: TriangleMotion, tStart: number, tEnd: number): boolean => {
  const half = motion.periodMs / 2;
  const firstK = Math.floor(tStart / half) + 1;
  const lastK = Math.ceil(tEnd / half) - 1;
  return lastK >= firstK;
};

/**
 * @internal 单调段斜率：由中点所在开区间给出。
 *
 * 段跨折返点（含端点）或 `tEnd ≤ tStart` 时返回 `null` —— 单段求交不得跨折返点。
 */
export const pieceSlope = (
  motion: TriangleMotion,
  tStart: number,
  tEnd: number,
): number | null => {
  requireMotion(motion);
  requireFinite(tStart, "tStart");
  requireFinite(tEnd, "tEnd");
  if (!(tEnd > tStart)) return null;
  if (motion.distance <= 0) return 0;
  if (containsTurn(motion, tStart, tEnd)) return null;
  const mid = tStart + (tEnd - tStart) / 2;
  return triangleSpeed(motion, mid);
};

/** @internal 由脚点（底边中点）+ manifest size 派生玩家盒；不取整。 */
export const playerBoxAt = (foot: Vec, size: Size): Aabb => boxFromFoot(foot, size);

/** @internal 时间 `t` 的 Hazard 盒；x 随三角波移动，y 静态，不取整。 */
export const hazardBoxAt = (
  motion: TriangleMotion,
  hazard: HazardBoxSpec,
  t: number,
): Aabb => {
  const anchorX = trianglePosition(motion, t);
  return {
    x: anchorX - hazard.anchor.x * hazard.size.w,
    y: motion.at.y - hazard.anchor.y * hazard.size.h,
    w: hazard.size.w,
    h: hazard.size.h,
  };
};

/**
 * @internal 容差 `ε = max(1e-9, 1e-9 × (xMax − xMin))`。
 *
 * 只用于门宽判定与显式区间阈值；**不进入**碰撞谓词，也不用它吞掉短窗口。
 */
export const epsilon = (xMin: number, xMax: number): number =>
  Math.max(1e-9, 1e-9 * (xMax - xMin));

/**
 * @internal Witness 方向的保守 lag 扫掠带（锚点 x 区间）。
 *
 * 方向取折返点的**右极限**（t=0 向上、P/2 向下）；`lagMs = 0` 或静止 Hazard 时
 * 退化为单点。门区不得使用本函数。
 */
export const lagPad = (
  motion: TriangleMotion,
  t: number,
  lagMs: number,
): AnchorSpan => {
  requireMotion(motion);
  requireFinite(t, "t");
  requireFinite(lagMs, "lagMs");
  if (lagMs < 0) throw new RangeError("lagMs must be >= 0");
  const position = trianglePosition(motion, t);
  if (motion.distance <= 0 || lagMs === 0) return { min: position, max: position };
  const rate = triangleMaxRate(motion);
  const phase = phaseOf(motion, t);
  const rising = phase < motion.periodMs / 2;
  return rising
    ? { min: position, max: position + rate * lagMs }
    : { min: position - rate * lagMs, max: position };
};

/** 单个线性不等式 `c0 + c1·u > 0` 在 `u ∈ [0, dt]` 上的开区间解。 */
const solveOpen = (c0: number, c1: number, dt: number): readonly [number, number] | null => {
  if (c1 === 0) return c0 > 0 ? [0, dt] : null;
  if (c1 > 0) {
    const bound = -c0 / c1;
    const lo = bound > 0 ? bound : 0;
    return lo <= dt ? [lo, dt] : null;
  }
  const bound = -c0 / c1;
  const hi = bound < dt ? bound : dt;
  return hi >= 0 ? [0, hi] : null;
};

const poseCollides = (input: ContinuousCheckInput, t: number): boolean => {
  const hazardBox = hazardBoxAt(input.motion, input.hazard, t);
  const playerBox: Aabb = {
    ...input.playerBox,
    x: input.playerBox.x + input.playerSpeedX * (t - input.t0),
  };
  return overlapsStrict(playerBox, hazardBox);
};

const isFiniteBox = (box: Aabb): boolean =>
  Number.isFinite(box.x) && Number.isFinite(box.y) &&
  Number.isFinite(box.w) && Number.isFinite(box.h);

const isNonNegativeInteger = (value: number): boolean =>
  Number.isInteger(value) && value >= 0;

/**
 * @internal 连续时间求交（解析解）。
 *
 * - 折返点切段；每段两个线性不等式取交集；
 * - `c1 === 0` 精确判定，不对速度差设容差；
 * - 相邻段共享切点时，仅当切点姿态真实重叠才合并；
 * - `t0 === t1` 退化为瞬时点查询，撞则返回 `[t0, t0]`；
 * - 切点数超过 `maxCuts` ⇒ `cut-budget`，不静默降级。
 */
export const intersectContinuous = (input: ContinuousCheckInput): ContinuousCheckResult => {
  const { motion, hazard, playerBox, playerSpeedX, t0, t1 } = input;
  const intervalTolerance = input.intervalTolerance ?? 0;
  const maxCuts = input.maxCuts ?? BUDGET_DEFAULTS.maxCutsPerCheck;

  if (
    !Number.isFinite(t0) || !Number.isFinite(t1) ||
    !Number.isFinite(playerSpeedX) || !Number.isFinite(intervalTolerance) ||
    !isFiniteBox(playerBox) || !Number.isFinite(hazard.size.w) ||
    !Number.isFinite(hazard.size.h) || !Number.isFinite(hazard.anchor.x) ||
    !Number.isFinite(hazard.anchor.y) || !Number.isFinite(motion.at.x) ||
    !Number.isFinite(motion.at.y) || !Number.isFinite(motion.distance) ||
    !Number.isFinite(motion.periodMs)
  ) {
    return { ok: false, reason: "non-finite" };
  }
  if (
    motion.periodMs <= 0 || t1 < t0 || intervalTolerance < 0 ||
    !isNonNegativeInteger(maxCuts)
  ) {
    return { ok: false, reason: "invalid-input" };
  }

  if (t1 === t0) {
    return {
      ok: true,
      intervals: poseCollides(input, t0) ? [{ start: t0, end: t0 }] : [],
      cutPoints: 0,
      segments: 1,
    };
  }

  // 切点集合 = {t0, t1} ∪ {k·P/2 | t0 < k·P/2 < t1}；先数后建，避免超预算。
  const half = motion.periodMs / 2;
  const firstK = Math.floor(t0 / half) + 1;
  const lastK = Math.ceil(t1 / half) - 1;
  const expectedCuts = lastK >= firstK ? lastK - firstK + 1 : 0;
  if (expectedCuts > maxCuts) return { ok: false, reason: "cut-budget" };

  const boundaries: number[] = [t0];
  for (let k = firstK; k <= lastK; k++) {
    const turn = k * half;
    if (turn > t0 && turn < t1) boundaries.push(turn);
  }
  boundaries.push(t1);
  const cutPoints = boundaries.length - 2;
  const segments = boundaries.length - 1;

  // y 是静态的：不重叠时整段不可能撞，但仍如实返回切段计数。
  const hazardY = motion.at.y - hazard.anchor.y * hazard.size.h;
  const yOverlaps =
    playerBox.y < hazardY + hazard.size.h && hazardY < playerBox.y + playerBox.h;
  if (!yOverlaps) return { ok: true, intervals: [], cutPoints, segments };

  const raw: CollisionInterval[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const a = boundaries[i] as number;
    const b = boundaries[i + 1] as number;
    const dt = b - a;
    const slope = pieceSlope(motion, a, b);
    if (slope === null) return { ok: false, reason: "invalid-input" };

    const hazardLeftAtA = trianglePosition(motion, a) - hazard.anchor.x * hazard.size.w;
    const hazardRightAtA = hazardLeftAtA + hazard.size.w;
    const playerLeftAtA = playerBox.x + playerSpeedX * (a - t0);

    const c01 = playerLeftAtA + playerBox.w - hazardLeftAtA;
    const c11 = playerSpeedX - slope;
    const c02 = hazardRightAtA - playerLeftAtA;
    const c12 = slope - playerSpeedX;
    if (
      !Number.isFinite(c01) || !Number.isFinite(c11) ||
      !Number.isFinite(c02) || !Number.isFinite(c12)
    ) {
      return { ok: false, reason: "non-finite" };
    }

    const leftBound = solveOpen(c01, c11, dt);
    const rightBound = solveOpen(c02, c12, dt);
    if (leftBound === null || rightBound === null) continue;

    const lo = Math.max(leftBound[0], rightBound[0]);
    const hi = Math.min(leftBound[1], rightBound[1]);
    if (!(hi - lo > intervalTolerance)) continue;

    raw.push({
      start: lo === 0 ? a : a + lo,
      end: hi === dt ? b : a + hi,
    });
  }

  const merged: CollisionInterval[] = [];
  for (const interval of raw) {
    const last = merged[merged.length - 1];
    if (last === undefined) {
      merged.push(interval);
    } else if (interval.start < last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, interval.end) };
    } else if (interval.start === last.end) {
      // 共享切点：切点姿态真实重叠才合并；否则保留零测度安全点。
      if (poseCollides(input, interval.start)) {
        merged[merged.length - 1] = { start: last.start, end: interval.end };
      } else {
        merged.push(interval);
      }
    } else {
      merged.push(interval);
    }
  }

  return { ok: true, intervals: merged, cutPoints, segments };
};
