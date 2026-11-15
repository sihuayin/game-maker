# U3-07 证据 — 回归、白名单审计与实现报告

| 项 | 值 |
| --- | --- |
| 票 | [U3-07 回归 / 白名单审计 / 实现报告](../issues/08-u3-07-regression-audit-report.md) |
| 执行会话 | claude（U3-07 session 2026-11-12） |
| 实现 HEAD | `fb0121a`（U3-06 结票提交；本票只加 scratch 文档） |
| base | `wayfinder/level-playability-v1.1-i02` @ `c0d6981` |

## 1. 命令与结果

| # | 命令 | 原始输出 | 退出码 | 结果 |
| --- | --- | ---: | ---: | --- |
| C1 | `pnpm build` | `07-build.log` | **0** | `tsc -b` + bundle 全部 Done |
| C2 | `pnpm typecheck` | `07-typecheck.log` | **0** | 11 workspace Done |
| C3 | `pnpm exec vitest run …playability-temporal-gate.test.ts` | `07-gate.log` | **0** | **48 / 48 passed** |
| C4 | `pnpm exec vitest run …playability-temporal-input.test.ts --reporter=verbose` | `07-architecture.log` | **0** | **65 / 65 passed**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| C5 | `pnpm test` | `07-test.log` | **0** | **174 / 174 files，2795 / 2795 tests passed**；`Errors 2 errors`（已知 RPC 超时） |

### 1.1 已知 runner RPC 超时

| 项 | 值 |
| --- | --- |
| 条数 | **2**（与 U3-00 基线一致） |
| 形态 | `Unhandled Error ⎯ [vitest-worker]: Timeout calling "onTaskUpdate"` |
| 是否断言失败 | **否**：`Test Files 174 passed`、`Tests 2795 passed`、退出码 0 |
| 计时 | `Duration 124.07s` |

无 `FAIL` 测试（`grep -c FAIL` = 0）。

## 2. 白名单审计

```text
git diff --name-status c0d6981..HEAD -- packages/ docs/ fixtures/
A  packages/contracts/src/playability/temporal-gate.ts
A  packages/contracts/tests/playability-temporal-gate.test.ts
```

| 检查 | 结果 |
| --- | --- |
| 产品路径 diff 只有 U3 两个新增文件 | **PASS** |
| `temporal.ts` / `graph.ts` / `reach.ts` 零 diff | **PASS** |
| `docs/` 零 diff（授权包 SHA 不变） | **PASS** |
| `fixtures/` 零 diff | **PASS** |
| `**/package.json` / `pnpm-lock.yaml` 零 diff | **PASS**（无新依赖） |
| 任何 `*.json` 零 diff | **PASS**（无 JSON fixture） |
| `playability/index.ts` / `contracts/src/index.ts` 零 diff | **PASS**（无 barrel 导出） |
| `playability-temporal-fixtures.ts` 未改 | **PASS** |

产品文件 hash（R3 时点）：

```text
03ec5ef656815028afb9ef5bb7b9d19b5f7e02e1b63a7c095721d2eebf9913a2  packages/contracts/src/playability/temporal-gate.ts
3303b7f25468f713e5c0b9d8dc049e57f4652b67c1db606bb93087689035d58d  packages/contracts/tests/playability-temporal-gate.test.ts
```

## 3. 架构断言

| 断言 | 结果 |
| --- | --- |
| T-55 contracts `src` 不引 `node:fs` / `node:crypto` | ✓ |
| T-57 不新增 `auditPlayabilityTemporal(` 生产调用者 | ✓ |
| T-58 生产 `analyze:` 实参仍只有 `stubTemporalAnalyzer` | ✓ |
| T-61 三处生产接线不变 | ✓ |
| T-62 不新增 `TEMPORAL_LAG_*` | ✓ |
| T-64 不出现 `Symbol(` | ✓ |
| `temporal-gate.ts` 不 import `temporal.ts` / `temporal-witness.ts` | ✓ |

## 4. R3 输入与 Draft PR

| 项 | 路径 |
| --- | --- |
| 实现报告（作者侧，R3 不得读） | [`../reports/07-implementation.md`](../reports/07-implementation.md) |
| R3 输入包（白名单 / 验收表 / 命令 / 原始输入） | [`../reports/07-r3-input-package.md`](../reports/07-r3-input-package.md) |
| Draft PR 描述（未推送、未创建） | [`../reports/07-draft-pr.md`](../reports/07-draft-pr.md) |

R3 输入包中所有验收项留空；未写入作者 PASS 结论。

## 5. 边界声明

- 未推送、未创建 PR、未合并。
- 未修改白名单外文件；未以「集成需要」修改 `temporal.ts` 或组装完整证书。
