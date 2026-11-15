# I-02 增量授权记录 07 — U5 实施与最终完成验收

| 项 | 值 |
| --- | --- |
| 记录类型 | 增量实施授权（**独立记录**；不修改已签署授权包正文） |
| 签署人 | **amber** |
| 日期 | **2026-11-13** |
| 指令原文 | 「开 U5 地图」（用户 2026-11-13 经确认选项选择） |
| 授权依据 | **R4 PASS** + **U4-SIGN**（2026-11-13），报告 [`R4-review.md`](./R4-review.md) |
| 授权范围 | **仅 U5 实施（I02-05：预算 / 确定性硬化、A–J 矩阵、性能证据、最终集成与完成报告）+ AC-08～AC-13 验收 + 用户签署**；**不设 R5** |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| 执行 effort | `.scratch/level-playability-v1.1-u5/`（分支 `wayfinder/level-playability-v1.1-u5`，base `wayfinder/level-playability-v1.1-i02` @ `b41f076`） |
| 结论 | U5 **AUTHORIZED（限实施 + AC-08～AC-13 验收 + 用户签署）**；**`PUBLIC_NB` / `PUBLIC_PU`、I-03 接线、推送 / PR / 合并仍 `BLOCKED`** |

> 本记录是授权台账的**增量条目**，不是新的授权包，也不改写任何已签署文本。
> `docs/v7.8/移动-I02.md` 的原文 SHA `797cd6fc…` **保持逐字符不变**；本记录不修改该文件。
> U5 的授权来自本用户指令，**不是** R4 PASS 的自动推导；授权包 §7.3 的两项条件（R4 PASS + 独立增量签署）均已满足。
> 授权包 §9.5 明确：U5 由完成报告 + AC-08～AC-13 验收，**不另设 R5**。

## 1. 授权范围（逐项）

| # | 授权项 | 状态 | 边界 |
| --- | --- | --- | --- |
| A1 | U5 实施（I02-05 预算 / 确定性硬化与集成） | **AUTHORIZED** | 仅授权包 §5.2 列出的既有 U5 白名单文件；语义按 §3.8 / §4 / §6 / §8 与 D5 / D5B / D7 / D9 / D10 冻结 |
| A2 | A–J 矩阵与跨单元组合测试 | **AUTHORIZED** | 新建 `playability-temporal.test.ts`；标题带 `[I02-0x][AC-xx]`；不得改既有单元测试断言 |
| A3 | 性能证据 | **AUTHORIZED（仅证据）** | `.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs`（路径冻结）；只作 E3 证据，**不作 CI 门禁** |
| A4 | AC-08～AC-13 最终验收 + 用户签署 | **AUTHORIZED** | 完成报告 `reports/U5-completion.md` + 最终审计 `reports/U5-final-audit.md`（独立会话）+ 用户签署；**无 R5** |
| A5 | LP-06 / LP-07 acceptance 复跑与冻结基线比较 | **AUTHORIZED（只读回归）** | 两个既有脚本原样运行；不得改造 / 包装成 I-02 测试；差异必须分析登记 |

U5 可写文件（授权包 §5.2 白名单 + 授权包 §8.7 冻结路径的性能证据脚本；**不得扩张**）：

| 文件 | 性质 |
| --- | --- |
| `packages/contracts/src/playability/temporal.ts` | 既有（U1 建立）；U5 内部入口 + 组装 + 最小编排 |
| `packages/contracts/src/playability/temporal-result.ts` | 既有；仅类型缺口 |
| `packages/contracts/src/playability/temporal-budget.ts` | 既有；仅缺口 |
| `packages/contracts/src/playability/temporal-motion.ts` | 既有；仅缺口 |
| `packages/contracts/src/playability/temporal-witness.ts` | 既有；仅缺口 |
| `packages/contracts/src/playability/temporal-gate.ts` | 既有；仅缺口 |
| `packages/contracts/src/playability/temporal-evasion.ts` | 既有；仅缺口 |
| `packages/contracts/tests/playability-temporal.test.ts` | **新建**（A–J 矩阵） |
| `packages/contracts/tests/playability-temporal-budget.test.ts` | 既有；U5 硬化扩展 |
| `packages/contracts/tests/playability-temporal*.test.ts` | 既有；仅缺口 |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | 既有 `TEST_ONLY` helper，可扩展 |
| `.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs` | **新建**（性能证据，路径冻结） |

只读引用（允许 import，不得修改）：`graph.ts`、`reach.ts`、`profile.ts`、`targets.ts`、`game-config.ts`、`geometry.ts`、`spatial.ts`、`completion.ts`。

**生产接线零改动**：`ops.ts`、`mechanic.ts`、`api.ts`、Runtime / Pipeline / CLI / MCP 不改；T-57 / T-58 / T-61 原样通过。

## 2. 明确不放行（NOT AUTHORIZED）

