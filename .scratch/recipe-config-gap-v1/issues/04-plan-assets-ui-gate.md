# 04. plan-assets 补 ui + 覆盖闸

Type: task
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 01
Map: ../map.md

## Question

落地：`assetPlanPrompt` 读 `runtimeRequirements`，`hud:screen-space` 时产出 ui（panel + pip）；
扩展覆盖闸（`designCoverageGate` 或新闸）强制 ui 覆盖 —— 缺 ui 时 plan-assets 明确拒（schema 档、
重采样），不让「清单合法地缺 ui」流到下游。

## 边界

- 改的是 `packages/assets`（plan-assets 提示词 + 覆盖闸），配 witness 测试。
- 只补「触发 + 闸」，具体 ui shape 按票 01 的契约事实。
- 不碰生图/付费；测试产物只写 `out/` 或本 effort 目录。

## Answer

**已实现（2026-10-23）** —— 两处改动 + 一个新 witness 测试，全仓 1850 测试绿、`pnpm -C packages/assets typecheck` 绿：

- **`hudUiGate(recipe, design)`**（`packages/assets/src/ops.ts`）：**只当设计 `runtimeRequirements` 含
  `hud:screen-space` 时触发**（设计没要 HUD 不硬塞 ui）。判据 = 清单里 `kind:"ui"` 且带 `ninePatch` ≥1
  （面板）+ `kind:"ui"` 且不带 `ninePatch` ≥1（pip）；缺哪类点名哪类，走 `failure:"schema"` 重采样档。
  挂点 = `planAssets` 内 `designCoverageGate` 之后、`playerAnimationGate` 之前（同档，不新增错误通路）。
- **`assetPlanPrompt` 正向线索**（`packages/assets/src/prompt.ts`）：`hud:screen-space` 时在清单格式前插一段
  「本代外壳有屏幕空间 HUD → 必须产出带 ninePatch 的 ui 面板 + 不带 ninePatch 的 ui 图标」。**判据仍以
  确定性闸为准**，不信任模型自觉。
- **witness**（`packages/assets/tests/plan-hud-gate.test.ts`，4 用例）：阳性（夹具 ui-scrap-counter/ui-scrap-icon
  照常落盘）+ 缺面板 / 缺图标 / 全缺三负例（`invalid`/4、点名、三发 `schema`、不落盘）。

关键裁定：闸**条件化**在 `hud:screen-space` 上，而不是无条件——`plan-assets.test.ts` 的 shift-change 设计
`runtimeRequirements: ["input:keyboard"]` 没声明 HUD，无条件闸会误伤它。wasteland 设计有 `hud:screen-space`，
闸对它正确触发。
