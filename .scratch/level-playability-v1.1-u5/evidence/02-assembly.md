# U5-01 内部结果组装与 dispatch — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u5` |
| base | `b41f076`（U1–U4 全部实现 + R1–R4 + U4-SIGN）；U5-00 `fa49454` |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未变） |
| 实现票 | [U5-01](../issues/02-u5-01-assembly.md) |

## 产品改动（白名单）

| 文件 | 改动 |
| --- | --- |
| `packages/contracts/src/playability/temporal.ts` | +637 / −3：实现 `analyzeTemporalInternal` 与内部组装 helper；更新 U1 注释 |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | +11：`TEST_ONLY` `trustedInputFixture`（组装层不消费 `trustedInput`） |
| `packages/contracts/tests/playability-temporal.test.ts` | 新建 299 行：U5-01 组装 / 六条件 / 不变量 / 预算 / 确定性 9 条测试 |

- `temporal-result.ts` / `temporal-budget.ts` / `temporal-motion.ts` / `temporal-witness.ts` / `temporal-gate.ts` / `temporal-evasion.ts` / `graph.ts` / `reach.ts`：**零改动**。
- `ops.ts` / `mechanic.ts` / `api.ts` / Runtime / Pipeline / CLI / MCP：**零改动**。
- 无新依赖、无 JSON fixture、无公共 barrel 导出、无新公共 Contract。

## 组装语义

