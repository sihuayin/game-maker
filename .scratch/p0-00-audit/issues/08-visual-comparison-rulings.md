# 08. 视觉对照裁定（W6 保留的 Q1 / Q2）

Type: grilling
Status: resolved
Owner: —
Blocked by: —
Map: ../map.md

## Question

W6 已取得客观运行证据，但两项视觉判断按用户裁定保留：

- **Q1 风格一致度**：HEAD 重放站点与参考图相比，色彩、轮廓、细节密度、材质表达是否达到可接受标准？
- **Q2 新实体同世界**：参考图未出现的 `ceiling-lurker` / `wasteland-enemy` / `extraction-point`
  是否融入同一个视觉世界？

对照材料（用户要求「并排 / 逐件」）：

- `../runs/2026-10-20a-head-replay/visual-compare/q1-reference-vs-site.png`
  （参考图 vs 胜利画面）
- `../runs/2026-10-20a-head-replay/visual-compare/q1-reference-vs-site-mid.png`
  （参考图 vs 中段画面，无胜利横幅）
- `../runs/2026-10-20a-head-replay/visual-compare/q2-entities-vs-world.png`
  （参考图 / 站点缩略 / 三件新实体 8x 原图）
- 逐件：`q2-ceiling-lurker.png` / `q2-wasteland-enemy.png` / `q2-extraction-point.png`

## 验收

- 用户对 Q1 / Q2 各给出明确裁定：一致 / 不一致 / 不确定（若不确定，写明还缺什么对照）。
- 若裁定「不一致」或「不确定」，登记为视觉缺口或后续 P0 候选；**不得改写成「已通过」**。

## 边界

- HITL：视觉判断由用户做，代理只准备材料。
- 零付费；不重新生图、不跑 `review`（付费视觉调用）。
- 不改源码 / Schema；本票只写裁定与证据链接。

## 产出

本票 `## Answer` 逐字记录用户裁定；把结论索引到地图；若产生视觉缺口，交给综合票（07）。

## Answer（2026-10-20 · grilling/HITL · 用户裁定）

### 用户裁定（逐字）

| 问题 | 裁定 | 结论 |
| --- | --- | --- |
| Q1 整体风格一致度 | (a) | 整体可接受。色彩、工业废土题材、硬边像素轮廓和材质表达基本统一；记录暗部偏重、局部细节密集的观察项 |
| Q2 新实体同世界 | (b) | 整体世界观兼容，但存在局部视觉缺口。重点检查 ceiling-lurker 的剪影可读性和 extraction-point 的像素尺度、材质分块；wasteland-enemy 暂不作为风格漂移定性 |

### 对 P0-00 综合票的影响（逐字）

这次裁定不改变 W6 的执行结论，也不改变证据边界：

1. HEAD 下游重放仍然是基于 pack v7 和手写 config 的下游证据，不能宣称 HEAD 单跑 E2E 通过。
2. 整体风格达到可接受标准，不代表视觉 QA 已具备自动判断风格一致性的能力。
3. 三个实体的局部视觉缺口进入综合票，按影响和修复成本确定优先级；不要因此默认触发全量资源重生成。
4. 危险物导致玩家掉穿地面、不可恢复的玩法缺陷，仍应独立保留为高优先级候选，不能被本轮视觉裁定覆盖。

**最终结论**：整体视觉方向成立，暂不因整体风格推翻当前资源包；局部资源的辨识度和像素表达需要进入后续改进清单。

### 收口

- Q1 = (a)：整体风格可接受；观察项「暗部偏重」「局部细节密集」登记，不作为阻断。
- Q2 = (b)：世界观整体兼容；局部缺口 = `ceiling-lurker` 剪影可读性、`extraction-point` 像素尺度与材质分块；
  `wasteland-enemy` **不定性为风格漂移**。
- 这些缺口交给 [综合票 07](07-synthesis-gap-table-p0-scope.md) 按影响 / 修复成本排序；
  **不默认全量重生成**。
- W6 的客观结论与证据边界不变；危险物掉穿地面仍是独立的高优先级候选。
