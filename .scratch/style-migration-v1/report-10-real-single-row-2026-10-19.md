# 票 10 第三次真跑：单行 sheet + 复用母版（付费，待点头）

- **日期**：2026-10-19
- **状态**：**报告已出，尚未发出任何上游请求**。
- **依据**：单行 smoke 已通过（`scavenger run` 8×1 → 8 帧 / `verifyPack` ok / 无格线）；
  [票 16](issues/16-fixed-grid-not-followed.md) 的 A 裁定已施工。
- **不改** `game-maker.local.json`；不隐藏重试；不自动修复 / 回退 / 转码。

## 0 · 一句话

把 **13 个动画全部改成单行 `sheet`**，并**复用**第一次/第二次真跑已生成的 3 张母版；
重新生成 13 个动画 + 2 个 sprite + 3 个背景层 = **18 次生图 + 3 次文本**；
正常 ≈ **$0.70–0.72**；最坏 72 发 ≈ **$2.81**；45 分钟硬停。

## 1 · 输入

| 项 | 路径 |
| --- | --- |
| 配方 | `runs/2026-10-19h-real-single-row/asset-recipe.json` |
| 风格 / 参考图 / DNA / VWS | 同目录 `stylespec.json`（32 色）· `reference.png` · `character-dna.json` · `visual-world.json` |
| 7 张 import PNG | 同目录 `imported/*.png` |
| 3 张复用母版 | 同目录 `reuse/master-*.png`（从失败现场裁到精确比例） |
| 模型 / 端点 | `gemini-2.5-flash-image` · legacy `generateContent`（PNG） |
| 代理 | 生图 `7890`；文本 `15721` |

## 2 · 单行 `sheet`（13 个动画）

| 资产 | 动画 | 帧 | 网格 |
| --- | --- | --- | --- |
| scavenger-actor | idle / run / jump | 4 / 8 / 4 | 4×1 / 8×1 / 4×1 |
| wasteland-enemy | patrol / charge / halt | 6 / 6 / 3 | 6×1 / 6×1 / 3×1 |
| ceiling-lurker | hang / lunge / retreat | 4 / 5 / 4 | 4×1 / 5×1 / 4×1 |
| scrap-resource | idle | 4 | 4×1 |
| clean-water | idle | 4 | 4×1 |
| extraction-point | standby / active | 3 / 6 | 3×1 / 6×1 |

## 3 · 复用与调用预算

| 类别 | 处理 | 调用 |
| --- | --- | --- |
| 3 张母版 | **import**（从失败现场裁剪到 3:4 / 1:1 / 6:7；`masterRatioReading` 全部一致） | **0** |
| 13 个动画 sheet | 重新生成（单行） | **13** |
| 2 个 sprite | 重新生成（避免复用图的抠底风险） | **2** |
| 3 个背景层 | 重新生成 | **3** |
| 7 个 import | 原样复用 | 0 |
| 3 个 drawlist | 文本重新生成 | **3 文本** |
| **合计** | | **18 生图 + 3 文本** |

**重试上限**：生图每调用 4 发 ⇒ 最坏 **72 发**；文本每资源 2 发 ⇒ 最坏 **6 发**。
4xx / 非 PNG 不重试；5xx / 429 / 网络 / 无图才重试。

## 4 · 费用

- 图像 **$0.039 / 张**：18 张 = **$0.702**。
- 输入 **$0.30 / 1M**：估计 < $0.05。
- 正常 ≈ **$0.70–0.75**；最坏 72 张 = **$2.808**。
- 文本 3 发（`deepseek-flash` 实际服务）量级 < $0.01。
- **累计已花 ≈ $0.98**；本次后 ≈ **$1.68**。

## 5 · 已知风险

1. **单行只实测了 8 帧**（smoke）；6 / 5 / 4 / 3 帧的同款单行排版**尚未付费验证**，
   但同一提示词模板、同一模型，风险低于多行网格。
2. **脚下细虚线**：smoke 的生成图与交付帧底部有一排很细的虚线（提示词要求不要地面线）；
   按格校验不抓这一档。本次可能复现；先记录，不自动修。
3. **色板**：32 色把外套的绿映射成棕；背包与躯干对比偏弱。风格验收时按图 43 逐项看。
4. **复用母版**：3 张母版来自上一跑并裁到精确比例；作为参考图使用，`masterRatioReading` 全部一致。
   母版本身的 2.7% / 9.3% 漂移是观察项（票 05），不阻断。
5. 任何一张 sheet 的按格校验失败 ⇒ 停；已付费图保留。

## 6 · 执行计划

1. runner：`runs/2026-10-19h-real-single-row/run-real.mjs`（`RUN_APPROVED=1` 才发请求）。
2. 输出：`runs/2026-10-19h-real-single-row/ruin-scavenger-extraction-assets/pack/v1/`。
3. 硬停：生图 ≤18 调用 / ≤72 发 · 文本 ≤3 调用 / ≤6 发 · 墙钟 45 分钟。
4. 跑完：`verifyPack`、`ledger`（18 / 3）、母版 import（0 master 调用）、13 个动画帧数、
   2 sprite、3 背景层、7 import、3 UI、联系表逐项验收。
5. 失败即停；不重跑、不补发、不自动修复。

## 7 · 验收

1. `verifyPack` **ok**，`problems` 空，provenance `mixed`。
2. `ledger`：生图 **18** 次（13 动画 + 2 sprite + 3 背景）· 文本 **3** 次；
   **0 次母版调用**；无额外调用。
3. 3 张 import 母版落盘；`master-ratios.json` 3 条（全部 match）。
4. 13 个动画帧数逐项等于 spec；单行按格校验全过；无格线 / 边框 / 编号。
5. 2 个 sprite、3 个背景层、7 个 import、3 个 UI 逐项正确。
6. 风格：深色描边、3–4 级明暗、脏旧材质、32 色内；图 43 逐项对照。

## 8 · 需要你给的授权

逐字一句即可：

> **批准票 10 第三次真跑：单行 + 复用母版，gemini-2.5-flash-image legacy，18 张 / 3 文本 / ≤72 图发 / ≤6 文本发 / 45 分钟，runner 走 7890**

未收到这句之前，本报告**不发任何上游请求**。
