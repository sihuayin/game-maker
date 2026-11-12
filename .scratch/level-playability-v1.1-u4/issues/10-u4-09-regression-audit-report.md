# U4-09 回归 / 白名单审计 / R4 输入包

Type: task
Status: open
Owner: —
Blocked by: 09
Map: ../map.md
Class: U4 / VERIFICATION

## Task

完成 U4 的回归、白名单审计与 R4 输入包；准备 Draft PR 描述与证据，但**不推送、不创建 PR**。

### 必须完成

1. 命令与证据（原始输出落 `.scratch/level-playability-v1.1-u4/evidence/`）：
   ```bash
   pnpm build
   pnpm typecheck
   pnpm exec vitest run packages/contracts/tests/playability-temporal-evasion.test.ts
   pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts
   pnpm exec vitest run packages/contracts/tests/playability-graph.test.ts
   pnpm test
   ```
   记录退出码与测试计数；全量若出现 runner RPC 超时，区分「非断言失败」并保留原始输出。
2. 白名单审计：
   - U4 产品路径 diff **只有** `temporal-evasion.ts`、`playability-temporal-evasion.test.ts`、`playability-temporal-fixtures.ts`；
   - `graph.ts` 变更**只**来自已合并的 `HopSampling` 尾参 PR（记录独立 commit），本单元不再二次改动；
   - `temporal.ts` / `reach.ts` / `docs/` / `fixtures/` 零 diff；
   - 无新依赖、无 JSON fixture、无公共 barrel 导出。
3. 架构断言逐条记录：T-55 / T-57 / T-58 / T-61 / T-62 / T-64；`temporal-evasion.ts` 不 import `temporal.ts` / `temporal-gate.ts`。
4. 写实现报告 `.scratch/level-playability-v1.1-u4/reports/09-implementation.md`：范围、文件、API、失败原因映射、测试矩阵、反例覆盖、已知限制、命令与退出码、未覆盖项。
5. 准备 R4 输入包 `.scratch/level-playability-v1.1-u4/reports/09-r4-input-package.md`（白名单、验收表、证据路径、测试命令、必要原始输入）；**不得**把作者结论写成复核结论，验收项留空。
6. 准备 Draft PR 描述 `.scratch/level-playability-v1.1-u4/reports/09-draft-pr.md`（目标 `wayfinder/level-playability-v1.1-i02`），但**不推送、不建 PR、不合并**。
7. 更新地图索引（如本票关闭时）。

### 禁止

- 推送 / 建 PR / 合并；
- 修改白名单外文件；
- 以「集成需要」为由修改 `temporal.ts` / `reach.ts` 或组装完整证书。

### 验收

全量 `pnpm test` exit 0；定向测试通过；diff 审计符合白名单；架构断言全 PASS；报告与 R4 输入包就绪。

## Answer

（resolved 时填写）
