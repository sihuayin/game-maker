# 18. patrol 范围收窄闸：motion.distance ≤ 跳跃跨度

Type: task
Status: open
Blocked by: 17
Map: ../map.md

## Question

按票 17 收尾裁定实施：加**确定性约束**把巡逻 hazard 的 `motion.distance` 压到**能跳过的范围**（≤ 玩家跳跃跨度 ~66px）。
修 smoke `playable` 的 full pass 卡点（patrol 100px vs 跳 66px，玩家 ~0.14s 短）。

实施范围：

1. **定位**：`motion.distance`（hazard 的巡逻范围）由 `compile-runtime` 生成，目前无约束。玩家跳跃跨度 = `jumpSpan(move)`
   （`game-config.ts:269`，speed90/jumpVelocity330/gravity900 → ~66px）。
2. **确定性约束**：hazard 的 `motion.distance` ≤ `jumpSpan(move)`（或更保守的阈值，考虑 hazard 体宽 + 玩家体宽）。
   落在 config 校验层（类似 `auditLayerCoverage` / `auditScreenSpace`，住 `contracts`，compile-runtime + QA 共用）。
3. **机制待定**：拒收重采样（同票 08 闸）vs 确定性 clamp（压到阈值）。倾向**提示词 + 闸**（提示词让模型写小距离，
   闸兜底拒绝过宽的），与票 08/09 同款；具体开票后定。
4. **验证（零付费）**：单测 + 重跑 r4 config 过闸（或 clamp）确认 patrol 距离收窄；重跑 smoke `playable` 确认 4/4 + won。

边界：零付费；只动 patrol 距离的约束（config 层），不动 smoke（票 17 已改时序感知跳）、不动 create/生图、不动 `jumpSpan` 物理。

## 收口（2026-10-26 · 尝试钳位 · **结论：这个方向是错的，撤**）

- 试过：`compile-runtime` 加 `clampPatrolRange`（hazard 的 `motion.distance` 钳到 `jumpSpan`）——
  结果 `compile-runtime.test.ts` 立刻红：`fixtures/game-configs/last-train.json` 的 `carriage`（hazard）`distance=200`
  是**合法的宽巡逻**（火车沿轨道往返，玩家是**躲**它、不是跳它），被钳成 66 是错的。
- **根本结论**：「巡逻范围 ≤ 跳跃跨度」**不是一条普适约束** —— 宽巡逻是合法设计（躲 vs 跳是玩法语义，
  不能从几何推）。硬钳会误伤合法关卡（last-train 就是反例）。**已撤**。
- 真实问题回到票 17 的量测：smoke 自动玩家跳不过**移动** hazard 的宽巡逻，是**自动玩家（测试）的限制**，
  不是游戏设计 bug —— 真人能掐时间跳过去。create 管线 + QA 都过，游戏是可玩的。

**结论**：票 18 方向作废。回到票 05 收尾—— smoke `playable` 3/4 记为**已知限制**（自动玩家跳不过移动宽巡逻），
不堵 demo.md 的 P0-05（判据是「真实操作能完成」，非「自动化能完成」）。
