# 10. 混合迁移包的第一次真跑（付费，需另出报告 + 逐字点头）

Type: task
Status: resolved
Owner: claude (2026-10-19 认领 · 已收包、已关)
Blocked by: 09
Map: ../map.md
> 派生自票 06 的裁定（2026-10-19）：7 import + 3 drawlist；真实 pack 需要 3 次 drawlist 文本上游。
> ⚠️ **本票不授权任何付费调用**；须先出书面预算报告，再逐字点头。

## Question

用票 09 的迁移配方跑一次真实 `pack`：

- 7 条 import：零生图；
- 3 条 drawlist：各 1 次文本上游（以实际 `framePlan` 为准）；
- 其余 9 条 image 资产：沿用 B 配方，生图预算按 **21 次**报；
- 产出包过 `verifyPack`；逐项检查风格、尺寸、透明底、锚点。

## 验收

- 付费前有书面报告（调用数、预计费用、失败后果）。
- 逐字点头后才发第一笔调用。
- 包过 `verifyPack`；3 个 UI 的 drawlist 输出与图 43 的 UI 观感一致；
  7 个 import 资源与目标尺寸/锚点一致。

## 边界

- 不改 `game-maker.local.json`；不加重试 / 修复循环；不扩玩法。
- 任何额外生图 / 重跑都要重新报告 + 点头。

## Comments

### 2026-10-19 · 认领 + 付费预算报告（未发任何上游请求）

- 已认领；只做了免费预检与免费配方补齐，**零生图、零文本、零付费**。
- 报告：[`../report-10-hybrid-real-run-2026-10-19.md`](../report-10-hybrid-real-run-2026-10-19.md)
- 免费预检发现两处缺口：
  1. 票 09 的配方 **0 张母版**（`ensureCharacterMasters` 只接在 `planAssets`，不在 `buildAssetPack`）⇒
     直接跑只有 18 次生图。已用纯函数补齐为 `runs/2026-10-19a-migration/asset-recipe.mastered.json`（21 次）。
  2. 13 个动画条目都**没有 `sheet`** ⇒ 票 01 的固定网格不触发，会退回 C/C2 失败的连通块路径。
     已备好 `asset-recipe.mastered-sheet.json`；是否采用待人裁（报告 §3.2 的 A/B 两变体）。
- 环境：config 的代理 `127.0.0.1:9098` **无人监听**；`7890` 可用（models 列表 200）。
  计划用 runner 把生图 transport 的 proxy 显式改成 7890，**不改** `game-maker.local.json`。
- 预算：生图 **21** 次 / 最多 84 发 · 文本 **3** 次 / 最多 6 发 · 45 分钟硬停；
  正常路径 ≈ $0.82–0.87，最坏重试 ≈ $3.28。
- 状态：**等待逐字点头**（报告 §10 的 10-A 或 10-B）。未收到前不发任何上游请求。

### 2026-10-19 · 人裁：模型改用 `gemini-3.1-flash-lite-image`

- 人裁逐字：「模型改用: gemini-3.1-flash-lite-image.」
- 免费预检：该模型在 models 列表里（**稳定版**，非 preview）；`generateContent` 支持；
  `countTokens` 带内联图片返回 **200**（TEXT 1 · IMAGE 258 tokens）⇒ 参考图 / 母版那条路可用。
- 价格（Google list price 2026-10-19）：输出 $30 / 1M image tokens ≈ **$0.0336 / 张（1K）**；
  输入 $0.25 / 1M。21 张 ≈ **$0.706**；最坏 84 发 ≈ **$2.82**。
- 执行方式：runner **显式覆盖模型名**；`game-maker.local.json` 仍**一字未动**（长期规矩）。
- 风险：C / C2 的风格与帧数证据全部来自 2.5；本次同时是新模型的适配测试。
  失败即停，**不自动回退 2.5、不自动换 3.1-flash-image**。
- 状态不变：**仍等逐字点头**（报告 §10 的 10-A 或 10-B）。未收到前零上游、零付费。

### 2026-10-19 · 授权执行（变体 B）

- 人裁先选 **B**（加 `sheet`），随后逐字「**授权执行**」。
- 执行：`run-real.mjs`（RUN_APPROVED=1）· 模型 `gemini-3.1-flash-lite-image` · 代理 7890。
- 预算：生图 21 调用 / ≤84 发 · 文本 3 调用 / ≤6 发 · 墙钟 45 分钟。
- 输出：`runs/2026-10-19b-real/ruin-scavenger-extraction-assets/pack/v1/`。
- 不自动回退 / 不自动重跑；失败即停、保留现场。

### 2026-10-19 · 真跑失败（B 变体，已停）

