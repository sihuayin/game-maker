# U3-00 基线证据 — 初始化、授权台账与只读复跑

| 项 | 值 |
| --- | --- |
| 票 | [U3-00 初始化、授权台账与基线](../issues/01-u3-00-init.md) |
| 执行会话 | claude（U3-00 session 2026-11-12） |
| 日期 | 2026-11-12 |
| 分支 | `wayfinder/level-playability-v1.1-u3` |
| base | `wayfinder/level-playability-v1.1-i02` @ `c0d6981170967f0145a26901425835dd8df7ba1e` |
| charting head | `64cdc3c87d559abf05d57cf9beee719fce816214`（`docs(wayfinder): chart U3 permanent-gate effort`；相对 base 只增 scratch 图 / 票） |
| 基线运行时 HEAD | `64cdc3c`（本票 claim 修改 `Owner:` 一行，未提交；产品目录零改动） |
| 授权包 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) |
| 产品目录改动 | **无** |

> 本文件只记录**基线**。U3-00 不实现任何 U3 语义，不写 `packages/**`。

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
| 判定 | **PASS**（逐字符相同） |

增量授权记录（新建，不改原包）：[`.scratch/level-playability-v1.1-i02/reports/04-u3-incremental-authorization.md`](../../level-playability-v1.1-i02/reports/04-u3-incremental-authorization.md)。

## 2. 分支与基线校验

| # | 检查 | 命令 | 结果 | 判定 |
| --- | --- | --- | --- | --- |
| B1 | 当前分支 | `git rev-parse --abbrev-ref HEAD` | `wayfinder/level-playability-v1.1-u3` | PASS |
| B2 | 工作区干净（开工前） | `git status --porcelain` | 空 | PASS |
| B3 | base 派生 | `git merge-base HEAD wayfinder/level-playability-v1.1-i02` | `c0d6981170967f0145a26901425835dd8df7ba1e` | PASS |
| B4 | i02 当前头 | `git rev-parse wayfinder/level-playability-v1.1-i02` | `c0d6981`（U2 经 PR #34 并入） | PASS |
| B5 | charting 提交在场 | `git log --oneline c0d6981..HEAD` | `64cdc3c docs(wayfinder): chart U3 permanent-gate effort` | PASS |
| B6 | 产品目录未改（vs base） | `git diff --stat c0d6981..HEAD -- packages/` | 空 | PASS |
| B7 | `docs/` 未改（vs base） | `git diff --stat c0d6981..HEAD -- docs/` | 空 | PASS |

working tree 在本票 claim 后只有：`M .scratch/level-playability-v1.1-u3/issues/01-u3-00-init.md`（`Owner:` 行）与新增的增量授权记录，均为 scratch 文档。

## 3. U3 白名单状态

| 文件 | 期望 | 实测 | 判定 |
| --- | --- | --- | --- |
| `packages/contracts/src/playability/temporal-gate.ts` | 不存在（U3-01 新建） | **不存在** | PASS |
| `packages/contracts/tests/playability-temporal-gate.test.ts` | 不存在（U3-01 新建） | **不存在** | PASS |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | 存在（`TEST_ONLY`，可扩展） | **存在**（453 行） | PASS |

只读依赖（允许 import，不得修改）：

| 文件 | 实测 | 判定 |
| --- | --- | --- |
| `packages/contracts/src/playability/temporal-result.ts` | 存在（280 行） | PASS |
| `packages/contracts/src/playability/temporal-budget.ts` | 存在（308 行） | PASS |
| `packages/contracts/src/playability/temporal-motion.ts` | 存在（371 行） | PASS |
| `packages/contracts/src/playability/graph.ts` | 存在（296 行） | PASS |
| `packages/contracts/src/playability/reach.ts` | 存在（225 行） | PASS |
| `packages/contracts/src/playability/geometry.ts` | 存在（37 行） | PASS |
| `packages/contracts/src/playability/profile.ts` | 存在（131 行） | PASS |
| `packages/contracts/src/playability/targets.ts` | 存在（88 行） | PASS |
| `packages/contracts/src/game-config.ts` | 存在（715 行；**不在 `playability/` 子目录**，位于 contracts `src` 根，§5.3 列为禁改可只读） | PASS |

结论：白名单与授权包 §5.2 逐文件一致，无残留 U3 文件、无越界新增。

