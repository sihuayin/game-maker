# U4-02 graph.ts HopSampling 尾参实现与默认行为回归

Type: task
Status: resolved
Owner: claude (U4-02 session 2026-11-12)
Blocked by: 02
Map: ../map.md
Class: U4 / IMPLEMENTATION

## Task

在**独立分支** `wayfinder/level-playability-v1.1-u4-graph-hop` 上实现 U4-01 已批准的 `graph.ts` `HopSampling` 可选尾参。**不推送、不建 PR、不合并。**

### 允许文件（本票唯一改动面）

- `packages/contracts/src/playability/graph.ts`（仅 `HopSampling` 可选尾参与默认值合并）
- `packages/contracts/tests/playability-temporal-evasion.test.ts`（新建；**只放默认等价断言**，不实现 U4 语义）

### 必须完成

1. 按 U4-01 批准的逐行提案实现：`hopSamples` / `hopEdges` / `hopTargets` 新增可选尾参；默认 `{ hz: 60, maxSamples: 120 }`。
2. 不改跳跃公式、既有采样语义、其他导出或调用语义；不改 `reach.ts`。
3. 回归断言：显式传默认参数与无参调用结果一致；可序列化场景稳定序列化一致；不修改既有 graph / temporal-input 断言。
4. 本地复跑并记录退出码与计数：
   ```bash
   pnpm build
   pnpm typecheck
   pnpm exec vitest run packages/contracts/tests/playability-graph.test.ts
   pnpm exec vitest run packages/contracts/tests/playability-temporal-evasion.test.ts
   pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts
   pnpm test
   ```
5. 记录 `git diff` 白名单审计：本分支改动**只有**上述两个文件；`reach.ts` / `temporal.ts` / docs / fixtures 零 diff。
6. 写证据 `.scratch/level-playability-v1.1-u4/evidence/02-graph-param.md`（命令、退出码、计数、diff stat、`graph.ts` 前后 hash）。
7. 本地 commit（分支 `wayfinder/level-playability-v1.1-u4-graph-hop`），记录 commit hash；**不推送**。

### 禁止

- 推送 / 建 PR / 合并；
- 实现 U4 图割或 hop 双档逻辑；
- 修改 `reach.ts`、跳跃公式、其他导出或调用语义；
- 修改白名单外文件。

### 验收

`pnpm build` / `pnpm typecheck` exit 0；`playability-graph.test.ts` 与默认等价断言通过；全量 `pnpm test` exit 0；diff 仅两个白名单文件；本地 commit 就绪。**合并前 U4 实施仍 `BLOCKED`。**

## Answer

（resolved 时填写）

## Answer

**完成。** 已按 U4-01 批准的提案在独立分支 `wayfinder/level-playability-v1.1-u4-graph-hop`（base `c0d6981`）实现并本地验证；**未推送、未建 PR、未合并**。

| 项 | 结果 |
| --- | --- |
| 本地 commit | `13b4e3b`（`U4-02: graph.ts HopSampling tail param and default regression`） |
| 改动面 | `graph.ts`（`HopSampling` 可选尾参 + 默认回落）+ 新建 `playability-temporal-evasion.test.ts`（5 条默认等价断言） |
| `graph.ts` hash | 前 `def3fa71…445e55b` → 后 `85346d6f…e0228b0` |
| 未改 | 跳跃公式、既有采样语义、`reach.ts`、`reachableCells`、其他导出 / 调用语义、既有测试 |
| `pnpm build` / `pnpm typecheck` | 退出码 **0** / **0** |
| `playability-graph.test.ts` | 退出码 **0**；**11 / 11 passed** |
| `playability-temporal-evasion.test.ts` | 退出码 **0**；**5 / 5 passed** |
| `playability-temporal-input.test.ts` | 退出码 **0**；**65 / 65 passed** |
| `pnpm test` | 退出码 **0**；**174 / 174 files，2752 / 2752 tests passed**（分支未含 U3 的 48 条 gate 测试） |
| 白名单外改动 | **无** |

证据：[`../evidence/02-graph-param.md`](../evidence/02-graph-param.md)（原始输出 `02-*.log`，本地保留不入库）。

**下游**：U4-03（独立 PR 推送与合并门）已 **unblocked**，但**必须等待用户明确指令**才会推送 / 建 PR / 合并。**U4 执行门仍 `BLOCKED`。** 本票未启动 U4-03。
