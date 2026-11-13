# U4-R4 独立复核

Type: task
Status: resolved
Owner: independent reviewer subagent (fresh context) / driven by claude, 2026-11-13
Blocked by: 10
Map: ../map.md
Class: U4 / REVIEW

## Task

由**未参与 U4 实现的独立会话**对 U4 做 R4 复核。复核人只获得：白名单、验收表、证据路径、测试命令与必要原始输入；**不得**读实现会话的作者总结、PASS 结论或调试笔记。

### 必须完成

1. 独立检查 diff：U4 产品路径只有 `temporal-evasion.ts`、`playability-temporal-evasion.test.ts`、`playability-temporal-fixtures.ts`；`graph.ts` 变更**只有**已独立审批并合并的 `HopSampling` 尾参；`temporal.ts` / `reach.ts` / `docs/` / `fixtures/` 零 diff；无新依赖、无 JSON fixture、无公共导出。
2. 独立重跑命令并记录退出码：
   ```bash
   pnpm build
   pnpm typecheck
   pnpm exec vitest run packages/contracts/tests/playability-temporal-evasion.test.ts
   pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts
   pnpm exec vitest run packages/contracts/tests/playability-graph.test.ts
   pnpm test
   ```
3. 按 R4 验收表逐项判定 `PASS / FAIL / NOT_RUN`：
   - 图割判据：无可达落脚点 / hop 弧采样盒覆盖 `goalRegion`；精确 spawn；`midAirHits = 0` 只作否决；
   - hop 双档：60 / 120Hz 分别记录 `n` / 端点 / cap；规范化采样覆盖 `F1 ⊆ F2`；不要求 `n` 精确 2×；
   - 反例：D4 §11 的 5、7–12 全覆盖；
   - 模型闭合：`movementModelClosure = "not-proven-air-control"`；公共 PU 仍 `BLOCKED`；
   - `graph.ts`：只有经独立审批的 `HopSampling` 尾参；默认行为回归通过；
   - 输出边界：U4 未生成 / 伪造 `puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` / 完整 `PermanentGateProof` / `TemporalInternalResult` / 公共 Verdict；
   - 范围：未实现 U5、未修改 `temporal.ts` / `reach.ts`。
4. 独立验证至少 2 条关键反例与 1 条边界值（自选并记录理由）。
5. 写 `.scratch/level-playability-v1.1-i02/reports/R4-review.md`：逐项结论、命令与退出码、证据摘要 / hash、未覆盖项、限制、独立签署。不得用总通过率替代逐项结果。
6. 复核结论只写 `PASS / FAIL / NOT_RUN`；不修改产品代码；不推送 / 不建 PR / 不合并。

### 禁止

- 读作者总结 / PASS 结论 / 调试笔记；
- 替作者修代码；
- 修改白名单外文件；
- 把 R4 结论扩展为 U5 授权或公共能力。

### 验收

R4 报告完整；所有 R4 项均有结论；命令有退出码；证据有 hash；未覆盖项显式列出；复核会话独立。

## Answer

（resolved 时填写）

## Answer

**完成。R4 结论：PASS。** 报告：[`.scratch/level-playability-v1.1-i02/reports/R4-review.md`](../../level-playability-v1.1-i02/reports/R4-review.md)。

复核由**未参与 U4 实现的 fresh-context 复核子代理**执行，独立签署于报告 §9；驱动会话未代填其判断。

| 项 | 结论 |
| --- | --- |
| R4-01 图割判据 | **PASS** |
| R4-02 hop 双档（60/120Hz，独立完整跑，`F1 ⊆ F2`） | **PASS** |
| R4-03 D4 §11 反例 5、7–12（1–4/6/13 不回归） | **PASS** |
| R4-04 模型闭合（`not-proven-air-control`，公共 PU 仍 BLOCKED） | **PASS** |
| R4-05 `graph.ts`（仅已审批 `HopSampling` 尾参） | **PASS** |
| R4-06 输出边界 | **PASS** |
| R4-07 范围（无 U5、`temporal.ts` / `reach.ts` 零 diff） | **PASS** |
| R4-08 独立验证（≥2 反例 + 1 边界） | **PASS** |

- 无 `FAIL`、无 `NOT_RUN`。
- 命令（复核人现场重跑）：build / typecheck / evasion 36 / gate 48 / graph 11 / input 65 / `pnpm test` 175 files · 2831 tests，**退出码均 0**。
- 独立验证：反例 10 的 `F1 ⊆ F2` 与全整数子集规则 0 处不一致；反例 9 用禁区 `(4,17)` 证明两档是独立完整 BFS；cap 严格 `>` 边界（120/240 不绑定、121/241 绑定）。
- 复核人记录的限制：`goalRegion` 外扩 0.5px 是调用方前置（U5 组装需强制）；`HopSampleSummary.n` 为跨弧最大值而非逐弧；`connectivityPreserved` 只比较目标可达布尔。
- 文件 hash 与授权包 SHA-256 均现场复算匹配。

**下游**：U4-SIGN（用户签署 R4）已 unblocked，**只能由用户 `amber` 完成**；本会话不代签。R4 PASS **不**授权 U5、`PUBLIC_NB` / `PUBLIC_PU`、I-03 接线、推送 / 建 PR / 合并。

**隔离说明**：复核人未读取 `09-implementation.md`、`09-draft-pr.md`、u4 地图及本票外的 U4 票，未以 evidence 作为结论依据；驱动会话在派发前已加载作者材料，故未自行担任复核人。
