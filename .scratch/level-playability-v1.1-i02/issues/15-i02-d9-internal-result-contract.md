# I02-D9 内部分析结果与诊断契约裁定

Type: grilling
Status: resolved
Owner: amber
Blocked by: 09, 10, 11, 20, 21
Map: ../map.md
Class: I-02 / DECISION

## Question

冻结 I-02 的内部输出契约：算法返回什么、Witness / Proof / Stats / Diagnostics 的形状、如何在不接生产 Verdict 的前提下被测试消费，以及 I-03 将来能怎么接。

### 必须裁定

1. **结果类型**：判别联合还是分层对象；`verdict` + `witness` / `proof` / `stats` / `diagnostics`；纯数据、可重复。
2. **Witness 形状**：每段起止状态、时间区间、玩家盒、Hazard 位姿、验证结果；足以复现「逐段连续验证」。
3. **Proof 形状**：门区 `L/R/y`、相位与 lag 覆盖证据、图割证据、hop 加倍结果、几何 checked 证据。
4. **Stats**：states / edges / elapsed / phaseSteps / xStep / maxStepPx / budget flags；确定性相关字段。
5. **Diagnostics**：内部降级原因码（稳定、仅内部）；不新增 `ConfigIssue.code`、不落盘。
6. **入口**：是否复用 `TemporalAnalyzer` 签名；若需要 start/goal/corridor 等额外输入，如何在不改 I-01 公共契约的前提下注入（例如由 `GameConfig` 派生）。
7. **I-03 消费边界**：哪些字段是 I-03 必需的；`coverage.temporal` 与 `PlayabilityEvidence` 的 `model/lag/degradation/limits` 属于 I-03，不在 I-02 接线。
8. **可测试性**：测试如何直接调用内部 analyzer；不建立平行生产入口。

### 产出

票内 `## Answer`：内部结果契约（TypeScript 形状 + 字段语义 + 不变量）。

### 下游

I02-AUTH。

## 相关证据

- [I02-05 性能与预算基线采集](../evidence/05-performance.md)：P0 对“状态预算耗尽”和“墙钟超时”返回同一个 `search-budget-exhausted`，且墙钟超时的 visited 不稳定；I-02 的内部结果/降级口径应能区分两者。

## 上游裁定（D2）

- [I02-D2 运动模型与输入契约裁定](08-i02-d2-motion-input-contract.md)：内部结果需能记录 `geometryChain = "manifest+atlas-metadata"`、`runtimeBody = "unverified"` 与“模型条件性结果”状态；不得把内部候选证书写成正式 PU/NB；公共 coverage 保持 `partial`。

## 上游裁定（D4，2026-11-11）

[I02-D4](10-i02-d4-gate-graphcut.md) 交给 D9 的字段集：`gate`、`periodCoverage`、`sideRule`、`forbiddenInjection`、`graphCut`、`hopDoubling`、`movementModelClosure`、`puConditions`、`geometryCoverage`、`lagMode`、`modelConditional`、`degradationReason`、`hopSamplingCoverage`、`lagInvariantByConstruction`。

`puConditions` 必须逐条保存状态（至少 `PASS` / `BLOCKED` / `INSUFFICIENT_EVIDENCE` / `NOT_RUN`）、证据引用与阻塞原因；禁止用单个布尔替代。`graphCut.verdict` 只能是 `conditional`；`midAirHits=0` 不得编码为正面证据。

## 上游裁定（D8，2026-11-11）

内部结果必须能承载预算状态、降级原因、单元 / 能力分离状态；`PUBLIC_NB` / `PUBLIC_PU` 在 I-03 前均为 `BLOCKED`；U4 的受限 scratch 分析须标 `NOT_RUN` / `INSUFFICIENT_EVIDENCE`，不得伪装成 R4 证据。


## 上游裁定（D5，2026-11-11）

字段集按 [I02-D5](11-i02-d5-budget-determinism.md) §9.1：含 `statesEnqueued` / `statesVisited` 分列、`cutsTotal`、`workUnitsSinceLastCheckpoint`、`budgetKind` 枚举、`internalResult` / `modelConditional` / `publicCapability` / `publicResult` 分层；`wallClockMs` 不进入 `determinismSignature`。`maxCutsPerBranch` 在 D5B 完成前保持 `DEFERRED`。

