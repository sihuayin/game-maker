# 票 10：混合迁移包的第一次真跑 —— 付费预算报告（待点头）

- **日期**：2026-10-19
- **状态**：**报告已出，尚未发出任何生图 / 文本上游请求**。本票只认领、只做免费预检与免费配方补齐。
- **票面**：[10. 混合迁移包的第一次真跑](issues/10-hybrid-migration-real-run.md)
- **前置**：[票 09](issues/09-hybrid-migration-construction.md) 已关（7 import + 3 drawlist + 9 image 的迁移配方；零上游）
- **不改** `game-maker.local.json`；不隐藏重试；不自动修复 / 自动重生成。

## 0 · 一句话

按票 09 的迁移配方真跑 `pack`，**21 次生图 + 3 次文本**；但免费预检发现两处**必须先裁**的缺口：
① 配方里 **0 张母版**（直接跑只有 18 次生图，和票 03 / 本票的 21 次对不上）；
② 13 个动画条目都**没有 `sheet`**（票 01 的固定网格路线不会触发，会退回 C/C2 里已经失败过的连通块路径）。
两处都已备好**免费、确定性的数据修正**，不动源码；需要你在两个变体里选一个并逐字点头。

## 1 · 输入

| 项 | 路径 |
| --- | --- |
| 迁移配方（票 09 原样） | `runs/2026-10-19a-migration/asset-recipe.json`（19 条） |
| 母版补齐后的配方 | `runs/2026-10-19a-migration/asset-recipe.mastered.json`（**已生成**，免费） |
| 加 `sheet` 的变体 | `runs/2026-10-19a-migration/asset-recipe.mastered-sheet.json`（**已生成**，免费，待人裁） |
| 风格 / 参考图 / DNA | 同目录 `stylespec.json`（32 色）· `reference.png` · `character-dna.json` |
| 7 张 import PNG | 同目录 `imported/*.png`（尺寸已逐项复核，见 §3.3） |
| 文本上游 | `ANTHROPIC_BASE_URL=http://127.0.0.1:15721`（端口已开） |
| 生图上游 | **`gemini-3.1-flash-lite-image`**（人裁 2026-10-19）。runner **显式覆盖**模型名；config 里的 `gemini-2.5-flash-image` **一字未动** |

## 2 · 免费预检（全部已跑，零付费）

| 检查 | 结果 |
| --- | --- |
| `resolveImageTransport`（config 原样） | ✅ `gemini · https://generativelanguage.googleapis.com/v1beta · gemini-2.5-flash-image（key 53 字符）· 经代理 http://127.0.0.1:9098` —— ⚠️ 本次 runner 显式覆盖为 3.1-flash-lite-image |
| 原配方 `parseRecipe` | ✅ 19 条通过 |
| 母版补齐后 `parseRecipe` | ✅ 19 条 + 3 母版通过 |
| 加 `sheet` 变体 `parseRecipe` | ✅ 通过（13 个动画全部 `columns × rows === frames`） |
| DNA 覆盖 | ✅ 3 个母版 characterId 全部命中 `character-dna.json` |
| 色板 | ✅ `palette.size = 32` |
| 7 张 import PNG 尺寸 | ✅ 64×32 / 64×64 / 96×48 / 96×40 / 64×48 / 48×48 / 64×96，全部与目标一致 |
| Gemini key / 模型（免费 models 列表） | ✅ HTTP 200；`gemini-3.1-flash-lite-image` 在列表里（稳定版，非 preview），支持 `generateContent` |
| 3.1-flash-lite-image 接受图片输入（免费 `countTokens`） | ✅ HTTP 200；259 tokens（TEXT 1 · IMAGE 258）⇒ 参考图 / 母版那条路可用 |
| 直连 Gemini | ❌ 8 秒超时（境内直连不通） |
| config 里的代理 `127.0.0.1:9098` | ❌ **无人监听**（ClashX 只开了 `7890` / `7891`） |
| `127.0.0.1:7890` | ✅ 可用（经它取 models 列表 200） |
| 9098 → 7890 临时转发 | ✅ 实测可通（无 key 时返回 403 = 已到 Google） |
| 文本上游 `127.0.0.1:15721` | ✅ 端口已开 |

