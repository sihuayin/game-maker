# 02. 现状审计：planner / recipe / pack 的真实调用关系

Type: task
Status: resolved
Owner: claude (2026-10-18 · AFK)
Blocked by: —
Map: ../map.md
> PRD Task 1 的本地审计（零上游、零付费）。不重构、不改代码；只把「PRD 的措辞」与「盘上的事实」对齐。

## Question

当前 `deriveRecipe` / `planAssets` / AssetSpec / AssetRecipe / `pack` 三条路线的真实调用关系是什么？
PRD 的哪些前提已过时？哪些缺口是真的？

## Answer

- **`deriveRecipe` 已不存在**：v2 [票 12](../../game-maker-v2/issues/12-asset-planner.md) 已把它合并成
  `planAssets`（`packages/assets/src/ops.ts:236`）。当前唯一规划入口是 `planAssets`；CLI `plan` / MCP
  `plan_assets` / `create-game` 都调它。⇒ PRD 的「取代 deriveRecipe」应读作「在 `planAssets` 内收敛路线职责」。
- **`planAssets` 是模型驱动的单次强制工具调用**：输入 design + visual-world + transport + outRoot；
  输出经 `parseRecipe` 的 Recipe；路线选择由 `assetPlanPrompt`（`packages/assets/src/prompt.ts:839`）
  用类别建议引导模型；现有测试 `plan-assets.test.ts:180` 保护「`source.kind` 不写死」。
- **`pack` 已按 `source.kind` 严格分派**：drawlist（`pack.ts:559`）/ image（`:586`）/ import（else 分支）；
  非法枚举在 `parseRecipe` 被拒；没有按名称/后缀重新推断。
- **合法路线已经只有三值**：`image` / `drawlist` / `import`（`contracts/src/recipe.ts:123`），无 `derived`。
- **真实缺口**：
  1. 路线决策住在长提示词里，没有确定性 `resolveRoute` 模块；
  2. 没有 plan sidecar / decision reason；
  3. `PlanAssetsOptions` 没有能力输入（`ops.ts:75-84`）；
  4. VWS 只有 `styleReferences`（`visual-world.ts:267`），create 链没有既有素材输入 ⇒ `import` 只对手写 Recipe 可达；
  5. 「同一输入可重复」与模型调用之间的语义未定义。
- **不需要改的**：Pack 目录/原子发布、CLI/MCP 形状、Recipe Schema、RuntimeProfile 分派。
