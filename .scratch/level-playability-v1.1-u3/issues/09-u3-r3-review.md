# U3-R3 独立复核

Type: task
Status: open
Owner: —
Blocked by: 08
Map: ../map.md
Class: U3 / REVIEW

## Task

由**未参与 U3 实现的独立会话**对 U3 做 R3 复核。复核人只获得：白名单、验收表、证据路径、测试命令与必要原始输入；**不得**读实现会话的作者总结、PASS 结论或调试笔记。

### 必须完成

1. 独立检查 diff：产品路径只有 `temporal-gate.ts`、`playability-temporal-gate.test.ts`、`playability-temporal-fixtures.ts`；`temporal.ts` / `graph.ts` / `reach.ts` / `docs/` 零 diff；无新依赖、无 JSON fixture、无公共导出。
2. 独立重跑命令并记录退出码：
   ```bash
   pnpm build
   pnpm typecheck
   pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts
   pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts
   pnpm test
   ```
3. 按 R3 验收表逐项判定 `PASS / FAIL / NOT_RUN`：
   - 门区闭式：`L/R` 公式、`w−d>ε`、全周期交集、无 pad；
   - 全相位覆盖：`∀φ0` 交集；不得用幸运相位或整段扫掠区；
   - 侧规则：左→右 / 右→左的 spawn 与 `goalRegion` 条件；`goalRegion` 外扩 `0.5px`；
   - `forbiddenInjection`：原样注入、只扩张一次、不进 `blocked`、门顶不是地板；
   - 反例：D4 §11 的 1–4、6、13 全覆盖；
   - 输出边界：U3 未生成 / 伪造 `graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure` / 完整 `PermanentGateProof` / 完整 `TemporalInternalResult`；
   - 范围：未实现 U4 / U5、未修改 `temporal.ts` / `graph.ts` / `reach.ts`。
4. 独立验证至少 2 条关键反例与 1 条边界值（自选并记录理由）。
5. 写 `.scratch/level-playability-v1.1-i02/reports/R3-review.md`：逐项结论、命令与退出码、证据摘要 / hash、未覆盖项、限制、独立签署。不得用总通过率替代逐项结果。
6. 复核结论只写 `PASS / FAIL / NOT_RUN`；不修改产品代码；不推送 / 不建 PR / 不合并。

### 禁止

- 读作者总结 / PASS 结论 / 调试笔记；
- 替作者修代码；
- 修改白名单外文件；
- 把 R3 结论扩展为 U4 授权。

### 验收

R3 报告完整；所有 R3 项均有结论；命令有退出码；证据有 hash；未覆盖项显式列出；复核会话独立。

## Answer

（resolved 时填写）
