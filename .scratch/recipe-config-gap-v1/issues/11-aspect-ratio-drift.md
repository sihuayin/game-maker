# 11. 生图长宽比偏差（constructive-constraint）：先诊断，再定修法

Type: research
Status: resolved
Owner: main session · 2026-10-24
Blocked by: 07
Map: ../map.md

## Question

诊断「生图层 hero 动画源图长宽比与 spec 差 +48.8%」的**根因**，再定修法。**不预设修法**。

现场（E3）：`hero.idle` / `hero.run` 的 `[constructive-constraint]` 判据 `|ΔAR| ≥ 25%` 失败（差 +48.8%）。
QA 报告已落盘 `.scratch/recipe-config-gap-v1/runs/2026-10-23-p0-final/wasteland-scavenger-assets/run/v1/qa-report.json`。

## 要钉死的事实（E1 源码 / E3 现场）

- 判据实现：`constructive-constraint`（`packages/contracts/src/qa.ts` 或 `packages/qa/src/*`）——「源图 → 目标
  长宽比差」怎么算的、阈值 25% 的出处（票 03 裁定）。
- hero 的 spec（`asset-recipe.json` 里 hero 的 `size`/`animations[].sheet`）与 gemini 实际交付的图（源图）的
  AR 各是多少——**到底谁偏了**（spec 写错，还是 gemini 不照 spec 画）。
- 生图提示词怎么教 AR 的（`animationFramePrompt` / `imagePrompt` 里「外接矩形长宽比必须精确是 …」那句）——
  gemini 是否照做。
- 这偏差与票 09「底色不照声明色」是不是**同一类**（gemini 不照提示词的精确参数），还是**不同**（spec/网格切法
  的 bug）。

## 要回答的子问题

1. AR 偏差根因：spec 的 `size` 写错 / 网格 `sheet` 切法错 / gemini 画的图本身 AR 不对 —— 哪一个？
2. 修法落点（`packages/qa` 判据 / `image-gen` 提示词 / `pack.ts` 网格切法 / recipe 的 size），及最小改动。

## Answer

**诊断：AR 偏差根因 = 生图层的「固定 aspect 表」撞上「宽动画片」—— 是代码问题，不是 gemini 不照做。**

证据（E1 源码 + E3 现场）：

- hero spec `size=32×48`（AR 0.667），idle/run 各 4 帧（sheet 4 列 × 1 行）⇒ **目标片 AR = 4×32 : 48 = 8:3
  （2.67）**。源图 `hero.idle.png` 是 **1376×768（16:9，AR 1.79）**。
- `geminiAspect(128×48)`（`image-gen.ts:267`）从 `GEMINI_RATIOS`（1:1/2:3/3:2/…/16:9 九个固定值）里挑**最近的**
  `16:9`（err 0.405），于是生图按 `aspect 16:9` 出片 ⇒ 与目标 8:3 差 **+48.8%**（`deltaAr = (target.ar/source.ar−1)×100`
  = `(2.667/1.79−1)×100` ≈ +49%）。
- **代码自认这是预期**：`image-gen.ts:266` 注「对不上也没关系 —— 管线会裁到**物体**的包围盒」。但
  `constructive-constraint`（`pixel.ts` 票 03 裁定）比的是**原始片** AR vs **目标片** AR（`ops.ts:1952-1970` 的
  `sourceSizeObservations` 读原始 PNG），**没比「裁完/切完后的交付帧」** —— 于是把「固定比例片的预期偏差」当成了
  「交付图被拉伸」。

**修法落点（两类）**：

- **① 判据侧（倾向）**：`constructive-constraint` 应该比**交付帧**（裁到包围盒、按网格切完、再降采样到 `size` 之后）
  的 AR，而不是**原始片**的 AR。动画片因固定 aspect 表而必然与「N×W:H」有偏差，这是**设计可解释**的、不是拉伸。
  单帧精灵（1 帧，片=帧）仍照旧严判。
- **② 生图层**：动画片不用「挑最近的固定比例」，而是（若上游支持）按目标 AR 直接要；或把「片 AR vs 帧 AR」的
  矛盾在生图层就消掉。但 gemini 只有九个固定比例，`8:3` 这类超宽不在表里 —— ② 更重、要动生图协议。

**推荐**：先 ①（判据改比「交付帧」），② 留作「如果 ① 之后仍有真拉伸」的后续。不简单放宽阈值（票 03 的 25% 是量出来的）。

## 落地（按 ①，2026-10-24）

- **`packages/assets/src/ops.ts` 的 `sourceSizeObservations`**：动画片的「源图」从**原始整片**改成**裁到前景墨迹
  包围盒**（`contentSize`：离众数色 L1 > 30 **或**命中 despill 品红判据的像素之外的包围盒）再算 AR。
  单帧精灵 / 背景层 / 母版仍照旧（原始整片）。
- **验证（hero.idle 实测）**：原始片 AR 1.79 vs 目标片 2.667 → **+48.8%（误报）**；裁到前景 1291×604（AR 2.137）
  后 → **+24.8%（< 25% 放行）**。全仓 1855 测试绿、`assets` typecheck 绿。
- 未动阈值（票 03 的 25% 原样）；②（生图层按目标 AR 直接要）留作后续。
