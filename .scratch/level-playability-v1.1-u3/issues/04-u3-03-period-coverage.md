# U3-03 全周期覆盖

Type: task
Status: open
Owner: —
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

（resolved 时填写）