- 失败报告：[`../report-10-failure-2026-10-19.md`](../report-10-failure-2026-10-19.md)
- 实际：**6 次生图**（3 母版 + 3 sprite）+ **3 次文本**，全部 HTTP 200；生图回应**不是 PNG**，
  `decodePNG` 拒绝 ⇒ 母版造不出来，包失败、停止。
- 花费：6 × $0.0336 ≈ **$0.2016**；文本 usage 4,369 in / 2,939 out（量级 <$0.01）。
- 现场：`runs/2026-10-19b-real/ruin-scavenger-extraction-assets/failed-2026-10-19T05-20-52-155Z/`
  （ledger、3 个真实 drawlist、7 张 import 都在）。
- 没有隐藏重试（6 次都是 attempts=1）；没有自动回退；没有生成包。
- 适配路线另立[票 12](12-gemini-non-png-output.md)；本票 `Blocked by: 09, 12`。

### 2026-10-19 · 适配层已修（票 13 已关）

- Gemini 生图适配器已改 **Interactions API**，显式要求 `image/png`；回应按 `steps[]` 解析。
- 全量 **102 文件 / 1620 条全绿**；`pnpm build` / `check:deps` / `check:links` 通过；
  `pnpm typecheck` 只剩两条既有、与本票无关的红。
- 本票解除对票 12 / 13 的阻塞，回到 `Blocked by: 09`。
- 但**真跑不能直接重发**：上一跑已花 ≈$0.21 且失败；按票面规矩，重跑要**重新出预算报告 + 逐字点头**。
  建议先做 **1 发 smoke test**（≈$0.034）验证 Interactions 请求形状与 PNG 回应，再决定是否发满 21 张。

### 2026-10-19 · smoke 报告（待点头）

- 报告：[`../report-10-smoke-2026-10-19.md`](../report-10-smoke-2026-10-19.md)
- 配方：`runs/2026-10-19c-smoke/asset-recipe.json`（1 条 `office-debris` 96×64）
- runner：`runs/2026-10-19c-smoke/run-smoke.mjs`（未批准时 `exit 2`）
- 预算：**1 张 / ≤4 发 / 0 文本 / 15 分钟**；正常 ≈ $0.034，最坏 ≈ $0.134。
- 目的：验证 Interactions 请求形状、`steps[]` 解析、PNG 回应、端到端出包与 `verifyPack`。
- 状态：**等待逐字点头**；未收到前零上游、零付费。

### 2026-10-19 · smoke 逐字授权（执行）

人裁逐字：

> **批准票 10 smoke：1 张 / ≤4 发 / 15 分钟，gemini-3.1-flash-lite-image，Interactions PNG，runner 走 7890**

- 执行：`runs/2026-10-19c-smoke/run-smoke.mjs`（`RUN_APPROVED=1`）
- 预算：1 张 / ≤4 发 / 0 文本 / 15 分钟；输出 `smoke-interactions/pack/v1`
- 失败即停；不重跑。

### 2026-10-19 · smoke M1 授权（执行）

人裁逐字：

> **换 gemini-nano-banana-2.1，先按 smoke 预算 1 张 / ≤4 发 / 15 分钟确认 PNG**

- 报告：[`../report-10-smoke-m1-2026-10-19.md`](../report-10-smoke-m1-2026-10-19.md)
- runner：`runs/2026-10-19d-smoke-m1/run-smoke.mjs`（`RUN_APPROVED=1`）
- 模型 `gemini-nano-banana-2.1` · Interactions PNG · 1 张 / ≤4 发 / 0 文本 / 15 分钟
- 失败即停；不换模型、不转码、不重跑。

### 2026-10-19 · legacy smoke 授权（执行）

人裁逐字：

> **裁 B：恢复 2.5 legacy PNG，先零付费恢复分支 + 1 发 smoke**

- 报告：[`../report-10-smoke-legacy-2026-10-19.md`](../report-10-smoke-legacy-2026-10-19.md)
- runner：`runs/2026-10-19e-smoke-legacy/run-smoke.mjs`（`RUN_APPROVED=1`）
- 模型 `gemini-2.5-flash-image` · legacy `generateContent` · 1 张 / ≤4 发 / 0 文本 / 15 分钟
- 失败即停；不换模型、不转码、不重跑。

### 2026-10-19 · legacy smoke 通过 ✅

