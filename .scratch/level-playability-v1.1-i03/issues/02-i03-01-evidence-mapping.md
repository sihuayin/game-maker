# I03-01 I-02 内部结果 → 公共证据映射

Type: grilling
Status: resolved
Owner: claude (I03-01 session 2026-11-13)
Blocked by: 01
Map: ../map.md
Class: I-03 / DECISION

## Question

如何把 D9 `TemporalInternalResult` / `PermanentGateProof` 映射为公共 `PlayabilityEvidence` 的 `model / lag / degradation / limits` 与 `coverage.temporal`，同时保持 I-02 的 `publicCapability=BLOCKED` / `publicResult=null` 不变？

### 必须裁定

- `model`：`modelConditional`、`geometryCoverage`、`movementModelClosure`、`puConditions` 的公共表示；
- `lag`：`lagMode`、`lagInvariantByConstruction`、两档证据如何表达（是否记录 per-lag）；
- `degradation`：D9 `DegradationReason` 闭集 → 公共 degradation 字段的逐项映射；IE 保留；
- `limits`：预算、Witness 体积、hop cap、geometry `partial` 的公共表示；
- `coverage.temporal` 与 `spatial / mechanic / completion` 并列时的取值条件（`checked / partial / not-checked`）；
- 适配层只消费内部结果，不回写 / 篡改 I-02 结果；
- 不得把 `insufficient-evidence` 映射为 `NO_PROVEN_BLOCKER`；不得把 `nb-candidate` / `pu-candidate` 写成公共 Verdict。

### 禁止

- 修改 `temporal-result.ts` / D9 字段 / I-02 原文；
- 新增公共导出或扩张 API；
- 把模型内候选当公共结论。

### 验收

字段级映射表、类型草案、正 / 负例、未覆盖项；每个映射有来源与不变量。

## Answer

**Q1=A / Q2=A / Q3=B / Q4=A / Q5=A。** 映射是**公共证据的加法摘要**，不搬运内部 Proof / Witness，不改 I-02 结果，也不产生公共 Verdict。

> 本票只冻结**映射契约草案**；公共类型实现、I03-09 授权包组装、I03-02 aggregate、I03-03/04/05 准入与 I03-06 发布门均不在本票实施。

### 0. 顶层决定

| 题 | 选择 | 结论 |
| --- | --- | --- |
| Q1 | A | 公共 evidence 带 `model` / `lag` / `degradation` / `limits` 摘要 + 紧凑 temporal witness；完整门区 / graph cut / hop endpoints 留在内部 |
| Q2 | A | 新增 `PlayabilityWitness` 变体 `kind: "temporal"`；不携带内部 proof |
| Q3 | B | 专用 `TemporalCoverageState = "checked" \| "partial" \| "unknown"`，与 I-00 §8 逐字一致；不重命名既有 `CoverageState` |
| Q4 | A | 公共 `degradation` 是稳定闭集；D9 内部原因码 many-to-one 映射，原码只留在内部 / scratch |
| Q5 | A | `lag` 记录逐档**结论**；`limits` 用紧凑摘要；不暴露完整 `Stats` / 两档 `TemporalInternalResult` |

### 1. 公共类型草案（供 I03-09 组装；本票不实现）

