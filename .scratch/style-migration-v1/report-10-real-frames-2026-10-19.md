# 票 10 逐帧真跑：61 帧 + 2 sprite + 3 背景（付费，待点头）

- **日期**：2026-10-19
- **状态**：**报告已出，尚未发出任何上游请求**。
- **依据**：[票 17](issues/17-frame-by-frame-vs-salvage.md) 的 A 裁定已施工（`source.kind="frames"`）。
- **不改** `game-maker.local.json`；不隐藏重试；不自动修复 / 回退 / 转码。

## 0 · 一句话

**每帧一次调用**，彻底绕开「一图 N 帧」的数量/排版问题：
**61 帧动画 + 2 sprite + 3 背景层 = 66 次生图 + 3 次文本**；
3 张母版从上一跑 import（0 母版调用）；正常 ≈ **$2.58–2.70**；60 分钟硬停。

## 1 · 输入

| 项 | 路径 |
| --- | --- |
| 配方 | `runs/2026-10-19i-real-frames/asset-recipe.json` |
| 风格 / 参考图 / DNA / VWS | 同目录 `stylespec.json`（32 色）· `reference.png` · `character-dna.json` · `visual-world.json` |
| 3 张 import 母版 | 同目录 `reuse/master-*.png`（精确比例；0 次母版调用） |
| 7 张 import PNG | 同目录 `imported/*.png` |
| 模型 / 端点 | `gemini-2.5-flash-image` · legacy `generateContent`（PNG） |
| 代理 | 生图 `7890`；文本 `15721` |

## 2 · 逐帧调用表

| 资产 | 动画 | 帧 |
| --- | --- | --- |
| scavenger-actor | idle / run / jump | 4 / 8 / 4 |
| wasteland-enemy | patrol / charge / halt | 6 / 6 / 3 |
| ceiling-lurker | hang / lunge / retreat | 4 / 5 / 4 |
| scrap-resource | idle | 4 |
| clean-water | idle | 4 |
| extraction-point | standby / active | 3 / 6 |
| **动画合计** | | **61** |
| 2 个 sprite | hazard-terrain · office-debris | 2 |
| 3 个背景层 | skyline · blocks · street | 3 |
| **生图合计** | | **66** |
| 3 个 drawlist | UI | **3 文本** |

## 3 · 预算与硬停

| 项 | 上限 |
| --- | --- |
| 生图调用 | **66** |
| 生图 HTTP | **≤132 发**（runner 硬停；引擎默认每调用 4 次尝试，132 约等于平均 2 发） |
| 文本调用 | **3** |
| 文本 HTTP | **≤6 发** |
| 墙钟 | **60 分钟** |
| 正常费用 | 66 × $0.039 ≈ **$2.574** + 输入 < $0.1；≈ **$2.58–2.70** |
| 最坏费用 | 132 发 × $0.039 ≈ **$5.148**（NO_IMAGE 通常不计费） |
| 累计已花 | ≈ **$1.53–1.68**；本次后 ≈ **$4.1–4.4** |

## 4 · 已知风险

1. **逐帧一致性**：61 张独立生成；母版参考图能锚住形象，但姿势 / 比例 / 细节可能在帧间漂移；
   每帧独立裁框，没有「同一动画共用裁框」的保护（这是逐帧模式的代价）。
2. **物件 vs 角色**：`scrap-resource` / `clean-water` / `extraction-point` 没有 `characterId`；
   逐帧提示词已按「物件」写（不再说「角色」），但模型仍可能画错主体。
3. **小瑕疵**：地面虚线 / 杂点不会被单帧判据完全抓住；先记录，不自动修。
4. **调用数大**：61 帧里任何一帧的抠底 / 主体判据失败 ⇒ 停；失败越晚，已花越多。
5. **首次逐帧真跑**：pack 的逐帧分支已离线测试（2 帧 = 2 次、manifest 2 帧、`verifyPack` ok），
   但**没有真实上游证据**。

## 5 · 执行计划

1. runner：`runs/2026-10-19i-real-frames/run-real.mjs`（`RUN_APPROVED=1` 才发请求）。
2. 输出：`runs/2026-10-19i-real-frames/ruin-scavenger-extraction-assets/pack/v1/`。
3. 硬停：66 生图 / ≤132 图发 · 3 文本 / ≤6 文本发 · 60 分钟。
4. 跑完：`verifyPack`、`ledger`（66 / 3、0 母版调用）、13 个动画逐帧帧数、
   2 sprite、3 背景层、7 import、3 UI、风格与帧间一致性。
5. 失败即停；不重跑、不补发、不自动修复。

## 6 · 验收

1. `verifyPack` **ok**，`problems` 空，provenance `mixed`。
2. `ledger`：生图 **66** 次（61 帧 + 2 sprite + 3 背景）· 文本 **3** 次；**0 次母版调用**。
3. 13 个动画的帧数逐项等于 spec（61 帧）；manifest 的 animations 分组正确。
4. 2 个 sprite、3 个背景层、7 个 import、3 个 UI 逐项正确。
5. 风格：深色描边、3–4 级明暗、脏旧材质、32 色内；逐帧角色形象一致（允许小幅姿势差异）。
6. 产物目录、`http-calls.log`、包内 `ledger.json` 全部保留。

## 7 · 请给授权

逐字一句即可：

> **批准票 10 逐帧真跑：gemini-2.5-flash-image legacy，66 张 / 3 文本 / ≤132 图发 / ≤6 文本发 / 60 分钟，runner 走 7890**

未收到这句之前，本报告**不发任何上游请求**。
