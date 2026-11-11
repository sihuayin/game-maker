// **I-02 内部结果契约**（D9）—— 纯类型，无运行时代码。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、这是内部契约，不是公共 Verdict
//
//   `TemporalInternalResult` 只表达**模型条件性**的内部候选：
//   `nb-candidate` ≠ 公共 `NO_PROVEN_BLOCKER`，`pu-candidate` ≠ 公共
//   `PROVEN_UNPLAYABLE`。`publicCapability` 恒为 `"BLOCKED"`、`publicResult`
//   恒为 `null`；I-03 才负责内部结果 → 公共结果的 adapter 与发布门禁。
//
// 二、纯数据
//
//   全部字段 `readonly`，可 JSON 序列化；无 `Map` / `Set` / class / function。
//   本模块**不导入任何 I-02 模块**（D6 DAG 的叶子），只允许从 `./geometry.js`
//   引入 `Aabb` / `Vec` / `Size` 类型。
//
// 三、证书状态
//
//   `certificate.status` 只表示**模型内证明**是否完整：
//   `COMPLETE` 不表示 PU 六条件全部 PASS（`geometry-checked` /
//   `model-out-excluded` 恒为 `BLOCKED`）；`INCOMPLETE` 必须至少带一个
//   `degradationReason`，且不得升级为 `nb-candidate` / `pu-candidate`。
// ─────────────────────────────────────────────────────────────────────────────
import type { Aabb } from "./geometry.js";

// ── 顶层 ────────────────────────────────────────────────────────────────────

/** @internal 内部三态；**绝不**复用公共 `PlayabilityVerdictState` 的名字。 */
export type InternalResultState = "nb-candidate" | "pu-candidate" | "insufficient-evidence";

/** @internal 模型内证明是否完整。 */
export type ProofStatus = "COMPLETE" | "INCOMPLETE";

/** @internal 证书联合：保留部分证明，不压扁成 `none`。 */
export type Certificate =
  | { readonly kind: "witness"; readonly status: ProofStatus; readonly witness: Witness }
  | { readonly kind: "permanent-gate"; readonly status: ProofStatus; readonly proof: PermanentGateProof }
  | { readonly kind: "none" };

/** @internal I-02 的唯一内部结果类型。 */
export type TemporalInternalResult = {
  readonly internalResult: InternalResultState;
  readonly modelConditional: true;
  readonly publicCapability: "BLOCKED";
  readonly publicResult: null;
  readonly certificate: Certificate;
  readonly stats: Stats;
  readonly diagnostics: Diagnostics;
};

// ── Witness（W1 紧凑记录） ──────────────────────────────────────────────────

/** @internal U9 与全相位 Winning Set 两条充分证书。 */
export type WitnessForm = "u9" | "winning-set";

/** @internal `[fromFoot, fromK, toFoot, toK, t0, t1, verified]`；`verified = 0 | 1`。 */
export type WitnessTransition = readonly [
  fromFoot: number,
  fromK: number,
  toFoot: number,
  toK: number,
  t0: number,
  t1: number,
  verified: 0 | 1,
];

/** @internal 终止性证明：严格递减 rank 或有限轨迹。 */
export type PolicyTermination =
  | { readonly kind: "rank"; readonly rank: readonly number[] }
  | { readonly kind: "trace"; readonly finite: true; readonly length: number };

/** @internal Witness 主体；盒由 `(footX, k, t)` + 冻结公式确定性派生。 */
export type Witness = {
  readonly form: WitnessForm;
  /** 明确的编码语义：盒由冻结输入 + 运动公式 + 转移时间确定性派生，不是推测。 */
  readonly derived: true;
  /** 逐转移验证记录；`policy` 用下标引用已验证项。 */
  readonly verifications: readonly WitnessTransition[];
  /** 策略表：`verifications` 的下标，按策略顺序排列；每一项 `verified = 1`。 */
  readonly policy: readonly number[];
  readonly termination: PolicyTermination;
  readonly phaseCoverage: {
    readonly cells: number;
    readonly covered: number;
    readonly complete: boolean;
  };
  readonly volume: {
    readonly transitions: number;
    /** 最终确定性序列化后的 UTF-8 字节数。 */
    readonly bytes: number;
  };
};

// ── Proof（U3 / U4 冻结字段） ───────────────────────────────────────────────

/** @internal PU 六条件；禁止用单个布尔替代。 */
export type PuConditionId =
  | "gate-coverage"
  | "geometry-checked"
  | "graph-cut"
  | "hop-doubling"
  | "model-out-excluded"
  | "lag-consistent";

/** @internal 单条 PU 条件；`PASS` 必有 `evidence`，`BLOCKED` 必有 `blockedReason`。 */
export type PuCondition = {
  readonly id: PuConditionId;
  readonly status: "PASS" | "BLOCKED" | "INSUFFICIENT_EVIDENCE" | "NOT_RUN";
  /** PASS 必须有证据引用。 */
  readonly evidence?: string;
  /** BLOCKED 必须有阻塞原因。 */
  readonly blockedReason?: string;
};

/** @internal 几何可信度；I-02 内恒为 `partial` / `unverified`。 */
export type GeometryCoverage = {
  readonly chain: "manifest+atlas-metadata";
  readonly runtimeBody: "unverified";
  readonly coverage: "partial";
};

/** @internal 单档 hop 采样摘要；U4 双档独立记录。 */
export type HopSampleSummary = {
  readonly n: number;
  readonly endpoints: readonly (readonly [number, number])[];
  readonly cap: number;
};

