# I-02 增量授权记录 05 — U4 实施与 R4 复核门

| 项 | 值 |
| --- | --- |
| 记录类型 | 增量实施授权（**独立记录**；不修改已签署授权包正文） |
| 签署人 | **amber** |
| 日期 | **2026-11-12** |
| 指令原文 | 「授权 U4 并开图」（用户 2026-11-12 经确认对话框选择） |
| 授权依据 | **R3 PASS** + **U3-SIGN**（2026-11-12），报告 [`R3-review.md`](./R3-review.md) |
| 授权范围 | **仅 U4 实施 + R4 复核门 + `graph.ts` `HopSampling` 独立审批前置**（I02-04：垂直规避图割） |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| 执行 effort | `.scratch/level-playability-v1.1-u4/`（分支 `wayfinder/level-playability-v1.1-u4`，base `wayfinder/level-playability-v1.1-u3` @ `1405c3f`） |
| 结论 | U4 **AUTHORIZED（限实施 + R4）**；但 **`graph.ts` 独立审批并合并前，U4 执行门保持 `BLOCKED`**；U5、`PUBLIC_NB` / `PUBLIC_PU`、I-03 接线仍**未授权** |

> 本记录是授权台账的**增量条目**，不是新的授权包，也不改写任何已签署文本。
> `docs/v7.8/移动-I02.md` 的原文 SHA `797cd6fc…` **保持逐字符不变**；本记录不修改该文件。
> U4 的授权来自本用户指令，**不是** R3 PASS 的自动推导；授权包 §7.3 的三项条件中，R3 PASS 与独立增量签署已满足，`graph.ts` 独立审批尚待 U4-01。

## 1. 授权范围（逐项）

| # | 授权项 | 状态 | 边界 |
| --- | --- | --- | --- |
| A1 | U4 实施（I02-04 垂直规避图割） | **AUTHORIZED** | 仅授权包 §5.2 列出的 U4 白名单文件；语义按 §3.7 / §7.2 / §9.4 与 D4 §4–§7 冻结 |
| A2 | R4 复核门 | **AUTHORIZED** | 独立复核会话；报告落 `.scratch/level-playability-v1.1-i02/reports/R4-review.md`；逐项 `PASS` / `FAIL` / `NOT_RUN` |
| A3 | `graph.ts` `HopSampling` 独立审批前置 | **AUTHORIZED（仅审批流程）** | 仅允许 `hopSamples` / `hopEdges` / `hopTargets` 可选尾参；审批记录落 `06-u4-graph-approval.md`；未批准并合并前 U4 不得开始实施 |
| A4 | U4 定向测试与全量回归 | **AUTHORIZED** | 仍受 §5.2 / §5.3 文件边界约束 |

U4 可写文件（与授权包 §5.2 逐文件一致，**不得扩张**）：

| 文件 | 性质 |
| --- | --- |
| `packages/contracts/src/playability/temporal-evasion.ts` | 新增（U4） |
| `packages/contracts/tests/playability-temporal-evasion.test.ts` | 新增（U4 / R4） |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | 既有 `TEST_ONLY` helper，可扩展 |
| `packages/contracts/src/playability/graph.ts` | **仅** `HopSampling` 可选尾参；独立审批 + 独立 PR 合并后 |

只读引用（允许 import，不得修改）：`reach.ts`、`temporal-motion.ts`、`temporal-budget.ts`、`temporal-result.ts`、`geometry.ts`、`profile.ts`、`targets.ts`、`game-config.ts`。

**`temporal.ts` 默认零改动**；任何修改（含最小编排 / dispatch）⇒ STOP + HITL。**`reach.ts` 零改动**，mid-air 保持 60Hz，不参与 hop 双档参数化。

## 2. 明确不放行（NOT AUTHORIZED）