## 上游裁定（D6，2026-11-11）

- 内部结果类型落在新增 `packages/contracts/src/playability/temporal-result.ts`：**纯类型模块**，不依赖任何 I-02 模块，不得反向导入 budget / motion / witness / gate / evasion。
- `temporal-result.ts` 不得导入 `temporal.ts`；任何循环依赖视为架构验收失败。
- 结果类型不转出公共 barrel（不进 `playability/index.ts` / `contracts/src/index.ts` / package exports）；内部符号加 `@internal`。
- I-02 不接生产：内部结果由 I-02 专项测试直接消费，不复用/修改生产 `TemporalAnalyzer` 签名，不改 `ops.ts`、T-57/T-58。

## 上游裁定（D7，2026-11-11）

- D7 的 A–J 语义断言表（[I02-D7](13-i02-d7-test-matrix.md) §2）需要 D9 为**每一条**提供明确字段落点。
- 强制对齐规则：D9 必须能表达 D7 的语义断言；若不能，回 D9 修订，不得在 AUTH 中弱化 D7；不得以字段名的实现便利性改变预期结论。
- 内部 NB 证书成立 ≠ 公共 `NO_PROVEN_BLOCKER`；内部 PU 证据成立 ≠ 公共 `PROVEN_UNPLAYABLE`；`publicCapability` 在 I-03 前保持 `BLOCKED`。
- A–J 的具体字段名**不由 D7 冻结**，由本票冻结；AUTH 负责逐条核对两边映射。

## 上游裁定（D5B，2026-11-11）

- **必须冻结 Witness 记录形状**，并在 W1 / W2 / W3 中选一（[I02-D5B](21-i02-d5b-cut-budget-benchmark.md) §5）：
  - W1（推荐）：紧凑记录（实测 35 B/转移）+ `maxWitnessTransitions = 1,000,000` + `maxWitnessBytes = 64 MiB`；
  - W2：全记录（200 B/转移）+ `250,000` + 64 MiB；
  - W3：全记录 + `1,000,000` + 256 MiB（不推荐）。
- 内部结果必须同时暴露 `cutPointsTotal` 与 `segmentsTotal`；`maxCutsPerBranch` 按 **segments** 计（默认 5,000,000 / 硬 10,000,000，AUTH 确认）。
- Witness 体积检查必须在构造过程中进行；触顶 ⇒ IE `witness-volume`，不得截断后继续。
- 证据：[`evidence/07-cut-budget.md`](../evidence/07-cut-budget.md)。

## Answer

用户 2026-11-11 逐题裁定。Q1–Q8 **按推荐方向采纳**，并追加四项修正：`pu-candidate` 仅表示完整的模型内门区 + 图割 + hop 证明；Witness 采用 W1 且以**实际序列化字节数**判定容量；`certificate` 保留 `COMPLETE / INCOMPLETE` 的部分证明；FNV-1a 32-bit 只作指纹，确定性测试仍须比较完整规范化序列化。

**修改产品目录：否**（仅本票、D5/D7/AUTH 票尾与地图；未触碰 `packages/**`、Runtime、CLI、MCP、公共 Contract、I-00 / I-02 原文）。

> 本票冻结 I-02 的**内部**结果契约，不发布公共 Verdict，也不构成 U2–U5 的实施授权。

### 0. 裁定总表

| 问题 | 裁定 | 冻结要点 |
| --- | --- | --- |
| Q1 顶层结果 | **A：分层对象 + certificate 联合** | `nb-candidate` / `pu-candidate` / `insufficient-evidence`；绝不使用公共三态名 |
| Q2 Witness | **W1：紧凑记录** | `1M / 64 MiB`；以实际 UTF-8 字节数判定 |
| Q3 Proof | **A：单一 certificate 联合 + 状态** | `COMPLETE / INCOMPLETE` 保留部分证明；不压扁成 `none` |
| Q4 Stats | **A：分组对象** | 字段名沿用 D5/D5B，只改层级 |
| Q5 Diagnostics | **A：闭集原因码** | 新增原因必须改 D9/AUTH |
| Q6 入口 | **A：独立内部入口** | `temporal.ts` 导出；`testHooks` 不进公共面 |
| Q7 确定性 | **A：FNV-1a 32-bit** | 指纹，不是无碰撞证明；完整序列化同时比较 |
| Q8 I-03 边界 | **A：分层消费** | I-03 负责公共转换；I-02 不接生产 |

