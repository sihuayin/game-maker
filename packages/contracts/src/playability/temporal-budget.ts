// **I-02 预算骨架**（D5 / D5B）—— 常量、合法性检查、工作计数与墙钟 abort。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、工作预算是唯一语义预算
//
//   状态 / 边 / cut / Witness 体积都是工作预算；墙钟**只** abort-only，触发即
//   `INSUFFICIENT_EVIDENCE` + `wall-clock-abort`，不得产出更强结论，也不得改变
//   证明方向。`wallClockMs` 永远不进确定性签名。
//
// 二、U1 只执行单次 check 的 cut 预算
//
//   `maxCutsPerCheck`（cutPoints）在 U1 生效；`maxCutsPerBranch`（segments，
//   `cutPoints + 1`）**只定义不执行**，由 U2 累计。这里没有 U2 的搜索 / Witness /
//   相位网格计数器。
//
// 三、非法预算显式降级
//
//   非有限、`timeBudgetMs ≤ 0`、`maxStates < 1`、超过硬上限 ⇒ `invalid-budget`；
//   派生上界（`maxEdges = maxStates × maxBranching`）溢出 ⇒
//   `budget-bound-overflow`。**不得**回退默认值继续。
//
// 四、检查点按确定性工作计数
//
//   `timeBudgetCheckpointWork = 1024` work units；检查点粒度不改变语义预算，
//   只决定多久读一次墙钟。
// ─────────────────────────────────────────────────────────────────────────────
import type {
  BudgetKind,
  BudgetProfile,
  BudgetStatus,
  DegradationReason,
  InternalBudget,
} from "./temporal-result.js";

/** @internal 默认预算（D5 §3 / D5B）。`maxEdges` 是派生值，见 `deriveMaxEdges`。 */
export const BUDGET_DEFAULTS = {
  maxStates: 500_000,
  timeBudgetMs: 2_000,
  maxCutsPerCheck: 1_000_000,
  maxCutsPerBranch: 5_000_000,
  maxWitnessTransitions: 1_000_000,
  maxWitnessBytes: 64 * 1024 * 1024,
  maxHopSamples: 240,
  timeBudgetCheckpointWork: 1024,
} as const satisfies Omit<BudgetProfile, "maxEdges">;

/** @internal 硬上限（D5 §3 / D5B）。`InternalBudget` 不得超过这些值。 */
export const BUDGET_HARD_CAPS = {
  maxStates: 1_000_000,
  timeBudgetMs: 10_000,
  maxCutsPerCheck: 1_000_000,
  maxCutsPerBranch: 10_000_000,
  maxWitnessTransitions: 1_000_000,
  maxWitnessBytes: 64 * 1024 * 1024,
  maxHopSamples: 240,
  timeBudgetCheckpointWork: 1024,
} as const satisfies Omit<BudgetProfile, "maxEdges">;

/** @internal 派生 `maxBranching` 所需的网格 / 运动量（D5 §3.2）。 */
export type BudgetGridInput = {
  readonly maxSpeed: number;
  readonly periodMs: number;
  readonly phaseSteps: number;
  readonly xStep: number;
};

/**
 * @internal `maxBranching = 2·floor(maxSpeed·periodMs / (N·xStep)) + 2`。
 *
 * 这是**安全上界**，不是实际平均分支数；调用方负责把结果交给
 * `resolveBudgetProfile` 做有限性与溢出检查。
 */
export const deriveMaxBranching = (grid: BudgetGridInput): number =>
  2 * Math.floor((grid.maxSpeed * grid.periodMs) / (grid.phaseSteps * grid.xStep)) + 2;

/** @internal `maxEdges = maxStates × maxBranching`（安全整数检查在解析时做）。 */
export const deriveMaxEdges = (maxStates: number, maxBranching: number): number =>
  maxStates * maxBranching;

/** @internal 预算解析失败的原因码；二者都是 IE，不得继续计算。 */
export type BudgetInvalidReason = "invalid-budget" | "budget-bound-overflow";

/** @internal 预算解析结果。 */
export type BudgetResolution =
  | { readonly ok: true; readonly profile: BudgetProfile }
  | { readonly ok: false; readonly degradationReason: BudgetInvalidReason };

/** @internal 测试可覆盖、且不得超过硬上限的数值字段。 */
const isNonNegativeInteger = (value: number): boolean =>
  Number.isInteger(value) && value >= 0;

