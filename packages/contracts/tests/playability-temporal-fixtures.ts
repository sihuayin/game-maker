// **TEST_ONLY** —— U1 内存夹具：构造器 / 断言辅助 / 规范化序列化。
//
// ⚠️ 不注册测试、不读写文件系统、不被 `src/**` 引用、不含产品逻辑。
// ⚠️ 不新增 JSON fixture；所有边界值都在内存里构造。
import type { Aabb } from "../src/playability/geometry.js";
import {
  intersectContinuous,
  type CollisionInterval,
  type ContinuousCheckInput,
  type ContinuousCheckResult,
  type HazardBoxSpec,
  type TriangleMotion,
} from "../src/playability/temporal-motion.js";
import type {
  BudgetProfile,
  Certificate,
  Diagnostics,
  Stats,
  TemporalInternalResult,
} from "../src/playability/temporal-result.js";

export type TriangleMotionArgs = {
  readonly atX?: number;
  readonly atY?: number;
  readonly distance?: number;
  readonly periodMs?: number;
};

/** 默认：`at=(0,0)`、往返 100px、周期 1000ms（上升段速度 0.2 px/ms）。 */
export const triangleMotion = (args: TriangleMotionArgs = {}): TriangleMotion => ({
  at: { x: args.atX ?? 0, y: args.atY ?? 0 },
  distance: args.distance ?? 100,
  periodMs: args.periodMs ?? 1000,
});

export type HazardSpecArgs = {
  readonly w?: number;
  readonly h?: number;
  readonly anchorX?: number;
  readonly anchorY?: number;
};

/** 默认：20×20、底边中心锚点；`at.y = 0` 时盒子 y 区间为 `[-20, 0]`。 */
export const hazardSpec = (args: HazardSpecArgs = {}): HazardBoxSpec => ({
  size: { w: args.w ?? 20, h: args.h ?? 20 },
  anchor: { x: args.anchorX ?? 0.5, y: args.anchorY ?? 1 },
});

export const aabb = (x: number, y: number, w: number, h: number): Aabb => ({ x, y, w, h });

/** 默认玩家盒：`[40, 50] × [-20, 0]`，与默认 Hazard 盒的 y 区间严格重叠。 */
export const baseCheckInput = (
  overrides: Partial<ContinuousCheckInput> = {},
): ContinuousCheckInput => ({
  motion: triangleMotion(),
  hazard: hazardSpec(),
  playerBox: aabb(40, -20, 10, 20),
  playerSpeedX: 0,
  t0: 0,
  t1: 1000,
  ...overrides,
});

export const checkContinuous = (
  overrides: Partial<ContinuousCheckInput> = {},
): ContinuousCheckResult => intersectContinuous(baseCheckInput(overrides));

export type OkContinuousCheck = Extract<ContinuousCheckResult, { ok: true }>;

export const okResult = (result: ContinuousCheckResult): OkContinuousCheck => {
  if (!result.ok) throw new Error(`expected ok result, got ${result.reason}`);
  return result;
};

export const okIntervals = (result: ContinuousCheckResult): readonly CollisionInterval[] =>
  okResult(result).intervals;

export const intervalAt = (
  intervals: readonly CollisionInterval[],
  index: number,
): CollisionInterval => {
  const interval = intervals[index];
  if (interval === undefined) throw new Error(`missing interval at index ${index}`);
  return interval;
};

/** 完整 `BudgetProfile` 夹具；默认值与 D5 / D5B 一致。 */
export const budgetProfileFixture = (overrides: Partial<BudgetProfile> = {}): BudgetProfile => ({
  maxStates: 500_000,
  maxEdges: 1_600_000,
  timeBudgetMs: 2_000,
  maxCutsPerCheck: 1_000_000,
  maxCutsPerBranch: 5_000_000,
  maxWitnessTransitions: 1_000_000,
  maxWitnessBytes: 64 * 1024 * 1024,
  maxHopSamples: 240,
  timeBudgetCheckpointWork: 1024,
  ...overrides,
});

export type InternalResultOverrides = {
  readonly internalResult?: TemporalInternalResult["internalResult"];
  readonly certificate?: Certificate;
  readonly grid?: Partial<Stats["grid"]>;
  readonly work?: Partial<Stats["work"]>;
  readonly timing?: Partial<Stats["timing"]>;
  readonly budget?: Partial<Stats["budget"]>;
  readonly diagnostics?: Partial<Diagnostics>;
  readonly determinismSignature?: string;
};

/** 最小 D9 结果夹具；U1 子集的 `certificate` 默认 `{ kind: "none" }`。 */
export const internalResultFixture = (
  overrides: InternalResultOverrides = {},
): TemporalInternalResult => ({
  internalResult: overrides.internalResult ?? "insufficient-evidence",
  modelConditional: true,
  publicCapability: "BLOCKED",
  publicResult: null,
  certificate: overrides.certificate ?? { kind: "none" },
  stats: {
    grid: {
      phaseSteps: 10,
      dtMs: 100,
      xStep: 1,
      xPositions: 100,
      stateCapacity: 1000,
      phaseGridCapped: false,
      phaseCapReason: null,
      N_max: 20,
      ...overrides.grid,
    },
    work: {
      statesEnqueued: 0,
      statesVisited: 0,
      edgesChecked: 0,
      cutPointsTotal: 3,
      segmentsTotal: 4,
      hopSamplesChecked: 0,
      witnessTransitions: 0,
      witnessBytes: 0,
      maxBranching: 2,
      workUnitsSinceLastCheckpoint: 5,
      ...overrides.work,
    },
    timing: {
      wallClockMs: 12,
      timeBudgetCheckpointWork: 1024,
      ...overrides.timing,
    },
    budget: {
      budgetProfile: budgetProfileFixture(),
      budgetStatus: "complete",
      budgetKind: null,
      ...overrides.budget,
    },
    determinismSignature: overrides.determinismSignature ?? "00000000",
  },
  diagnostics: {
    degradationReason: null,
    secondaryReasons: [],
    ...overrides.diagnostics,
  },
});

/** 规范化 JSON：对象键排序、数组保留语义顺序。 */
export const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, val) => {
    if (val === null || typeof val !== "object" || Array.isArray(val)) return val;
    const record = val as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = record[key];
    return sorted;
  });

/** 剔除 `wallClockMs` / `detail` 后的完整结果视图，供逐字节比较。 */
export const deterministicView = (result: TemporalInternalResult): unknown => ({
  ...result,
  stats: {
    ...result.stats,
    timing: {
      timeBudgetCheckpointWork: result.stats.timing.timeBudgetCheckpointWork,
    },
  },
  diagnostics: {
    degradationReason: result.diagnostics.degradationReason,
    secondaryReasons: result.diagnostics.secondaryReasons,
  },
});
