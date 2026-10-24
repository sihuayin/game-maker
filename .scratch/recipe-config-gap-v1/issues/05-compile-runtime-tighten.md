# 05. 地形 prop + compile-runtime 收紧

Type: task
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 02, 03
Map: ../map.md

## Question

按票 03 裁定落地地形 prop 侧；compile-runtime 加前置闸（清单缺 solid/decor 资源时在 LLM 调用前明确拒）
+ 提示词收紧（禁止拿玩家/动画资源当 solid/decor 实体）。

## 边界

- 改的是 `packages/assets`（compile-runtime 提示词 + 前置闸），配 witness 测试。
- 前置闸要「缺资源就拒」而非「乱填到 5 条硬失败」，失败点更早、账目分得开。
- 不碰生图/付费；测试产物只写 `out/` 或本 effort 目录。

## Answer

**已实现（2026-10-23）** —— 按票 03 的 (c) 落地三处，全仓 1851 测试绿、contracts/assets typecheck 绿：

- **solid/decor → `sprite` kind 锁**（`packages/contracts/src/game-config.ts` 的实体引用循环）：
  `solid` / `decor` 实体引用资源时加 `["sprite"]` 锁 —— 「拿玩家动画当地形」从「多动画缺 anim」这种间接失败
  变成「是 animation，这里要的是 sprite」的**构建期 kind 拒绝**（与 player/hud 同口径）。这是 (c) 的**确定性底线**。
- **compile-runtime 提示词收紧**（`packages/assets/src/ops.ts` 铁律 #5 加一条）：`solid` / `decor` 只能引 `sprite`、
  **禁止拿玩家角色（animation）当地形**；清单没有 sprite 地形资源时地面用 `terrain`（看不见的碰撞）搭、**不要硬造 solid**。
  → 这是 (c) 的「缺 sprite 退 terrain」安全网（**退化，不是硬拒**）。
- **recipe 产地形 sprite 正向线索**（`packages/assets/src/prompt.ts`）：platformer 的 `solid`/`decor` 只能引 sprite，
  若 layout 要地面砖/台阶/碎石堆/斜坡，产一件对应 `sprite`。→ (c) 的正向路径。

**witness**（`packages/contracts/tests/game-config.test.ts` 引用族加 1 用例）：`solid`/`decor` 实体引用
`player-traveler`（animation）⇒ 报「是 animation，这里要的是 sprite」。

**口径澄清**：票 03 (c) 选的是「缺 sprite 退 terrain」，不是「缺 sprite 硬拒」——所以原 Question 里的「前置闸
（LLM 调用前明确拒）」**未照字面做**；改为 kind 锁（`auditGameConfig` 业务校验，post-LLM 但确定性）+ 提示词退化
（pre-LLM 正向引导）。失败点依然比原来早且清晰（构建期 kind 拒绝，而不是模型乱填到 5 条硬失败）。

**⚠️ 修正（票 06 免费验收时抓的）**：初版把 `decor` 也锁成 `sprite`，跑 `playable-smoke` 时**误伤了 v7 真配置**
——它的 `decor` 实体合法引用 `ceiling-lurker`（animation，带 anim）与 `health-icon`（ui）。已改为**只锁 `solid`**：
`decor` 是纯装饰、不加锁（sprite/animation/ui 都合法）。witness 也拆成「solid 负例 + decor 正例」两条。修正后
全仓 1853 绿 + `playable-smoke` 全绿。