```ts
// I-00 §8：temporal coverage 使用独立取值，逐字对齐 checked / partial / unknown。
export type TemporalCoverageState = "checked" | "partial" | "unknown";

// 公共 coverage 的加法字段；既有三维不变。
export type PlayabilityCoverage = {
  readonly spatial: CoverageState;
  readonly mechanic: CoverageState;
  readonly completion: CoverageState;
  /** 仅时序 evidence 设置；缺省由消费者按 unknown 处理（I03-02 定 aggregate）。 */
  readonly temporal?: TemporalCoverageState;
};

// 公共 degradation 闭集：稳定、可版本化；不直接透传 D9。
export type PublicTemporalDegradation =
  | "invalid-input"
  | "model-out"
  | "geometry-untrusted"
  | "budget-exhausted"
  | "witness-volume"
  | "hop-sample-budget"
  | "wall-clock-abort"
  | "lag-disagreement"
  | "no-witness"
  | "no-permanent-gate"
  | "graph-cut-incomplete"
  | "hop-doubling-changed"
  | "movement-model-unclosed";

export type PublicGeometryCoverage = {
  readonly chain: "manifest+atlas-metadata";
  readonly runtimeBody: "unverified";
  readonly coverage: "partial";
};

export type PublicPuCondition = {
  readonly id:
    | "gate-coverage" | "geometry-checked" | "graph-cut"
    | "hop-doubling" | "model-out-excluded" | "lag-consistent";
  readonly status: "PASS" | "BLOCKED" | "INSUFFICIENT_EVIDENCE" | "NOT_RUN";
  readonly evidence?: string;
  readonly blockedReason?: string;
};

export type TemporalModelEvidence = {
  readonly conditional: true;
  readonly geometryCoverage: {
    readonly hazard: PublicGeometryCoverage;
    readonly player: PublicGeometryCoverage;
    readonly graph: PublicGeometryCoverage;
  };
  readonly movementModelClosure: "not-proven-air-control";
  /** 仅 permanent-gate 证据携带；NB / IE 缺省。 */
  readonly puConditions?: readonly PublicPuCondition[];
};

export type TemporalLagConclusion = {
  readonly lagMs: number;
  readonly internalResult: "nb-candidate" | "pu-candidate" | "insufficient-evidence";
  readonly certificateKind: "witness" | "permanent-gate" | "none";
  readonly certificateStatus: "COMPLETE" | "INCOMPLETE";
  readonly degradation: PublicTemporalDegradation | null;
};

export type TemporalLagEvidence = {
  readonly mode: "gate-independent; witness-only";
  readonly invariantByConstruction: true;
  /** 恰好两项：[主档, 基准档]；不含逐档 Witness / proof。 */
  readonly perLag: readonly TemporalLagConclusion[];
};

export type TemporalDegradationEvidence = {
  readonly reason: PublicTemporalDegradation | null;
  readonly secondary: readonly PublicTemporalDegradation[];
};

export type TemporalLimitsEvidence = {
  readonly budgetStatus: "complete" | "exhausted" | "aborted" | "invalid";
  readonly budgetKind:
    | "state-budget" | "edge-budget" | "cut-budget"
    | "witness-volume" | "hop-sample-budget" | "wall-clock-abort" | null;
  readonly witnessTransitions: number;
  readonly witnessBytes: number;
  readonly maxWitnessTransitions: number;
  readonly maxWitnessBytes: number;
  readonly hopSamplesChecked: number;
  readonly maxHopSamples: number;
  /** 摘要；三份明细在 model.geometryCoverage。 */
  readonly geometryCoverage: "partial";
};

// PlayabilityEvidence 的加法字段；既有 evidence 不带这些字段。
// model / lag / degradation / limits 只出现在 temporal evidence 上。
```

`PlayabilityWitness` 的加法变体：

```ts
| {
    readonly kind: "temporal";
    readonly result: "nb-candidate" | "pu-candidate" | "insufficient-evidence";
    readonly certificateKind: "witness" | "permanent-gate" | "none";
    readonly certificateStatus: "COMPLETE" | "INCOMPLETE";
    readonly degradation: PublicTemporalDegradation | null;
  }
```

> `witness` 只放**结论摘要**；`model` / `lag` / `degradation` / `limits` 放在 evidence 顶层。
> 不把 `PermanentGateProof` / `Witness` / `perLag` 的完整内部对象放进公共 witness。

### 2. D9 → 公共 degradation 映射（many-to-one，完整覆盖）

