# U2-07 回归、白名单审计与实现报告

Type: task
Status: resolved
Owner: claude (U2-07 audit session 2026-11-12)
Blocked by: 07
Map: ../map.md
Class: U2 / AUDIT

## Task

对 U2 做回归与范围审计，产出实现报告与 R2 输入包。**不推送、不创建 PR、不合并。**

### 必须完成

1. 全量命令：`pnpm build`、`pnpm typecheck`、U2 定向 vitest、架构断言（`playability-temporal-input.test.ts`）、`pnpm test`；记录退出码与测试计数。
2. `git diff <U2 base>..HEAD` 逐文件审计：
   - 产品路径只允许 U2 白名单 3 个文件；
   - 无其它产品改动、无新依赖、无 JSON fixture、无 `packages/demo/**` / `ops.ts` / `graph.ts` / `profile.ts` / barrel 改动。
3. 架构断言 T-55 / T-57 / T-58 / T-61 / T-62 / T-64；新模块无 `analyze:` / `auditPlayabilityTemporal(` / `Symbol(` / `TEMPORAL_LAG_*`；`temporal-witness.ts` **不 import** `temporal.ts`。
4. 写 `.scratch/level-playability-v1.1-u2/reports/07-implementation.md`：
   - 命令、退出码、测试计数；
   - `git diff --stat`；
   - 白名单核对表；
   - 未覆盖项 / 已知限制；
   - “产品目录只改 U2 白名单”声明；
   - Draft PR 描述（base = `wayfinder/level-playability-v1.1-i02`，head = `wayfinder/level-playability-v1.1-u2`）；
   - R2 输入包（授权包 SHA、U2 白名单、§9.2 清单、命令、diff 范围 / head SHA、证据路径）。
5. 不推送 / 不建 PR / 不合并。

### 停止条件

- 任一白名单外文件 / 新依赖 / 公共导出 ⇒ STOP；
- 任一架构断言失败 ⇒ STOP；
- 需要新增文件或扩 D9 闭集 ⇒ STOP + HITL。

### 验收

报告完整；全量测试通过；diff 只含 U2 白名单；R2 输入包可交付。

## Answer

**2026-11-12 完成。** 回归、白名单审计与实现报告完成。**未推送、未创建 PR、未合并；未启动 U2-R2。** 产品代码 / 测试 / 配置零修改（本票只读审计）。

### 命令、退出码与计数（真实原始输出见 `../evidence/07-*.log`）

| # | 命令 | 退出码 | 计数 / 摘要 |
| --- | --- | ---: | --- |
| 1 | `pnpm build` | **0** | `tsc -b` + demo / cli / mcp bundle 全部 Done |
| 2 | `pnpm typecheck` | **0** | 10 个 workspace `typecheck: Done` |
| 3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-witness.test.ts` | **0** | **68 / 68 passed** |
| 4 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | **0** | **65 / 65 passed**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| 5 | `pnpm test`（第 1 次） | **0** | **173 files / 2742 tests passed**，`Duration 119.78s` |
| 6 | `pnpm test`（第 2 次复跑） | **0** | **173 files / 2742 tests passed**，`Duration 119.83s` |

- U2 定向合计 **133 / 133**。
- **测试级超时 0 条、断言失败 0 条**（两次全量均无 `Test timed out`、无 `FAIL` / `×`）。上一轮独立复跑记录的 10 条 `Test timed out in 20s/60s/120s` **本会话未复现**；两次全量均在 ~120s 内完成。
- 每次全量日志仍有 **2 条** `[vitest-worker]: Timeout calling "onTaskUpdate"`：vitest 3.2.7 runner RPC 层 unhandled error，与 U2-00 基线同类（非测试超时、非断言失败；`vitest.config.ts` 的 `dangerouslyIgnoreUnhandledErrors` 使其不影响退出码）。未改产品代码 / 未弱化测试 / 未改超时配置。

### Diff scope（`23a2027..HEAD`）

- 产品路径只有 U2 白名单 3 文件：`temporal-witness.ts`（A，+2593）、`playability-temporal-witness.test.ts`（A，+1294）、`playability-temporal-fixtures.ts`（M，+264 / −0）。
- 其余全部为 `.scratch/level-playability-v1.1-u2/**`（map / 票 / 基线证据 / 本报告）与 `.scratch/level-playability-v1.1-i02/reports/03-u2-incremental-authorization.md`。
- 自动化逐文件分类断言：`RESULT: PASS (no out-of-scope file)`。
- 无 `packages/demo/**` / `ops.ts` / `graph.ts` / `profile.ts` / `temporal.ts` / `temporal-result.ts` / `temporal-budget.ts` / barrel / `package.json` / lockfile / 新依赖 / JSON fixture 改动；`docs/v7.8/移动-I02.md` SHA 仍为 `797cd6fc…`。

### 架构与静态扫描

- T-55 / T-57 / T-58 / T-61 / T-62 / T-64：**全部 PASS**（`--reporter=verbose` 逐条 ✓）。
- 新模块 / 新测试：无 `analyze:`、`auditPlayabilityTemporal(`、`Symbol(`、`TEMPORAL_LAG_*`、`node:fs` / `node:crypto`、`Buffer` / `process.` / `Date.now`；无 U3–U5 泄漏（`permanent-gate` / `evasion` / `hop-doubling` / `graph-cut` 均为 0）。
- `temporal-witness.ts` **不 import** `temporal.ts`；无公共 barrel 导出；`src/**` 不引用 fixture；fixture 不注册测试、不读写文件系统。
- 失败原因只用既有 D9 闭集，未扩 `DegradationReason` / `BudgetProfile`。

### 未覆盖项 / 已知限制

见 [实现报告 §5](../reports/07-implementation.md)：S1 与走廊冗余、`maxCutsPerCheck` 入口不可单独耗尽、失败侧策略措辞不一致、W 转移不携带 lag、残差等待由 `phaseCoverage` 承载、`spawn-not-standable` 用 `gap` 表达、A–J / U3–U5 未实现、真实 `last-train/v2` 在 U2 模型下为 IE、本票不做 R2 语义复核、上一轮超时不可外推。

### 产物

- 实现报告 + R2 输入包：[`reports/07-implementation.md`](../reports/07-implementation.md)。
- 证据日志：`../evidence/07-{build,typecheck,witness,temporal-input,test-run1,test-run2}.log`（`*.log` 被 `.gitignore` 忽略，仅本地）。
- STOP 条件：白名单外文件 / 新依赖 / 公共导出 / 架构断言失败 / 全量失败 / 需扩 D9 闭集——**均未触发**。

### 下游

U2-R2 已 unblocked（独立会话、独立复核），**本票未启动 R2**。R2 PASS 不等于 U3 授权，也不等于 U2 签署。
