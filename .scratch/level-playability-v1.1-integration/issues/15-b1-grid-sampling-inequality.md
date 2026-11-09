# B1 网格采样不等式的方向证明

Type: research
Status: resolved
Owner: agent（AFK）· 2026-11-09
Blocked by: —
Blocks: 10（R1 签署）
Map: ../map.md
Class: I-00 / EVIDENCE

## Question

R1 暂不冻结 `maxSpeed · periodMs / N ≥ xStep`。必须用**反例与推导**确认：不等式的方向是否正确、它约束的到底是什么（碰撞检测的可靠性，还是搜索能否移动），以及两个可能的约束是否被混为一谈。

### 必须回答

1. **碰撞可靠性约束**：Hazard 在相邻时间采样之间整段穿过一个空间网格单元时，算法是否会漏检？用 P0 的 `segmentCollides`（折返点切段 + 解析求交）构造最小反例验证。关键问题：可靠性是否依赖 `dt` 与 `xStep` 的关系。
2. **搜索可行性约束**：状态为 `(x 网格点, k mod N)`，移动边要求 `|Δx| ≤ maxSpeed · dt`。当 `maxSpeed · dt < xStep` 时实际发生什么？用 P0 的 `analyze` 复现。
3. **方向判定**：分别陈述两个约束的正确形式与方向，并指出 `≤` 与 `≥` 各自对应哪一个、各自保证什么。
4. **可用 N 区间**：由上述约束导出的 `N` 上下界；区间为空时的行为（IE）。
5. **反例要求**：至少两个——(i) 粗采样下 Hazard 中途穿越仍被捕获；(ii) 同样输入在细采样下搜索退化。
6. **冻结建议**：给出应写入契约的**精确不等式与判定规则**，逐条标依据（碰撞可靠性 / 搜索能力 / 预算）。

### 产出

`evidence/b1-grid-sampling.md` + `scripts/b1-grid-sampling-probe.mjs` + 原始输出。

### 边界

只读 P0 模型与源码；不改产品目录；不 commit。

## Answer

（待补）

## Answer

证据：[`evidence/b1-grid-sampling.md`](../evidence/b1-grid-sampling.md)；原始输出 [`evidence/b1-probe.out.json`](../evidence/b1-probe.out.json)；探针 [`scripts/b1-grid-sampling-probe.mjs`](../scripts/b1-grid-sampling-probe.mjs)（EXIT=0）。

**结论：方向没有写反，但原来那条不等式被误读了——存在两个不同的约束。**

1. **碰撞可靠性不依赖 `dt` 与 `xStep` 的关系。** `segmentCollides` 按折返点切段后解析求交，hazard 位置是连续精确值。反例：采样点 `t=0`、`t=1000` 全安全，hazard 在 `t=476` 中途穿过玩家（该区间 hazard 位移 2000px = 1000 个 xStep），仍被捕获；N=2/4/8/16 四种粗细全部捕获。
2. **搜索可行性才是 `≥` 方向。** `maxSpeed · periodMs / N ≥ xStep` ⇔ `N ≤ floor(maxSpeed · periodMs / xStep)`。实测 N=100（maxStepPx=2.0）正常，N=101（1.98）立即退化为 `statesVisited == N` 且 `no-witness-found`。
3. **违反 `≥` 只会产生 IE，不会产生错误结论** ⇒ 它是能力约束，应写进「能力 / 降级」条款，不是 G-06 的安全性条款。
4. **不建议冻结 `v_hazard · dt ≤ xStep`**：它只对逐点采样实现成立，对解析实现既不必要，又会要求「hazard 越快采样越粗」，削弱能力。

**建议条文**：`N ≥ 2`；`N ≤ floor(maxSpeed · periodMs / xStep)`；上界内取最大 N，受预算约束；无法满足 ⇒ IE（`grid-resolution-infeasible`）；不设 `≤` 方向约束。

**边界**：若生产实现改变求交方式（回退到逐点采样），第 4 条不成立，必须重新论证。
