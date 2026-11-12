# I-02 增量授权记录 03 — U2 实施与 R2 复核门

| 项 | 值 |
| --- | --- |
| 记录类型 | 增量实施授权（**独立记录**；不修改已签署授权包正文） |
| 签署人 | **amber** |
| 日期 | **2026-11-12** |
| 指令原文 | 「授权 U2 及其复核门」 |
| 授权依据 | **R1 PASS**（2026-11-12），报告 [`R1-review.md`](./R1-review.md) |
| 授权范围 | **仅 U2 实施 + R2 复核门**（I02-02：安全通过 Witness） |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| 执行 effort | `.scratch/level-playability-v1.1-u2/`（分支 `wayfinder/level-playability-v1.1-u2`，base `23a2027`） |
| 结论 | U2 `AUTHORIZED`（限实施 + R2）；U3–U5、`PUBLIC_NB` / `PUBLIC_PU`、I-03 接线仍**未授权** |

> 本记录是授权台账的**增量条目**，不是新的授权包，也不改写任何已签署文本。
> `docs/v7.8/移动-I02.md` 的原文 SHA `797cd6fc…` **保持逐字符不变**；本记录不修改该文件。

## 1. 授权范围（逐项）

| # | 授权项 | 状态 | 边界 |
| --- | --- | --- | --- |
| A1 | U2 实施（I02-02 安全通过 Witness） | **AUTHORIZED** | 仅授权包 §5.2 列出的 U2 白名单文件；语义按授权包 §3.5 / §6.2 / §9.2 与 D3 / D10 冻结 |
| A2 | R2 复核门 | **AUTHORIZED** | 独立复核会话；报告落 `.scratch/level-playability-v1.1-i02/reports/R2-review.md`；逐项 `PASS` / `FAIL` / `NOT_RUN` |
| A3 | U2 定向测试与全量回归 | **AUTHORIZED** | 仍受 §5.2 / §5.3 文件边界约束 |

U2 可写文件（与授权包 §5.2 逐文件一致，**不得扩张**）：

| 文件 | 性质 |
| --- | --- |
| `packages/contracts/src/playability/temporal-witness.ts` | 新增（U2） |
| `packages/contracts/tests/playability-temporal-witness.test.ts` | 新增（U2 / R2） |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | 既有 `TEST_ONLY` helper，可扩展 |

只读引用（允许 import，不得修改）：`graph.ts`、`reach.ts`、`targets.ts`、`profile.ts`、`game-config.ts`、`temporal-motion.ts`、`temporal-budget.ts`、`temporal-result.ts`、`geometry.ts`。

## 2. 明确不放行（NOT AUTHORIZED）

| # | 未授权项 | 说明 |
| --- | --- | --- |
| N1 | **U3–U5** | 门区证明、垂直规避图割、预算硬化 / 性能基准 / 最终集成均未授权；`PLANNED` / `BLOCKED` 状态不变 |
| N2 | **`PUBLIC_NB` / `PUBLIC_PU`** | 仍为 `BLOCKED`；U2 完成不等于公共 NB / PU 能力 |
| N3 | **I-03 接线** | `coverage.temporal`、`mechanic.ts` / `api.ts` 接线、公共 Verdict 聚合均不授权 |
| N4 | **`analyzeTemporalInternal` / `temporal.ts` 修改** | U2 不实现内部入口、不改 `temporal.ts`；测试直接调用 witness 模块 |
| N5 | **`temporal-budget.ts` / `temporal-result.ts` 修改** | 只读引用；预算如需扩 `BudgetProfile` 或 D9 闭集 ⇒ STOP + HITL |
| N6 | **`graph.ts` 尾参** | U4 独立审批项，不在 U2 |
| N7 | **白名单外任何文件** | 含 Pipeline / Runtime / CLI / MCP / 公共 Contract / `packages/demo/**` / `fixtures/packs/**` / 新依赖 / 新增 JSON fixture / 公共 barrel 导出 |
| N8 | **推送、创建 PR、合并、i02 → main** | 需另行明确指令 |

## 3. 记录性声明

1. **授权包原文 SHA 不变**：`docs/v7.8/移动-I02.md` = `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（本记录创建时现场复算，逐字符相同）。
2. **本记录不修改授权包**：增量授权只写入本独立记录；不触碰已签署正文、其 §15.2 首次签署范围表与其台账原文。
3. **R2 PASS 不等于 U3 授权**：R2 通过仅表示 U2 完成。U3 需 **R2 PASS + 另行增量签署**；不得由 R2 结论推导 U3 授权。
4. **R2 PASS 不等于 U2 签署**：R2 之后仍需用户审阅并签署 U2（U2-SIGN），地图方可收口。
5. **本记录不替代 R2**：授权 ≠ 验收；R2 复核会话必须与实现会话隔离，不得读取作者总结 / PASS 结论 / 调试笔记。
6. **越界即停**：任何新增文件、白名单外修改、扩 D9 闭集、架构断言（T-55 / T-57 / T-58 / T-61 / T-62 / T-64）失败 ⇒ STOP + HITL，不得由执行票自行扩权。

## 4. 授权台账增量

| 单元 / 能力 | 增量前 | 增量后 | 条件 |
| --- | --- | --- | --- |
| U1 安全通过 Witness 前置（I02-01） | `AUTHORIZED`（首次签署） | `AUTHORIZED` | 首次签署；R1 PASS |
| **U2 安全通过 Witness（I02-02）** | `PLANNED` | **`AUTHORIZED`（限实施 + R2）** | 本记录；依据 R1 PASS 2026-11-12 |
| U3 门区（I02-03） | `PLANNED` | `PLANNED`（未变） | 需 R2 PASS + 另行增量签署 |
| U4 图割（I02-04） | `BLOCKED` | `BLOCKED`（未变） | 需 `graph.ts` 独立审批 + R4 |
| U5 硬化 / 集成（I02-05） | `PLANNED` | `PLANNED`（未变） | 未授权 |
| `PUBLIC_NB` / `PUBLIC_PU` | `BLOCKED` | `BLOCKED`（未变） | 未授权 |

## 5. 生效与失效

- 生效：本记录提交之时（2026-11-12）。
- 失效：U2 签署完成后本增量条目即耗尽；R2 `FAIL` 时 U2 退回实施，不得进入任何后续单元。
- 本记录不产生任何后续单元的隐含授权。