**代理的处置**：不改 `game-maker.local.json`。本跑用一支 runner 脚本调用 `packAssets`，
把生图 transport 的 proxy **显式改成 `http://127.0.0.1:7890`**（与 C / C2 探针同一条做法），
文本请求仍直连 `15721`。不额外起转发进程，也不改配置文件。

## 3 · 两处必须先裁的缺口

### 3.1 母版：配方里 0 张，直接跑只有 18 次生图

- 票 09 的 `asset-recipe.json`：19 条资产、**`authoring` 缺席（0 张母版）**。
- 票 03 的 `ensureCharacterMasters` 只接在 **`planAssets`**（`packages/assets/src/ops.ts:364`），
  **没有接在 `buildAssetPack`**。所以 `pack --recipe asset-recipe.json` 不会自动补母版。
- 后果：3 个角色动画仍会各画各的，DNA → 母版 → 动画这条链**静默跳过**；生图 18 次，不是本票的 21 次。
- **免费修正（已做）**：用 dist 里的 `ensureCharacterMasters` 纯函数跑一遍，写出
  `asset-recipe.mastered.json`。结果：

| 母版 id | characterId | 画布 |
| --- | --- | --- |
| `master-scavenger-actor` | scavenger-actor | 48×64 |
| `master-wasteland-enemy` | wasteland-enemy | 48×48 |
| `master-ceiling-lurker` | ceiling-lurker | 48×56 |

`imageCallsOf` = **21**（animation 13 · single 2 · background 3 · master 3）。
零源码改动、零上游。

### 3.2 `sheet`：13 个动画条目一个都没有

- 票 01 的固定网格只在 `animations[].sheet` 存在时触发；没有 `sheet` 就走**旧连通块**路径。
- C / C2 的失败正是这条旧路径：8 帧画出 9 个、9 帧画出 12 个（2×6），管线拒绝。
- 票 01 自己写着：「生产链是否由 planner 统一写 `sheet` 仍待下一票 / 另裁。」票 10 没裁这一条。
- 两个变体：

**变体 A（严格「沿用 B 配方」）**：不加 `sheet`，21 次生图照发。
只验证 import + drawlist + image 三路混合能不能成包；**不验证**票 01 的固定网格。
帧数一旦再错，是**生图回来后**的校验失败 ⇒ 这笔图**已经付过**，且引擎不会重试这一档。

**变体 B（推荐）**：先给 13 个动画补确定性网格，再跑。数据修正、零源码、生图仍 21 次；
同时验证固定网格与混合包。已备好 `asset-recipe.mastered-sheet.json`：

| 资产 | 动画 | 帧 | 网格 | 申请画布 |
| --- | --- | --- | --- | --- |
| scavenger-actor | idle | 4 | 2×2 | 96×128 |
| scavenger-actor | run | 8 | 4×2 | 192×128 |
| scavenger-actor | jump | 4 | 2×2 | 96×128 |
| wasteland-enemy | patrol | 6 | 3×2 | 144×96 |
| wasteland-enemy | charge | 6 | 3×2 | 144×96 |
| wasteland-enemy | halt | 3 | 3×1 | 144×48 |
| ceiling-lurker | hang | 4 | 2×2 | 96×112 |
| ceiling-lurker | lunge | 5 | 5×1 | 240×56 |
| ceiling-lurker | retreat | 4 | 2×2 | 96×112 |
| scrap-resource | idle | 4 | 2×2 | 48×48 |
| clean-water | idle | 4 | 2×2 | 48×48 |
| extraction-point | standby | 3 | 3×1 | 192×96 |
| extraction-point | active | 6 | 3×2 | 192×192 |

