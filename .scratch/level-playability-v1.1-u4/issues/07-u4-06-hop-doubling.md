# U4-06 hop 双档与规范化采样覆盖

Type: task
Status: resolved
Owner: claude (U4-06 session 2026-11-13)
Blocked by: 06
Map: ../map.md
Class: U4 / IMPLEMENTATION

## Task

实现 D4 §6 的 hop 双档检查与规范化采样覆盖，产出 `hopDoubling` 与 `hopSamplingCoverage` 半部。**不实现模型闭合与最终输出边界。**

### 前置

- U4-03 已合并 `graph.ts` 的 `HopSampling` 可选尾参；U4-05 的图割判据已通过。

### 允许文件

- `packages/contracts/src/playability/temporal-evasion.ts`
- `packages/contracts/tests/playability-temporal-evasion.test.ts`
- `packages/contracts/tests/playability-temporal-fixtures.ts`（仅在确需时）

### 必须完成

1. 双档参数：主档 `{ hz: 60, maxSamples: 120 }`；倍档 `{ hz: 120, maxSamples: 240 }`。
2. **两档各自独立跑完整目标可达性检查**；不得只跑倍档，也不得只比较单条 hop 边。
3. 规范化采样覆盖：
   - `F1 = { i/n1 : 0 ≤ i ≤ n1 }`、`F2 = { j/n2 : 0 ≤ j ≤ n2 }`；
   - 要求 `F1 ⊆ F2`，用**整数交叉乘**判定，不用浮点容差；
   - **禁止**把 `n_double === 2·n_prime` 作为通过条件。
4. 记录每档 `HopSampleSummary`：`n` / 端点列表 / `cap`；cap 绑定（`ceil(T·hz) > maxSamples`）⇒ `INCOMPLETE` + `hop-sample-budget`。
5. 判败与降级（冻结映射）：
   - 采样覆盖不可证明 ⇒ `hop-doubling-changed`；
   - 任一档判目标可达 ⇒ `graph-cut-incomplete`；
   - 两档结论不一致 ⇒ `hop-doubling-changed`；
   - 两档都不可达才允许继续进入 U4-07。
6. 产出：
   - `hopDoubling: { base, doubled, connectivityPreserved, normalizedCoverage }`；
   - `hopSamplingCoverage: { covered, method: "normalized" | "insufficient" }`；
   - `connectivityPreserved` 只在两档完整检查结论一致时为 `true`。
7. 测试：
   - 只跑倍档 / 只比单边 ⇒ 必须失败（反例 9）；
   - `n_double === 2·n_prime` 不得作为通过条件（反例 10，用 `Tf = 1.2` 等反例）；
   - cap 绑定 ⇒ `hop-sample-budget`；
   - `F1 ⊆ F2` 整数判定正反例；
   - 双档不一致 ⇒ `hop-doubling-changed`；
   - 60Hz 可达 / 120Hz 不可达的图级翻转（N7b 形态）。

### 禁止

- 修改 `reach.ts` 或把 mid-air 检查写成双档；
- 修改跳跃公式或既有采样语义；
- 模型闭合 / U5 字段；
- 用浮点容差放宽 `F1 ⊆ F2`。

### 验收

定向 evasion 测试通过；graph 默认等价断言不回归；build / typecheck exit 0；diff 仅白名单文件。

## Answer

（resolved 时填写）

## Answer

**完成。** hop 60/120Hz 双档与规范化采样覆盖已实现；模型闭合与最终输出边界留给 U4-07。

| 项 | 结果 |
| --- | --- |
| 双档参数 | 主档 `{60,120}`、倍档 `{120,240}`（D4 §6.1） |
| 两档独立完整跑 | `reachWithSampling` 各自完整 BFS；`reach.ts` 只读、不参数化 hop |
| 规范化覆盖 | `F1 ⊆ F2` 整数交叉乘；**不要求** `n_doubled = 2·n_base` |
| 记录 | `HopSampleSummary`：`n`（最大每弧采样数）/ `endpoints`（落点去重）/ `cap` |
| 降级映射 | 图割否决 / 任一档可达 ⇒ `graph-cut-incomplete`；cap 绑定 ⇒ `hop-sample-budget`；覆盖不可证明 / 不一致 ⇒ `hop-doubling-changed`；全成立 ⇒ `COMPLETE` |
| `pnpm build` / `pnpm typecheck` | 退出码 **0** / **0** |
| 定向 evasion 测试 | 退出码 **0**；**22 / 22 passed** |
| graph + gate + input | 退出码 **0**；**124 / 124 passed** |
| `pnpm test` | 退出码 **0**；**175 / 175 files，2817 / 2817 tests passed** |
| 白名单外改动 | **无** |

覆盖：反例 9（必须两档都跑；用 120Hz 独有采样点构造连通性翻转）、反例 10（判据为 `F1 ⊆ F2`，非 2×）、cap 绑定、覆盖不可证明、双档一致不可达的 `COMPLETE` 路径。

证据：[`../evidence/06-hop-doubling.md`](../evidence/06-hop-doubling.md)。

**下游**：U4-07（模型闭合、降级映射与输出边界）已 **unblocked**。本票未启动 U4-07。
