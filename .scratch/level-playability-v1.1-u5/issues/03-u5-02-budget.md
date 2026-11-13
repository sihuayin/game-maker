# U5-02 预算闭合与降级硬化

Type: task
Status: resolved
Owner: claude (U5-02 session 2026-11-13)
Blocked by: 02
Map: ../map.md
Class: U5 / IMPLEMENTATION

## Task

按 D5 / D5B 硬化预算与降级语义：工作预算是唯一语义预算，墙钟 abort-only，累计 cut 按 segments。**不扩 `BudgetProfile` 闭集。**

### 允许文件

- `packages/contracts/src/playability/temporal-budget.ts` / `temporal.ts` / `temporal-witness.ts` / `temporal-evasion.ts`（仅缺口）
- `packages/contracts/tests/playability-temporal-budget.test.ts` / `playability-temporal.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`

### 必须完成

1. 核对并补齐：`maxStates 500k/1M`、`timeBudgetMs 2s/10s`、`maxCutsPerCheck 1M`、`maxCutsPerBranch 5M/10M`（segments = cutPoints + 1）、`maxWitnessTransitions 1M`、`maxWitnessBytes 64 MiB`、`maxHopSamples 240/arc`、`timeBudgetCheckpointWork 1024`、`maxEdges` 防溢出。
2. 触发顺序与降级原因：状态 / edge 预算不得被累计 cut 先触发而改写原因；触顶 ⇒ `INSUFFICIENT_EVIDENCE` + 对应 `budgetKind`；不得提升部分结果。
3. 非法预算：非有限、`timeBudgetMs ≤ 0`、`maxStates < 1`、派生上界溢出 ⇒ `invalid-budget` / `budget-bound-overflow`；不得回退默认值。
4. `phaseGridCapped` 只作诊断，不是降级 Verdict；`N < 2` ⇒ `grid-resolution-infeasible`。
5. Witness 体积：`1M` 转移或 `64 MiB` 任一超限 ⇒ `witness-volume`。
6. 双档「不完整」与「不一致」使用不同原因（`wall-clock-abort` / `budgetKind` vs `lag-disagreement`）；不得伪装。
7. 测试：刚好达上限 / 刚好超限、累计 cut、体积、非法预算、上界溢出、原因优先级；标题带 `[I02-0x][AC-08]` 编号。
8. 复跑 build / typecheck / budget + 全量测试。

### 禁止

- 扩 `BudgetProfile` / `DegradationReason` 闭集（需要 ⇒ STOP + HITL）；
- 按关卡配置预算；
- 重跑 / 扩预算 / 换算法掩盖失败；
- 新增依赖或白名单外文件。

### 验收

预算语义与 D5 / D5B 逐项一致；AC-08 测试通过；全量测试绿；diff 仅白名单文件。

## Answer

**完成。** 预算闭合与降级硬化按 D5 / D5B / D9 落地；未扩 `BudgetProfile` / `DegradationReason` 闭集，未改生产接线。

| 项 | 结果 |
| --- | --- |
| 预算终值 | `maxStates 500k/1M`、`timeBudgetMs 2s/10s`、`maxCutsPerCheck 1M`、`maxCutsPerBranch 5M/10M`（segments = cutPoints + 1）、`maxWitnessTransitions 1M`、`maxWitnessBytes 64 MiB`、`maxHopSamples 240/arc`、`timeBudgetCheckpointWork 1024` 全部保持冻结值 |
| 触发顺序 | 状态 / edge 触顶后 `ownStop` 单向锁定，后续累计 cut 不得覆盖原因；`verifyTransition` 先 edge 后 cut |
| 边界 | 状态 / edge / 单次 check cut / 累计 segments / Witness 转移数 / 字节数均覆盖「恰好达上限通过、多 1 即触顶」 |
| 非法预算 | 非有限 / `≤0` / 超硬上限 ⇒ `invalid-budget`；`maxBranching` 非安全整数 / `maxEdges` 超派生硬上界 ⇒ `budget-bound-overflow`；不回退默认值 |
| 相位网格 | `phaseGridCapped` 只是诊断（N=2 时仍可 `nb-candidate`）；`N < 2` ⇒ `grid-resolution-infeasible` |
| Witness 体积 | 转移数 / 字节任一超限 ⇒ `witness-volume` + `exhausted` + `witness-volume`；不截断、不返回部分 Witness |
| hop 采样 | `maxHopSamples` 同时约束两档；cap 绑定 ⇒ `hop-sample-budget` + `exhausted` + 部分门区证明；低于结构下限 6 / 高于 240 ⇒ 直接 `hop-sample-budget`，不静默改用默认值 |
| 双档原因 | 单档预算耗尽保留 `edge-budget-exhausted` 等实际原因；只有两档 verdict 不同才是 `lag-disagreement`（完整双档隔离由 U5-05 承担） |
| 代码 | `temporal-budget.ts` +3、`temporal-witness.ts` +14/−1、`temporal-evasion.ts` +58/−10、`temporal.ts` +40 |
| 测试 | 新增 13 条（预算单元 3 + 组装级 10）；定向 154 / 154 |
| 命令 | `pnpm build` 0；`pnpm typecheck` 0；`pnpm test` 176 files / 2853 tests，退出码 0 |
| 架构断言 | T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓（65 / 65） |

### 已知缺口

- `stats.work.hopSamplesChecked` 仍为 0：U4 六键输出边界（R4-06）未暴露逐弧采样计数；U5-06 单独记录 hop 采样规模。
- U4 没有独立搜索预算对象（`maxStates` / `maxEdges` 按 D5 只属 U2）；U5-02 只闭合 `maxHopSamples` 与组装层原因映射，U4 墙钟总上界留待 U5-06 / 最终审计。
- `verifyTransition` 的 `cut-budget → BudgetStop` 是防御性修复；U2 预切段后现行搜索不会走到该分支。
- U5-01 登记的 F（门区不成立）证书形状缺口仍未裁定，需在 U5-04 前 HITL。

**后续裁定（2026-11-13）**：用户选择方案 ③，F 允许 `certificate.kind = "none"` + `no-permanent-gate`；见 [增量裁定 08](../../level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md)。

证据：[`../evidence/03-budget.md`](../evidence/03-budget.md)。本票未推送 / 建 PR / 合并。
