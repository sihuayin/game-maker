# I02-D9 内部分析结果与诊断契约裁定

Type: grilling
Status: open
Owner: —
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