/**
 * @internal 解析生效预算：默认值 + 测试覆盖，并做合法性 / 硬上限 / 溢出检查。
 *
 * `maxBranching` 由网格派生（U2）；U1 只在测试里传受控值。`maxEdges` 可被覆盖，
 * 但同样受派生硬上限约束。
 */
export function resolveBudgetProfile(args: {
  readonly maxBranching: number;
  readonly overrides?: InternalBudget;
}): BudgetResolution {
  const overrides = args.overrides ?? {};
  const merged = {
    ...BUDGET_DEFAULTS,
    maxEdges: deriveMaxEdges(
      overrides.maxStates ?? BUDGET_DEFAULTS.maxStates,
      args.maxBranching,
    ),
    ...overrides,
  };

  const values: readonly (readonly [keyof typeof BUDGET_HARD_CAPS, number])[] = [
    ["maxStates", merged.maxStates],
    ["timeBudgetMs", merged.timeBudgetMs],
    ["maxCutsPerCheck", merged.maxCutsPerCheck],
    ["maxCutsPerBranch", merged.maxCutsPerBranch],
    ["maxWitnessTransitions", merged.maxWitnessTransitions],
    ["maxWitnessBytes", merged.maxWitnessBytes],
    ["maxHopSamples", merged.maxHopSamples],
    ["timeBudgetCheckpointWork", merged.timeBudgetCheckpointWork],
  ];

  if (!isNonNegativeInteger(args.maxBranching) || args.maxBranching < 1) {
    return { ok: false, degradationReason: "invalid-budget" };
  }
  for (const [, value] of values) {
    if (!Number.isFinite(value) || !isNonNegativeInteger(value)) {
      return { ok: false, degradationReason: "invalid-budget" };
    }
  }
  if (merged.timeBudgetMs <= 0 || merged.maxStates < 1 || merged.timeBudgetCheckpointWork < 1) {
    return { ok: false, degradationReason: "invalid-budget" };
  }
  for (const [field, value] of values) {
    if (value > BUDGET_HARD_CAPS[field]) {
      return { ok: false, degradationReason: "invalid-budget" };
    }
  }
  if (!Number.isFinite(merged.maxEdges) || !isNonNegativeInteger(merged.maxEdges)) {
    return { ok: false, degradationReason: "invalid-budget" };
  }

  // 派生上界：默认与硬上限都必须落在安全整数内，否则不得静默截断或变成无穷预算。
  const derivedHardMaxEdges = deriveMaxEdges(BUDGET_HARD_CAPS.maxStates, args.maxBranching);
  if (!Number.isSafeInteger(derivedHardMaxEdges)) {
    return { ok: false, degradationReason: "budget-bound-overflow" };
  }
  if (!Number.isSafeInteger(merged.maxEdges) || merged.maxEdges > derivedHardMaxEdges) {
    return { ok: false, degradationReason: "budget-bound-overflow" };
  }

  return {
    ok: true,
    profile: {
      maxStates: merged.maxStates,
      maxEdges: merged.maxEdges,
      timeBudgetMs: merged.timeBudgetMs,
      maxCutsPerCheck: merged.maxCutsPerCheck,
      maxCutsPerBranch: merged.maxCutsPerBranch,
      maxWitnessTransitions: merged.maxWitnessTransitions,
      maxWitnessBytes: merged.maxWitnessBytes,
      maxHopSamples: merged.maxHopSamples,
      timeBudgetCheckpointWork: merged.timeBudgetCheckpointWork,
    },
  };
}

/** @internal 预算已触发；调用方必须逐层降级为 IE，不得提升部分结果。 */
export type BudgetStop = {
  readonly stopped: true;
  readonly budgetStatus: "exhausted" | "aborted";
  readonly budgetKind: BudgetKind;
  readonly degradationReason: DegradationReason;
};

/** @internal 仍在预算内。 */
export type BudgetContinue = { readonly stopped: false };

/** @internal 每次计量后的信号。 */
export type BudgetSignal = BudgetContinue | BudgetStop;

/** @internal 预算快照；可直接展开进 `Stats.work` / `Stats.timing` / `Stats.budget`。 */
export type BudgetSnapshot = {
  readonly budgetStatus: BudgetStatus;
  readonly budgetKind: BudgetKind | null;
  readonly workUnitsSinceLastCheckpoint: number;
  readonly cutPointsTotal: number;
  readonly segmentsTotal: number;
  readonly wallClockMs: number;
  readonly timeBudgetCheckpointWork: number;
};

