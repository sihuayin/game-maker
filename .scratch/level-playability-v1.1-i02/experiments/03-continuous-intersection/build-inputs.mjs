/**
 * I02-03 · 生成 `inputs/cases.json`（确定性；不含时间戳、不含随机）。
 *
 * 期望值全部来自**闭式推导**或冻结文档，不来自被测求解器的输出。
 * 运行：node build-inputs.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const WORLD = { xMin: 0, xMax: 2000 };
const BASE = {
  world: WORLD,
  player: { y: 0, height: 16, width: 4 },
  hazard: { at: 50, distance: 100, periodMs: 2000, width: 20, height: 100, anchorX: 0.5, y: 0 },
};

// 短安全窗口构造：hazard 箱 [p−10, p+10]，p 在 [50,150]，速度 0.1；玩家宽 4、速度 s=0.099。
// 上升段碰撞终点 t = 1000·(x0 − 36)；下降段碰撞起点 t = (236 − x0)/0.199。
// 取 x0 = 36.999999999 ⇒ 终点 999.999999，起点 1000.0000000050251，安全窗口 ≈ 1.005e-6 ms。
const GAP_X0 = 36.999999999;
const GAP_S = 0.099;

// 极短碰撞窗口：双方宽 1e-11、hazard 速度 0.1 ⇒ 窗口宽 2e-10 ms。
const TINY = {
  world: WORLD,
  player: { y: 0, height: 16, width: 1e-11 },
  hazard: { at: 0, distance: 100, periodMs: 2000, width: 1e-11, height: 100, anchorX: 0.5, y: 0 },
};

// 近零相对速度 + 微量重叠：hazard 在下降段（斜率 −1e-10），玩家静止。
// 精确解：整个区间碰撞；P0 的 |c1| < 1e-9 钳位 + c0 ≤ EPS 会把整段判成安全。
const SLOW = {
  world: { xMin: 0, xMax: 10 },
  player: { y: 0, height: 16, width: 1 },
  hazard: {
    at: 1 - 1e-7 - 1e-12,
    distance: 1e-7,
    periodMs: 2000,
    width: 1,
    height: 100,
    anchorX: 0,
    y: 0,
  },
};

// 竖直重叠 5e-10：精确语义为真；P0 的 −EPS/+EPS 判据为假。
const YEDGE = {
  world: WORLD,
  player: { y: 0, height: 16, width: 4 },
  hazard: { ...BASE.hazard, y: 16 - 5e-10 },
};

// JSON 不能表达 NaN / Infinity：用哨兵字符串，run.mjs 解码。
const NAN = "__NaN__";
const INF = "__Infinity__";
const NEG_INF = "__-Infinity__";

const cases = {
  meta: {
    effort: "level-playability-v1.1-i02",
    ticket: "I02-03",
    note: "scratch-only; expectations derived from closed forms and frozen docs, not from the solver",
    world: WORLD,
  },
  predicate: [
    { id: "P1", note: "严格内部重叠", a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 5, y: 0, w: 10, h: 10 }, expect: true },
    { id: "P2", note: "边界相切（x）", a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 10, y: 0, w: 10, h: 10 }, expect: false },
    { id: "P3", note: "角接触", a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 10, y: 10, w: 1, h: 1 }, expect: false },
    { id: "P4", note: "零面积（w=0）", a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 0, y: 0, w: 0, h: 10 }, expect: false },
    { id: "P5", note: "零面积（h=0）", a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 0, y: 0, w: 10, h: 0 }, expect: false },
    { id: "P6", note: "1e-9 正面积重叠", a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 10 - 1e-9, y: 0, w: 10, h: 10 }, expect: true },
    { id: "P7", note: "竖直相切", a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 0, y: 10, w: 10, h: 10 }, expect: false },
    { id: "P8", note: "竖直重叠 5e-10", a: { x: 0, y: 0, w: 10, h: 10 }, b: { x: 0, y: 10 - 5e-10, w: 10, h: 10 }, expect: true },
  ],
  wave: {
    params: { at: 10, distance: 100, periodMs: 2000 },
    speed: 0.1,
    positions: [
      { t: 0, expect: 10 },
      { t: 500, expect: 60 },
      { t: 1000, expect: 110 },
      { t: 1500, expect: 60 },
      { t: 2000, expect: 10 },
      { t: 2500, expect: 60 },
      { t: -500, expect: 60 },
      { t: -1000, expect: 110 },
      { t: -2000, expect: 10 },
    ],
    symmetryPairs: [[137, -137], [450, -450], [1999, -1999]],
    turnaroundContinuity: [
      { t: 999.999999, expect: 109.9999999 },
      { t: 1000.000001, expect: 109.9999999 },
    ],
    stationary: { at: 42, distance: 0, periodMs: 2000, positions: [{ t: 0, expect: 42 }, { t: 12345, expect: 42 }, { t: -7, expect: 42 }] },
  },
  segments: [
    {
      id: "S1",
      note: "静止玩家在路径中，整个周期的两次穿越",
      config: BASE,
      segment: { t0: 0, x0: 50, t1: 2000, x1: 50 },
      expect: { hit: true, intervals: [[0, 140], [1860, 2000]], tol: 1e-9 },
    },
    {
      id: "S2",
      note: "t=0 相切，随后立刻重叠：碰撞从 0 开始",
      config: BASE,
      segment: { t0: 0, x0: 60, t1: 2000, x1: 60 },
      expect: { hit: true, intervals: [[0, 240], [1760, 2000]], tol: 1e-9 },
    },
    {
      id: "S3",
      note: "仅在折返点相切（峰值）⇒ 不碰撞",
      config: BASE,
      segment: { t0: 0, x0: 160, t1: 2000, x1: 160 },
      expect: { hit: false, intervals: [], tol: 1e-9 },
    },
    {
      id: "S4",
      note: "碰撞区间跨折返点，必须在切段后合并成一段",
      config: BASE,
      segment: { t0: 0, x0: 155, t1: 2000, x1: 155 },
      expect: { hit: true, intervals: [[950, 1050]], tol: 1e-9 },
    },
    {
      id: "S5",
      note: "周期平移不变性：S4 平移 +2000ms",
      config: BASE,
      segment: { t0: 2000, x0: 155, t1: 4000, x1: 155 },
      expect: { hit: true, intervals: [[2950, 3050]], tol: 1e-9 },
    },
    {
      id: "S6",
      note: "负时间：S4 关于 t=0 的镜像（三角波偶函数）",
      config: BASE,
      segment: { t0: -2000, x0: 155, t1: 0, x1: 155 },
      expect: { hit: true, intervals: [[-1050, -950]], tol: 1e-9 },
    },
    {
      id: "S7",
      note: "玩家与 hazard 同速同向、完全嵌入 ⇒ 整段碰撞",
      config: BASE,
      segment: { t0: 0, x0: 50, t1: 1000, x1: 150 },
      expect: { hit: true, intervals: [[0, 1000]], tol: 1e-9 },
    },
    {
      id: "S8",
      note: "同速同向、始终相切 ⇒ 不碰撞（c1=0 的严格分支）",
      config: BASE,
      segment: { t0: 0, x0: 60, t1: 1000, x1: 160 },
      expect: { hit: false, intervals: [], tol: 1e-9 },
    },
    {
      id: "S9",
      note: "极短碰撞窗口：双方宽 1e-11，窗口 2e-10 ms",
      config: TINY,
      segment: { t0: 499.999, x0: 50, t1: 500.001, x1: 50 },
      expect: { hit: true, intervals: [[499.9999999999502, 500.0000000001502]], tol: 1e-12 },
    },
    {
      id: "S10",
      note: "极短安全窗口（≈1.005e-6 ms），夹在两段碰撞之间，跨折返点",
      config: BASE,
      segment: { t0: 0, x0: GAP_X0, t1: 1200, x1: GAP_X0 + GAP_S * 1200 },
      expect: {
        hit: true,
        intervals: [
          [0, 999.999999],
          [1000.0000000050251, 1120.6030150804025],
        ],
        gapMax: 2e-6,
        tol: 1e-9,
      },
    },
    {
      id: "S11",
      note: "近零相对速度（1e-10 px/ms）下的持续性微量重叠",
      config: SLOW,
      segment: { t0: 1000, x0: 0, t1: 1100, x1: 0 },
      expect: { hit: true, intervals: [[1000, 1100]], tol: 1e-9 },
    },
    {
      id: "S12",
      note: "竖直重叠 5e-10 仍应判碰撞（严格语义无 EPS 收缩）",
      config: YEDGE,
      segment: { t0: 0, x0: 50, t1: 100, x1: 50 },
      expect: { hit: true, intervals: [[0, 100]], tol: 1e-9 },
    },
    {
      id: "S13",
      note: "极短通道：玩家宽 4，通道净宽 4+1e-6 ⇒ 通过不撞",
      config: BASE,
      segment: { t0: 0, x0: 0, t1: 0, x1: 0 },
      predicateOnly: true,
      a: { x: 0, y: 0, w: 4, h: 16 },
      b: { x: 4 + 1e-6, y: 0, w: 10, h: 16 },
      expect: { hit: false },
    },
  ],
  errors: [
    { id: "E1", note: "hazard.at = NaN", config: { ...BASE, hazard: { ...BASE.hazard, at: NAN } }, segment: { t0: 0, x0: 0, t1: 10, x1: 0 }, expect: "hazard.at-not-finite" },
    { id: "E2", note: "periodMs = Infinity", config: { ...BASE, hazard: { ...BASE.hazard, periodMs: INF } }, segment: { t0: 0, x0: 0, t1: 10, x1: 0 }, expect: "hazard.periodMs-not-finite" },
    { id: "E3", note: "segment.x1 = NaN", config: BASE, segment: { t0: 0, x0: 0, t1: 10, x1: NAN }, expect: "segment.x1-not-finite" },
    { id: "E4", note: "lagMs = NaN", config: BASE, segment: { t0: 0, x0: 0, t1: 10, x1: 0 }, opts: { lagMs: NAN }, expect: "opts.lagMs-not-finite" },
    { id: "E5", note: "periodMs = -Infinity", config: { ...BASE, hazard: { ...BASE.hazard, periodMs: NEG_INF } }, segment: { t0: 0, x0: 0, t1: 10, x1: 0 }, expect: "hazard.periodMs-not-finite" },
  ],
  sampling: [
    {
      id: "D1",
      note: "端点/粗采样全部安全，区间内碰撞（22.5,27.5）",
      config: {
        world: { xMin: -100, xMax: 100 },
        player: { y: 0, height: 16, width: 1 },
        hazard: { at: -10, distance: 20, periodMs: 100, width: 1, height: 16, anchorX: 0, y: 0 },
      },
      segment: { t0: 0, x0: 0, t1: 100, x1: 0 },
      // 上升段 (22.5, 27.5) 与下降段 (72.5, 77.5)
      expectIntervals: [[22.5, 27.5], [72.5, 77.5]],
      // 步长 50 / 20 / 10 ms：采样时刻都落在 (22.5, 27.5) 之外。
      sampleCounts: [2, 6, 11],
    },
    {
      id: "D2",
      note: "极短碰撞窗口（2e-10 ms）下，16.67ms 帧采样在 2s 跨度内全数漏检",
      config: {
        world: { xMin: 0, xMax: 2000 },
        player: { y: 0, height: 16, width: 1e-11 },
        hazard: { at: 0, distance: 100, periodMs: 2000, width: 1e-11, height: 100, anchorX: 0.5, y: 0 },
      },
      segment: { t0: 499, x0: 50, t1: 501, x1: 50 },
      expectHit: true,
      frameSamples: 120,
    },
  ],
  epsilon: {
    worlds: [
      { world: { xMin: 0, xMax: 2000 }, expectEps: 2e-6 },
      { world: { xMin: 0, xMax: 200 }, expectEps: 2e-7 },
      { world: { xMin: 0, xMax: 1 }, expectEps: 1e-9 },
      { world: { xMin: 0, xMax: 1e9 }, expectEps: 1 },
    ],
    gates: [
      // hazard 宽 = 100 + gateWidth；门宽 = width − distance。
      { id: "G1", width: 100 + 1e-6, expectWidth: 1e-6 },
      { id: "G2", width: 100 + 3e-6, expectWidth: 3e-6 },
    ],
    verdicts: [
      { worldWidth: 2000, gateWidth: 1e-6, expectValid: false },
      { worldWidth: 2000, gateWidth: 3e-6, expectValid: true },
      { worldWidth: 200, gateWidth: 1e-6, expectValid: true },
      { worldWidth: 1, gateWidth: 1e-12, expectValid: false },
    ],
  },
  p0Probes: [
    {
      id: "X1",
      note: "极短碰撞窗口：精确找得到，P0 的 hi−lo>1e-9 阈值看不到",
      config: TINY,
      segment: { t0: 499.999, x0: 50, t1: 500.001, x1: 50 },
      expectMineHit: true,
      expectP0Hit: false,
    },
    {
      id: "X2",
      note: "竖直重叠 5e-10：精确为真，P0 的 −EPS/+EPS 判据为假",
      config: YEDGE,
      segment: { t0: 0, x0: 50, t1: 100, x1: 50 },
      expectMineHit: true,
      expectP0Hit: false,
    },
    {
      id: "X3",
      note: "近零相对速度 + 微量重叠：P0 的 |c1|<1e-9 绝对钳位把整段判安全",
      config: SLOW,
      segment: { t0: 1000, x0: 0, t1: 1100, x1: 0 },
      expectMineHit: true,
      expectP0Hit: false,
    },
    {
      id: "X4",
      note: "同一点位姿的两种表达：dt>0 用区间分支判撞，dt=0 用 pointCollides 判不撞（P0 内部分支不一致）",
      config: {
        world: { xMin: 0, xMax: 10 },
        player: { y: 0, height: 16, width: 1 },
        hazard: { at: 1 - 5e-10, distance: 0, periodMs: 2000, width: 1, height: 100, anchorX: 0, y: 0 },
      },
      segmentInterval: { t0: 0, x0: 0, t1: 1, x1: 0.5 },
      segmentPoint: { t0: 0, x0: 0, t1: 0, x1: 0 },
      expectIntervalHit: true,
      expectPointHit: false,
    },
    {
      id: "X5",
      note: "lag pad：P0 的对称 pad 在谷底把从未出现过的左侧位置算进来（保守超集）",
      config: {
        world: { xMin: 0, xMax: 2000 },
        player: { y: 0, height: 16, width: 4 },
        hazard: { at: 50, distance: 100, periodMs: 2000, width: 20, height: 100, anchorX: 0.5, y: 0 },
      },
      segment: { t0: 0, x0: 29, t1: 0, x1: 29 },
      lagMs: 100,
      expectPadHit: true,
      expectExactReachableHit: false,
    },
  ],
  nearCritical: {
    note: "竖直边界附近的确定性枚举：exact 判撞、P0 的 −EPS/+EPS 判据漏判",
    player: { y: 0, height: 16, width: 4 },
    hazard: { at: 50, distance: 0, periodMs: 2000, width: 4, height: 100, anchorX: 0.5 },
    segment: { t0: 0, x0: 50, t1: 1, x1: 50 },
    cases: [
      { yOffset: 0, expect: "both-miss" },
      { yOffset: -1e-12, expect: "exact-only" },
      { yOffset: -5e-10, expect: "exact-only" },
      { yOffset: -1e-9, expect: "exact-only" },
      { yOffset: -1e-6, expect: "both-hit" },
      { yOffset: -1e-3, expect: "both-hit" },
    ],
  },
  p0Random: { seed: 1337, count: 2000 },
};

writeFileSync(join(here, "inputs", "cases.json"), JSON.stringify(cases, null, 2) + "\n");
console.log(`wrote inputs/cases.json (${JSON.stringify(cases).length} bytes)`);
