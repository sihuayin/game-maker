# 03. Asset Planner 不再产出角色母版：0 masters

Type: task
Status: resolved
Owner: claude (2026-10-18 · 人裁「施工 03」→「提交 并 关票」)
Blocked by: —
Map: ../map.md
> 派生自 B 阶段（`runs/2026-10-18d/`）：19 个资源、18 次预计生图、**母版 0 张**。
> 旧 v2 配方（`run-out-2026-10-17d`）有 2 张母版。C 探针手工补了一张才测到 DNA→母版→动画。
> ⚠️ **立票 ≠ 批准施工**。

## 1 · 证据

- B 清单：`animation×6 · sprite×9 · background×1 · ui×3`；`imageCallBreakdown.master = 0`。
- 三个 `characterId`（`scavenger-actor` / `wasteland-enemy` / `ceiling-lurker`）都没有 `masterAsset`，
  `authoring[]` 为空。
- 旧配方有 `master-player-scavenger` / `master-enemy-wasteland`，动画 spec 带 `masterAsset`。
- 探针 `probe-player-recipe.json` 手工补 master 后，pack 能走通母版→动画。

## 2 · 要做什么

- 查清 v3 planner 是否**有意**去掉母版，还是提示词/后处理漏了。
- 若是漏了：让 planner 为每个有 `characterId` 的动画资源生成 `authoring[]` 母版条目并写 `masterAsset`。
- 若不是漏了：在票面记录理由，并更新测试/文档，避免“角色一致性靠 DNA 直出”成为未声明行为。

## 3 · 验收

1. 一份 fixture 设计 → plan 产出中，每个角色至少一张母版、每个动画 `masterAsset` 指向它。
2. 先红后绿。
3. 不改变旧清单的行为（无 `masterAsset` 仍可跑）。

## 4 · 边界

- 不跑付费上游；不写 `game-maker.local.json`。
- 不改变 master 比例判据（另票 / 雾）。

## 5 · 调查结论（2026-10-18）

**不是有意去掉母版，是提示词允许 + 无人兜底。**

- 契约（`AuthoringAsset` / `masterAsset`）与 `pack` 的母版生成链路一直完整，没有任何代码剥掉 `authoring[]`；
  `planAssets` 只是把模型给的清单原样过契约、改写路线。
- 问题在两份提示词：`PLAN_TOOL_DESCRIPTION` 第 4 条逐字写着「母版**不必每份清单都有**」，
  `assetPlanPrompt` 写着「`authoring[]` **只有真给了母版才写**」——**省略是合法的**。
- 链上**没有任何一步**要求「有 `characterId` 的 animation 必须指一张母版」⇒ B 跑的 3 个角色、0 张母版，
  正是照提示词许可省略的结果。
- 反证：v2 planner 探针（[票 12](../../game-maker-v2/issues/12-asset-planner.md) §5）测到 `authoring[]` 4/4 填得出来；
  v3 也没有留下任何「去掉母版」的裁定。⇒ 定性为**软化后的执行缺口**，不是设计变更。

## 6 · 施工记录（2026-10-18）

- **新文件 `packages/assets/src/planner-masters.ts`**：`ensureCharacterMasters(recipe, { skipAssetIds })` —— 纯函数。
  - 每个带 `characterId` 的 `animation` 必须指向一张**本角色、同比例**的母版；
  - 已指对 ⇒ 不动；本角色已有同比例母版 ⇒ 复用；否则新建 `master-<characterId>`（撞 id 自动让开，
    `source.kind = "image"`，画布 = 该动画的 `size`）；
  - 同一角色、同比例的多个动画共用一张；不同比例各建一张；
  - 模型指到**别的角色**的母版上 ⇒ 改指回本角色那张（契约只验存在性与比例，不验 `characterId`）；
  - `import` 的 `mustReuse` 资产不补（人给的位图不需要母版）。
- **接入 `planAssets`**：在路线决策**之前**补齐 ⇒ 落盘 recipe、sidecar `inputs.masterAsset`、
  能力检查（如 `dashscope-mcp` 不支持参考图）都能看见这条边。
- **提示词收紧**：`PLAN_TOOL_DESCRIPTION` 第 4 条与 `assetPlanPrompt` 都改成
  「每个写了 `characterId` 的 `animation` 都必须有一张母版，`masterAsset` 指向它」；
  骨架里 `masterAsset` 标注「带 characterId 的 animation 必填」。
- **先红后绿**：实现前新用例 **10 条红**（7 条纯函数 + 3 条 plan 集成）。
- **B 跑现场免费重放**（零上游）：原 `asset-recipe.json` 经兜底后得到
  `master-scavenger-actor` / `master-wasteland-enemy` / `master-ceiling-lurker` 三张，三条动画各自指对，
  `parseRecipe` 通过；生图调用 **18 → 21**（`master: 0 → 3`）—— 下一轮付费预算必须按 21 报。
- **验收③**：无母版的旧 fixture 在 `pack` 侧行为不变（`pack.test.ts` / `recipes-sweep.test.ts` 全绿）。
- **五闸**：全量 **99 文件 / 1585 条全绿**（+10）· `tsc -b --force` 干净 · `pnpm build` ✅ ·
  `check:deps` 9 包 ✅ · `check:links` 383 份文档 / 2096 条链接 ✅。
- **两处测试预期随行为更新**（不是放宽）：CLI 检查点生图数 4→5、breakdown `master: 1`；
  pipeline 包内账的 step 集合加入 `master`；显式 `buildAssetPack` 的那个 attempt 测试补传 `characterDna`
  （清单现在真带母版，母版是 DNA 的渲染图）。
- **边界**：零付费上游 · `game-maker.local.json` 一字未动 · 未改母版比例判据 ·
  `import`/`mustReuse` 豁免 · 未动探针期尚未入库的源码改动。
