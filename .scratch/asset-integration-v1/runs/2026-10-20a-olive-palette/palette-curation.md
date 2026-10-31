# 色板策展记录 · 2026-10-20（票 06）

## 结论

- **采用包**：`ruin-scavenger-extraction-assets/pack/v4/`
- 色板 = **32 色确定性提取（图 43）+ 2 个人工策展槽**，**不是**纯提取。
- 两个槽追加在末尾，现有 `palette:0..31` 一个下标都没动。

## 追加的两个槽

| 下标 | 色值 | 来源 / 理由 |
|---|---|---|
| `palette:32` | `#59503b` | raw 外套中间调众数（`scavenger-actor` raw 中 `#59503b` 出现 450 px；外套 hue≈42、低饱和的橄榄/卡其）。 |
| `palette:33` | `#50432b` | 由 raw 暗部 `#42392a`（lightness≈0.20 带）策展而来：同色相、饱和度 0.22→0.30，避开世界暖棕（`#523730` 等）。直接用 `#42392a` 的 v2 实验把背景 **27.40%** 的像素吸成橄榄；本值把 v4 背景变化压到 **2.66%**，同时抓住 raw 暗部约 128k 像素（5-bit 直方图模拟），实际 v4 玩家帧变化 **18.95%**。 |

## 为什么不是「重跑提取」

图 43 的绿色只占 **0.14%**（1,427 / 1,048,576），且是正绿（如 `#36673a`）；
外套橄榄 `#59503b` 离参考绿 ≈42、离现有棕 `#685247` ≈19。
把参考绿加进色板后，外套仍会吸附到棕色 —— 要恢复外套，必须追加**橄榄/卡其色本身**。
证据见 [票 04](../../issues/04-palette-coat-review.md) 与
`.scratch/asset-integration-v1/issues/04-evidence/player-raw-current-olive.png`。

## 可复现依据

- **raw**：`.scratch/style-migration-v1/runs/2026-10-19k-patch/`
- **母版 / 导入图**：本目录 `reuse/` · `imported/`
- **配方**：`asset-recipe.json`
- **风格（v4 定稿）**：`stylespec.json`（34 色）
  - 对照变体：`stylespec-two-slot.json`（v2，含 `#42392a`）· `stylespec-one-slot.json`（v3，仅 `#59503b`）
- **DNA / VWS**：`character-dna.json` · `visual-world.json`
- **脚本**：`run-olive.mjs`
- **命令**：`PACK_VERSION=4 node run-olive.mjs`（默认读 `stylespec.json`）
- **结果**：`olive-result-v4.json`
- 两个上游桩都是抛错桩：`imageCalls=0` · `ledgerCalls=0`。

## QA（v4 vs v1）

**机器证据**

- `verifyPack` ok；**61 动画帧 / 76 总帧不变**；0 上游调用。
- 像素变化：animations **8.65%**、backgrounds **2.66%**、sprites **5.92%**、ui **0%**。
- 分资源：`scavenger-actor` **18.95%**（v1 全棕 → v4 外套出现橄榄/卡其，背包保持棕）；
  `extraction-point` 7.61%、`scrap-resource` 9.41%、`wasteland-enemy` 3.80%、
  `ceiling-lurker` 2.15%、`clean-water` 1.11%。
- **v2 被拒**（`#42392a`）：background 27.40%、玩家 49.98% 变化，世界整体发绿。
- **v3 被拒**（仅 `#59503b`）：玩家只变 11.78%，外套仍以棕为主，区分不够。

**视觉证据**（左 v1 / 中 v3 / 右 v4）

- `qa-compare/v134-scavenger-actor.idle1.png`
- `qa-compare/v134-scavenger-actor.run1.png`
- `qa-compare/v134-ruined-city-backdrop.blocks.png`
- `qa-compare/v134-extraction-point.standby1.png`
- `qa-compare/v134-scrap-resource.idle1.png`
- 对照（v1 / v2 / v4）：`qa-compare/v124-*.png`

**结论：通过。** 外套与背囊的色相分离恢复；其他资源的橄榄误吸在可接受范围，
没有 v2 那种整体发绿。

## 边界

- 未改 DNA / 参考图 / 生成提示词。
- 未覆盖或修改 v1；v2 / v3 是 QA 变体，**v4 是定稿**。