| D9 `DegradationReason` | 公共值 |
| --- | --- |
| `invalid-budget` | `invalid-input` |
| `budget-bound-overflow` | `invalid-input` |
| `grid-resolution-infeasible` | `invalid-input` |
| `spawn-not-on-lattice` | `invalid-input` |
| `goal-not-representable` | `invalid-input` |
| `goal-rect-degenerate` | `invalid-input` |
| `state-budget-exhausted` | `budget-exhausted` |
| `edge-budget-exhausted` | `budget-exhausted` |
| `cut-budget-exhausted` | `budget-exhausted` |
| `witness-volume` | `witness-volume` |
| `hop-sample-budget` | `hop-sample-budget` |
| `wall-clock-abort` | `wall-clock-abort` |
| `lag-disagreement` | `lag-disagreement` |
| `model-out` | `model-out` |
| `geometry-untrusted` | `geometry-untrusted` |
| `no-witness-found` | `no-witness` |
| `no-permanent-gate` | `no-permanent-gate` |
| `graph-cut-incomplete` | `graph-cut-incomplete` |
| `hop-doubling-changed` | `hop-doubling-changed` |
| `movement-model-unclosed` | `movement-model-unclosed` |

- 内部 `budgetKind` 仍保留在 `limits.budgetKind`，不因 many-to-one 丢失实际预算类别。
- `degradation.reason` = 内部主因映射；`secondary` = 内部 `secondaryReasons` 逐项映射、去重、按公共字符串字典序排序。
- `degradation.reason = null` 仅当内部主因为 `null`；`certificate.status = COMPLETE` 时 `reason` 必须为 `null` 且 `secondary` 为空。
- 原始 D9 码只留在内部 / scratch evidence；公共 evidence 不出现自由字符串原因码。

### 3. `coverage.temporal` 取值规则

| 值 | 条件 | 备注 |
| --- | --- | --- |
| `checked` | I-02 输入 brand 有效、模型适用、两档都完成（`budgetStatus="complete"`），且无 `model-out` / `invalid-input` / `geometry-untrusted` | **只表示输入 / 模型检查完成**；不代表已证明可通行，也不代表 geometry `checked` |
| `partial` | 分析已开始、输入 / 模型检查通过，但一档或两档因预算 / 墙钟 / Witness 体积不完整 | 保留实际降级原因；不得升级为 checked |
| `unknown` | 不适用、`model-out`、非法输入、`geometry-untrusted`，或没有可消费的时序分析结果 | 不得静默回退为 checked / partial |

- 时序 evidence 必须设置 `coverage.temporal`；非时序 evidence 可缺省。
- `coverage.spatial / mechanic / completion`：适配层从当前 `auditPlayability` 结果**原样复制**；取不到时用 `"not-checked"`，不得伪造 `"checked"`。
- `coverage.temporal = checked` **不**推出公共 NB；几何 gate 与 NB 证据准入是独立条件（I03-03 / I03-04）。

### 4. `lag` 与 `limits`

- `lag.perLag` 恰好两项，顺序固定为 `[主档 input.lagMs, 基准档 secondLagMs]`；`lagMs` 记录实际数值（通常是 16.67 / 200）。
- `perLag[i]` 只含结论摘要：`internalResult` / `certificateKind` / `certificateStatus` / 主 `degradation`；**不**含逐档 Witness、proof、stats。
- 两档不一致时，适配层仍保留两档各自结论；主 evidence 的 `witness.result` / `degradation` 取合并结果（`insufficient-evidence` + `lag-disagreement`，由 I-02 `resolveTwoLagInternalResults` 给出）。
- `limits` 从内部 `stats.budget` / `stats.work` / `budgetProfile` 取值；`hopSamplesChecked` 目前恒为 0（U5 已知缺口），不得伪造为 `maxHopSamples` 或非零值。
- `limits.geometryCoverage` 固定摘要 `"partial"`；三份明细在 `model.geometryCoverage`。

### 5. judgmentId / target / 非阻断

- `judgmentId`：**`PLAYABILITY_TEMPORAL_EVIDENCE`**（单一稳定 id；不按 nb/pu/ie 分裂，结论在 `witness.result`）。
- `target`：**`objective.gate`**（时序分析回答的是“能否完成目标”，不按 hazard 分裂目标）；`assetId` = 移动 Hazard 的资源 id；`detail` 用人话说明内部结论，不写原始 D9 码。
- 第一阶段该 id **非阻断**：不产生 `ConfigIssue`，不进入 `publish-gate` 拒稿；I03-06 负责把这条写进消费规则。
- 不新增 `ConfigIssue.code`；不改 `playabilityIssues` 的既有阻断映射。

