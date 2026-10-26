# 16. smoke 可玩性：自动玩家不会跳巡逻 hazard（create 已 pass）

Type: grilling
Status: resolved
Owner: main session · 2026-10-26
Map: ../map.md

## Question

票 05 第四次重跑：**create QA 已 pass**（exit 0，站点产出，五个真实缺口全修）。但 headless smoke 的
`playable` 场景 FAIL：自动玩家收集 scrap-1（1/4）后卡在**巡逻 hazard**（patroller-1，`motion cycle` x±100/3s），
12 次撞 hazard 重置、45s 超时。

根因：smoke 的跳跃启发式 `hazardAhead`（`playable-smoke.mjs:547-549`）**只看 hazard 当前 x**（`h.x - st.x < 100` 就跳），
**不看 motion**（虽然 `hazards` 状态已读了 `axis/distance/periodMs`，见 `:291`）。巡逻 hazard 在跳的过程中移动，
简单启发式时序对不上 → 撞上重置。

裁定怎么处置，至少覆盖：

1. **修 smoke 自动玩家**：跳跃启发式改成**时序感知**（按 hazard 的 motion 反推起跳时机 / 等 hazard 远离再跳），
   用已读到的 `axis/distance/periodMs` —— 这是测试改进，不动游戏。
2. **游戏设计避免移动 hazard**（demo 关卡不用巡逻 hazard）—— 让 smoke 现有启发式能过，但把「巡逻」这条机制挡在 demo 外。
3. **接受为已知限制**：人工验证「真人能跳过去」（截图/录屏证据），smoke 这条记为「自动玩家不会跳移动 hazard」的已知限制，
   不堵 P0-05（demo.md 判据是「真实操作能完成」，不要求自动化能完成）。

HITL：用户逐字裁定，不替用户答。

## Answer（裁定 · 2026-10-26 用户逐字）

**Q 裁定：选择 (1) 修 smoke 自动玩家。** 把 `playable-smoke.mjs` 的跳跃启发式改成**时序感知**——
按 hazard 的 `motion`（`axis` / `distance` / `periodMs`，`:291` 已读）反推起跳时机 / 等 hazard 远离再跳，
让自动玩家能跳过巡逻 hazard。这是测试改进，不动游戏、不动 create。

**裁定边界**：

1. **只动 smoke 测试**（`packages/demo/probe/playable-smoke.mjs` 的跳跃决策），不动 create / 游戏 / QA。
2. **用已读到的 motion 参数**：`hazards` 状态已有 `axis/distance/periodMs`，别重新造一套。
3. **验证**：重跑 `playable-smoke.mjs` 对 r4 真实站点，确认 `playable` 场景过（收集 4/4 + won）。
   零付费（smoke 是本地 headless Chrome，无上游调用）。

**为什么不选其他**：(2) 设计避免移动 hazard —— 把「巡逻」机制挡在 demo 外，是**收缩验收范围**、不是修缺口；
(3) 接受为已知限制 —— demo.md P0-05 要「真实操作能完成」，smoke 就是那个自动化的「真实操作」代理，
   留一个会红的 smoke 等于 P0-05 没被机器守住。

**补记（2026-10-26）**：实施落 [票 17](../issues/17-smoke-patrol-aware.md)。
