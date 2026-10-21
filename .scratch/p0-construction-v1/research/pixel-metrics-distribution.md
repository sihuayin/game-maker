# P0-05a · 像素指标免费测量与阈值提案

| 属性 | 内容 |
|---|---|
| 日期 | 2026-10-21（票 03） |
| 分支 | `p0-construction-v1` |
| 性质 | **只读测量 + 阈值提案**；不写实现、零付费、未提交 |
| 原始数据 | [`runs/2026-10-21-ticket-03/`](../runs/2026-10-21-ticket-03/)（`raw/*.json` · `measurements.json` · `readonly-check.json`） |
| 状态 | **等待用户逐字裁定**（Q7 A）；裁定后由票 04 落地 |

## 1. 方法

对既有包跑只读的 `game-maker inspect <pack> --json`（HEAD 的 `inspectPack`），把三类**已经算出来**的
指标导出：`paletteUsage.perAsset[].offPalettePixels` / `sourceSizes[].deltaAr` / `layerCoverage[].ratio`。
不新增指标、不调用视觉模型、不写 `out/`。

### 1.1 样本包（7 个可用）

| # | 包 | 角色 |
|---|---|---|
| 1 | `.scratch/asset-integration-v1/.../ruin-scavenger-extraction-assets/pack/v7` | **最终包 / 已验收** |
| 2 | `fixtures/packs/last-train/v2` | 已接受 fixture |
| 3 | `fixtures/packs/counter-siege/v4` | 已接受 fixture |
| 4 | `.../e2e-wasteland/raw/run-out-2026-10-17d/.../pack/v1` | 真实单跑（含已知坏例） |
| 5 | `.../e2e-wasteland/raw/run-out-2026-10-18a/.../pack/v2` | 真实单跑（清单不完整） |
| 6 | `.scratch/style-migration-v1/runs/2026-10-19j-salvage/.../pack/v1` | style-migration 真实产物 |
| 7 | `.scratch/style-migration-v1/runs/2026-10-19k-standby3-fix/.../pack/v1` | style-migration 单资源产物 |

**不可用（3 个，不参与分布）**：`out/shift-change-mixed/pack/v7`、`out/last-train/pack/v17`、
`.../run-out-2026-10-13h/.../pack/v1` —— 它们是旧 `assetpack/v3`，HEAD 的 `inspect` 当场
`invalid`（exit 4：「expected \"assetpack/v4\"」）。这是**既有的兼容事实**，不是本票引入的；
它们也不在「已接受包」名单里。

### 1.2 只读证据

运行前后对 7 个包共 **605 个文件**逐个做 `sha256 + size + mtimeMs` 快照并比对：
**零漂移**（`readonly-check.json` 的 `drift: []`）。`inspect` 成功 7 次（exit 0）、
失败 3 次（exit 4，上述旧包）。

## 2. 分布

### 2.1 色板外像素（每资源；share = 色板外 / 不透明像素）

| 包 | 资源数 | min | p50 | max（按 share） | 最大绝对像素 |
|---|---|---|---|---|---|
| v7（已验收） | 19 | 0 | 0 | **16.02%**（`health-icon` 41/256） | 41 |
| last-train v2 | 9 | 0 | 0 | 3.03%（`signal-endlight` 24/792） | 2524（`bg-dusk-halt`，1.29%） |
| counter-siege v4 | 21 | 0 | 0 | 12.89%（`tile-wall` 29/225） | 29 |
| e2e 10-17d | 10 | 0 | 0 | 7.99%（`ui-scrap-counter` 184/2304） | 184 |
| e2e 10-18a | 10 | 0 | 0 | 7.99%（同上） | 184 |
| 10-19j | 19 | 0 | 0 | 16.02%（`health-icon`） | 41 |
| 10-19k | 1 | 0 | 0 | 0 | 0 |
| **合计** | **89** | 0 | **0** | **16.02%** | **2524** |

- 全样本 **89 个资源里只有 11 个**有非零色板外像素；非零样本的 share：min 1.29% / p50 7.99% / max 16.02%。
- 绝对像素的 p50 = 0、p90 = 4、max = 2524（背景层边缘）。
- **已接受包全部有非零样本**：v7 `health-icon` 41 px（16.02%）、counter-siege `tile-wall` 29 px（12.89%）。

