# U5-01 内部结果组装与 dispatch

Type: task
Status: resolved
Owner: claude (U5-01 session 2026-11-13)
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

**完成。** `analyzeTemporalInternal` 已实现并组装 D9 `TemporalInternalResult` / `PermanentGateProof`；生产接线零改动，未发布公共 Verdict。

| 项 | 结果 |
| --- | --- |
| 产品改动 | `temporal.ts` +637 / −3（内部入口 + 组装 helper）；`temporal-result.ts` 零改动 |
| 测试 | 新建 `playability-temporal.test.ts`；`TEST_ONLY` fixtures 增加 `trustedInputFixture` |
| NB | `∀φ0` Winning Set 完整 ⇒ `nb-candidate` + `witness/COMPLETE`；U9 因 `coverage.temporal = partial`（D10 §1.1）不参与组装 |
| PU | 门区 + 注入图 + 图割 + hop 全部完整 ⇒ `pu-candidate` + `permanent-gate/COMPLETE`；六条件 1/3/4/6 `PASS`、2/5 `BLOCKED` |
| G | 门区完整、图割不完整 ⇒ `permanent-gate/INCOMPLETE` + `graph-cut-incomplete`，保留部分证明 |
| 门区不成立 | IE `no-permanent-gate`，`certificate.kind = "none"`（不为失真的门区伪造证明） |
| 模型外 | Y 轴 / 多移动 Hazard / Moving Platform / Danger `strike` ⇒ IE `model-out` |
| 预算 | 非法 / 溢出 ⇒ IE `invalid-budget` / `budget-bound-overflow`；edge 触顶 ⇒ IE `edge-budget-exhausted` |
| 确定性 | 重复运行签名与规范化完整序列化一致；`wallClockMs` / `detail` 不进签名 |
| 架构断言 | T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓（65 / 65） |
| 命令 | `pnpm build` 0；`pnpm typecheck` 0；定向 9 / 9；`pnpm test` 176 files / 2840 tests，退出码 0 |
| 白名单 | 仅 `temporal.ts`、`playability-temporal-fixtures.ts`、新建 `playability-temporal.test.ts`；其余白名单 / 只读 / 生产文件零 diff |

### 必须在 U5-04 前裁定的缺口

**F（短暂安全窗口）无法按票面字面要求产出 `permanent-gate + INCOMPLETE`。** D9 `PermanentGateProof` 要求门区四段齐全且 `periodCoverage.complete` 为字面量 `true`；U3 半部在门区失败时把四段全部置 `null`。当前实现选择 `certificate.kind = "none"` + IE `no-permanent-gate`，不伪造门区字段。这与 D7 §305「E/F/G 不得压扁成 `none`」及 U5-04 票面的 F 断言冲突。封闭方式（修改 `temporal-gate.ts` 保留部分诊断 / 放宽 D9 类型 / 用户裁定允许 `none`）均超出 U5-01 授权，需 STOP + HITL。

### 其他限制

- U4 hop / 图割工作计数尚未接入 `stats.work.hopSamplesChecked`；PU 分支暂不消费工作预算（U5-02）。
- U9 不参与组装是 D10 §1.1 的直接结果，不是把 U9 改写为非必要。

证据：[`../evidence/02-assembly.md`](../evidence/02-assembly.md)。本票未推送 / 建 PR / 合并。
