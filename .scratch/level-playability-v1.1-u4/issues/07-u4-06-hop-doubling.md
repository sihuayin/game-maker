# U4-06 hop 双档与规范化采样覆盖

Type: task
Status: open
Owner: —
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
