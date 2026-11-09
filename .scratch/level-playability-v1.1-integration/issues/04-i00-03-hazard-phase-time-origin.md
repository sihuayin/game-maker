# I00-03 Hazard 运动相位与时间起点

Type: research
Status: open
Owner: —
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
