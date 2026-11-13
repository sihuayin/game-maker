# U4-05 图割判据与 reach 消费

Type: task
Status: resolved
Owner: claude (U4-05 session 2026-11-13)
Blocked by: 05
Map: ../map.md
Class: U4 / IMPLEMENTATION

## Task

实现 D4 §4 的图割判据：用**精确 spawn** 与 `assessReachability(..., { full: true })` 判断目标是否图内不可达，并产出 `graphCut` 半部。**不实现 hop 双档与模型闭合。**

### 允许文件

- `packages/contracts/src/playability/temporal-evasion.ts`
- `packages/contracts/tests/playability-temporal-evasion.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`（仅在确需时）

### 必须完成

1. 起点 = 输入传入的**精确 spawn 脚点格**；**禁止** `startCells()` 宽松多起点。
2. 调用 `assessReachability(graph, move, [{ rect: goalRegion }], { full: true })`；消费 `covered` 与 `midAir`。
3. 产出：
   - `reachableFootpoints`（可达落脚点数，确定性计数）；
   - `goalIntersections`（`covered` 是否命中 / 命中数）；
   - `midAirHits`（`midAir` 命中数）；
   - `evidence`（确定性字符串，无时钟 / 随机）；
   - `verdict: "conditional"`（**恒为** `conditional`）。
4. 语义：
   - 落脚点未覆盖且 `midAirHits = 0` ⇒ 允许进入 hop 双档检查（仍不是 PU，不是正面证明）；
   - `midAirHits > 0` ⇒ `INCOMPLETE` + `graph-cut-incomplete`（否决）；
   - 任一落脚点覆盖目标 ⇒ `INCOMPLETE` + `graph-cut-incomplete`；
   - 注释与测试必须显式写明：**`midAirHits = 0` 只能作否决证据**。
5. `reach.ts` 零改动；mid-air 保持现有 60Hz 行为，**不得**描述成参与 hop 双档参数化。
6. 测试：不可达路径、可达路径、midAir 否决、精确 spawn vs `startCells()`（D4 反例 8）、`midAirHits=0` 不得当正面证明（反例 7）。

### 禁止

- hop 双档 / `hopDoubling` / `hopSamplingCoverage`；
- 模型闭合结论；
- 修改 `reach.ts` / `graph.ts` / `temporal.ts`；
- 把 `conditional` 改成确定性不可达断言。

### 验收

定向 evasion 测试通过；`playability-graph.test.ts` 与 gate 测试不回归；build / typecheck exit 0；diff 仅白名单文件。

## Answer

（resolved 时填写）

## Answer

**完成。** 图割判据已实现：精确 spawn 出发、`assessReachability(..., { full: true })`、`covered` / `midAir` 消费；hop 半部仍为 `null`。

| 项 | 结果 |
| --- | --- |
| 精确 spawn | `withExactSpawnSeed` 把 `startCells()` 钉成 D3 精确脚点格；`evidence` 记录 `seeds=1` |
| 判据 | `assessReachability(seeded, move, [{ rect: goalRegion }], { full: true })` |
| 输出 | `graphCut: { verdict: "conditional", reachableFootpoints, goalIntersections, midAirHits, evidence }` |
| 不健全性 | `midAirHits > 0` 只作否决；`midAirHits = 0` 永不作为正面证明；`verdict` 恒 `conditional` |
| `reach.ts` | 零改动；mid-air 保持 60Hz，不参与 hop 双档 |
| `pnpm build` / `pnpm typecheck` | 退出码 **0** / **0** |
| 定向 evasion 测试 | 退出码 **0**；**16 / 16 passed** |
| graph + gate + input | 退出码 **0**；**124 / 124 passed** |
| `pnpm test` | 退出码 **0**；**175 / 175 files，2811 / 2811 tests passed** |
| 白名单外改动 | **无** |

覆盖：精确 spawn vs 宽松多起点（反例 8）、`midAirHits = 0` 不作正面证明（反例 7）、可达 / 不可达 / mid-air 否决 / 确定性。

证据：[`../evidence/05-graph-cut.md`](../evidence/05-graph-cut.md)。

**下游**：U4-06（hop 双档与规范化采样覆盖）已 **unblocked**。本票未启动 U4-06。
