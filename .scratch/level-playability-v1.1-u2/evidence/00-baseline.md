# U2-00 基线证据 — 初始化、授权台账与只读复跑

| 项 | 值 |
| --- | --- |
| 票 | [U2-00 初始化、授权台账与基线](../issues/01-u2-00-init.md) |
| 执行会话 | claude（U2-00 session 2026-11-12） |
| 日期 | 2026-11-12 |
| 分支 | `wayfinder/level-playability-v1.1-u2` |
| base | `wayfinder/level-playability-v1.1-i02` @ `23a2027e30afaef033b2afe3d5a4a8a424fec20c` |
| charting head | `c7911a5373fd7a9e8cc5af2a050ffef9d1df9ce2`（含 `4bc26e5`、`c7911a5` 两个 charting 提交） |
| 基线运行时 HEAD | `febb826c6c5a2310f8e3c006bd59f89b2060144f`（本票 claim 提交；相对 `c7911a5` 只改本票 `Owner:` 一行） |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) |
| 产品目录改动 | **无** |

> 本文件只记录**基线**。U2-00 不实现任何 U2 语义，不写 `packages/**`。

## 1. 授权包 SHA 复算

命令：

```bash
shasum -a 256 docs/v7.8/移动-I02.md
```

输出：

```text
797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56  docs/v7.8/移动-I02.md
```

| 项 | 结果 |
| --- | --- |
| 期望值 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| 复算值 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| 判定 | **PASS**（逐字符相同；记录创建前后各复算一次） |

增量授权记录（新建，不改原包）：`.scratch/level-playability-v1.1-i02/reports/03-u2-incremental-authorization.md`。

## 2. 分支与基线校验

| # | 检查 | 命令 | 结果 | 判定 |
| --- | --- | --- | --- | --- |
| B1 | 当前分支 | `git rev-parse --abbrev-ref HEAD` | `wayfinder/level-playability-v1.1-u2` | PASS |
| B2 | 工作区干净 | `git status --porcelain` | 空（复跑前） | PASS |
| B3 | base 派生 | `git merge-base HEAD wayfinder/level-playability-v1.1-i02` | `23a2027e30afaef033b2afe3d5a4a8a424fec20c` | PASS |
| B4 | charting 提交在场 | `git log --oneline -5` | `c7911a5`、`4bc26e5` 均在 `23a2027` 之上 | PASS |
| B5 | 产品目录未改（vs base） | `git diff --stat 23a2027..HEAD -- packages/` | 空 | PASS |
| B6 | 授权包未改（vs base） | `git diff --stat 23a2027..HEAD -- docs/` | 空 | PASS |

## 3. U2 白名单状态

| 文件 | 期望 | 实测 | 判定 |
| --- | --- | --- | --- |
| `packages/contracts/src/playability/temporal-witness.ts` | 不存在 | **不存在** | PASS |
| `packages/contracts/tests/playability-temporal-witness.test.ts` | 不存在 | **不存在** | PASS |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | 存在（`TEST_ONLY`） | **存在** | PASS |

只读依赖（允许 import，不得修改）：

| 文件 | 实测 | 判定 |
| --- | --- | --- |
| `packages/contracts/src/playability/graph.ts` | 存在 | PASS |
| `packages/contracts/src/playability/reach.ts` | 存在 | PASS |
| `packages/contracts/src/playability/targets.ts` | 存在 | PASS |
| `packages/contracts/src/playability/profile.ts` | 存在 | PASS |
| `packages/contracts/src/game-config.ts` | 存在（**不在 `playability/` 子目录**，位于 contracts `src` 根；授权包 §5.3 列为禁改可只读） | PASS |
| `packages/contracts/src/playability/temporal-motion.ts` | 存在 | PASS |
| `packages/contracts/src/playability/temporal-budget.ts` | 存在 | PASS |
| `packages/contracts/src/playability/temporal-result.ts` | 存在 | PASS |
| `packages/contracts/src/playability/geometry.ts` | 存在 | PASS |

`packages/contracts/src/playability/` 现有模块：`api.ts`、`completion.ts`、`geometry.ts`、`graph.ts`、`index.ts`、`mechanic.ts`、`profile.ts`、`reach.ts`、`spatial.ts`、`targets.ts`、`temporal-budget.ts`、`temporal-input.ts`、`temporal-motion.ts`、`temporal-result.ts`、`temporal.ts`、`verdict.ts`。