规则：4 帧 2×2 · 6 帧 3×2 · 8 帧 4×2 · 3/5 帧单行。`lunge` 5 帧只有 5×1 或 1×5 两种，
选 5×1（4.3:1）；其余都接近方形。

### 3.3 7 张 import（已复核，零调用）

| 资源 | 交付尺寸 | 背景 |
| --- | --- | --- |
| `collapsed-floor` | 64×32 | 不透明（整幅地面） |
| `tile-floor` | 64×64 | 不透明（整格瓷砖） |
| `metal-platform` | 96×48 | 透明 |
| `vent-duct` | 96×40 | 透明（槽内保持不透明） |
| `concrete-step` | 64×48 | 透明（保留左侧三角侧影） |
| `wooden-crate` | 48×48 | 透明 |
| `broken-wall` | 64×96 | 不透明（整块墙板） |

## 4 · 调用预算

| 类别 | 资产 / 动作 | 调用 |
| --- | --- | --- |
| 母版 | 3 个角色 | 3 |
| 动画 | scavenger 3 · enemy 3 · lurker 3 · scrap 1 · water 1 · extraction 2 | 13 |
| 单帧 sprite | hazard-terrain · office-debris | 2 |
| 背景层 | skyline · blocks · street | 3 |
| **生图合计** | | **21** |
| import | 7 张 PNG | 0 |
| drawlist 文本 | hud-panel · scrap-icon · health-icon（各 1 发） | **3** |

**重试上限（引擎既有行为，不改）**：

- 生图 Gemini 默认每调用最多 **4 发** ⇒ 最坏 **84 发**；只有 5xx / 429 / 网络 / `NO_IMAGE` 会重试，
  帧数或内容校验失败**不会**重试。
- 文本默认每资源最多 **2 发** ⇒ 最坏 **6 发**。
- 任何一发越过上限 ⇒ runner 立即 `exit 124`，不偷偷续跑。

## 5 · 预计费用

按 Google 官方 list price（2026-10-19 页面）的 `gemini-3.1-flash-lite-image`（Nano Banana 2 Lite）：

- 图像输出 **$30 / 1M image tokens ≈ $0.0336 / 张（1K 分辨率）**：21 张 = **$0.706**。
- 输入（文本 / 图片 / 视频）**$0.25 / 1M tokens**：21 发合计估计 < $0.03（以 ledger 的 `usage` 为准）。
- **正常路径合计 ≈ $0.71–0.75**。
- 最坏重试 84 张 = **$2.822**（只会在上游连续抖动时发生）。
- 文本 3 发走 `deepseek-v4-pro`（本机 `cc-switch`），单价不在本仓记录里；按发数很小，usage 会落账。
- ⚠️ 实际账单以中转为准；1K 以下的画幅（如 16:9）会比 $0.0336 更便宜，本报告按 1K 上限估。

## 6 · 已知风险（先说清）

1. **新模型没有本仓的付费证据**：`gemini-3.1-flash-lite-image` 是「效率特化」档，
   C / C2 的风格、帧数与描边证据全部来自 `gemini-2.5-flash-image`。
   本次同时是一次**新模型的风格 / 网格适配测试**：若风格明显压平、描边丢失或帧数更不稳 ⇒
   **停**，保留现场，另出报告；**不自动回退 2.5、也不自动换 3.1-flash-image**（换模型须另裁）。
2. **母版提示词旧句**：票 07 已裁定母版提示词里「交付管线会两方向拉伸」是假的；
   改写是[票 11](issues/11-master-prompt-rewrite.md)，本跑**仍用旧句**。比例读数只观察、不阻断（票 05）。
3. **帧数仍可能错**：即使走固定网格，模型也可能画错格数 / 空格 / 边框；
   这类失败发生在生图回来之后，图已付费，包会失败。
4. **风格**：32 色 + 参考图是已验证配置；但 9 个 image 资源里只有 3 个角色沿用 C/C2 的侧视经验，
   道具 / 背景仍可能出现绘画感或比例漂移。本跑只记录，不自动重生成。

