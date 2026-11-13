# I03-01 I-02 内部结果 → 公共证据映射

Type: grilling
Status: open
Owner: —
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

（resolved 时填写）
