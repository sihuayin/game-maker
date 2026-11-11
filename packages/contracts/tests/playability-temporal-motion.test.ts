// U1 / R1：三角波、AABB、ε 与连续时间解析求交。
//
// ⚠️ 只覆盖 U1（I02-01）。U2–U5 的 Witness / 门区 / 图割 / A–J 场景不在这里。
// ⚠️ 断言只依赖解析解，不做固定帧采样；采样只出现在「采样会漏、解析不会」的反例里。
import { describe, expect, it } from "vitest";
import { overlapsStrict } from "../src/playability/geometry.js";
import {
  epsilon,
  hazardBoxAt,
  lagPad,
  pieceSlope,
  playerBoxAt,
  triangleMaxRate,
  trianglePosition,
  triangleSpeed,
} from "../src/playability/temporal-motion.js";
import {
  aabb,
  checkContinuous,
  hazardSpec,
  intervalAt,
  okIntervals,
  okResult,
  triangleMotion,
} from "./playability-temporal-fixtures.js";

// 世界相对 ε 会把 1e-9 量级的窗口当成噪声 —— 这里明确它只作显式阈值。
const tinyWindow = {
  motion: triangleMotion({ distance: 1000 }),
  hazard: hazardSpec({ w: 2e-10 }),
  playerBox: aabb(50, -20, 2e-10, 20),
  t0: 0,
  t1: 500,
};

