# 案例 C：不确定输入 → INSUFFICIENT_EVIDENCE

> 本目录只准备**分析器输入**，不构造 Runtime 站点（票面允许）。不做 P0-03 的案例判断。
> 几何绑定 `fixtures/packs/last-train/v2` 的资源；不确定的是**分析器调用方能建立的确定性**。

## C1：时间相位不可确定

[`analyzer-phase-unknown.json`](analyzer-phase-unknown.json)

- 几何沿用案例 A 的移动 Hazard；`certainty.phase = "unknown"`。
- 对应 P0-01R 未确认事项：U1（页面隐藏期间的 `t0` 冻结/慢走）与 U8（首次渲染相位）。
- 冻结原型预期：`INSUFFICIENT_EVIDENCE` / `phase-uncertain`。

## C2：碰撞边界不可追溯

[`analyzer-hitbox-unverifiable.json`](analyzer-hitbox-unverifiable.json)

- 几何使用动画 Hazard（`hazard-sweeping-carriage`，2 帧）；`certainty.hitbox = "unverifiable"`。
- 对应 P0-01R 未确认事项：U3（任意 pack 的帧几何 == manifest 不变量不由 schema 强制）、
  U6（动画换帧对命中体几何的影响在非 accepted pack 下无上界）。
- 冻结原型预期：`INSUFFICIENT_EVIDENCE` / `hitbox-uncertain`。

## 关于 lag 敏感性

两个输入都写入 `lagMs=200`；原型在**确定性输入门**就返回 IE，`lagMs` 根本不被消费。
因此以 `16.67ms` 重跑会得到**同一个** `INSUFFICIENT_EVIDENCE` 与原因；P0-03 应复核并记录这一点。
C 的 IE **不是**「不可玩」结论，只是模型边界。