- 模型 `gemini-2.5-flash-image` · legacy `generateContent` · `aspect 3:2` · 1 次调用 / 1 发 · 18.4s。
- `IMG-MIME #1 image/png`（shape=candidates）；`verifyPack` **ok**（problems 空）；`ledger` 1 生图 / 0 文本。
- 交付 `office-debris` 96×64；atlas 里透明 3,317 / 不透明 2,827 / 半透明 0；肉眼见深色描边、脏旧木料与锈迹。
- 包：`runs/2026-10-19e-smoke-legacy/smoke-interactions/pack/v1/`
- 花费：1 × $0.039 ≈ **$0.039**。
- 结论：**2.5 legacy 今天仍回 PNG，端到端出包通过**；可以进入完整 21 张预算（需另出报告 + 逐字点头）。

### 2026-10-19 · 第二次真跑预算报告（待点头）

- 报告：[`../report-10-real-legacy-2026-10-19.md`](../report-10-real-legacy-2026-10-19.md)
- 输入：`runs/2026-10-19a-migration/asset-recipe.mastered-sheet.json`（19 条 + 3 母版 + 13 个网格动画）
- 模型：`gemini-2.5-flash-image` · legacy `generateContent`（PNG）
- 预算：**21 生图 + 3 文本** · ≤84 图发 / ≤6 文本发 · 45 分钟
- 费用：正常 ≈ **$0.82–0.87**；最坏 ≈ **$3.28**；累计已花 ≈ **$0.24**
- runner：`runs/2026-10-19f-real-legacy/run-real.mjs`（未批准时 `exit 2`）
- 状态：**等待逐字点头**；未收到前零上游、零付费。

### 2026-10-19 · 第二次真跑逐字授权（执行）

人裁逐字（重复两次）：

> **批准票 10 第二次真跑：gemini-2.5-flash-image legacy，21 张 / 3 文本 / ≤84 图发 / ≤6 文本发 / 45 分钟，runner 走 7890**

- runner：`runs/2026-10-19f-real-legacy/run-real.mjs`（`RUN_APPROVED=1`）
- 输出：`runs/2026-10-19f-real-legacy/ruin-scavenger-extraction-assets/pack/v1/`
- 失败即停；不重跑、不自动修复。

### 2026-10-19 · 单行 smoke 通过 ✅

- 输入：`scavenger-actor.run` 8 帧 · `sheet 8×1` · 复用失败现场母版（`source.reference`，零母版调用）。
- 结果：1 发 `image/png` · 17.3s · `verifyPack` **ok** · **8 帧** 全部落盘 · 1 生图 / 0 文本。
- 生成图：**一行 8 个角色**、大小一致、无格线 / 边框 / 编号；按格校验通过。
- 交付：`atlas.animations.png` 48×512（8× 48×64，透明 15,037 / 不透明 9,539 / 半透明 0）。
- 小瑕疵（非结构性）：脚下有一排很细的虚线（提示词要求不要地面线）；32 色量化把外套的绿映射成棕，
  背包与躯干对比偏弱。结构 / 帧数 / 切帧全过。
- 花费：1 × $0.039 ≈ **$0.039**；累计 ≈ **$0.98**。
- 包：`runs/2026-10-19g-smoke-single-row/smoke-single-row/pack/v1/`

### 2026-10-19 · 第三次真跑预算报告（待点头）

- 报告：[`../report-10-real-single-row-2026-10-19.md`](../report-10-real-single-row-2026-10-19.md)
- 配方：`runs/2026-10-19h-real-single-row/asset-recipe.json`
  （3 个 import 母版 + 13 个单行动画 + 2 sprite + 3 背景层）
- 复用：3 张母版从失败现场裁到精确比例并 import（0 次母版调用）；7 个 import 原样复用。
- 预算：**18 生图 + 3 文本** · ≤72 图发 / ≤6 文本发 · 45 分钟
- 费用：正常 ≈ **$0.70–0.75**；最坏 ≈ **$2.81**；累计已花 ≈ **$0.98**
- runner：`runs/2026-10-19h-real-single-row/run-real.mjs`（未批准时 `exit 2`）
- 状态：**等待逐字点头**；未收到前零上游、零付费。

### 2026-10-19 · 第三次真跑逐字授权（执行）

人裁逐字：

> **批准票 10 第三次真跑：单行 + 复用母版，gemini-2.5-flash-image legacy，18 张 / 3 文本 / ≤72 图发 / ≤6 文本发 / 45 分钟，runner 走 7890**

- runner：`runs/2026-10-19h-real-single-row/run-real.mjs`（`RUN_APPROVED=1`）
- 输出：`runs/2026-10-19h-real-single-row/ruin-scavenger-extraction-assets/pack/v1/`
- 失败即停；不重跑、不自动修复。

### 2026-10-19 · 逐帧真跑预算报告（待点头）

- 报告：[`../report-10-real-frames-2026-10-19.md`](../report-10-real-frames-2026-10-19.md)
- 配方：`runs/2026-10-19i-real-frames/asset-recipe.json`
  （61 帧逐帧动画 + 2 sprite + 3 背景；3 个 import 母版）