### 1. 顶层结果（Q1）

```ts
// packages/contracts/src/playability/temporal-result.ts —— 纯类型、@internal
// 只允许从 ./geometry.js 引入 Aabb / Vec / Size；不得引入任何 I-02 模块。
export type InternalResultState =
  | "nb-candidate"
  | "pu-candidate"
  | "insufficient-evidence";

export type ProofStatus = "COMPLETE" | "INCOMPLETE";

export type Certificate =
  | { readonly kind: "witness"; readonly status: ProofStatus; readonly witness: Witness }
  | { readonly kind: "permanent-gate"; readonly status: ProofStatus; readonly proof: PermanentGateProof }
  | { readonly kind: "none" };

export type TemporalInternalResult = {
  readonly internalResult: InternalResultState;
  readonly modelConditional: true;
  readonly publicCapability: "BLOCKED";
  readonly publicResult: null;
  readonly certificate: Certificate;
  readonly stats: Stats;
  readonly diagnostics: Diagnostics;
};
```

语义：

- `nb-candidate`：内部安全 Witness **完整成立**；不代表公共 `NO_PROVEN_BLOCKER`。
- `pu-candidate`：I-02 模型范围内的门区 + 图割 + hop 加倍证明**完整成立**；不代表公共 `PROVEN_UNPLAYABLE`。
- `insufficient-evidence`：没有形成完整的 NB / PU 候选证书，或因预算、模型适用性、几何可信度等原因无法完成。
- `modelConditional` 恒为 `true`；`publicCapability` 恒为 `"BLOCKED"`；`publicResult` 恒为 `null`。

`pu-candidate` 的严格条件（四条同时满足）：

1. 门区恒覆盖证明完整；
2. 静态图割证明完整；
3. hop 加倍验证通过；
4. 证明范围、输入与预算完整，没有未完成项。

即使达到 `pu-candidate`，`puConditions` 中仍必须明确：

- `gate-coverage` = `PASS`
- `geometry-checked` = `BLOCKED`
- `graph-cut` = `PASS`
- `hop-doubling` = `PASS`
- `model-out-excluded` = `BLOCKED`
- `lag-consistent` = `PASS`

`certificate.status = "COMPLETE"` 只表示**模型内证明**完整，不表示 PU 六条件全部 PASS；公共 PU 仍由 I-03 的几何与 Runtime 证据门槛决定。

门区或图割本身不完整 ⇒ 只能是 `insufficient-evidence`，不得因“找到了部分门区证据”升级为候选。

### 2. Witness 形状（Q2，W1）

```ts
export type WitnessForm = "u9" | "winning-set";

/** [fromFoot, fromK, toFoot, toK, t0, t1, verified]；verified = 0 | 1。 */
export type WitnessTransition = readonly [
  fromFoot: number,
  fromK: number,
  toFoot: number,
  toK: number,
  t0: number,
  t1: number,
  verified: 0 | 1,
];

export type PolicyTermination =
  | { readonly kind: "rank"; readonly rank: readonly number[] }
  | { readonly kind: "trace"; readonly finite: true; readonly length: number };

export type Witness = {
  readonly form: WitnessForm;
  /** 明确的编码语义：盒由冻结输入 + 运动公式 + 转移时间确定性派生，不是推测。 */
  readonly derived: true;
  /** 逐转移验证记录；policy 用下标引用已验证项。 */
  readonly verifications: readonly WitnessTransition[];
  /** 策略表：verifications 的下标，按策略顺序排列；每一项 verified = 1。 */
  readonly policy: readonly number[];
  readonly termination: PolicyTermination;
  readonly phaseCoverage: {
    readonly cells: number;
    readonly covered: number;
    readonly complete: boolean;
  };
  readonly volume: {
    readonly transitions: number;
    readonly bytes: number;
  };
};
```

冻结约束：

