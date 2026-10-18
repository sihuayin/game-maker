# 02. qaRunner 的 inspect 观察输入接口

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线；第二轮已收口，见 [06](06-round-2-rulings.md))
Blocked by: —
Map: ../map.md
> 第一轮 Q4 = (a)：pipeline 调 `inspectPack`，把观察输入传入 `qaRunner`；qa 仍只装配。
> 本票只定**接口形状**，不动报告契约。

## Question

`qaRunner` 现在只吃 `QaContext`（全是路径）。inspect 观察怎么传进去？

1. **(a)** `QaContext` 加可选 `inspectObservation?: Observation`（contracts 的 TS 类型；不落盘、不升 schema）：
   pipeline 构造；qaRunner 用它；没给 ⇒ 保持旧的 `unavailable`。
2. **(b)** `QaRunner` 改成 `(ctx, input?: { inspectObservation?: Observation })`；所有实现/调用方更新。
3. **(c)** 新 `QaObservationInput` 类型 + qaRunner 工厂；更重。
4. **(d)** pipeline 拿 `qaRunner` 的报告后**后处理**替换 inspect 观察（把装配挪出 qa，不推荐）。

必须一并定：
- 字段名与语义；只接受 `source: "inspect"` 的观察吗（review 注入明确不在本图）？
- 没传时（standalone qaRunner / 旧调用方）是否保持今天的 `unavailable`（向后兼容）？
- `QaContext` 是 contracts 里的**输入类型**、不落盘 —— 加可选字段是否算「报告契约不变」（不是）。
- 观察的 `ok`/`unavailable` 都由 pipeline 决定；qaRunner 不得改写/重新计算。


## 第二轮裁定（收口，见 [06](06-round-2-rulings.md)）

见 06 的逐字裁定；本票的接口/内容/失败语义已按 Q9–Q11 收敛。