### 6. 正 / 负例

| # | 内部结果 | 公共 evidence 摘要 |
| --- | --- | --- |
| P1 | `nb-candidate` + `witness/COMPLETE`，两档完成 | `witness.kind="temporal"`、`result="nb-candidate"`、`certificateKind="witness"`、`status="COMPLETE"`、`degradation=null`；`coverage.temporal="checked"`；`lag.perLag` 两项；**不是公共 `NO_PROVEN_BLOCKER`** |
| P2 | `pu-candidate` + `permanent-gate/COMPLETE`，六条件齐全 | `result="pu-candidate"`、`certificateKind="permanent-gate"`、`status="COMPLETE"`；`model.puConditions` 六项；`coverage.temporal="checked"`；**不是公共 `PROVEN_UNPLAYABLE`** |
| P3 | IE + `no-witness-found` / `no-permanent-gate` | `result="insufficient-evidence"`、`certificateKind="none"`、`degradation.reason` 对应公共值；`coverage.temporal` 按 §3；不产生安全结论 |
| P4 | 预算耗尽 / 墙钟 abort | `result="insufficient-evidence"`、`budget-exhausted` 或 `wall-clock-abort`；`coverage.temporal="partial"`；`limits.budgetStatus` 对应 |
| N1 | `nb-candidate` 被写成公共 `NO_PROVEN_BLOCKER` | **禁止**；`witness.result` 只是候选 |
| N2 | `pu-candidate` 被写成公共 `PROVEN_UNPLAYABLE` | **禁止**；公共 PU 仍 `BLOCKED` |
| N3 | IE 映射为 `NO_PROVEN_BLOCKER` | **禁止**；IE 必须保留 |
| N4 | `coverage.temporal="checked"` 被当作 geometry `checked` / 公共 NB 准入 | **禁止**；几何 gate 独立 |
| N5 | 缺失 / 非法内部值被静默填成 `checked` / `COMPLETE` | **禁止**；用 `unknown` / `invalid-input` |
| N6 | 公共 evidence 携带完整 `PermanentGateProof` / 内部 Witness / 原始 D9 码 | **禁止**；只带摘要 |

### 7. 不变量

1. `TemporalInternalResult` / `PermanentGateProof` **不被修改**；适配层只读消费，不回写。
2. `nb-candidate` / `pu-candidate` / `insufficient-evidence` 是内部候选词汇；公共 evidence 的 `witness.result` 可以引用它们，但**不产生公共 Verdict**。
3. `certificate.status="COMPLETE"` ⇒ `degradation.reason=null` 且 `secondary=[]`；`INCOMPLETE` ⇒ 至少一个非 null 公共原因。
4. `lag.perLag` 恰好两项，逐档独立；不共享 / 拼接逐档 Witness 或 proof。
5. `coverage.temporal` 不得由缺失 / 预算耗尽 / 模型外静默升级为 `checked`。
6. 公共 evidence 不出现原始 D9 原因码、完整 Witness、完整 `PermanentGateProof`、完整 `Stats`。
7. 非时序 evidence 的既有字段与行为不变；`model / lag / degradation / limits` 只出现在 temporal evidence。
8. `PLAYABILITY_TEMPORAL_EVIDENCE` 第一阶段非阻断；不改 `publish-gate` 拒稿。

### 8. 下游

- **I03-02**：用本映射定义 `coverage.temporal` 的 aggregate、公共 Verdict 语义与 `INSUFFICIENT_EVIDENCE` 的顶层优先级。
- **I03-03 / I03-04 / I03-05**：几何 gate、NB 三阶段、PU 独立链；不得把 `coverage.temporal="checked"` 当作准入通过。
- **I03-06**：`PLAYABILITY_TEMPORAL_EVIDENCE` 的非阻断消费规则与未来 gate 变更门槛。
- **I03-09**：把本 Answer 的映射表与类型草案组装进 `docs/v7.8/移动-I03.md` §3–§5。

本票**未修改产品代码 / 公共类型 / I-02 原文 / U5 结果**；TypeScript 片段是契约草案，不是已实现代码。
