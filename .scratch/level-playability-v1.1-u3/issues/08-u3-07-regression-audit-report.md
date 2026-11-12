# U3-07 回归 / 白名单审计 / 实现报告

Type: task
Status: open
Owner: —
Blocked by: 07
Map: ../map.md
Class: U3 / VERIFICATION

## Task

完成 U3 的回归、白名单审计与 R3 输入包；准备 Draft PR 描述与证据，但**不推送、不创建 PR**。

### 必须完成

1. 命令与证据（原始输出落 `.scratch/level-playability-v1.1-u3/evidence/`）：
   ```bash
   pnpm build
   pnpm typecheck
   pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts
   pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts
   pnpm test
   ```
   记录退出码与测试计数；`pnpm test` 若出现已知 runner RPC 超时，必须区分「非断言失败」并保留原始输出。
2. 白名单审计：
   - 产品路径 diff **只有** `temporal-gate.ts`、`playability-temporal-gate.test.ts`、`playability-temporal-fixtures.ts`；
   - `temporal.ts` / `graph.ts` / `reach.ts` / `docs/` 零 diff；
   - 无新依赖、无 JSON fixture、无公共 barrel 导出。
3. 架构断言逐条记录：T-55 / T-57 / T-58 / T-61 / T-62 / T-64；`temporal-gate.ts` 不 import `temporal.ts`。
4. 写实现报告 `.scratch/level-playability-v1.1-u3/reports/07-implementation.md`：范围、文件、API、失败原因闭集、测试矩阵、反例覆盖、已知限制、命令与退出码、未覆盖项。
5. 准备 R3 输入包（白名单、验收表、证据路径、测试命令、必要原始输入）；**不得**把作者结论写成复核结论。
6. 准备 Draft PR 描述（目标 `wayfinder/level-playability-v1.1-i02`），但**不推送、不建 PR、不合并**。
7. 更新地图索引（如本票关闭时）。

### 禁止

- 推送 / 建 PR / 合并；
- 修改白名单外文件；
- 以「集成需要」为由修改 `temporal.ts` 或组装完整证书。

### 验收

全量 `pnpm test` exit 0；定向测试通过；diff 审计符合白名单；架构断言全 PASS；报告与 R3 输入包就绪。

## Answer

（resolved 时填写）