| # | 未授权项 | 说明 |
| --- | --- | --- |
| N1 | **U5** | 预算 / 确定性硬化、A–J 矩阵、性能基准、最终集成与完成报告 |
| N2 | **`PUBLIC_NB` / `PUBLIC_PU`** | 仍为 `BLOCKED`；移动模型未闭合，生产 PU 不授权 |
| N3 | **I-03 接线** | `coverage.temporal`、`mechanic.ts` / `api.ts` 接线、公共 Verdict 聚合 |
| N4 | **`puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction`** | U5 组装；U4 不得生成或伪造 |
| N5 | **完整 `PermanentGateProof` / `TemporalInternalResult` / `certificate`** | U4 只产出图割半部 |
| N6 | **`temporal.ts` 修改** | 默认零改动；含 `analyzeTemporalInternal` 与内部派发 |
| N7 | **`reach.ts` 修改或参数化** | 只读；含把 mid-air 检查改成双档 |
| N8 | **`graph.ts` 审批面之外的修改** | 不得改跳跃公式、既有采样语义、其他导出或调用语义 |
| N9 | **白名单外任何文件** | 含 Pipeline / Runtime / CLI / MCP / 公共 Contract / barrel 导出 / `fixtures/packs/**` / 新依赖 / 新增 JSON fixture |
| N10 | **扩 D9 `DegradationReason` 闭集 / `BudgetProfile`** | 需要即 STOP + HITL |
| N11 | **推送、创建 PR、合并、i02 → main** | 唯一例外：U4-03 的 `graph.ts` 尾参独立 PR，且仅在收到用户明确指令后执行 |

## 3. `graph.ts` 独立审批（冻结状态）

1. 仅允许 `hopSamples` / `hopEdges` / `hopTargets` 新增可选尾参 `HopSampling = { hz?: number; maxSamples?: number }`。
2. 默认参数固定为 `{ hz: 60, maxSamples: 120 }`。
3. 不得修改 `reach.ts`、跳跃公式、既有采样语义、其他导出或调用语义。
4. 必须有回归测试证明显式传入默认参数与无参调用行为一致；可序列化场景验证稳定序列化结果一致。
5. 该审批独立于 I-00 R2；不得以「已列入白名单」或「U4 已授权」推定获批。
6. **未获批准并合并前，U4 实施保持 `BLOCKED`**；不得用临时改动、测试专用实现、复制实现或其他路径绕过。
7. 变更走独立分支、独立 PR：先审批、合并，再由 U4 PR 引用（授权包 §7.2）。

## 4. 记录性声明

1. **授权包原文 SHA 不变**：`docs/v7.8/移动-I02.md` = `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（本记录创建时现场复算，逐字符相同）。
2. **本记录不修改授权包**：增量授权只写入本独立记录；不触碰已签署正文、其 §15.2 首次签署范围表与其台账原文。
3. **U4 授权不是 R3 的自动推论**：本条授权来自用户 2026-11-12 明示指令；R3 PASS 仅是授权包要求的前置条件之一。
4. **R4 PASS 不等于 U5 授权**：R4 通过只允许**申请** U5 的增量授权；`PUBLIC_NB` / `PUBLIC_PU` 仍由 I-03 独立准入。
5. **R4 PASS 不等于 U4 签署**：R4 之后仍需用户审阅并签署 U4（U4-SIGN），地图方可收口。
6. **本记录不替代 R4**：授权 ≠ 验收；R4 复核会话必须与实现会话隔离。
7. **越界即停**：任何新增文件、白名单外修改、扩 D9 闭集、修改 `reach.ts` / `temporal.ts`、架构断言（T-55 / T-57 / T-58 / T-61 / T-62 / T-64）失败 ⇒ STOP + HITL，不得由执行票自行扩权。

## 5. 授权台账增量

| 单元 / 能力 | 增量前 | 增量后 | 条件 |
| --- | --- | --- | --- |
| U3 门区（I02-03） | `AUTHORIZED`（限实施 + R3） | **已完成（R3 PASS + U3-SIGN）** | 2026-11-12 |
| **U4 图割（I02-04）** | `BLOCKED` | **`AUTHORIZED`（限实施 + R4）；执行门仍 `BLOCKED`** | 本记录；待 `graph.ts` 独立审批并合并 |
| U5 硬化 / 集成（I02-05） | `PLANNED` | `PLANNED`（未变） | 需 R4 PASS + 另行增量签署 |
| `PUBLIC_NB` / `PUBLIC_PU` | `BLOCKED` | `BLOCKED`（未变） | 未授权 |

## 6. 生效与失效

- 生效：本记录提交之时（2026-11-12）。
- 执行门解除条件：U4-01 `graph.ts` 独立审批**批准** + U4-03 独立 PR **合并**。
- 失效：U4 签署完成后本增量条目即耗尽；R4 `FAIL` 时 U4 退回实施，不得进入任何后续单元。
- 本记录不产生任何后续单元的隐含授权。