1. **模型适用性**：只接受单个、X 轴、`cycle` 三角波 Hazard；Y 轴 / 多移动 Hazard / Moving Platform / Danger `strike` 联合 ⇒ IE `model-out`；Hazard 资源或几何不可解 ⇒ IE `geometry-untrusted`。
2. **预算**：先用 `maxBranching = 2` 的临时预算解析状态格（只消费 `maxStates`），拿到网格后按 D5 `deriveMaxBranching` 重算并解析最终预算；非法 / 溢出 ⇒ IE `invalid-budget` / `budget-bound-overflow`，不回退默认值继续。
3. **NB**：`∀φ0` Winning Set（D10 §2）完整 ⇒ `encodeWitness` 成功 ⇒ `nb-candidate` + `witness/COMPLETE`。U9 不参与组装：I-02 的 `coverage.temporal` 恒 `partial`，D10 §1.1 的 `checked` 前置不成立。
4. **PU**：U3 门区半部 ⇒ 原始 `gateRect` 注入 `buildMovementGraph` ⇒ U4 图割半部。门区 + 图割 + hop 全部完整 ⇒ `pu-candidate` + `permanent-gate/COMPLETE`；门区完整而图割不完整 ⇒ `permanent-gate/INCOMPLETE` + 部分证明。
5. **互斥保护**：W 搜索已完整但 Witness 编码失败时，直接 IE，不再去主张 PU（避免假 PU）；NB 预算耗尽不阻止独立的 PU 分支。
6. **六条件**：`gate-coverage` / `graph-cut` / `hop-doubling` / `lag-consistent` 在对应证明完整时 `PASS`（带 `evidence`）；`geometry-checked` / `model-out-excluded` 恒 `BLOCKED`（带 `blockedReason`）。
7. **输出边界**：`modelConditional: true`、`publicCapability: "BLOCKED"`、`publicResult: null` 恒成立；`nb-candidate` / `pu-candidate` 不写成公共 Verdict。

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal.test.ts` | **0** | **9 / 9 passed** |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | **0** | **65 / 65 passed**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| `pnpm test` | **0** | **176 files / 2840 tests passed**；2 条 `onTaskUpdate` RPC 超时（工具层，非断言失败） |

原始输出：`02-{build,typecheck,architecture,test}.log`（本地保留，不入库）。

| 日志 | sha256 |
| --- | --- |
| `02-test.log` | `84896ac9c1838f207be6b41268c4cf45f80537e00213a250511db2b44f0e8ec5` |
| `02-build.log` | `56bab5942534d7e2ea729546691b45618e8f8523584c38ba466b9f19266bd208` |
| `02-typecheck.log` | `8d15ba2e817b7a37795bb98277de33cbbfeacba04d90fafd1c6f854dea885c3a` |
| `02-architecture.log` | `1a62458ed37f3e477465bc17a9db05ebd93bd45e8c8acfcaa0004d57defbdeaf` |

## 测试清单

| # | 测试 | 断言 |
| --- | --- | --- |
| 1 | `[I02-05][AC-13]` 顶层字段固定为 D9 七项 | 顶层 7 键、stats 5 键；`publicCapability` / `publicResult` 边界 |
| 2 | `[I02-05][AC-11]` 模型外输入 | Y 轴 / 多移动 Hazard ⇒ IE `model-out` |
| 3 | `[I02-01][AC-03]` W 成立 | `nb-candidate` + `witness/COMPLETE`；policy 只引用 `verified=1`；`volume` 与 `stats.work` 一致 |
| 4 | `[I02-04][AC-05/06/07]` PU 完整 | `pu-candidate`；六条件 1/3/4/6 `PASS`、2/5 `BLOCKED`；`geometryCoverage` 三份 `partial` |
| 5 | `[I02-04][AC-06]` 图割不成立 | `permanent-gate/INCOMPLETE` + `graph-cut-incomplete`；条件 1 `PASS`、3 `INSUFFICIENT_EVIDENCE` |
| 6 | `[I02-03][AC-05]` 门区不成立 | IE + `no-permanent-gate`；`certificate.kind = "none"` |
| 7 | `[I02-05][AC-08]` edge 预算触顶 | IE + `exhausted` + `edge-budget` + `edge-budget-exhausted` |
| 8 | `[I02-05][AC-10]` 重复运行 | 四个世界的签名与规范化完整序列化均一致 |
| 9 | `[I02-05][AC-10]` 墙钟隔离 | `wallClockMs` 不同但签名一致 |

## 已知缺口（必须在 U5-04 前裁定）

**F（短暂安全窗口）/ 门区半部 INCOMPLETE 的证书形状存在跨单元张力。**

- D9 `PermanentGateProof` 要求 `gate` / `periodCoverage` / `sideRule` / `forbiddenInjection` 全部存在，且 `periodCoverage.complete` 是字面量 `true`。
- U3 `computePermanentGate` 在门宽 `≤ ε`、y 区间不重叠、判侧失败或注入失败时把四个半部全部置 `null`，不保留部分几何。
- 因此门区不成立时，组装层**无法如实**构造 `permanent-gate + INCOMPLETE` 证明；当前实现选择 `certificate.kind = "none"` + IE `no-permanent-gate`（D9 §10.5 允许 `none ⇒ IE`），没有伪造门区字段。
- 这与 U5-04 票面对 F 的字面要求（`permanent-gate` + `INCOMPLETE` + `no-permanent-gate`）不一致，也与 D7 §305「E/F/G 不得压扁成 `none`」不一致。
- **后续裁定（2026-11-13）**：用户选择方案 ③，F 允许 `certificate.kind = "none"`；见 [增量裁定 08](../../level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md)。以下为当时的待裁定选项，已由该记录收口。
- 可选的封闭方式（均需 HITL，不在 U5-01 授权内）：
  1. 修改 `temporal-gate.ts`，在 INCOMPLETE 时保留可如实记录的候选几何 / 子检查状态；
  2. 放宽 D9 `PermanentGateProof` 的必填 / `complete: true` 约束；
  3. 由用户裁定 F 允许 `certificate.kind = "none"`。

**其他限制**：

- U4 的 hop / 图割工作计数未接入 `stats.work.hopSamplesChecked`（U4 未暴露计数器）；U5-02 预算硬化时补齐。
- PU 分支目前不消费工作预算；U5-02 负责把 U4 纳入统一预算与触发顺序。
- `trustedInput` 不参与组装；品牌校验由 I-01 公共入口完成，I-03 接线时必须继续在入口校验。

## 结论

`analyzeTemporalInternal` 可产出 D9 完整内部结果；NB / PU / G / 门区失败 / 预算耗尽路径均有测试；六条件与不变量通过；生产接线零改动；全量 176 files / 2840 tests 绿。F 的证书形状缺口已显式登记，等待 U5-04 前的 HITL 裁定。