结论：白名单与授权包 §5.2 逐文件一致，无残留 U2 文件、无越界新增。

## 4. 基线命令与结果

全部命令在 `HEAD = febb826` 上执行，原始输出存于同目录 `.log`（`*.log` 被 `.gitignore` 忽略，仅本地保留，不入库）。

| # | 命令 | 原始输出 | 退出码 | 结果 |
| --- | --- | ---: | ---: | --- |
| C1 | `pnpm build` | `00-build.log` | **0** | `tsc -b` + 10/11 workspace bundle 全部 Done |
| C2 | `pnpm typecheck` | `00-typecheck.log` | **0** | 10/11 workspace `typecheck` 全部 Done |
| C3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | `00-temporal-input.log` | **0** | **65 / 65 passed**（1 file） |
| C4 | `pnpm test` | `00-test.log` | **0** | **172 / 172 files，2674 / 2674 tests passed**；`Errors 2 errors`（见 §4.2） |

### 4.1 架构断言（C3，T-55 / T-57 / T-58 / T-61 / T-62 / T-64）

| 断言 | 标题 | 结果 |
| --- | --- | --- |
| T-55 | contracts 源码不含 `node:fs` / `node:crypto` | **✓ PASS** |
| T-57 | `auditPlayabilityTemporal` 生产调用者只有 `ops.ts` | **✓ PASS** |
| T-58 | 生产 `analyze` 实参只有 `stubTemporalAnalyzer` | **✓ PASS** |
| T-61 | 三处生产接线各至少一次 | **✓ PASS** |
| T-62 | 常量唯一且不复用 `FRAME_MARGIN_MS` | **✓ PASS** |
| T-64 | brand `Symbol` 只在 `temporal-input.ts` 铸造 | **✓ PASS** |

同一文件内其余 T-28～T-65 亦全部 ✓；`Test Files 1 passed (1)`、`Tests 65 passed (65)`。

### 4.2 已知 vitest RPC 超时（C4）

`pnpm test` 末尾出现 **2 条** `Unhandled Error: [vitest-worker]: Timeout calling "onTaskUpdate"`（`vitest@3.2.7`，RPC 层，非测试断言失败）：

| 项 | 值 |
| --- | --- |
| 条数 | **2**（与已知基线一致） |
| 形态 | `Unhandled Error ⎯ [vitest-worker]: Timeout calling "onTaskUpdate"` |
| 是否影响结论 | 否：`Test Files 172 passed (172)`、`Tests 2674 passed (2674)`、退出码 0 |
| 计时 | `Start at 12:06:12`，`Duration 119.03s` |

未出现其它 unhandled error / 未处理 rejection；无 `FAIL` 测试。

## 5. 产品目录未修改声明

- `git diff --stat 23a2027..HEAD -- packages/` **为空**；`git diff --stat 23a2027..HEAD -- docs/` **为空**。
- 本票只新增 / 修改 scratch 文档：本票 `Owner:` 行、增量授权记录、本证据文件（`.log` 不入库）。
- `packages/**` 零改动；`docs/v7.8/移动-I02.md` 零改动，SHA 保持 `797cd6fc…`。
- 未推送、未创建 PR、未合并。

## 6. 环境

| 项 | 值 |
| --- | --- |
| OS | macOS 15.7.9（Darwin 24.6.0） |
| 架构 | arm64 |
| Node | v22.23.2 |
| pnpm | 10.7.1 |
| vitest | 3.2.7（`node_modules/.pnpm/vitest@3.2.7_@types+node@22.20.4`） |

## 7. 结论

| 项 | 结论 |
| --- | --- |
| 授权包 SHA | **不变**（`797cd6fc…`） |
| 增量授权记录 | **就绪**（`.scratch/level-playability-v1.1-i02/reports/03-u2-incremental-authorization.md`） |
| 白名单 | **一致**，U2 新文件均不存在，只读依赖齐全 |
| 基线构建 / 类型 / 测试 | **全绿**（退出码全 0；2674 tests passed；2 条已知 RPC 超时） |
| 架构断言 | **6 / 6 PASS**（T-55 / T-57 / T-58 / T-61 / T-62 / T-64） |
| 产品目录 | **零改动** |
| STOP 条件 | **未触发** |
| 下游 | U2-01 已 unblocked（U2 语义实施仍未开始） |