### 2.2 源图 → 目标长宽比（`deltaAr`，正 = 目标更宽）

| 包 | n | min \|Δ\| | p50 \|Δ\| | max \|Δ\| |
|---|---|---|---|---|
| v7（已验收） | 12 | 0 | 0 | **2.70%**（`hazard-terrain` −2.7%） |
| e2e 10-17d | 11 | 0 | 52.38% | **107.79%**（`enemy-wasteland.patrol` 1344×768 → 320×88） |
| e2e 10-18a | 11 | 0 | 52.38% | 107.79%（同上） |
| 10-19j | 12 | 0 | 0 | 2.70% |
| 10-19k | 1 | 0 | 0 | 0 |
| last-train v2 | **0** | — | — | —（包内没有 `authoring` 位图 → 指标 **unavailable**） |
| counter-siege v4 | **0** | — | — | —（同上） |
| **合计** | **47** | 0 | **1.59%** | **107.79%** |

- 47 条里 **28 条 |Δ| > 0.5%**；三档明显分离：0–9.1%（正常）、52.4%（已知坏）、103–108%（更坏）。
- 背景层也在这张表里（目标按 `size` 逐层算）：v7 的背景是 1.6%，10-17d 的四层是 **103.2%**
  （源图 1344×768 = 16:9，目标 1920×540 = 32:9）。
- `last-train` / `counter-siege` 的 **unavailable ≠ 通过**：票 04 必须把它记成「没跑」而不是绿。

### 2.3 背景层覆盖率（每层）

| 包 | n | min | p50 | max |
|---|---|---|---|---|
| v7（已验收） | 3 | 73.09% | 88.88% | 100% |
| last-train v2 | 3 | 20.00% | 31.19% | 100% |
| e2e 10-17d | 4 | 17.43% | 50.55% | 100% |
| 10-19j | 3 | 73.09% | 88.88% | 100% |
| **合计** | **17** | **17.43%** | **81.74%** | **100%** |

## 3. 已知坏例（漏放样本）

| 指标 | 坏例 | 读数 | 当前行为 |
|---|---|---|---|
| 长宽比 | `player-scavenger.run`（10-17d / 10-18a） | 1344×768 → 288×108 · **+52.4%** | exit 0 |
| 长宽比 | `enemy-wasteland.patrol`（10-17d / 10-18a） | 1344×768 → 320×88 · **+107.8%** | exit 0 |
| 长宽比 | `level-downtown-ruins.{sky,horizon,facade,ground}` | 1344×768 → 1920×540 · **+103.2%** | exit 0 |
| 色板外 | v7 `health-icon` | **41 px / 16.02%**（16×16 图标） | exit 0 |
| 色板外 | counter-siege `tile-wall` | **29 px / 12.89%**（15×15 地块） | exit 0 |

⚠️ **票 04 的阳性判据与「抓 health-icon」直接冲突**：票 04 写着「已接受包（v7 …）⇒ 在阈值内通过」，
而任何能抓 16.02% 的 per-asset 阈值（例如 10%）都会**同时让 v7 与 counter-siege v4 失败**。
这不是调参能同时满足的两件事，必须由人裁定（见 §5 的两个方案）。

## 4. 阈值提案（逐项）

### 4.1 长宽比：**建议 P0 采用，低风险**

- **指标**：`|deltaAr|`（每一条 `sourceSizes` 条目）。
- **建议阈值**：`|ΔAR| ≥ 25%` ⇒ `error`（阻断发布）。
- **理由**：
  - 已验收且有数据的包（v7、10-19j、10-19k）最大值 **2.70%**，离阈值有 9 倍余量；
  - 正常帧间差异（`player.idle` / `jump` −2.7%、`chest` −4.3%、母版 −9.1%、背景 1.6%）全部安全；
  - 已知坏例 +52.4% 必中；更坏的 +103.2% / +107.8% 也必中；
  - 阈值在 10%–50% 之间的**样本外后果完全相同**（都只让 10-17d/18a 失败），25% 是离正常样本与坏例都最远的中点。
