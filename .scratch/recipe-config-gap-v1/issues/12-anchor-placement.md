# 12. compile-runtime 非底边锚点的摆法：entity 出界

Type: task
Status: resolved
Owner: main session · 2026-10-24
Blocked by: 07
Map: ../map.md

## Question

compile-runtime 把 `wrecked-vehicle`（anchor `(0.5, 0.3)`，非底边）摆到 `at.y = 地面线`，盒子底边伸出地面线 28px、
被判「落在世界之外」。修 compile-runtime 提示词，让模型按**每个资源的真实 anchor** 摆。

## 诊断（E1 源码 + E3 现场）

- `entityBox(at, size, anchor)`（`game-config.ts:126`）：`y = at.y − anchor.y·size.h`，`bottom = at.y + (1−anchor.y)·size.h`。
- `resourceBrief`（`ops.ts:898`）**已经**把每个资源的「锚点 {x, y}」写进清单给模型看。
- 铁律 #3 只教了「**底边中心**（0.5,1）写 `at.y = 地面线`」，没教 anchor 不是底边的资源怎么摆 —— 模型把 vehicle
  （anchor 0.3）照「底边」写了 `at.y = 250`，底边到 278 > 270 出界。票 10 的重采样救不了（模型 3/3 都这么写，是
  **系统性的提示词盲区**，不是偶发）。

## 落地

- `packages/assets/src/ops.ts` 铁律 #3 补一句：**anchor 不是底边的资源**（清单里 `锚点 {x,y}` 的 `y < 1`）站在地面上时，
  `at.y = 地面线 − (1 − anchor.y) × 高`（例：anchor y=0.3、高 40 ⇒ `at.y = 地面线 − 28`），别写成 `地面线`。
- 全仓 1855 测试绿、`assets` typecheck 绿。
