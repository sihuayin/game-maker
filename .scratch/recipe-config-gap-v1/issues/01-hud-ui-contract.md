# 01. HUD ui 资源与配置契约

Type: research
Status: resolved
Owner: main session · 2026-10-23
Blocked by: —
Map: ../map.md

## Question

确定横版 platformer/v1 的 `hud.panel` / `hud.pip` 需要哪些 `ui` 资源（精确 shape：size / anchor /
ninePatch），以及 plan-assets 从 `runtimeRequirements: ["hud:screen-space"]` 触发产出的正确接缝。
现有 ui 产出先例（塔防 `hud.panel` 九宫格、td-compile 票 08 ninepatch-on-ui）是什么？覆盖闸
（`designCoverageGate`）在哪一处扩展最自然？

## 要钉死的事实（E1 源码 / E2 测试）

- `hud.panel` / `hud.pip` 的精确契约（`packages/contracts/src/game-config.ts`）：asset 必须 `ui` kind、
  `panel.size` 与九宫格的关系、pip 的 size/step 语义。
- `assetPlanPrompt`（`packages/assets/src/prompt.ts`）当前是否以任何形式提及 `runtimeRequirements` / hud /
  ui；接缝在哪。
- `designCoverageGate`（plan-assets）的现状与扩展点（新增「ui 覆盖」闸应放哪、判据长什么样）。
- 塔防路线的 ui 先例：`td-config.ts` 的 hud、td-compile 票 08 ninepatch-on-ui 的裁决与测试。
- 现有测试/夹具里有没有「ui 资源 + hud」的 witness 可复用。

## Answer

**HUD 契约（E1）**：
- `Hud`（`game-config.ts:188-192`）：`panel = { asset, at, size }.strict()`、`pip = { asset, at, step }.strict()`。
- **asset 必须 `ui` kind**：`auditReferences` 内 `game-config.ts:361-362`（`ref("hud.panel",…,["ui"])`、
  `ref("hud.pip",…,["ui"])`）；种类核对 `kindOf`（`:311-320`）报「…是 sprite，这里要的是 ui」（硬失败）。
- `auditPanelSize`（`game-config.ts:392-413`）：**九宫格（`scale9Borders`）→ 声明尺寸可≠资源尺寸（放行）**；
  非九宫格 → 声明尺寸必须等于资源尺寸，否则硬失败。调用点 `:467-468`（在 `auditGameConfig` 内）。

**ui 资源契约（E1）**：`UiSpec`（`asset-spec.ts:154-165`）= `kind:"ui"` + `COMMON`（`size`/`anchor` 必填）
+ **`ninePatch` 可选**（`.optional()`）。ui = 屏幕空间（vs sprite = 世界空间；`screenSpace` 字段已删，票 42）。

**plan-assets 现状（逐字确认「没有」）**：`assetPlanPrompt`（`prompt.ts:895-946`）只插值 `designBrief` +
`worldBrief` + 骨架，**不读 `runtimeRequirements` / `hud` / `hud:screen-space`**；`designBrief`（`:850-868`）
无 runtimeRequirements。`recipeShapeSpec`（`:606-629`）**有** `ui → 没有必须加的键` + 九宫格可选说明，但
**没有任何输入逼模型产 ui**。`runtimeRequirements` 只被 game-design 侧求差，从不进 plan-assets。

**覆盖闸扩展点（E1）**：`designCoverageGate`（`ops.ts:253-273`）查四桶 `enemies/npcs/interactables/resources`。
**最自然挂点 = `planAssets` 内 `ops.ts:398` 之后新增 `hudUiGate(recipe)`**（`designCoverageGate` 与
`playerAnimationGate` 之间，同 `failure:"schema"` 重采样档）。判据参照四桶写法：
`recipe.assets` 里 `kind:"ui"` 且带 `ninePatch` ≥1、`kind:"ui"` 且不带 `ninePatch` ≥1（横版 HUD 面板 + 点亮 pip
最小集合），不足即报点名缺哪一类。

**先例（E2 夹具可复用）**：
- 横版正例 `fixtures/recipes/last-train.json:219-257`：`hud-lost-slots`（ui 72×32，`ninePatch{4,4,4,4}`）+
  `hud-pip`（ui 12×12，无 ninePatch）；config `fixtures/game-configs/last-train.json:20-23`（panel 72×32、
  pip step 20×0）；pack `fixtures/packs/last-train/v2/manifest.json:473-520`。
- 塔防正例 `fixtures/recipes/counter-siege.json`（ui-hud-bar/ui-btn 带 ninePatch、图标不带）。
- 断言测试：`packages/assets/tests/compile-runtime.test.ts:334-366`（面板=九宫格/声明尺寸可不同；pip=非九宫格/必须一致）、
  `pack.test.ts:204-241`（UiSpec.ninePatch → scale9Borders 连线）、`prompt.test.ts:13-17`。
- 裁决 `.scratch/td-compile-v1/issues/08-ninepatch-on-ui.md`：ninePatch **可选**、不加 schema 约束、修共享提示词。

**最小落点**：① 确定性闸 `hudUiGate`（`ops.ts:398` 后）：清单缺「带 ninePatch 的 ui 面板」或「不带 ninePatch 的
ui pip」即 `failure:"schema"` 重采样；② 可选正向线索：`designBrief` 尾部补一行 `runtimeRequirements`（含
`hud:screen-space` 时明说「本代外壳有屏幕空间 HUD，必须产出 ui 面板与 pip」），但**判据以确定性闸为准**，不信任模型自觉。
