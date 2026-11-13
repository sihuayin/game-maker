# U5-01 内部结果组装与 dispatch

Type: task
Status: open
Owner: —
Blocked by: 01
Map: ../map.md
Class: U5 / IMPLEMENTATION

## Task

在 `temporal.ts` 建立 U5 内部入口与组装：把门区半部（U3）与图割半部（U4）汇成 D9 `TemporalInternalResult` / `PermanentGateProof`。**不接线生产、不发布公共 Verdict。**

### 允许文件

- `packages/contracts/src/playability/temporal.ts`
- `packages/contracts/src/playability/temporal-result.ts`（仅类型缺口）
- `packages/contracts/tests/playability-temporal*.test.ts`（新增 / 扩展测试）
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`）

### 必须完成

1. 实现 `analyzeTemporalInternal(input: TemporalInternalInput): TemporalInternalResult`（`@internal`，按 D9 签名）；可拆成内部 helper，但入口与签名不改。
2. 组装 `PermanentGateProof`：`gate` / `periodCoverage` / `sideRule` / `forbiddenInjection`（U3）+ `graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure`（U4）+ `puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction`（U5）。
3. `puConditions` 六条齐全（`gate-coverage` / `geometry-checked` / `graph-cut` / `hop-doubling` / `model-out-excluded` / `lag-consistent`）：`PASS` 必带 `evidence`，`BLOCKED` 必带 `blockedReason`；`geometry-checked` / `model-out-excluded` 恒 `BLOCKED`；禁止用 `puEligible` 布尔替代。
4. `geometryCoverage` 三份均 `chain="manifest+atlas-metadata"` / `runtimeBody="unverified"` / `coverage="partial"`。
5. `lagMode = "gate-independent; witness-only"`；`lagInvariantByConstruction: true`；`modelConditional: true`；`publicCapability: "BLOCKED"`；`publicResult: null`。
6. 内部结果映射：门区 + Witness 的 NB 路径、门区 + 图割 / hop 的 PU 路径、其余 IE；`certificate.kind` / `status` 与 `degradationReason` 一致（D9 §7 不变量）。
7. 生产接线零改动：T-57 / T-58 / T-61 原样通过；不替换 `stubTemporalAnalyzer`；不在生产代码调用 `analyzeTemporalInternal`。
8. 测试：组装形状、六条件状态、不变量（`pu-candidate` ⇔ `certificate.kind="permanent-gate"` + `COMPLETE`）、`publicCapability` 恒 `BLOCKED`。
9. 复跑 build / typecheck / 全量 `pnpm test` 并记录退出码。

### 禁止

- 接生产 / 改 `ops.ts` / `mechanic.ts` / `api.ts`；
- 发布公共 Verdict 或修改公共 Contract / barrel；
- 新增依赖 / JSON fixture / 白名单外文件；
- 删改 T-57 / T-58 / T-61 断言。

### 验收

`analyzeTemporalInternal` 可产出 D9 完整内部结果；六条件与不变量测试通过；T-55/57/58/61/62/64 通过；全量测试绿；diff 仅白名单文件。

## Answer

（resolved 时填写）
