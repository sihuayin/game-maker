# 09. 混合迁移的免费施工：裁切表 + 7 张透明 PNG + 迁移配方（待授权）

Type: task
Status: resolved
Owner: claude (2026-10-19 施工 · 人裁「只做裁切表」→「授权 PNG + 配方 + 桩跑」)
Blocked by: —
Map: ../map.md
> 派生自票 06 的裁定（2026-10-19）：7 个环境/道具走 import，3 个 UI 留 drawlist。
> ⚠️ **立票 ≠ 批准施工**；本票的施工须另行点头。

## Question

把票 06 的路线落成可用的迁移输入，**不跑任何上游**：

1. 先产出一张**裁切表**（7 行；每行：资源 id / 图 43 的源矩形 / 背景处理方式 / 目标尺寸），供人复核。
2. 复核通过后，产出 7 张**透明背景 PNG**（图 43 的底是深色网格，需清理）。
3. 复制 B 配方（`runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1/asset-recipe.json`）
   为迁移配方：7 条改成 `source: { kind: "import", ref: "..." }`；3 条 UI 保持 drawlist。
4. 免费验证：`parseRecipe` 通过；用桩 drawlist 生成器跑 `buildAssetPack`
   （不调真实文本/生图上游），确认 7 条 import 走通、3 条 drawlist 落盘、包过 `verifyPack`。

## 验收

- 裁切表逐项有人复核。
- 7 张 PNG 是透明底，尺寸与对象与目标资源一致。
- 迁移配方过 `parseRecipe`；桩跑产出的包 `verifyPack` 通过。
- 零生图、零文本上游、零付费。

## 边界

- 不扩 `create` 的 `existingAssets`；不改 planner 全局规则。
- 不改源码（除非施工中发现必须的接线，另行报告）。
- 不跑真实 pack / 不出付费调用。
- 立票 ≠ 批准施工。

## Comments

### 2026-10-19 · 授权范围 = 只做裁切表

- 人裁：本次只做第 1 步（裁切表），复核通过后再做 PNG、迁移配方与桩跑。
- 已产出：`assets/crop-table.md`、`assets/crop-table-overlay.png`、`assets/crop-table-targets.png`。
- 未产出：透明 PNG、迁移配方、任何源码改动、任何上游调用。
- 状态停在**待复核**；复核通过前本票不关。

## Answer

**一句话**：票 06 的混合路线已落成可用迁移输入 —— 7 张目标尺寸 PNG、一份 19 条迁移配方、
一份过 `parseRecipe` 且桩跑 `verifyPack` 全绿的包；零上游、零付费、源码一字未动。

### 交付物

- 裁切表：[`../../assets/crop-table.md`](../../assets/crop-table.md)
  （复核预览：`crop-table-overlay.png` · `crop-table-targets.png`）
- 迁移运行目录：[`runs/2026-10-19a-migration/`](../runs/2026-10-19a-migration/)
  - `imported/*.png`：7 张目标尺寸 PNG
  - `asset-recipe.json`：全量迁移配方（19 条）
  - `asset-recipe.stub.json`：桩跑子集（7 import + 3 drawlist）
  - `stylespec.json` / `visual-world.json` / `reference.png` / `character-dna.json`
  - `run-stub.mjs` · `stub-run.txt` · `stub-out/…/pack/v1/` · `png-preview.png`

### 裁切表（人裁 2026-10-19）

| 资源 | 源矩形 | → 目标 | 背景 |
|---|---|---|---|
| `collapsed-floor` | (347, 544, 87×46) | 64×32 | 不抠（整幅地面） |
| `tile-floor` | (347, 497, 47×47) | 64×64 | 不抠（整格瓷砖） |
| `metal-platform` | (567, 511, 118×60) | 96×48 | 键出深色网格 |
| `vent-duct` | (478, 561, 69×31) | 96×40 | 键出深色网格（只清外部） |
| `concrete-step` | (493, 463, 55×48) | 64×48 | 键出深色网格；**保留左侧三角侧影** |
| `wooden-crate` | (565, 719, 43×44) | 48×48 | 键出深色网格 |
| `broken-wall` | (110, 510, 50×75) | 64×96 | 不抠（整块墙板） |

两条人裁已写进裁切表：第 5 行保留楼梯结构性侧影；第 1 行保留 Floors 的塌陷地面，不改长梁。

### PNG

- 4 张透明背景：`metal-platform` · `vent-duct` · `concrete-step` · `wooden-crate`。
  抠法是「底色线段距离 + 边缘泛洪/全局键色」，楼梯侧影（亮度 ~55）与底网格（~18–40）分得开；
  `vent-duct` 只从边缘抠，槽内保持不透明。
- 3 张满幅表面按复核表保持不透明：`collapsed-floor` · `tile-floor` · `broken-wall`（没有外部背景可抠）。
- 7 张均为目标尺寸 RGBA；预览见 `png-preview.png`（品红/绿棋盘垫底）。

### 迁移配方

- 全量 **19 条**过 `parseRecipe`：
  7 条 `source: { kind: "import", ref: "imported/<id>.png" }`；
  3 条 UI（`hud-panel` / `scrap-icon` / `health-icon`）保持 `drawlist`；
  其余 9 条 `image` 原样沿用 B 配方。
- **施工中发现并修正的偏差**：B 的 `stylespec.json` 还是票 04 之前的 **16 色模型色板**
  （桩跑首版把木箱量化成橄榄绿/红）。按票 04 已落地的机制，用
  `extractPalette(reference.png, size: 32)` + `applyDeterministicPalette` 重算了迁移
  `stylespec.json` 与 `visual-world.json`（含六桶 / materials 的 `palette:N` 改写）。
  色板 32 色，提取日志 `palette-apply.txt`。这不是改源码，是把旧数据对齐到已裁定的生产色板。

### 桩跑（零上游）

`run-stub.mjs` 只跑 7 import + 3 drawlist（9 条 image 不在桩跑内，零生图端口调用）：

- `parseRecipe`：全量 19 条通过。
- `buildAssetPack` → `stub-out/ruin-scavenger-extraction-assets/pack/v1`。
- `verifyPack`：**ok**（problems 空，provenance `mixed`）。
- `audit`：空；`imageCalls`：**0**。
- `palette.size = 32`；coverage：`exact 3 · composited 0 · quantized 7 · unbound 0`。
- 7 条 import 的交付尺寸逐项等于目标（64×32 / 64×64 / 96×48 / 96×40 / 64×48 / 48×48 / 64×96）；
  3 条 drawlist 落盘且进 `atlas.ui`。

### 边界

- 零文本上游、零生图、零付费；没有跑真实 pack。
- 没改源码；没改 `game-maker.local.json`；没扩 `create` 的 `existingAssets`；没改 planner 规则。
- 票 10 现在解锁，但仍是**付费票**：须先出书面预算报告 + 逐字点头。