- **误伤样本**：`hazard-terrain` −2.7%、`player.idle/jump` −2.7%、`chest` −4.3%、
  `master-enemy-wasteland` −9.1%、背景层 1.6%（全部正常）。
- **漏放边界**：接近阈值但低于它的样本本语料里没有；**建议票 04 用合成 fixture 钉 24.9% / 25.0%**。
- **不可用**：包内没有 `authoring` 位图（last-train / counter-siege）⇒ 记 `unavailable`，不判绿。

### 4.2 色板外像素：**建议 P0 采用「低风险档」，但需人裁定宽松度**

两个方案都只改一个数，后果完全不同：

| 方案 | 判据 | 语料内会失败的包 | 抓住的已知坏例 | 漏掉的已知坏例 |
|---|---|---|---|---|
| **A（推荐 · 低风险）** | `share ≥ 25%` **且** `pixels ≥ 16` ⇒ error | 无（7 个全过） | 只有合成的「大量」坏例（≥25%） | `health-icon`（16.02%）、`tile-wall`（12.89%）继续作 observation |
| **B（严格）** | `share ≥ 10%` **且** `pixels ≥ 16` ⇒ error | **v7、counter-siege v4、10-19j** | `health-icon`、`tile-wall` | 无（但会与票 04 的「已接受包通过」冲突） |

- **A 的理由**：Q3 只收低风险指标；v7 与 counter-siege 是已接受产物，P0 不把「已接受」翻案；
  25% 仍能抓住「明显坏」的色板外（合成 fixture 50% 必中），只是不抓小图标的边缘像素。
  **代价写清**：`health-icon` 41 px / 16.02% 在 A 下**不会被抓**（P1 再收紧）。
- **B 的理由**：更贴近「已知坏例必须被抓」；**代价**是 v7 与 counter-siege 从今以后失败，
  需要人工修复 / 重新生成这两件资源，或把票 04 的正例换成别的已接受基线。
- **误伤样本（两方案共有）**：背景层边缘（`bg-dusk-halt` 2524 px 但 share 仅 1.29%）、
  1–3 px 的小图标（`proj-beam` 3 px、`slot-ring` 4 px）—— 用 `pixels ≥ 16` 的下限挡掉分母过小的噪声。
- **漏放边界**：票 04 用合成 fixture 钉 `24.9% / 25.0%`（A）或 `9.9% / 10.0%`（B），以及 `15 / 16 px`。

### 4.3 背景层覆盖率：**建议 P0 不作 QA 阈值，继续 observation**

- 覆盖率已经有一条**装配期的硬判据**（`auditLayerCoverage`：最远层必须 100%，其余层不许 100%），
  而票 08 会把 `layer-coverage` 作为 QA 的第 6 条判据真正跑起来。
- 再在 QA 里给覆盖率设一条阈值，等于**同一件事的第三个判据**；且语料最小值 17.43% 出自真实单跑，
  已接受包最低 20%，没有能区分好坏的数字。
- ⇒ **P0 保持 observation**；若人裁定要阈值，建议 `min(layer coverage) ≥ 10%`（语料全过，只防零覆盖）。

## 5. 裁定表（逐项可勾选）

| # | 指标 | 提案 | 备选 | 决议 |
|---|---|---|---|---|
| 1 | 源图→目标长宽比 | ☐ 采用 `\|ΔAR\| ≥ 25% ⇒ error`（背景 / 母版 / 精灵 / 动画都算） | 阈值改为 ____% ；或排除背景层 | |
| 2 | 色板外像素 | ☐ 方案 A：`share ≥ 25% 且 pixels ≥ 16 ⇒ error`（v7 通过，health-icon 漏放） | ☐ 方案 B：`share ≥ 10% 且 pixels ≥ 16`（v7 / counter-siege 失败） | |
| 3 | 背景层覆盖率 | ☐ 保持 observation（不设 QA 阈值） | 阈值改为 ____% | |
| 4 | unavailable 语义 | ☐ 无 `sourceSizes` = 「没跑」，不得记绿 | 其他：____ | |

> 裁定后由票 04（P0-05b）承接：阈值集中一处、写入报告来源、正 / 负 / 边界用例。