/** @internal U1 预算计数器；只覆盖单次 check 的 cut 与通用 work units。 */
export type BudgetTracker = {
  readonly profile: BudgetProfile;
  /** 记录 `units` 个确定性工作单元；到达检查点时读一次注入时钟。 */
  chargeWork(units?: number): BudgetSignal;
  /** 一次连续求交：`cutPoints` 为该次 check 的折返点切分数。 */
  chargeCheck(cutPoints: number): BudgetSignal;
  /** 只读快照；不会推进状态。 */
  snapshot(): BudgetSnapshot;
  /** 分析收尾：做最后一次墙钟检查并定格状态。 */
  finish(): BudgetSnapshot;
};

/**
 * @internal 建立预算计数器。
 *
 * `now` 只用于 wall-clock abort（测试注入假时钟）；它不参与相位、移动、碰撞、
 * Witness 或策略选择。时间预算的检查点由 `timeBudgetCheckpointWork` 触发。
 */
export function createBudgetTracker(args: {
  readonly profile: BudgetProfile;
  readonly now?: () => number;
}): BudgetTracker {
  const { profile } = args;
  const now = args.now ?? Date.now;
  const startedAt = now();

  let budgetStatus: BudgetStatus = "complete";
  let budgetKind: BudgetKind | null = null;
  let stoppedBy: DegradationReason | null = null;
  let workUnitsSinceLastCheckpoint = 0;
  let cutPointsTotal = 0;
  let segmentsTotal = 0;

  const elapsed = (): number => Math.max(0, now() - startedAt);

  const stop = (
    status: "exhausted" | "aborted",
    kind: BudgetKind,
    reason: DegradationReason,
  ): BudgetStop => {
    if (budgetStatus === "complete") {
      budgetStatus = status;
      budgetKind = kind;
      stoppedBy = reason;
    }
    return {
      stopped: true,
      budgetStatus: status,
      budgetKind: kind,
      degradationReason: reason,
    };
  };

  const stoppedSignal = (): BudgetStop | null =>
    stoppedBy === null || budgetKind === null
      ? null
      : {
          stopped: true,
          budgetStatus: budgetStatus as "exhausted" | "aborted",
          budgetKind,
          degradationReason: stoppedBy,
        };

  const snapshot = (): BudgetSnapshot => ({
    budgetStatus,
    budgetKind,
    workUnitsSinceLastCheckpoint,
    cutPointsTotal,
    segmentsTotal,
    wallClockMs: elapsed(),
    timeBudgetCheckpointWork: profile.timeBudgetCheckpointWork,
  });

  const chargeWork = (units = 1): BudgetSignal => {
    if (!isNonNegativeInteger(units)) {
      throw new RangeError("work units must be a non-negative integer");
    }
    const stopped = stoppedSignal();
    if (stopped) return stopped;
    workUnitsSinceLastCheckpoint += units;
    if (workUnitsSinceLastCheckpoint < profile.timeBudgetCheckpointWork) {
      return { stopped: false };
    }
    workUnitsSinceLastCheckpoint = 0;
    if (elapsed() >= profile.timeBudgetMs) {
      return stop("aborted", "wall-clock-abort", "wall-clock-abort");
    }
    return { stopped: false };
  };

  const chargeCheck = (cutPoints: number): BudgetSignal => {
    if (!isNonNegativeInteger(cutPoints)) {
      throw new RangeError("cut points must be a non-negative integer");
    }
    const stopped = stoppedSignal();
    if (stopped) return stopped;
    if (cutPoints > profile.maxCutsPerCheck) {
      return stop("exhausted", "cut-budget", "cut-budget-exhausted");
    }
    cutPointsTotal += cutPoints;
    // D5B：每个 check 的 segments = cutPoints + 1；累计上界由 U2 的
    // maxCutsPerBranch 按 segmentsTotal 执行，U1 只计数。
    segmentsTotal += cutPoints + 1;
    return chargeWork(1);
  };

  const finish = (): BudgetSnapshot => {
    if (budgetStatus === "complete" && elapsed() >= profile.timeBudgetMs) {
      stop("aborted", "wall-clock-abort", "wall-clock-abort");
    }
    return snapshot();
  };

  return { profile, chargeWork, chargeCheck, snapshot, finish };
}