| # | 未授权项 | 说明 |
| --- | --- | --- |
| N1 | **`PUBLIC_NB` / `PUBLIC_PU`** | 仍为 `BLOCKED`；`publicCapability` 恒 `"BLOCKED"`、`publicResult` 恒 `null`；I-03 独立准入 |
| N2 | **I-03 接线** | `coverage.temporal`、`mechanic.ts` / `api.ts` 接线、公共 Verdict 聚合 |
| N3 | **新依赖 / JSON fixture / `fixtures/packs/**` / 新公共导出 / 公共 Contract / barrel** | 一律不授权 |
| N4 | **扩 `BudgetProfile` / `DegradationReason` 闭集** | 需要即 STOP + HITL，不得由票自行扩权 |
| N5 | **按关卡配置预算** | 不授权 |
| N6 | **修改已签署授权包 / I-00 / I-02 原文** | SHA `797cd6fc…` 必须保持不变 |
| N7 | **`graph.ts` / `reach.ts` 等只读文件修改** | 只读；不得参数化或改写既有语义 |
| N8 | **删除 / 放宽 T-55 / T-57 / T-58 / T-61 / T-62 / T-64** | 架构断言必须原样通过 |
| N9 | **把 `nb-candidate` / `pu-candidate` 写成公共 Verdict** | 输出边界冻结于内部结果 |
| N10 | **R5 门** | 授权包 §9.5 明确不设 |
| N11 | **推送、创建 PR、合并、i02 → main** | 需另行明确指令；U5-08 只准备 Draft PR 描述 |

## 3. 完成与验收协议（冻结）

1. **唯一权威完成报告**：`.scratch/level-playability-v1.1-i02/reports/U5-completion.md`；必须覆盖授权包 §9.5：已证明结论 vs 仍为 `INSUFFICIENT_EVIDENCE` 的结论、预算 / 确定性 / 性能证据、未覆盖项。
2. **唯一权威最终审计**：`.scratch/level-playability-v1.1-i02/reports/U5-final-audit.md`；由**未参与 U5 实现**的独立会话执行；**不是 R5 门**，不授权任何后续能力。
3. **AC-08～AC-13 逐项** `PASS / FAIL / NOT_RUN`；不得用总通过率替代；未运行项不得因其他测试通过而推定通过。
   - AC-08 预算；AC-09 双档 lag；AC-10 确定性；
   - AC-11 模型外 `INSUFFICIENT_EVIDENCE`；
   - AC-12 范围与白名单审计（E1 `git diff`）；
   - AC-13 核心测试 + LP-06/07 回归 + 性能证据完整性（E2 + E3）。
4. 最终审计必须自己重跑命令并记录退出码：`pnpm build`、`pnpm typecheck`、`pnpm test`、两个 acceptance 脚本、bench 脚本；独立验证至少 2 条关键断言。
5. 每项证据记录：测试名 / 命令 / 退出码 / 原始输出摘要或 hash / 对应 AC / 复核门；E1 / E2 / E3 口径照用。
6. 由用户签署 U5 后地图方可收口；签署**不**授权 `PUBLIC_NB` / `PUBLIC_PU`、I-03、推送 / PR / 合并。

## 4. 记录性声明

1. **授权包原文 SHA 不变**：`docs/v7.8/移动-I02.md` = `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（本记录创建时现场复算，逐字符相同）。
2. **本记录不修改授权包**：增量授权只写入本独立记录；不触碰已签署正文、其 §15.2 首次签署范围表与其台账原文。
3. **U5 授权不是 R4 的自动推论**：本条授权来自用户 2026-11-13 明示指令；R4 PASS 与 U4-SIGN 仅是授权包要求的前置条件。
4. **U5 完成 ≠ 公共能力**：`PUBLIC_NB` / `PUBLIC_PU` 仍为 `BLOCKED`，公共能力由 I-03 独立准入。
5. **不设 R5**：U5 的最终验收由完成报告 + AC-08～AC-13 + 最终审计 + 用户签署承担；最终审计不是复核门，不得被解释为后续单元授权。
6. **审计独立性**：U5-AUDIT 会话必须未参与 U5 实现；实现会话不得自审。
7. **越界即停**：任何新增产品文件、白名单外修改、新依赖 / JSON fixture、扩 `BudgetProfile` / `DegradationReason`、修改 `graph.ts` / `reach.ts` 等只读文件、架构断言失败、修改已签署授权包 ⇒ STOP + HITL，不得由执行票自行扩权。

## 5. 授权台账增量

| 单元 / 能力 | 增量前 | 增量后 | 条件 |
| --- | --- | --- | --- |
| U4 图割（I02-04） | `AUTHORIZED`（限实施 + R4） | **已完成（R4 PASS + U4-SIGN）** | 2026-11-13 |
| **U5 硬化 / 集成（I02-05）** | `PLANNED` | **`AUTHORIZED`（限实施 + AC-08～AC-13 + 用户签署）** | 本记录；无 R5；不发布公共能力 |
| `PUBLIC_NB` / `PUBLIC_PU` | `BLOCKED` | `BLOCKED`（未变） | I-03 独立准入 |
| I-03 接线 | 未授权 | 未授权（未变） | 需独立授权 |

## 6. 生效与失效

- 生效：本记录提交之时（2026-11-13）。
- 执行门：**无额外前置**；U5-00 完成后 U5-01 可开始实施。
- 失效：U5 用户签署完成后本增量条目即耗尽；最终审计 `FAIL` 时 U5 退回实施，不得进入任何后续单元。
- 本记录不产生任何后续单元（I-03 / 公共能力 / 新 effort）的隐含授权。