## 7 · 执行计划（点头后才跑）

1. runner 脚本：`runs/2026-10-19b-real/run-real.mjs`（新目录，不覆盖任何现有产物）。
   - 调用 `packAssets`；生图 transport = 配置的 baseUrl / key + **模型覆盖为 `gemini-3.1-flash-lite-image`** + **proxy `127.0.0.1:7890`**；文本直连 `127.0.0.1:15721`。
   - 一个共享 `fetchImpl` 计数并按 URL 分流；逐发写 `http-calls.log`（不记 key）。
   - 并发：生图 3 · 文本 4（引擎实测默认）。
   - 硬停：生图 ≤21 次调用 / ≤84 发 · 文本 ≤3 次调用 / ≤6 发 · 墙钟 **45 分钟**（`exit 124`）。
   - `--visual-world`：把同目录 `visual-world.json` 一并拷进包（不影响调用数）。
2. 输出：`runs/2026-10-19b-real/ruin-scavenger-extraction-assets/pack/v1/`。
3. 跑完立刻：
   - `verifyPack` 逐项检查；`inspect` 留一份摘要。
   - 读包内 `ledger.json`：生图调用数必须 **21**，文本调用数必须 **3**。
   - 读 `master-ratios.json`：3 张母版的读数照实记录（不阻断）。
   - 本地拼一张联系表（1× / 4×），逐项核对 §9。
4. 任何一步失败 ⇒ **停**，保留 ledger、失败现场与已付费原图；不重跑、不补发、不自动修复。

## 8 · 失败后果

| 失败点 | 已经发生的花费 | 产物 |
| --- | --- | --- |
| 第一发生图前（配方 / DNA / 代理） | $0 | 免费拒；无包 |
| 某张生图 4 发都失败 | 该调用已发的最多 4 发 | 共享闸停掉后续新调用；失败现场保留 |
| 帧数 / 空格 / 边框校验失败 | 那张图已付费 | 包失败；该图原图在 `authoring/generated/` |
| 母版失败 | 母版那几发 | 只阻断引用它的 3 个角色动画；其余照跑，整包最后仍失败 |
| 文本 drawlist 2 发都失败 | 2 发 | 整包失败 |
| 墙钟 / 预算到顶 | 已发出的 | `exit 124`，不偷偷续跑 |

## 9 · 验收

1. `verifyPack` **ok**，`problems` 空，provenance `mixed`。
2. `ledger.json`：生图 **21** 次调用（3 母版 + 13 动画 + 2 单帧 + 3 背景层）· 文本 **3** 次调用；无额外调用。
3. 3 张母版落盘；`master-ratios.json` 有 3 条读数（观察项，不阻断）。
4. 7 个 import 资源：交付尺寸逐项等于 §3.3；4 张透明底保持透明；锚点按 spec。
5. 3 个 UI：drawlist 渲染出的 `hud-panel` / `scrap-icon` / `health-icon` 与图 43 的 UI 观感一致（脏旧铁皮、暗色描边、16×16 图标）。
6. 9 个 image 资源：深色描边、3–4 级明暗、脏旧材质、32 色内；动画帧数逐项等于 spec；无文字 / 边框 / 编号。
7. 产物目录、`http-calls.log`、包内 `ledger.json` 全部保留。

## 10 · 需要你给的授权

逐字发下面**其中一句**即可（两句都包含代理改走 7890、预算与硬停）：

> **批准票 10-A：gemini-3.1-flash-lite-image，无 sheet 真跑，21 张图 / 3 次文本 / ≤84 图请求 / ≤6 文本请求 / 45 分钟，runner 走 7890**

> **批准票 10-B：gemini-3.1-flash-lite-image，加 sheet 真跑，21 张图 / 3 次文本 / ≤84 图请求 / ≤6 文本请求 / 45 分钟，runner 走 7890**

未收到这句之前，本报告**不发任何生图 / 文本上游请求**。
