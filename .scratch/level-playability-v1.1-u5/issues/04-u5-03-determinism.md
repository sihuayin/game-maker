# U5-03 墙钟 abort 与确定性

Type: task
Status: resolved
Owner: claude (U5-03 session 2026-11-13)
Blocked by: 03
Map: ../map.md
Class: U5 / IMPLEMENTATION

## Task

硬化墙钟 abort-only 与确定性承诺：`determinismSignature` 排除 `wallClockMs` / `detail`，规范化序列化一致，跨进程可复现。

### 允许文件

- `packages/contracts/src/playability/temporal.ts` / `temporal-budget.ts`（仅缺口）
- `packages/contracts/tests/playability-temporal-budget.test.ts` / `playability-temporal.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`

### 必须完成

1. 墙钟只作 abort-only：注入 `now` 确定性触发 `wall-clock-abort`；不得依赖真实耗时。
2. `determinismSignature` 必须排除 `wallClockMs` / `detail`；签名只覆盖语义字段（D5 Q1）。
3. 确定性测试：进程内连跑 ≥2 次，签名相等；剔除 `wallClockMs` / `detail` 的规范化完整序列化相等。
4. 跨进程确定性：同一输入的规范化结果在不同进程一致（脚本或测试；不得依赖墙钟字段）。
5. 所有影响策略选择的遍历 / 候选顺序必须确定性排序（D5 Q9）。
6. 测试标题带 `[I02-0x][AC-10]` 编号。
7. 复跑 build / typecheck / budget + 全量测试。

### 禁止

- 把墙钟纳入签名或作为通过条件；
- 引入真实时间依赖 / 随机源；
- 扩闭集 / 新增依赖 / 白名单外文件。

### 验收

AC-10 测试通过；墙钟 abort 可确定性触发；跨进程签名一致；全量测试绿。

## Answer

**完成（零产品改动）。** 审计确认 `determinismSignature`、墙钟注入与遍历顺序已满足 D5 §8 / D9 §7；本票补充 E2 测试与跨进程 E3 证据，未发现需要修改的产品缺口。

| 项 | 结果 |
| --- | --- |
| 产品改动 | **无**；`temporal.ts` / `temporal-budget.ts` / `temporal-witness.ts` / `temporal-evasion.ts` 零 diff |
| 墙钟 abort | 步进注入时钟 + `timeBudgetMs=10` / `checkpointWork=1` 确定性命中 `wall-clock-abort`；同一预算 + 恒定时钟不 abort（只由时钟驱动） |
| 签名排除 | `wallClockMs` 不同（0 vs 1）签名一致；`detail` 不同的两类 `spawn-not-on-lattice` 签名一致 |
| 签名覆盖 | 改动 `certificate.witness.verifications` 的 `t0` ⇒ 签名改变 |
| 重复运行 | 4 个世界 × 3 档 lag（0 / 16.67 / 200ms）各两遍：签名 + 剔除 `wallClockMs` / `detail` 的规范化完整序列化一致 |
| 策略顺序 | `playerSpeed=90` / `maxStates=38` 世界有 30 个多候选状态；同 rank 后继与最小 `(footX, k)` 零分歧 |
| 跨进程 | [脚本](../../level-playability-v1.1-u5/scripts/cross-process-determinism.mjs) 跑 3 个独立进程：`last-train`（IE）签名 `e504455e`、compact NB（witness）签名 `2c4d7930`，规范化 sha256 均逐进程一致；墙钟 0 vs 1 / 0 vs 67 |
| 测试 | 新增 7 条，定向 52 / 52；`pnpm build` 0、`pnpm typecheck` 0、架构断言 65 / 65 |
| 全量 | `pnpm test` **176 files / 2860 tests passed**，退出码 0 |
| 跨进程脚本 | 退出码 **0**；`ok: true` |

### 已知限制

- 真实墙钟 abort 的发生点依赖环境，按 D5 Q1 不在确定性承诺范围内；本票只保证注入时钟的确定性 abort 与「工作预算内完成」的运行。
- U9 不在 U5 组装路径（`coverage.temporal = partial`），跨进程完整证书由 W 提供；U9 确定性由 U2 测试覆盖。
- U5-02 的 `stats.work.hopSamplesChecked = 0` 与 U4 独立搜索预算缺口仍在，不影响本票签名 / 序列化结论。
- U5-01 登记的 **F（门区不成立）证书形状缺口**仍未裁定，需在 U5-04 前 HITL。

证据：[`../evidence/04-determinism.md`](../evidence/04-determinism.md)、[`../evidence/04-cross-process.json`](../evidence/04-cross-process.json)。本票未推送 / 建 PR / 合并。