/** @internal 永久封锁门证明（门区 + 图割 + hop 加倍）。 */
export type PermanentGateProof = {
  readonly gate: {
    readonly L: number;
    readonly R: number;
    readonly width: number;
    readonly y: number;
    readonly height: number;
    readonly epsilon: number;
  };
  readonly periodCoverage: {
    readonly periodMs: number;
    readonly complete: true;
    readonly intervals: readonly (readonly [number, number])[];
  };
  readonly sideRule: {
    readonly direction: "left->right" | "right->left";
    readonly spawnBox: Aabb;
    readonly goalRegion: Aabb;
  };
  readonly forbiddenInjection: {
    readonly gateRect: Aabb;
    readonly expandedRect: Aabb;
    readonly source: "forbiddenBoxes";
  };
  readonly graphCut: {
    readonly verdict: "conditional";
    readonly reachableFootpoints: number;
    readonly goalIntersections: number;
    readonly midAirHits: number;
    readonly evidence: string;
  };
  readonly hopDoubling: {
    readonly base: HopSampleSummary;
    readonly doubled: HopSampleSummary;
    readonly connectivityPreserved: boolean;
    readonly normalizedCoverage: boolean;
  };
  readonly hopSamplingCoverage: {
    readonly covered: boolean;
    readonly method: "normalized" | "insufficient";
  };
  readonly movementModelClosure: "not-proven-air-control";
  readonly puConditions: readonly PuCondition[];
  readonly geometryCoverage: {
    readonly hazard: GeometryCoverage;
    readonly player: GeometryCoverage;
    readonly graph: GeometryCoverage;
  };
  readonly lagMode: "gate-independent; witness-only";
  readonly lagInvariantByConstruction: true;
};

// ── Stats ───────────────────────────────────────────────────────────────────

/** @internal 预算状态；`invalid` 表示配置非法，分析未开始。 */
export type BudgetStatus = "complete" | "exhausted" | "aborted" | "invalid";

/** @internal 生效预算快照；硬上限由 `temporal-budget.ts` 在解析时检查。 */
export type BudgetProfile = {
  readonly maxStates: number;
  readonly maxEdges: number;
  readonly timeBudgetMs: number;
  readonly maxCutsPerCheck: number;
  readonly maxCutsPerBranch: number;
  readonly maxWitnessTransitions: number;
  readonly maxWitnessBytes: number;
  readonly maxHopSamples: number;
  readonly timeBudgetCheckpointWork: number;
};

/** @internal 测试专用预算覆盖；不得高于硬上限，生产调用不传。 */
export type InternalBudget = Partial<BudgetProfile>;

/** @internal 分组统计；字段名沿用 D5 / D5B，只改层级。 */
export type Stats = {
  readonly grid: {
    readonly phaseSteps: number;
    readonly dtMs: number;
    readonly xStep: number;
    readonly xPositions: number;
    /** 理论状态空间容量，不是实际访问状态数。 */
    readonly stateCapacity: number;
    readonly phaseGridCapped: boolean;
    readonly phaseCapReason: "state-capacity" | null;
    readonly N_max: number;
  };
  readonly work: {
    readonly statesEnqueued: number;
    readonly statesVisited: number;
    readonly edgesChecked: number;
    readonly cutPointsTotal: number;
    readonly segmentsTotal: number;
    readonly hopSamplesChecked: number;
    readonly witnessTransitions: number;
    readonly witnessBytes: number;
    readonly maxBranching: number;
    readonly workUnitsSinceLastCheckpoint: number;
  };
  readonly timing: {
    readonly wallClockMs: number;
    readonly timeBudgetCheckpointWork: number;
  };
  readonly budget: {
    readonly budgetProfile: BudgetProfile;
    readonly budgetStatus: BudgetStatus;
    readonly budgetKind: BudgetKind | null;
  };
  readonly determinismSignature: string;
};

// ── Diagnostics ─────────────────────────────────────────────────────────────

/** @internal 降级原因闭集；新增原因必须改 D9 / AUTH，不得临时加自由字符串。 */
export type DegradationReason =
  | "invalid-budget"
  | "budget-bound-overflow"
  | "grid-resolution-infeasible"
  | "state-budget-exhausted"
  | "edge-budget-exhausted"
  | "cut-budget-exhausted"
  | "witness-volume"
  | "hop-sample-budget"
  | "wall-clock-abort"
  | "lag-disagreement"
  | "spawn-not-on-lattice"
  | "goal-not-representable"
  | "goal-rect-degenerate"
  | "model-out"
  | "geometry-untrusted"
  | "no-witness-found"
  | "no-permanent-gate"
  | "graph-cut-incomplete"
  | "hop-doubling-changed"
  | "movement-model-unclosed";

/** @internal 触发的预算类别；`complete` 时为 `null`。 */
export type BudgetKind =
  | "state-budget"
  | "edge-budget"
  | "cut-budget"
  | "witness-volume"
  | "hop-sample-budget"
  | "wall-clock-abort";

/** @internal 内部诊断；`detail` 不进确定性签名、不参与状态分支。 */
export type Diagnostics = {
  readonly degradationReason: DegradationReason | null;
  readonly secondaryReasons: readonly DegradationReason[];
  /** 辅助解释；不进确定性签名、不参与状态分支。 */
  readonly detail?: string;
};