describe("I02-01 三角波（AC-01）", () => {
  const motion = triangleMotion();

  it("[I02-01][AC-01] t=0 锚点在 at，P/2 在 at+distance，P 回到 at", () => {
    expect(trianglePosition(motion, 0)).toBe(0);
    expect(trianglePosition(motion, 500)).toBe(100);
    expect(trianglePosition(motion, 1000)).toBe(0);
  });

  it("[I02-01][AC-01] 负时间对称、多周期重复", () => {
    expect(trianglePosition(motion, -137)).toBeCloseTo(trianglePosition(motion, 137), 12);
    for (const t of [0, 123, 499, 500, 777]) {
      expect(trianglePosition(motion, t + 3000)).toBeCloseTo(trianglePosition(motion, t), 12);
    }
  });

  it("[I02-01][AC-01] 两端不停留", () => {
    expect(trianglePosition(motion, 1e-6)).toBeGreaterThan(0);
    expect(trianglePosition(motion, 500 - 1e-6)).toBeLessThan(100);
    expect(trianglePosition(motion, 500 + 1e-6)).toBeLessThan(100);
    expect(trianglePosition(motion, 1000 - 1e-6)).toBeGreaterThan(0);
  });

  it("[I02-01][AC-01] 折返点不定义速度，段内速度为 ±2d/P", () => {
    for (const t of [0, 500, 1000, 1500]) expect(triangleSpeed(motion, t)).toBeNull();
    expect(triangleMaxRate(motion)).toBeCloseTo(0.2, 12);
    expect(triangleSpeed(motion, 250)).toBeCloseTo(0.2, 12);
    expect(triangleSpeed(motion, 750)).toBeCloseTo(-0.2, 12);
  });

  it("[I02-01][AC-01] pieceSlope 只接受单一单调段", () => {
    expect(pieceSlope(motion, 0, 500)).toBeCloseTo(0.2, 12);
    expect(pieceSlope(motion, 500, 1000)).toBeCloseTo(-0.2, 12);
    expect(pieceSlope(motion, 400, 600)).toBeNull();
    expect(pieceSlope(motion, 500, 500)).toBeNull();
    expect(pieceSlope(motion, 600, 400)).toBeNull();
  });

  it("[I02-01][AC-01] distance ≤ 0 原地不动", () => {
    const still = triangleMotion({ atX: 42, distance: 0 });
    expect(trianglePosition(still, 123)).toBe(42);
    expect(triangleSpeed(still, 123)).toBe(0);
    expect(pieceSlope(still, 0, 999)).toBe(0);
  });

  it("[I02-01][AC-01] 非法运动参数显式失败", () => {
    expect(() => trianglePosition(triangleMotion({ periodMs: 0 }), 0)).toThrow(RangeError);
    expect(() => trianglePosition(triangleMotion({ periodMs: -1 }), 0)).toThrow(RangeError);
    expect(() => trianglePosition(motion, Number.NaN)).toThrow(RangeError);
    expect(() => trianglePosition(motion, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => trianglePosition(triangleMotion({ atX: Number.NaN }), 0)).toThrow(RangeError);
  });
});

describe("I02-01 AABB、几何派生与 ε（AC-02）", () => {
  it("[I02-01][AC-02] overlapsStrict：正面积算撞，相切 / 角接触 / 零面积不算", () => {
    const a = aabb(0, 0, 10, 10);
    expect(overlapsStrict(a, aabb(10 - 1e-12, 0, 10, 10))).toBe(true);
    expect(overlapsStrict(a, aabb(10, 0, 10, 10))).toBe(false);
    expect(overlapsStrict(a, aabb(10, 10, 10, 10))).toBe(false);
    expect(overlapsStrict(a, aabb(10, 5, 0, 0))).toBe(false);
    expect(overlapsStrict(a, aabb(0, 10 - 1e-12, 10, 10))).toBe(true);
    expect(overlapsStrict(a, aabb(0, 10, 10, 10))).toBe(false);
  });

  it("[I02-01][AC-02] playerBoxAt 由脚点反推，不取整", () => {
    expect(playerBoxAt({ x: 50.5, y: 100.25 }, { w: 10, h: 20 }))
      .toEqual({ x: 45.5, y: 80.25, w: 10, h: 20 });
  });

  it("[I02-01][AC-02] hazardBoxAt 用 manifest size/anchor，随三角波移动", () => {
    const motion = triangleMotion();
    const hazard = hazardSpec();
    expect(hazardBoxAt(motion, hazard, 0)).toEqual({ x: -10, y: -20, w: 20, h: 20 });
    expect(hazardBoxAt(motion, hazard, 500)).toEqual({ x: 90, y: -20, w: 20, h: 20 });
    expect(hazardBoxAt(motion, hazard, -125).x)
      .toBeCloseTo(hazardBoxAt(motion, hazard, 125).x, 12);
  });

  it("[I02-01][ε] epsilon 是唯一具名常量：max(1e-9, 1e-9×(xMax−xMin))", () => {
    expect(epsilon(0, 1)).toBe(1e-9);
    expect(epsilon(0, 1000)).toBeCloseTo(1e-6, 15);
    expect(epsilon(100, 100 + 2e9)).toBeCloseTo(2, 12);
  });

  it("[I02-01][ε] ε 不进入碰撞谓词：1e-9 以下的微量重叠仍算撞", () => {
    const still = { motion: triangleMotion({ distance: 0 }), t0: 0, t1: 0 };
    const xHit = checkContinuous({ ...still, playerBox: aabb(10 - 5e-10, -20, 10, 20) });
    expect(okIntervals(xHit)).toHaveLength(1);
    const yHit = checkContinuous({ ...still, playerBox: aabb(0, -5e-10, 10, 20) });
    expect(okIntervals(yHit)).toHaveLength(1);
    const xTangent = checkContinuous({ ...still, playerBox: aabb(10, -20, 10, 20) });
    expect(okIntervals(xTangent)).toHaveLength(0);
    const yTangent = checkContinuous({ ...still, playerBox: aabb(0, 0, 10, 20) });
    expect(okIntervals(yTangent)).toHaveLength(0);
  });

  it("[I02-01][ε] ε 只作显式区间阈值：默认 0 保留任意小窗口", () => {
    const result = okResult(checkContinuous(tinyWindow));
    expect(result.intervals).toHaveLength(1);
    const width = intervalAt(result.intervals, 0).end - intervalAt(result.intervals, 0).start;
    expect(width).toBeGreaterThan(0);
    expect(width / 2e-10).toBeCloseTo(1, 6);
  });

  it("[I02-01][ε] 显式阈值两侧：1e-10 保留、3e-10 丢弃", () => {
    expect(okIntervals(checkContinuous({ ...tinyWindow, intervalTolerance: 1e-10 }))).toHaveLength(1);
    expect(okIntervals(checkContinuous({ ...tinyWindow, intervalTolerance: 3e-10 }))).toHaveLength(0);
  });

  it("[I02-01][ε] 极短安全窗口保留（约 1.005e-6 ms）", () => {
    // 玩家右边缘 = 90 − 1.005e-7 ⇒ 折返点两侧各让出 5.025e-7 ms。
    const result = okResult(checkContinuous({ playerBox: aabb(80 - 1.005e-7, -20, 10, 20) }));
    expect(result.intervals).toHaveLength(2);
    const gap = intervalAt(result.intervals, 1).start - intervalAt(result.intervals, 0).end;
    expect(gap).toBeGreaterThan(0);
    expect(gap / 1.005e-6).toBeCloseTo(1, 6);
  });

  it("[I02-01][ε] 临界门宽：严格大于 ε 才成立", () => {
    const eps = epsilon(0, 1000);
    expect(eps > 0).toBe(true);
    expect(eps > eps).toBe(false);
    expect(eps * (1 + 1e-9) > eps).toBe(true);
  });
});

describe("I02-01 连续时间求交（AC-01 / AC-02）", () => {
  it("[I02-01][AC-01] 折返点切段：跨折返点得到两个窗口", () => {
    const result = okResult(checkContinuous());
    expect(result.intervals).toHaveLength(2);
    expect(intervalAt(result.intervals, 0).start).toBeCloseTo(150, 9);
    expect(intervalAt(result.intervals, 0).end).toBeCloseTo(300, 9);
    expect(intervalAt(result.intervals, 1).start).toBeCloseTo(700, 9);
    expect(intervalAt(result.intervals, 1).end).toBeCloseTo(850, 9);
    expect(result.cutPoints).toBe(1);
    expect(result.segments).toBe(2);
  });

  it("[I02-01][AC-01] 折返点相切：两个窗口之间保留零测度安全点", () => {
    const result = okResult(checkContinuous({ playerBox: aabb(80, -20, 10, 20) }));
    expect(result.intervals).toHaveLength(2);
    expect(intervalAt(result.intervals, 0).end).toBe(500);
    expect(intervalAt(result.intervals, 1).start).toBe(500);
  });

  it("[I02-01][AC-01] 折返点真实重叠：相邻窗口合并", () => {
    const result = okResult(checkContinuous({ playerBox: aabb(85, -20, 10, 20) }));
    expect(result.intervals).toHaveLength(1);
    expect(intervalAt(result.intervals, 0).start).toBeCloseTo(375, 9);
    expect(intervalAt(result.intervals, 0).end).toBeCloseTo(625, 9);
  });

  it("[I02-01][AC-01] c1 === 0 精确分支：同速整段撞 / 整段不撞", () => {
    const hit = okResult(checkContinuous({
      playerBox: aabb(0, -20, 10, 20), playerSpeedX: 0.2, t0: 0, t1: 500,
    }));
    expect(hit.intervals).toHaveLength(1);
    expect(intervalAt(hit.intervals, 0).start).toBe(0);
    expect(intervalAt(hit.intervals, 0).end).toBe(500);
    const miss = okResult(checkContinuous({
      playerBox: aabb(40, -20, 10, 20), playerSpeedX: 0.2, t0: 0, t1: 500,
    }));
    expect(miss.intervals).toHaveLength(0);
  });

  it("[I02-01][AC-01] 近速不被绝对容差归零（D-P0-2）", () => {
    const result = okResult(checkContinuous({
      playerBox: aabb(0, -20, 10, 20), playerSpeedX: 0.2 + 1e-12, t0: 0, t1: 500,
    }));
    expect(result.intervals).toHaveLength(1);
    expect(intervalAt(result.intervals, 0).end).toBe(500);
  });

  it("[I02-01][AC-01] 不采样：短于 60Hz 帧间隔的窗口也能解析求出", () => {
    const frameMs = 1000 / 60;
    const result = okResult(checkContinuous(tinyWindow));
    const interval = intervalAt(result.intervals, 0);
    const width = interval.end - interval.start;
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThan(frameMs);
  });

  it("[I02-01][AC-02] dt = 0 退化为瞬时点查询，与区间表达一致", () => {
    const hit = okResult(checkContinuous({ t0: 200, t1: 200 }));
    expect(hit.intervals).toHaveLength(1);
    expect(intervalAt(hit.intervals, 0).start).toBe(200);
    expect(intervalAt(hit.intervals, 0).end).toBe(200);
    const miss = okResult(checkContinuous({ playerBox: aabb(140, -20, 10, 20), t0: 200, t1: 200 }));
    expect(miss.intervals).toHaveLength(0);
    const intervalForm = okResult(checkContinuous({ t0: 200, t1: 201 }));
    expect(intervalAt(intervalForm.intervals, 0).start).toBe(200);
  });

  it("[I02-01][AC-02] y 不重叠时无窗口，但切段计数照常", () => {
    const result = okResult(checkContinuous({ playerBox: aabb(40, 100, 10, 20) }));
    expect(result.intervals).toHaveLength(0);
    expect(result.cutPoints).toBe(1);
    expect(result.segments).toBe(2);
  });

  it("[I02-01][AC-01] 负时间窗口", () => {
    const result = okResult(checkContinuous({ t0: -500, t1: 0 }));
    expect(result.intervals).toHaveLength(1);
    expect(intervalAt(result.intervals, 0).start).toBeCloseTo(-300, 9);
    expect(intervalAt(result.intervals, 0).end).toBeCloseTo(-150, 9);
  });

  it("[I02-01][AC-01] 切点计数：只在严格内部切段", () => {
    expect(okResult(checkContinuous({ t0: 0, t1: 400 })).cutPoints).toBe(0);
    expect(okResult(checkContinuous({ t0: 0, t1: 500 })).cutPoints).toBe(0);
    expect(okResult(checkContinuous({ t0: 0, t1: 501 })).cutPoints).toBe(1);
    const two = okResult(checkContinuous({ t0: 0, t1: 1200 }));
    expect(two.cutPoints).toBe(2);
    expect(two.segments).toBe(3);
  });

  it("[I02-01][AC-02] 非有限输入返回 non-finite", () => {
    expect(checkContinuous({ t1: Number.POSITIVE_INFINITY })).toMatchObject({ ok: false, reason: "non-finite" });
    expect(checkContinuous({ playerSpeedX: Number.NaN })).toMatchObject({ ok: false, reason: "non-finite" });
    expect(checkContinuous({ playerBox: aabb(Number.NaN, -20, 10, 20) }))
      .toMatchObject({ ok: false, reason: "non-finite" });
    expect(checkContinuous({ motion: triangleMotion({ periodMs: Number.NaN }) }))
      .toMatchObject({ ok: false, reason: "non-finite" });
    expect(checkContinuous({ hazard: hazardSpec({ w: Number.POSITIVE_INFINITY }) }))
      .toMatchObject({ ok: false, reason: "non-finite" });
  });

  it("[I02-01][AC-02] 非法输入返回 invalid-input", () => {
    expect(checkContinuous({ motion: triangleMotion({ periodMs: 0 }) }))
      .toMatchObject({ ok: false, reason: "invalid-input" });
    expect(checkContinuous({ t0: 500, t1: 0 })).toMatchObject({ ok: false, reason: "invalid-input" });
    expect(checkContinuous({ intervalTolerance: -1 })).toMatchObject({ ok: false, reason: "invalid-input" });
    expect(checkContinuous({ maxCuts: -1 })).toMatchObject({ ok: false, reason: "invalid-input" });
    expect(checkContinuous({ maxCuts: 1.5 })).toMatchObject({ ok: false, reason: "invalid-input" });
  });

  it("[I02-01][budget][AC-08] 单次 check 切点超限返回 cut-budget（U1 前置）", () => {
    expect(checkContinuous({ maxCuts: 0 })).toMatchObject({ ok: false, reason: "cut-budget" });
    expect(okResult(checkContinuous({ maxCuts: 1 })).cutPoints).toBe(1);
  });

  it("[I02-01][AC-02] D-P0-4：极短跨折返点段仍切成两段", () => {
    const result = okResult(checkContinuous({
      playerBox: aabb(140, -20, 10, 20),
      t0: 500 - 1e-10,
      t1: 500 + 1e-10,
    }));
    expect(result.cutPoints).toBe(1);
    expect(result.segments).toBe(2);
    expect(result.intervals).toHaveLength(0);
  });
});

describe("I02-01 lagPad（AC-02）", () => {
  // I02-03 §8.1 X5：t=0 的精确可达集是 [50, 60]，对称 pad [40, 60] 是错误超集。
  const x5 = triangleMotion({ atX: 50, distance: 100, periodMs: 2000 });

  it("[I02-01][AC-02] 方向性：上升段只向正方向外扩（D-P0-6）", () => {
    expect(lagPad(x5, 0, 100)).toEqual({ min: 50, max: 60 });
  });

  it("[I02-01][AC-02] 方向性：下降段只向负方向外扩", () => {
    expect(lagPad(x5, 1500, 100)).toEqual({ min: 90, max: 100 });
  });

  it("[I02-01][AC-02] 折返点取右极限方向", () => {
    expect(lagPad(x5, 1000, 100)).toEqual({ min: 140, max: 150 });
  });

  it("[I02-01][AC-02] lagMs=0 与静止 Hazard 退化为单点", () => {
    expect(lagPad(x5, 250, 0)).toEqual({ min: 75, max: 75 });
    expect(lagPad(triangleMotion({ atX: 50, distance: 0 }), 250, 100)).toEqual({ min: 50, max: 50 });
  });

  it("[I02-01][AC-02] 负 lag 显式失败", () => {
    expect(() => lagPad(x5, 0, -1)).toThrow(RangeError);
  });
});
