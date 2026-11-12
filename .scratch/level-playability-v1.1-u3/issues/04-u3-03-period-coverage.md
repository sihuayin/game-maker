# U3-03 全周期覆盖

Type: task
Status: resolved
Owner: claude (U3-03 session 2026-11-12)
Blocked by: 03
Map: ../map.md
Class: U3 / IMPLEMENTATION

## Task

实现 D4 §1.2–§1.3 的**全周期覆盖**记录与守卫。只填 `periodCoverage`。

### 允许文件

- `packages/contracts/src/playability/temporal-gate.ts`
- `packages/contracts/tests/playability-temporal-gate.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`）

### 必须完成

1. `periodCoverage` 必须表达**全周期解析交集**：
   - `max p = at + d`、`min p = at`；极值只在 `t = P/2` 与 `t = 0 / P` 作解析边界；
   - 输出 `{ periodMs: P, complete: true, intervals }`，区间语义与 D9 一致且能无损耗嵌入 `PermanentGateProof.periodCoverage`。
2. 只允许闭式全周期结果；**任何采样、子周期、幸运相位结果不得**生成 `complete: true`，也不得用于门区。
3. 周期边界 / 折返点只作解析边界；单段语义不得跨折返点推断。
4. `∀φ0` 交集在定义上已覆盖整个周期；`⋂δ` 由全相位量化自动满足，**门区不带 pad**。本票不记录 lag pad，也不引入 `lagMode` 字段（属完整 proof）。
5. 非法周期 / 非有限值 ⇒ `INCOMPLETE`，原因取 D9 闭集；不得放宽为 `complete: true`。
6. 定向测试：`t = 0`、`P/2`、`P`、负时间、多周期；周期起终点一致；采样 / 子周期路径不能产生 `complete`。

### 禁止

- 用采样或数值扫描「证明」全周期；
- 输出 `complete: true` 而缺少闭式依据；
- 计算判侧 / 注入 / 图割；
- 修改 `temporal.ts` / `graph.ts` / `reach.ts`。

### 验收

`pnpm build` / `pnpm typecheck` exit 0；新增定向测试通过；`complete: true` 只能来自闭式路径；diff 仅白名单文件。

## Answer

**完成。** 全周期覆盖记录落地，只来自闭式全周期解析；判侧 / 注入仍未实现。

| 项 | 结果 |
| --- | --- |
| 记录 | `{ periodMs: P, complete: true, intervals: [[0, P/2], [P/2, P]] }` |
| 闭式依据 | `max p = at + d`（`t = P/2`）、`min p = at`（`t = 0 / P`） |
| 区间语义 | 周期内门区核心被覆盖的绝对时间窗口；两段解析半周期不合并，相邻且合并恰为 `[0, P]` |
| 采样禁令 | 模块内无 `for` / `while`；采样 / 子周期 / 幸运相位不可能产出 `complete: true` |
| 非法周期 | `≤0` / 非有限 ⇒ `geometry-untrusted`，`periodCoverage: null` |
| 无 pad | 不引入 `lagMode` 或 lag pad（属完整 proof）；区间总长 = `P` |
| `pnpm build` / `pnpm typecheck` | 退出码 **0** / **0**（首次 typecheck 因测试元组解构 `TS2488` 失败，已修复后复跑） |
| 定向 gate 测试 | 退出码 **0**；**23 / 23 passed** |
| `playability-temporal-input.test.ts` | 退出码 **0**；**65 / 65 passed** |
| 白名单外改动 | **无**；STOP **未触发** |

`intervals` 的语义是 D9 未限定处的本票裁定：取「周期内覆盖时间窗口」，保留两个解析半周期而不合并，避免下游误读为跨折返点推断。

证据：[`../evidence/03-period-coverage.md`](../evidence/03-period-coverage.md)。

**下游**：U3-04（判侧规则）已 **unblocked**。本票未启动 U3-04。
