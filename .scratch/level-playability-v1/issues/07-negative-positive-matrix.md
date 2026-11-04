# 合成负例与合法边界矩阵

Type: task
Status: open
Owner: —
Blocked by: 03, 04, 05
Map: ../map.md

## Question

根据 03–05 的候选判据，设计**合成负例 + 合法边界**的最小测试矩阵，证明判据会响且不误伤。只做矩阵与 scratch fixture，不实现生产判据。

### 必须覆盖的负例（至少）

- 沟壑造成必经路线中断；
- 台阶/落脚点使跳跃无法完成；
- 巡逻 hazard 封死唯一通路；
- 危险区不存在可通过的安全窗口；
- 必需拾取物被地形或机制封死；
- 目标位置无法到达或不可站立；
- 出生点卡在实心体内；
- 实体/目标越界。

### 每个用例必须给出

1. 最小 fixture（scratch 下的 config + manifest；标注「非生产」）；
2. 预期判定：`PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER`；
3. 预期判据 id、失败定位字段；
4. 合法边界配对：同一判据下的「合法但接近阈值」用例，预期 `NO_PROVEN_BLOCKER`；
5. 与历史语料的区分：合成负例只证明判据会响，不替代 08 的零误伤基线。

### 输出

- `../test-matrix.md`（矩阵 + 预期结果 + 定位字段）。
- `../fixtures/**` 下的 scratch fixture（明确标注非生产）。
- 本票 `## Answer` 摘要；更新 map 的 Decisions so far。

### 边界

- 不写生产测试、不改 `packages/**`。
- 不把矩阵规模扩大到 03–05 未裁定的判据。
- 不声称合成负例通过就等于真实关卡可玩性已验证。