## 4. 基线命令与结果

全部命令在 base `c0d6981` + charting `64cdc3c` 上执行；原始输出存于同目录 `.log`（`*.log` 被 `.gitignore` 忽略，仅本地保留，不入库）。

| # | 命令 | 原始输出 | 退出码 | 结果 |
| --- | --- | ---: | ---: | --- |
| C1 | `pnpm build` | `00-build.log` | **0** | `tsc -b` + 11 workspace bundle 全部 Done |
| C2 | `pnpm typecheck` | `00-typecheck.log` | **0** | 11 workspace `typecheck` 全部 Done |
| C3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | `00-temporal-input.log` | **0** | **65 / 65 passed**（1 file） |
| C4 | `pnpm test` | `00-test.log` | **0** | **173 / 173 files，2747 / 2747 tests passed**；`Errors 2 errors`（见 §4.2） |

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

`pnpm test` 末尾出现 **2 条** `Unhandled Error: [vitest-worker]: Timeout calling "onTaskUpdate"`（`vitest@3.2.7` RPC 层，非测试断言失败）：

| 项 | 值 |
| --- | --- |
| 条数 | **2**（与 U2 基线一致） |
| 形态 | `Unhandled Error ⎯ [vitest-worker]: Timeout calling "onTaskUpdate"` |
| 是否影响结论 | 否：`Test Files 173 passed (173)`、`Tests 2747 passed (2747)`、退出码 0 |
| 计时 | `Start at 20:44:19`，`Duration 120.77s` |

无 `FAIL` 测试；无其它 unhandled error。

## 5. R3 复核协议初始化

| 项 | 冻结内容 |
| --- | --- |
| 正式报告路径 | `.scratch/level-playability-v1.1-i02/reports/R3-review.md`（唯一权威） |
| 复核会话隔离 | 复核人必须未参与 U3 实现；**不得**读 `.scratch/level-playability-v1.1-u3/reports/`、`map.md`、作者总结 / PASS 结论 / 调试笔记 |
| 复核输入 | 仅白名单、R3 验收表（授权包 §9.3）、证据路径、测试命令、必要原始输入 |
| 结论口径 | 逐项 `PASS` / `FAIL` / `NOT_RUN`；总通过率不得替代逐项结论；未运行项不得推定通过 |
| 必录内容 | 命令与退出码、证据摘要 / hash、未覆盖项、限制、独立签署 |
| 判定基 | 门区模块 API 与证明行为（**不是**顶层 `certificate`；A–J F 行推迟） |
| 后续 | R3 PASS ≠ U4 授权；U4 需 R3 PASS + 独立增量签署 + `graph.ts` 独立审批 |

R3 复核票：[U3-R3 独立复核](../issues/09-u3-r3-review.md)。

## 6. 产品目录未修改声明

- `git diff --stat c0d6981..HEAD -- packages/` **为空**；`-- docs/` **为空**。
- 本票只新增 / 修改 scratch 文档：本票 `Owner:` 行、增量授权记录、本证据文件（`.log` 不入库）。
- `packages/**` 零改动；`docs/v7.8/移动-I02.md` 零改动，SHA 保持 `797cd6fc…`。
- 未推送、未创建 PR、未合并。

## 7. 环境

| 项 | 值 |
| --- | --- |
| OS | macOS 15.7.9（Darwin 24.6.0） |
| 架构 | arm64 |
| Node | v22.23.2 |
| pnpm | 10.7.1 |
| vitest | 3.2.7 |

## 8. 结论

| 项 | 结论 |
| --- | --- |
| 授权包 SHA | **不变**（`797cd6fc…`） |
| 增量授权记录 | **就绪**（`.scratch/level-playability-v1.1-i02/reports/04-u3-incremental-authorization.md`） |
| 白名单 | **一致**，U3 新文件均不存在，只读依赖齐全 |
| 基线构建 / 类型 / 测试 | **全绿**（退出码全 0；2747 tests passed；2 条已知 RPC 超时） |
| 架构断言 | **6 / 6 PASS**（T-55 / T-57 / T-58 / T-61 / T-62 / T-64） |
| 产品目录 | **零改动** |
| STOP 条件 | **未触发** |
| 下游 | U3-01 已 unblocked（U3 语义实施仍未开始） |