1. `derived: true` 表示**确定性派生**，不表示“缺少几何记录所以暂时推测”。
2. 必须有测试验证：派生玩家盒、Hazard 位姿与连续求交实际使用的解析几何**完全一致**。
3. 序列化必须确定性：同一策略不得因对象属性顺序、数字格式或序列化器差异改变字节结果。
4. `volume.transitions` 与 `volume.bytes` 以**最终确定性序列化后的 UTF-8 字节数**为准。
5. 容量：`maxWitnessTransitions = 1,000,000`、`maxWitnessBytes = 64 MiB`。任一超限 ⇒ IE `witness-volume`；**不得**因为转移数未超限而忽略字节限制。
6. `policy` 的每一项必须在 `verifications` 中 `verified = 1`；策略不得引用未验证记录。
7. `phaseCoverage.complete = true` 只表示相位域被完整分区，不自动推出证书完整；证书完整性由 `certificate.status` 表达。

### 3. Proof 形状（Q3）

`certificate` 的两个实质分支都带 `status`：

- `witness + COMPLETE` ⇒ 可形成 `nb-candidate`；
- `witness + INCOMPLETE` ⇒ 保留部分路径 / 验证记录，**不得**形成 `nb-candidate`；
- `permanent-gate + COMPLETE` ⇒ 可形成 `pu-candidate`；
- `permanent-gate + INCOMPLETE` ⇒ 保留部分门区 / 图割证据，**不得**形成 `pu-candidate`；
- `none` ⇒ 没有形成可保留的证书材料。

```ts
export type PuConditionId =
  | "gate-coverage"
  | "geometry-checked"
  | "graph-cut"
  | "hop-doubling"
  | "model-out-excluded"
  | "lag-consistent";

export type PuCondition = {
  readonly id: PuConditionId;
  readonly status: "PASS" | "BLOCKED" | "INSUFFICIENT_EVIDENCE" | "NOT_RUN";
  /** PASS 必须有证据引用。 */
  readonly evidence?: string;
  /** BLOCKED 必须有阻塞原因。 */
  readonly blockedReason?: string;
};

export type PermanentGateProof = {
  readonly gate: {
    readonly L: number; readonly R: number; readonly width: number;
    readonly y: number; readonly height: number; readonly epsilon: number;
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
```

冻结约束：

- `graphCut.verdict` 只能为 `"conditional"`；`midAirHits` 是否决证据，不是“空中可达性完整模型”的正面证明。
- `movementModelClosure` 固定为 `"not-proven-air-control"`。
- `puConditions` 必须六条齐全，禁止用 `puEligible` 布尔替代。
- `geometry-checked` 与 `model-out-excluded` 仍为 `BLOCKED`。
- `PASS` 必须有 `evidence`；`BLOCKED` 必须有 `blockedReason`；状态与证据不一致视为契约违反。
- `status = INCOMPLETE` 时必须至少有一个 `degradationReason`；`status = COMPLETE` 时不得携带表示“不完整”的降级原因。

`GeometryCoverage`：

```ts
export type GeometryCoverage = {
  readonly chain: "manifest+atlas-metadata";
  readonly runtimeBody: "unverified";
  readonly coverage: "partial";
};
```

### 4. Stats（Q4）

```ts
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
    readonly budgetStatus: "complete" | "exhausted" | "aborted" | "invalid";
    readonly budgetKind: BudgetKind | null;
  };
  readonly determinismSignature: string;
};
```

冻结：

- 字段名不改（沿用 D5/D5B），只分组。
- `cutPointsTotal` 与 `segmentsTotal` 必须同时存在；`maxCutsPerBranch` 按 `segmentsTotal` 计（D5B）。
- `phaseGridCapped` 是诊断，不是降级原因。
- `wallClockMs` 不进入 `determinismSignature`。
- `stateCapacity` 是理论容量，不得冒充实际访问状态数。
- `budgetKind` 在 `budgetStatus = "complete"` 时为 `null`。

### 5. Diagnostics（Q5）

```ts
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

export type BudgetKind =
  | "state-budget"
  | "edge-budget"
  | "cut-budget"
  | "witness-volume"
  | "hop-sample-budget"
  | "wall-clock-abort";

export type Diagnostics = {
  readonly degradationReason: DegradationReason | null;
  readonly secondaryReasons: readonly DegradationReason[];
  /** 辅助解释；不进确定性签名、不参与状态分支。 */
  readonly detail?: string;
};
```

冻结：

- 原因码是**闭集**；新增原因必须改 D9 / AUTH，不允许实现者临时加自由字符串。
- `secondaryReasons` 同样使用闭集，去重并按字典序稳定排序。
- 双档结果严格区分：两档都完整但结果不一致 ⇒ `lag-disagreement`；至少一档因预算 / wall-clock 不完整 ⇒ 保留实际降级原因，不得伪装成 `lag-disagreement`。

