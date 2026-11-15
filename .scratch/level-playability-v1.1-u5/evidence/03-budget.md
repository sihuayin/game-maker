# U5-02 预算闭合与降级硬化 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u5` |
| base | `623eb0e`（U5-01） |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未变） |
| 实现票 | [U5-02](../issues/03-u5-02-budget.md) |

## 产品改动（白名单）

| 文件 | 改动 |
| --- | --- |
| `packages/contracts/src/playability/temporal-budget.ts` | +3：`maxBranching` 非安全整数 ⇒ `budget-bound-overflow`（不再只靠派生上界兜底） |
| `packages/contracts/src/playability/temporal-witness.ts` | +14 / −1：单次 check `cut-budget` 映射为 `BudgetStop`，不再误报 `model-out` |
| `packages/contracts/src/playability/temporal-evasion.ts` | +58 / −10：`maxHopSamples` 生效；低于采样下限 / 高于 240 ⇒ `hop-sample-budget`，不静默改用默认值 |
| `packages/contracts/src/playability/temporal.ts` | +40：把 `maxHopSamples` 传入 U4；工作预算类主因统一映射 `budgetStatus` / `budgetKind` |
| `packages/contracts/tests/playability-temporal-budget.test.ts` | +71：3 条预算闭合单元测试 |
| `packages/contracts/tests/playability-temporal.test.ts` | +166：10 条组装级降级 / 预算测试 |

- `temporal-result.ts` / `temporal-gate.ts` / `graph.ts` / `reach.ts` / 生产接线：**零改动**。
- 无新依赖、无 JSON fixture、无公共 barrel 导出、未扩 `BudgetProfile` / `DegradationReason` 闭集。

## 预算闭合语义

