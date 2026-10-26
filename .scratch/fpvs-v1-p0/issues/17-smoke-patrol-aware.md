# 17. smoke 自动玩家：跳跃启发式时序感知（跳巡逻 hazard）

Type: task
Status: open
Blocked by: 16
Map: ../map.md

## Question

按票 16 裁定实施：改 `packages/demo/probe/playable-smoke.mjs` 的跳跃启发式，让自动玩家能跳过**巡逻 hazard**
（`motion: {kind:"cycle", axis, distance, periodMs}`）。修票 05 的 smoke `playable` 卡点（patroller-1，12 次撞 hazard 重置）。

实施范围：

1. **定位**：`shouldJump`（约 `:505-553`）里 `hazardAhead`（`:547-549`）只看 `h.x - st.x < 100`，不看 motion。
2. **时序感知**：对 `distance > 0` 的巡逻 hazard，起跳时机要**考虑它在移动**（如：等 hazard 远离 / 按
   `axis/distance/periodMs` 推它当前位置与移动方向 / 把整个巡逻范围当危险区、提前起跳越过整段）。
   具体算法落地时定；`hazards` 状态已有 `axis/distance/periodMs`（`:291`），别再造一套读取。
3. **验证（零付费）**：重跑 `playable-smoke.mjs --pack r4 包 --config r4 config`，确认 `playable` 过
   （collected 4/4 + won）；顺带确认 `hazard-reset`/`hazard-legacy` 这两个软锁专项仍按预期（本关卡无该场景，可仍 FAIL，
   但要看清是不是受本次改动误伤）。

边界：零付费（smoke 本地 headless Chrome，无上游）；只动 `playable-smoke.mjs` 的跳跃决策，不动 create/游戏/QA；
不动 smoke 的轨迹/证据格式。

## 收口（2026-10-26 · 时序感知跳已落 · smoke playable 1/4 → 3/4 · 仍有 1 缺口）

- `playable-smoke.mjs`：`READ_STATE` 加读 hazard 的 `t0`；`shouldJump` 的 `hazardAhead` 对 `distance>0` 的巡逻 hazard
  只在 **phase<0.5**（三角波向 + 方向移动、远离左侧玩家）时起跳，否则等它远离再跳。
- 效果：smoke `playable` 从 **collected 1/4 → 3/4**（过 patroller-1、捡到 scrap-3），但仍撞 patroller-2 重置、随后陷入重置循环。
- ⚠️ **试过「停住等」**（phase≥0.5 时松右键），**回退**：停住时起跳 = 原地跳（无前进动量），反降回 1/4。已撤。
- **根本缺口（已量）**：一跳跨度 ~66px（speed90·jumpVelocity330·gravity900 定死、无变高跳），patrol 范围 100px；
  玩家从起跳到走远过 hazard 最远点需 ~1.64s，而 hazard 0.5 周期才 1.5s 就折返 —— **差 ~0.14s**，单跳+走法过不去，
  必须多跳且时序极准，或 patrol 范围收窄。这不是简单启发式能补的，是关卡几何 vs 跳跃物理的张力。
- 全仓 test 不受影响（smoke 是独立命令）；`node --check` 过。

**结论**：时序感知跳（phase<0.5）是真实改进（1/4→3/4），但 full pass（4/4+won）卡在「patrol 100px vs 跳 66px」的物理张力，
需裁定：收窄 patrol 范围（设计层，回票 05 前改）/ 多跳策略（smoke 更复杂）/ 接受 3/4 为已知限制。