### 6. 入口与测试钩子（Q6）

入口放在 `temporal.ts`（D6 冻结的编排文件），不新建 `temporal-internal.ts`：

```ts
// temporal.ts
export type TemporalInternalInput = {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  readonly lagMs: number;
  readonly trustedInput: TrustedAtlasInput;
  /** @internal 仅用于 I-02 专项测试；不进 barrel / 公共 Contract。 */
  readonly testHooks?: {
    readonly budget?: InternalBudget;
    readonly now?: () => number;
  };
};

export type TemporalInternalAnalyzer =
  (input: TemporalInternalInput) => TemporalInternalResult;
```

冻结边界：

- `start / goal / corridor` 全部从 `GameConfig` 与固定 profile 派生；不增加公共输入字段。
- `testHooks` 只用于内部测试；生产调用不传，使用模块级默认预算与时钟。
- `now` 只用于 wall-clock abort 判定；不参与相位、移动、碰撞、Witness、图割或策略选择。
- `budget` / `now` 不进 barrel、不进公共 Contract、不进配置字段；不得成为生产调用方扩预算或放宽上限的入口。
- I-03 负责内部结果 → 公共结果的 adapter；I-02 不修改 `TemporalAnalyzer`、`ops.ts` 或生产接线。
- `@internal` 注释**不是访问控制**：必须通过白名单审计与公共导出扫描确认测试钩子没有进入公共导出面。

### 7. 确定性签名（Q7）

- 算法：纯 JavaScript **FNV-1a 32-bit**，输出 8 位十六进制字符串；不使用 `node:crypto`（T-55）。
- 实现位置：`temporal.ts`；`temporal-result.ts` 保持纯类型。
- 规范化 JSON：对象键排序、数组保留语义顺序、数值编码固定、无 `undefined`。
- 覆盖：`stats.grid`、`stats.work` 计数、`internalResult`、`certificate`（policy / verifications / termination / phaseCoverage）、`diagnostics` 原因码、`stats.budget` 状态。
- 排除：`stats.timing.wallClockMs`、`diagnostics.detail`、时间戳、`testHooks`。

关键约束：

- 32-bit 签名**只作指纹，不是无碰撞证明**。
- vitest 确定性测试必须同时比较签名**和**剔除非确定性字段后的规范化完整序列化结果。
- 不允许仅凭签名相等判定完整结果相同；签名不同可以作为确定性失败的直接证据。
- 跨进程 scratch 基准也必须保留完整规范化结果或强校验材料，不能把 32-bit 哈希当作唯一证据。

### 8. I-03 消费边界（Q8）

I-03 可消费：

- `internalResult`
- `certificate`
- `stats.budget`
- `modelConditional`
- `diagnostics`
- `geometryCoverage`
- `lagMode`
- `puConditions`

I-03 负责：

- `coverage.temporal`
- `PlayabilityEvidence` 的 `model / lag / degradation / limits`
- 内部结果 → 公共结果的转换与发布门禁。

I-02 保留：

- `publicCapability: "BLOCKED"`
- `publicResult: null`

继续遵守：

- 不新增 `ConfigIssue.code`；
- 不持久化内部结果；
- 不接入 Pipeline；
- 不生成公共 NB / PU。

### 9. A–J 字段落点

