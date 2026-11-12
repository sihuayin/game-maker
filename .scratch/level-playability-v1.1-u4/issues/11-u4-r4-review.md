# U4-R4 独立复核

Type: task
Status: open
Owner: —
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