1. **工作预算是唯一语义预算**；墙钟只 abort-only，`wallClockMs` 不进确定性签名（U1 已冻结，U5-02 复验）。
2. **状态 / edge 不被累计 cut 抢占**：`WitnessWorkBudget` 的 `ownStop` 单向锁定；状态 / edge 先触顶后，后续 `recordCheck` 返回原原因。`verifyTransition` 的检查顺序是 edge → S1/S3/S4 → cut，累计 cut 不会覆盖 edge 原因。
3. **`maxCutsPerBranch` 按 segments（`cutPoints + 1`）计**：`recordCheck` 在记账前检查 `segmentsTotal + cutPoints + 1 > 上限`；恰好达上限通过，多 1 即 `cut-budget-exhausted`。
4. **单次 `maxCutsPerCheck`** 是 DoS 守卫；U2 在调用连续求交前已按折返点预切段，因此 U2 转移不会产生内部 cut（`maxCutsPerCheck: 0` 也不误伤）；原语级恰好 / 超限由 U1 预算与 motion 测试覆盖。
5. **`phaseGridCapped` 只是诊断**：`maxStates` 压小到 N=2 时仍可完成 `nb-candidate`；`N < 2` 才 `grid-resolution-infeasible`，不截断到 2。
6. **非法预算 / 派生溢出**：`maxBranching` 非安全整数、`maxEdges` 超派生硬上界 ⇒ `budget-bound-overflow`；`timeBudgetMs ≤ 0`、`maxStates < 1`、超硬上限 ⇒ `invalid-budget`；不回退默认值继续。
7. **Witness 体积**：`maxWitnessTransitions` / `maxWitnessBytes` 任一超限 ⇒ IE `witness-volume`；恰好达上限通过，多 1 即失败；`budgetStatus = "exhausted"`、`budgetKind = "witness-volume"`。
8. **`maxHopSamples`**：显式上限同时约束 60/120Hz 两档；cap 绑定 ⇒ U4 `hop-sample-budget`，组装层同步 `budgetStatus = "exhausted"` / `budgetKind = "hop-sample-budget"`，保留门区 + 图割部分证明。低于采样结构下限 6 或高于 240 ⇒ 直接 `hop-sample-budget`，不静默改用 6/240。
9. **不完整 vs 不一致**：单档预算耗尽保留 `edge-budget-exhausted` 等实际原因；`resolveTwoLagResults` 只在两档 verdict 不同时给 `lag-disagreement`。完整双档证据隔离由 U5-05 承担。

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-budget.test.ts` | **0** | **26 / 26 passed** |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal.test.ts` | **0** | **19 / 19 passed** |
| `pnpm exec vitest run ...evasion / ...witness / ...budget / ...temporal` | **0** | **154 / 154 passed** |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose` | **0** | **65 / 65 passed**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| `pnpm test` | **0** | **176 files / 2853 tests passed**；2 条 `onTaskUpdate` RPC 超时（工具层，非断言失败） |

原始输出：`03-{build,typecheck,architecture,test}.log`（本地保留，不入库）。

| 日志 | sha256 |
| --- | --- |
| `03-test.log` | `8fbac0d5d4a76f63e7a7947fa83a1973ea9502a661363b8d6324ec0ba6316bf7` |
| `03-build.log` | `8a20af2ab772a3da94bb97f481c933adf2ed7709054b850514f717183f6e37be` |
| `03-typecheck.log` | `cc2e63af682b2b4873198c43bb766155ecc07c2cdf730ecd1f5ccbb754f925f8` |
| `03-architecture.log` | `ab62f56806e826e2ee8d40ddba9ff0c8d9c4bf8600b104f1846b7e7d2b513c0b` |

## 新增测试清单

### 预算单元（`playability-temporal-budget.test.ts`）

| 测试 | 断言 |
| --- | --- |
| `[I02-05][AC-08]` 状态 / edge 触顶后，累计 cut 不得覆盖已有原因 | `ownStop` 单向；state / edge 原因优先 |
| `[I02-05][AC-08]` 刚好达上限不算超限；多 1 即触顶 | state / edge / per-check cut / branch segments 四项边界 |
| `[I02-05][AC-08]` 累计 cut 与状态 / edge 计数分列 | `cutPointsTotal` / `segmentsTotal` 与 states / edges 独立；墙钟不进入语义预算 |

### 组装级（`playability-temporal.test.ts`）

| 测试 | 断言 |
| --- | --- |
| `[I02-05][AC-08]` phaseGridCapped 只是诊断 | N=2、`phaseCapReason=state-capacity`，仍 `nb-candidate` |
| `[I02-05][AC-08]` N < 2 | `grid-resolution-infeasible`，不截断 |
| `[I02-05][AC-08]` 非法预算 / 超硬上限 | 10 组 override 全部 `invalid-budget` + `budgetStatus=invalid` |
| `[I02-05][AC-08]` 派生上界溢出 | `budget-bound-overflow` |
| `[I02-05][AC-08]` edge 先于 cut | `edge-budget-exhausted` + `edge-budget` |
| `[I02-05][AC-08]` 折返点预切段 | `maxCutsPerCheck=0` 不误伤 U2 |
| `[I02-05][AC-08]` Witness 体积边界 | 恰好达上限通过；转移数 / 字节多 1 均 `witness-volume` |
| `[I02-05][AC-08]` maxHopSamples cap 绑定 | `hop-sample-budget` + `exhausted` + 部分证明，两档 `cap=6` |
| `[I02-05][AC-08]` maxHopSamples 低于下限 | `hop-sample-budget`，证书 `none`，不静默改用默认值 |
| `[I02-05][AC-08]` 不完整 vs 不一致 | 预算原因 ≠ `lag-disagreement`；两档 verdict 不同才是 |

## 已知缺口

- `stats.work.hopSamplesChecked` 仍为 0：U4 半部未暴露逐弧采样计数，且其六键输出边界已由 R4-06 冻结。U5-06 性能证据会单独记录 hop 采样规模；若审计要求该字段，需要另开白名单缺口裁定。
- U4 目前没有独立的搜索预算对象（`maxStates` / `maxEdges` 按 D5 只属 U2）；U5-02 只闭合了 `maxHopSamples` 与墙钟 abort-only 的组装层映射。U4 的墙钟总上界（D5 §5.2）留待 U5-06 / 最终审计以证据形式检查。
- `verifyTransition` 的 `cut-budget → BudgetStop` 映射是防御性修复；U2 预切段后该路径在现行搜索中不可达，真正生效的是 tracker 级 `maxCutsPerCheck`。
- U5-01 登记的 **F（门区不成立）证书形状缺口**已由 [增量裁定 08](../../level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md) 解决（方案 ③：`none` + `no-permanent-gate`）。

## 结论

预算终值、触发顺序、非法预算、派生溢出、Witness 体积、hop 采样上限与 `phaseGridCapped` 诊断均已按 D5 / D5B / D9 闭合；新增 13 条测试；全量 176 files / 2853 tests 绿；生产接线零改动。U5-03 为下一 frontier 票。