| 编号 | 必须成立的字段断言 |
| --- | --- |
| A | `internalResult = "nb-candidate"`；`certificate.kind = "witness"`；`certificate.status = "COMPLETE"`；`publicCapability = "BLOCKED"` |
| B | `internalResult = "pu-candidate"`；`certificate.kind = "permanent-gate"`；`certificate.status = "COMPLETE"`；`puConditions["geometry-checked"].status = "BLOCKED"`；`puConditions["model-out-excluded"].status = "BLOCKED"`；`publicCapability = "BLOCKED"`。**只断言 `pu-candidate` 不够** |
| C | `internalResult = "insufficient-evidence"`；`diagnostics.degradationReason` 与具体缺口一致 |
| D | `certificate.witness.verifications` 含跨折返点的切段记录（`t0/t1` 跨 `P/2`）；`verified` 与解析求交结果一致 |
| E | `certificate.kind = "witness"` 且 `status = "INCOMPLETE"`（或 `kind = "none"`）；`diagnostics.degradationReason ∈ { no-witness-found, … }`；不得 `nb-candidate` |
| F | `certificate.kind = "permanent-gate"` 且 `status = "INCOMPLETE"`（门证明不成立）；`degradationReason = "no-permanent-gate"`；不得 `pu-candidate` |
| G | `certificate.kind = "permanent-gate"` 且 `status = "INCOMPLETE"`（图割不成立）；`degradationReason ∈ { graph-cut-incomplete, hop-doubling-changed, movement-model-unclosed }`；不得 `pu-candidate` |
| H | `internalResult = "insufficient-evidence"`；`stats.budget.budgetStatus = "exhausted"`；`stats.budget.budgetKind` 与触发原因一致 |
| I | `internalResult = "insufficient-evidence"`；`diagnostics.degradationReason = "lag-disagreement"`；两档都完整 |
| J | `stats.determinismSignature` 相等；剔除 `wallClockMs` / `detail` / 时间戳后的规范化完整序列化相等 |

### 10. 不变量

1. 纯数据：可 JSON 序列化；无 `Map` / `Set` / class / function；无 `NaN` / `Infinity` / `undefined`。
2. 全部字段 `readonly`；数组按语义顺序，JSON 序列化时对象键规范化。
3. `nb-candidate` ⇔ `certificate.kind = "witness"` 且 `status = "COMPLETE"`。
4. `pu-candidate` ⇔ `certificate.kind = "permanent-gate"` 且 `status = "COMPLETE"` 且门区 / 图割 / hop 加倍完整；`puConditions` 必须 `gate-coverage` / `graph-cut` / `hop-doubling` / `lag-consistent` = `PASS`，`geometry-checked` / `model-out-excluded` = `BLOCKED`。
4b. `certificate.status = "COMPLETE"` 指模型内证明完整，**不**表示 PU 六条件全部 PASS。
5. `certificate.kind = "none"` ⇒ `internalResult = "insufficient-evidence"`。
6. `status = "INCOMPLETE"` ⇒ 至少一个 `degradationReason`；`status = "COMPLETE"` ⇒ 不携带表示不完整的降级原因。
7. `puConditions` 六条齐全；`PASS` 必有 `evidence`，`BLOCKED` 必有 `blockedReason`。
8. `graphCut.verdict = "conditional"`；`midAirHits` 只作否决证据。
9. `movementModelClosure = "not-proven-air-control"`。
10. `geometryCoverage` 三份均为 `chain = "manifest+atlas-metadata"`、`runtimeBody = "unverified"`、`coverage = "partial"`。
11. `witness.derived = true`；派生盒与解析盒一致由测试证明。
12. `witness.volume.bytes` 是最终确定性序列化的 UTF-8 字节数；超 `1M` 转移或 `64 MiB` ⇒ IE `witness-volume`。
13. `stateCapacity` 是理论容量；实际访问量看 `statesVisited`。
14. `wallClockMs` 不进 `determinismSignature`。
15. `publicCapability = "BLOCKED"`、`publicResult = null` 恒成立。

### 11. 辅助类型

```ts
export type HopSampleSummary = {
  readonly n: number;
  readonly endpoints: readonly (readonly [number, number])[];
  readonly cap: number;
};

/** 生效预算快照；数值来自 D5 / D5B，硬上限在实现内检查。 */
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

/** 测试专用预算覆盖；不得高于硬上限，生产调用不传。 */
export type InternalBudget = Partial<BudgetProfile>;
```

### 12. 对上游的确认

- **D5 / D5B**：Witness 采用 **W1**（紧凑记录，`1M / 64 MiB`）；`maxCutsPerBranch` 按 `segmentsTotal` 计（默认 5M / 硬 10M）；`cutPointsTotal` 与 `segmentsTotal` 同时暴露。
- **D6**：类型全部落在 `temporal-result.ts`（纯类型）；`temporal.ts` 只放内部入口、签名函数与编排。
- **D7**：A–J 的字段落点见 §9；B 的断言必须同时检查五项，不得只断言 `pu-candidate`。
- **AUTH**：必须逐条核对 D7 A–J ↔ D9 §9；记录 witness 终值与原因码闭集；确认 `testHooks` 不在公共导出面。
