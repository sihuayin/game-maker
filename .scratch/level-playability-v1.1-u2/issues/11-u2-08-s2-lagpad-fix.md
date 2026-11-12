# U2-08 S2 lagPad 保守化与跨折返点回归

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md
Class: U2 / FIX

## Task

修复 R2 FAIL：S2 的 `lagPad` 在 `lagMs` 窗口跨过折返点 `m·P/2` 时**不是** `∃δ` 的保守覆盖。首次 R2 报告见 `.scratch/level-playability-v1.1-i02/reports/R2-review.md` §4。

### 根因

`verifyTransition` 的 S2 按**当前单调段方向**单侧加宽 Hazard 盒；当 `[t, t+lagMs]` 跨过折返点时，精确可达集包含折返后另一侧的位姿，单侧 pad 看不见它。

官方 `16.67ms` 可复现反例（R2-review §4.3）：

- Hazard `at=(0,40)`、`distance=50`、`periodMs=200`、盒 `10×12`、`anchor=(0,1)`
- 玩家 `2×20`、脚点 `(15,40)`、盒 `[14,16]×[20,40]`
- `N=40`、`dt=5ms`、`maxSpeed=0.2 px/ms`
- `wait (15,39) → (15,0)`，规范时间 `[195,200]`
- 当前实现返回 `verified:true`；但 `t=195, δ=16.6, u=211.6` 时 Hazard 盒 `[5.8,15.8]` 与玩家盒 `[14,16]` 正宽度重叠

### 允许文件

- `packages/contracts/src/playability/temporal-witness.ts`
- `packages/contracts/tests/playability-temporal-witness.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`（仅在需要新夹具时）

### 必须实现

1. 让 S2 对 `[t, t+lagMs]` 的**全部可达 Hazard 位姿**保守：
   - 优先 **对称 pad ± `hazardSpeed × lagMs`**（I02-03 §8.1 已证这是精确 `∃δ` 的保守超集；`hazardSpeed = 2·distance/periodMs`，静止 Hazard ⇒ 0）；或
   - 对 `[t, t+lagMs]` 做含折返点的精确滑动 `min/max`，按窗口实际范围构造并集盒。
   - 二者择一，在 Answer 写明选择与理由。**不得**继续按当前段方向单侧加宽。
2. 审计同型 pad 逻辑：`verifyResidualWait` 与 `verifyU9Stay` 也必须对各自区间保守；即使 R2 判定停留段 / 残差等待当前不受影响，修复时要保证一致，不得留下第二套方向性 pad。
3. 新增回归测试：
   - R2 §4.3 的 `16.67ms` 反例：修复后必须 `verified:false` / `failure:"hazard"`；
   - 一个 `lagMs=200` 的跨折返点变体；
   - 至少一个 W 或 U9 转移跨折返点、修复前会漏检的用例；
   - 更新既有 `[S2] lagPad 按单调段方向加宽` 测试为新的保守语义；
   - 标题带 `[I02-02][R2-FIX]` / `[AC-03]` 等可追溯编号。
4. 不扩 D9 闭集 / `BudgetProfile`；不改 `temporal-motion.ts` / `temporal-result.ts` / `temporal.ts` / budget。

### 禁止

- 修改上述白名单之外的任何产品文件；修改 `docs/**`；
- 弱化既有测试或删除断言来换取绿色；
- 新增测试文件 / JSON fixture / 公共 barrel 导出 / 新依赖；
- 推送 / 创建 PR / 合并；启动 U2-09 或 U2-R2。

### 验证

- `pnpm build`、`pnpm typecheck`（exit 0）
- `pnpm exec vitest run packages/contracts/tests/playability-temporal-witness.test.ts`（全过，含新回归）
- `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts`（65/65）
- `pnpm test`（全量 exit 0；若出现环境超时，区分超时与断言失败并重跑）
- `git diff` 产品路径只含 `temporal-witness.ts` + 两个测试侧文件

### 验收

R2 §4.3 反例在修复后必须失败；全量测试通过；未扩 D9 / budget；既有测试只按新保守语义更新，不删断言。

### 下游

U2-09（修复后回归 / 审计 / R2 重审输入）→ 新的独立 R2 会话。