- 预算：**66 生图 + 3 文本** · ≤132 图发 / ≤6 文本发 · 60 分钟
- 费用：正常 ≈ **$2.58–2.70**；最坏 ≈ **$5.15**；累计已花 ≈ **$1.53–1.68**
- runner：`runs/2026-10-19i-real-frames/run-real.mjs`（未批准时 `exit 2`）
- 状态：**等待逐字点头**；未收到前零上游、零付费。

### 2026-10-19 · 逐帧真跑逐字授权（执行）

人裁逐字：

> **批准票 10 逐帧真跑：gemini-2.5-flash-image legacy，66 张 / 3 文本 / ≤132 图发 / ≤6 文本发 / 60 分钟，runner 走 7890**

- runner：`runs/2026-10-19i-real-frames/run-real.mjs`（`RUN_APPROVED=1`）
- 输出：`runs/2026-10-19i-real-frames/ruin-scavenger-extraction-assets/pack/v1/`
- 失败即停；不重跑、不自动修复。

### 2026-10-19 · 零付费抢救出包 ✅

- 包：`runs/2026-10-19j-salvage/ruin-scavenger-extraction-assets/pack/v1/`
- `verifyPack` **ok** · **0 次上游调用** · 19 资源 · 61 帧动画 · 2 sprite + 7 import · 3 层背景 · 3 UI。
- `office-debris` 用 `minLargestShare: 0.5` 通过（桌子 + 椅子 + 弹簧，多部件）。
- 内容瑕疵：standby3 是人；潜伏者倒挂/站立语义混用；地面线；绿外套量化成棕。
- 成功报告：[`../report-10-salvage-success-2026-10-19.md`](../report-10-salvage-success-2026-10-19.md)
- 状态：等收包 / 定向修复裁定。

### 2026-10-19 · standby3 修复 + 零付费重建 ✅

- 1 发生图（≈$0.039）：`extraction-point.standby3` 已替换为**终端**（EVAC 屏幕 + 天线 + 线缆）。
- 重建：patch 目录复用其余 65 张 + 3 drawlist，**0 上游调用**；`verifyPack` **ok**。
- **最终包**：`runs/2026-10-19l-salvage-standby3/ruin-scavenger-extraction-assets/pack/v1/`
  （19 资源 · 61 帧动画 · 2 sprite + 7 import · 3 层背景 · 3 UI）
- 剩余内容瑕疵：潜伏者 hang/lunge/retreat 倒挂/站立语义混用；多图地面线；绿外套量化成棕。
- 状态：等收包 / 继续定向修复。

## Answer

**决定（2026-10-19 · 人裁「你来决定」）**：**收下这个包，关票 10**。

### 最终包

`runs/2026-10-19l-salvage-standby3/ruin-scavenger-extraction-assets/pack/v1/`

- `verifyPack` **ok** · `problems` 空 · provenance `mixed`。
- **19 个资源**：6 个动画（**61 帧**：玩家 16 / 敌人 15 / 潜伏者 13 / 废料 4 / 净水 4 / 终端 9）·
  9 sprite（2 生成 + 7 import）· 1 背景（3 层）· 3 UI（drawlist）。
- 图集：animations 256×760 · backgrounds 640×1080 · sprites 96×488 · ui 48×64。
- 3 张母版 import（0 母版调用）；`office-debris` 用 `minLargestShare: 0.5` 通过多部件判据。
- 最终重建 **0 次上游调用**；生图花费记录在逐帧失败报告（66 次 ≈$2.57–2.73）。

### 决定理由

- Destination 的结构部分已满足：整包可交付、`verifyPack` 通过、固定帧数 / manifest / 图集 / 校验齐全；
  生产链不再依赖「一图 N 帧」的排版运气。
- 剩余是**内容质量**而非结构性阻塞：潜伏者倒挂/站立语义混用、地面线、绿外套量化成棕。
  这些需要另一次定向付费修（潜伏者 ≤13 发）或零付费后处理（地面线），不应在「你来决定」下自动花钱。
- 按付费闸：任何进一步生图都要另出报告 + 逐字点头；本次不发起。

### 已知瑕疵（记录在案）

1. **潜伏者**：hang / lunge / retreat 的倒挂 / 站立语义混用（形象一致）。
2. **地面线**：多张动画帧脚下有地面线 / 细虚线。
3. **色板**：32 色把绿外套量化成棕；整体风格（深色描边 / 脏旧材质 / 有限色板）成立。

三项都不影响 `verifyPack` 与帧数；作为后续质量迭代记录在地图 Notes。
