# 起草 A 的 intent 与关卡概念

Type: task
Status: resolved
Blocked by: （无）

## Question

在不调用任何付费上游的前提下，为候选 A（平台探索/收集）起草输入草案：

- 新 `intent` 文本：明确目标、核心循环、玩家体验；不得引入当前 `platformer/v1` 之外的机制；
- 关卡概念：横向多层平台、收集物、gate；遵守 `world.size.h=270`、跳跃顶点/横跨距离约束；不使用 hazard/avoid-danger/moving-platform；
- 所需资源清单（玩家 idle/run/jump、背景、solid、pickup、goal、HUD；宝箱可选）；
- 说明与废土寻宝 Demo 的差异，以及它验证的是「第二个独立 Demo」而非仅换关卡。

产物：`.scratch/p0-02-second-demo/inputs/a-intent.md`、`a-level-concept.md`、`a-assets.md`。不得付费、不得写生产代码。

## Answer

**已收口（2026-10-29，仅起草；零付费、零生成、零生产修改）。**

- 概念：**屋顶信使（Skyline Courier）**——黄昏城市天际线，收集 4 封信，穿过屋顶/雨棚/水塔/天线平台，到达钟楼门。
- 机制：核心只用 `collect-pickup` + `reach-goal`；`open-chest` 可选；不使用 hazard / avoid-danger / moving-platform。
- 关卡：世界约 2400×270；5 段屋顶；所有向上台阶 ≤50px、水平缺口 ≤55px（在跳跃上限 60.5px / 66px 内）；4 封信 + 终点 gate。
- 资源：玩家 idle/run/jump、三层 480×270 背景、4 类 solid、信件、钟楼门、HUD panel/pip、可选信箱；16 色统一色板；`generated` 路线，不复用冻结包。
- 新参考图要求：黄昏蓝绿天空 + 暖窗光 + 屋顶/天线/水塔剪影，16 色左右色板，无 UI/文字。

产物：[a-intent.md](../inputs/a-intent.md) · [a-level-concept.md](../inputs/a-level-concept.md) · [a-assets.md](../inputs/a-assets.md)

**下一步：票 04「批准 A 的输入与新参考图」（HITL）**——由用户确认/修改概念并批准参考 PNG；未批准前不得付费生图。
