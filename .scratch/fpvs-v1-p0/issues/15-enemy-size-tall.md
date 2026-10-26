# 15. enemy 尺寸改成高比例（patrol 帧表 AR 对齐模型画法）

Type: task
Status: resolved
Owner: main session · 2026-10-26
Blocked by: 14
Map: ../map.md

## Question

按票 14 裁定实施：把 enemy 的设计框从 32×32 改成**高比例**（24×32 或 32×48），匹配模型实际把 enemy
画成高挑机器人的比例，patrol 帧表 AR 目标从 1.0 压到 ~0.75，与模型画法对齐、`constructive-constraint` 过。

实施范围：

1. **定位 enemy 尺寸从哪来**：enemy 的 32×32 是 `plan-assets` 模型选的（`assetPlanPrompt` 不指定尺寸，
   设计层 `GameDesignSpec.enemies[]` 无尺寸字段）。确定最小改动点：
   - `assetPlanPrompt` 让模型按 silhouette/身份定尺寸（高挑机器人 → 高框、宽体 → 宽框），或
   - 设计层加实体尺寸/比例字段（确定性，可能更重）。
2. **改 enemy 一个**：hero 8.2% 已过不动；只让 enemy 定成 24×32（或 32×48）。
3. **测试**：prompt 测试（`assetPlanPrompt` 含「按比例定尺寸」规则）；若有设计层字段，加契约测试。
4. **验证（免费离线，零付费）**：
   - 全仓 test + typecheck 绿。
   - E3（零付费）：r3 现场 `game-design.json`/`asset-recipe.json` 对照新规则，确认 enemy 该定成高框。

边界：零付费；只动 enemy；不动 `constructive-constraint` 阈值、不动票 13 的网格推导；不动 hero。

## 收口（2026-10-26 · 代码已落，零付费验证已过）

- 定位：enemy 的 32×32 是 `plan-assets` 模型选的（`assetPlanPrompt` 不指定尺寸、设计层无实体尺寸字段、
  角色 DNA 也不进 plan-assets）。最小改动点 = **`assetPlanPrompt` 加一条「按身份定尺寸」规则**（不是设计层字段，避免动契约）。
- `packages/assets/src/prompt.ts`：`assetPlanPrompt` 加「**角色类资源按身份定尺寸**」——高挑人形/机器人（守卫/哨兵/骑士）
  用高框（24×32 / 32×48）、Q 版/矮胖/方形照旧用方框（32×32）。只给方向，不硬码 enemy id。
- `packages/assets/tests/prompt.test.ts`：+1（断「按身份定尺寸 / 高框 / 方框」）。
- 全仓 1990/1990 · typecheck 绿。

**结论**：enemy 该画高框的方向已写进提示词。⚠️ **它是提示词、不是确定性** —— 模型是否真把 enemy 定成高框
（24×32 / 32×48）只有真调用能证。下一个动作 = 回票 05 重跑付费 E2E（需重新授权）。
