# U4-00 基线证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-12 |
| 分支 | `wayfinder/level-playability-v1.1-u4` |
| base | `wayfinder/level-playability-v1.1-u3` @ `1405c3f`（U3 实现 + R3 + U3-SIGN） |
| charting commit | `5548b5d`（`docs(wayfinder): chart U4 evasion-graphcut effort`） |
| 工作区 | 开工前干净；产品目录 `packages/` / `docs/` / `fixtures/` 自 `1405c3f` 起 **零 diff** |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（`shasum -a 256 docs/v7.8/移动-I02.md`，与已签署版本一致） |
| U3 合并状态 | **U3 尚未并入 i02**；U3 PR 未创建 / 未合并，属于另行指令 |

## 白名单状态

| 文件 | 状态 |
| --- | --- |
| `packages/contracts/src/playability/temporal-evasion.ts` | **不存在**（U4 新建） |
| `packages/contracts/tests/playability-temporal-evasion.test.ts` | **不存在**（U4 新建） |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | 存在，453 行（`TEST_ONLY`） |
| `packages/contracts/src/playability/temporal-gate.ts` | 存在（U3，18788 bytes） |
| `packages/contracts/src/playability/graph.ts` | 存在；**无** `HopSampling` 尾参（`hopSamples` 定义于 `graph.ts:225`） |

## 基线命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run packages/contracts/tests/playability-graph.test.ts` | **0** | 1 file / **11 tests passed** |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | **0** | 1 file / **65 tests passed**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| `pnpm test` | **0** | **174 files / 2795 tests passed**；2 条 `[vitest-worker] Timeout calling "onTaskUpdate"`（工具层 RPC 超时，非断言失败） |

原始输出：`00-{build,typecheck,graph,architecture,test}.log`（`*.log` 本地保留，不入库）。

## 架构断言

`playability-temporal-input.test.ts` verbose 输出逐条确认：

- T-55 contracts 源码不含 `node:fs` / `node:crypto` ✓
- T-57 `auditPlayabilityTemporal` 生产调用者只有 `ops.ts` ✓
- T-58 生产 `analyze` 实参只有 `stubTemporalAnalyzer` ✓
- T-61 三处生产接线各至少一次 ✓
- T-62 常量唯一且不复用 `FRAME_MARGIN_MS` ✓
- T-64 brand `Symbol` 只在 `temporal-input.ts` 铸造 ✓

## R4 复核协议（冻结）

- 正式报告：`.scratch/level-playability-v1.1-i02/reports/R4-review.md`（唯一权威）。
- 复核人必须未参与 U4 编写；只获得白名单、验收表、证据路径、测试命令与必要原始输入。
- 逐项 `PASS` / `FAIL` / `NOT_RUN`；不得用总通过率替代。
- 必须记录命令与退出码、证据摘要 / hash、未覆盖项、限制、独立签署。
- R4 PASS 只允许申请 U5 增量授权；不是能力授权。

## 结论

基线全绿；授权台账记录 05 就绪；`graph.ts` 独立审批尚未开始。**U4 执行门保持 `BLOCKED`**，U4-01 为下一 frontier 票。
