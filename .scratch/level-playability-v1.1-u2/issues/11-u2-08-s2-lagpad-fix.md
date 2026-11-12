# U2-08 S2 lagPad 保守化与跨折返点回归

Type: task
Status: resolved
Owner: claude (U2-08 fix session 2026-11-12)
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

## Answer

### 修复选择：对称 pad（方案 1）

采用**对称 pad**：`pad = |slope| × lagMs = hazardSpeed × lagMs`；Hazard 盒左右各扩
`pad`，宽度 `w + 2·pad`，`anchor.x' = (anchor.x·w + pad) / (w + 2·pad)`。

理由：

- I02-03 §8.1 已证对称 pad 是精确 `∃δ`（`p(t+δ)`，δ ∈ [0, lagMs]）的保守超集：
  三角波速度有界 ⇒ `|p(t+δ) − p(t)| ≤ hazardSpeed·lagMs`，该界与方向无关；窗口跨
  `m·P/2` 时 Hazard 回到段的另一侧也被覆盖。
- 与既有 `intersectContinuous` 的逐单调段解析求交直接兼容：每段仍只调用一次，
  切段数 / `segments` / `maxCutsPerBranch` 记账 / 记录的 `lagPad` 都不变。
- 精确滑动窗口（在 `[t,t+lagMs]` 上求含折返点的 `min/max` 并构造并集盒）与对称 pad
  等价但实现与预算记账更复杂，且会改变每段求交的调用形态；在无收益的前提下不选。
- 原「按当前单调段方向单侧加宽」的分支已删除；`slope` 的符号现在只用于 U9 诊断
  字段 `direction: "rising" | "falling" | "static"`，不再决定 pad 方向。

### 三处 pad 的统一方式

`temporal-witness.ts` 新增两个**内部** helper：

- `conservativeLagPad(slope, lagMs) = |slope| × lagMs`（静止 Hazard 的 slope = 0 ⇒ 0）；
- `lagPaddedHazardBox(hazard, pad)`：返回左右各扩 `pad` 的 `HazardBoxSpec`
  （`w + 2·pad`、`anchor.x = (ax·w + pad)/(w + 2·pad)`）。

三处调用同一套语义：

1. `verifyTransition` 的 S2：`intersectContinuous(..., hazard: lagPaddedHazardBox(...))`；
2. `verifyU9Stay` 的停留子段：同一 helper、同一对称语义；
3. `verifyResidualWait`：同一 `pad` + 同一 helper，按 padded 盒的左缘展开该单调段的
   位姿范围，构造「左右各扩 `pad`」的并集扫掠盒。

不存在第二套方向性 pad。记录的 `lagPad` 仍为 `|slope|·lagMs` / `hazardSpeed·lagMs`，
编码层 `stay.lagPad === hazardSpeed·lagMs`、`segment.lagPad === |slope|·lagMs` 的
校验不变。

### R2 §4.3 反例修复前后

测试夹具（与 R2 等价，anchor 取 0.5 并相应平移 `at`）：Hazard 盒 10×12、anchor
`(0.5,1)`、`at=(5,40)`、`distance=50`、`periodMs=200`；玩家 2×20、脚点 `(15,40)`、
`maxSpeed=0.2 px/ms`、`N=40`、`dt=5ms`；`wait (15,39) → (15,0)`、`lagMs=16.67`。

```text
修复前：{"kind":"wait",...,"t0":195,"t1":200,"playerSpeedX":0,"verified":true,
         "failure":null,"cutPoints":0,"segments":1,"budgetStop":null}
修复后：{"kind":"wait",...,"t0":195,"t1":200,"playerSpeedX":0,"verified":false,
         "failure":"hazard","cutPoints":0,"segments":1,"budgetStop":null}
```

精确 `∃δ` 见证（测试内独立断言）：玩家盒 `[14,16]×[20,40]`；`t=195`、`δ=16.6`
（≤16.67）⇒ `u=211.6`、Hazard 盒 `[5.8,15.8]` 与玩家盒正宽度重叠；名义折返姿态
`[0,10]` 本身不相交。

### 测试

新增 5 条（标题含 `[I02-02][R2-FIX][AC-03|AC-04]`）：

1. S2 官方 16.67ms 反例（wait 边，`verified:false` / `failure:"hazard"`）；
2. S2 `lagMs=200` 跨折返点变体（`P=200, N=3, k=2, footX=45`）；
3. W/U9 同型 move 边跨折返点（含远离谷底的 cell 19 对照，证明失败只来自 lag）；
4. 残差等待 cell 39 整格覆盖（lag 0 安全 / lag 16.67 失败）；
5. W 级：cell 39 的 `residualWait` 不再被覆盖，出现在 `uncoveredPhases`。

更新 1 条既有测试：`[S2] lagPad 按单调段方向加宽` → `[S2] lagPad 两侧对称加宽`；
保留原有「上升段右扩 / 下降段左扩」断言，新增「上升段左扩 / 下降段右扩」两条反向
断言（只更新为新语义，未删除 / 弱化任何断言）。

修复前（原始 `temporal-witness.ts`）上述 5 条新测试 + 1 条更新测试全部失败
（均为 `expected true to be false`，实际 `verified:true`）；修复后全过。

- 定向：`playability-temporal-witness.test.ts` **73/73**；
  `playability-temporal-input.test.ts` **65/65**（合计 138）。
- 全量：`pnpm test` **173 files / 2747 tests passed，exit 0**；仅有 vitest worker
  `onTaskUpdate` RPC 超时（工具层 unhandled error，非断言失败 / 非测试超时）。

### 验证与范围

- `pnpm build` exit 0；`pnpm typecheck` exit 0。
- `git diff` 产品路径只有 `temporal-witness.ts` + `playability-temporal-witness.test.ts`
  （fixtures 未改）；未改 `temporal-motion.ts` / `temporal-result.ts` / `temporal.ts` /
  `temporal-budget.ts`；未扩 D9 闭集 / `BudgetProfile`；无新依赖 / JSON fixture / barrel /
  公共导出。
- 授权包 `docs/v7.8/移动-I02.md` SHA-256 仍为 `797cd6fc…`。

### 已知限制

1. 对称 pad 是保守超集而非最小精确集：对贴边情形可能比精确窗口更保守，但不会产生
   假验证；这是恢复证明健全性的代价。
2. U9 停留段（静态玩家 + 整周期）上，对称 pad 与旧方向 pad 的并集等价（R2 §5.3 已指出
   停留段本身不受该缺陷影响），因此没有可区分的失败回归；一致性由共享 helper 保证。
3. 未构造出「W/U9 搜索 complete→failed 仅由一条跨折返点边导致」的隔离用例：同一
   Hazard 下 spawn 列的其它相位格会先失败，complete→failed 无法只归因于该边。W 级
   回归改为断言 cell 39 的整格覆盖结果，并用 `verifyTransition` 直接覆盖 wait / move
   两种边（票面允许直接 API）。
4. W 编码仍不绑定 hazard / lag 来源（R2 §6 残留风险），本票未处理，留给 U2-09 / 重审。
