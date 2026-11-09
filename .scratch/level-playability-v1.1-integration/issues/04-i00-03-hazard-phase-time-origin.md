# I00-03 Hazard 运动相位与时间起点

Type: research
Status: resolved
Owner: research subagent · 2026-11-09
Blocked by: 01
Map: ../map.md
Class: I-00 / EVIDENCE

## Question

PRD FR-01 / FR-07 / G-03 要求运动相位与时间模型「明确且可验证」；现有 `Motion`（`game-config.ts:79-85`）没有 phase 字段，三角波从 `t=0` 起算（`packages/demo/src/hazard.ts:14-19`），P0 的 U1（页面隐藏期间 `t0` 行为）与 U8（首帧渲染相位）仍未确认。

### 必须回答

1. **权威 `t=0`**：游戏时间 `T` 在哪里被创建与累计（`packages/demo/src/shell/scene.ts:161,271-281`）？关卡开始、首帧渲染、玩家首次可操作之间的关系是什么？这四者是否同一时刻。
2. **相位的可推导性**：给定 config + pack + 起点，能否唯一确定「玩家抵达危险区域时刻」的 hazard 相位？若不能，缺的是哪一个量（关卡起点时间 / 首帧 delta / 页面可见性）。
3. **页面暂停与后台计时**：源码路径上 `delta` 如何被 clamp（Phaser `TimeStep.js:174,576-585`）；`visibilitychange` / 页面隐藏时是否暂停循环。给出「可支持范围」与「必须降级」的分界。
4. **契约选项**：(a) 相位当自由变量（P0 做法）；(b) 要求调用方显式提供起点时间；(c) 由审计自行推导；(d) 拒绝任何相位不确定的关卡。逐项说明对误判方向的影响（假阴 / 假阳）与所需授权。
5. **与 `lagMs` 的耦合**：相位不确定性与一帧滞后是否会被重复计算，还是各自独立。

### 产出

`evidence/03-phase-time-origin.md`：时间线图、未确认项清单、契约选项对比。**不实施。**

## Answer

- **权威 `t=0` 是场景 `create()`，`t0: 0`（`packages/demo/src/shell/scene.ts:161`），每帧 `h.t0 += delta`（`:272`）。`create` 由图集加载完成回调触发、发生在两帧之间；**首帧渲染与首次可操作同帧**（`Game.js:498,514`），但比 `create` 晚一帧。⇒ 玩家**看不到**相位 0，第一张可见画面是 `P(delta₁)`。
- **`delta` 的源码上界是 200ms**（`minFps=5`、`smoothStep`、`deltaHistory=10`：`TimeStep.js:99,174,576-585`；站点未覆盖 fps：`entry.ts:75-85`）。`delta₁ ∈ [0, 200ms]` 可证（正常路径约一帧），**具体值未测量**（P0 U8 从「未测量」收紧为「有 ≤200ms 上界」）。
- **相位的可推导性：位置↔游戏时间是确定的（`hazard.ts:14-19`），零点也是确定的（恒 0）；缺的只有「玩家抵达的游戏时刻 `T_arr`」**——它来自输入轨迹，不在 config/pack 里。票面三个候选里：关卡起点时间**不是**自由量（运行时恒 0），首帧 delta **是有界小量**（≤200ms，不累积），页面可见性**不产生额外相位偏移**（不补帧）。
- **只要「存在安全等待格（在 `sweptBox` 之外、可达）」成立，抵达相位就取满整个 `[0, periodMs)`**——这是可证明的模型事实，不是「测不到只好放弃」。该前提可由 config+manifest 判定，但本票未实现/未测量（新增 U9）；前提不成立时必须降级。
- **页面暂停/后台：没有补帧、没有跳变。** `onHidden` 只调 `TimeStep.pause()` 记录时刻（`Game.js:592`、`TimeStep.js:468-471`），RAF 循环不看可见性（`RequestAnimationFrame.js:89-96`），回前台 `resetDelta` + 120 帧冷却（`TimeStep.js:494-514`）。**可支持**：game-time 模型、单帧 ≤200ms、回前台无尖峰。**必须降级**：任何墙钟判据、隐藏期间走了多少、首帧相位具体值。隐藏页到底派发几次 RAF **不在仓库内**（U1 仍未解除）。
- **契约选项**：(a) 相位自由——FP 最低（FP-B 天然保守），但需「安全等待格」前提，不改公共契约；(b) 调用方给起点——相位变成不可验证的声明，FP 上升，需 PRD §9.2 公共输入授权（b2 还要改 `Motion` + `scene.ts`，并改变所有现存关卡语义）；(c) 审计自行推导——只能推出 `t0=0`，推不出 `T_arr`，会把不确定藏进实现，FP 最高；(d) 拒绝——FP 为零、FN 最大，**且今天已经是事实行为**（`mechanic.ts:119` gap ⇒ `verdict.ts:113` ⇒ `api.ts:87-92`；`last-train` fixture 实测 `verdict=INSUFFICIENT_EVIDENCE`）。
- **与 `lagMs`：成因正交、不会重复计算错误，但会重复保守。** `lagMs` 来自「物理步在 `scene.update` 之前 ⇒ hazard 碰撞位姿落后一帧」（`ArcadePhysics.js:142`、`Systems.js:356-366`、`scene.ts:79-82`），有界 ≤200ms；相位不确定性来自「抵达时刻自由」，量级是整个周期。在相位自由模型里 lag 带是相位扫描的子集；一旦相位被钉死，`lagMs` 是唯一覆盖采样缺口的量。玩家输入延迟（`:84-91`，下一物理步生效）永远不被相位自由吸收。
- **证据**：[`../evidence/03-phase-time-origin.md`](../evidence/03-phase-time-origin.md)；复跑 `node .scratch/level-playability-v1.1-integration/scripts/phase-origin-probe.mjs`（61/61 锚点，`EXIT=0`），`npx vitest run …`（10 + 34 passed，`EXIT=0`）。
