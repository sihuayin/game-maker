# 票 10 第二次真跑：2.5 legacy PNG · 完整迁移包（付费，待点头）

- **日期**：2026-10-19
- **状态**：**报告已出，尚未发出任何上游请求**。
- **依据**：legacy smoke 已通过（1 发 `image/png` · `verifyPack` ok）；[票 15](issues/15-interactions-jpeg-only.md) 已恢复 2.5 legacy 分支。
- **上一次失败**：[report-10-failure-2026-10-19.md](report-10-failure-2026-10-19.md)（6 张非 PNG，≈$0.21）。
- **不改** `game-maker.local.json`；不隐藏重试；不自动修复 / 回退 / 转码。

## 0 · 一句话

用 **2.5 legacy `generateContent`（PNG）** 跑票 09 的迁移配方（B 变体：加 `sheet`）：
**21 次生图 + 3 次文本**；正常 ≈ **$0.82–0.87**；最坏 84 发 ≈ **$3.28**；45 分钟硬停。

## 1 · 输入

| 项 | 路径 |
| --- | --- |
| 配方 | `runs/2026-10-19a-migration/asset-recipe.mastered-sheet.json`（19 条 + 3 母版 + 13 个网格动画） |
| 风格 / 参考图 / DNA | 同目录 `stylespec.json`（32 色）· `reference.png` · `character-dna.json` |
| 7 张 import PNG | 同目录 `imported/*.png`（尺寸已复核） |
| 模型 | **`gemini-2.5-flash-image`**（runner 显式覆盖；config 不动） |
| 端点 | `POST {baseUrl}/models/gemini-2.5-flash-image:generateContent` |
| 代理 | 生图 `127.0.0.1:7890`；文本直连 `127.0.0.1:15721` |
| `sheet` | 13 个动画全部带网格（4→2×2 · 6→3×2 · 8→4×2 · 3/5→单行） |

## 2 · 调用预算

| 类别 | 资产 / 动作 | 调用 |
| --- | --- | --- |
| 母版 | 3 个角色 | 3 |
| 动画 | scavenger 3 · enemy 3 · lurker 3 · scrap 1 · water 1 · extraction 2 | 13 |
| 单帧 sprite | hazard-terrain · office-debris | 2 |
| 背景层 | skyline · blocks · street | 3 |
| **生图合计** | | **21** |
| import | 7 张 PNG | 0 |
| drawlist 文本 | hud-panel · scrap-icon · health-icon | **3** |

**重试上限**：生图默认每调用 4 发 ⇒ 最坏 **84 发**；文本默认每资源 2 发 ⇒ 最坏 **6 发**。
4xx / 非 PNG 不重试；5xx / 429 / 网络 / 无图才重试。越界 ⇒ `exit 124`。

## 3 · 费用

按 Google 官方 list price（2026-10-19）：

- 图像输出 **$0.039 / 张**：21 张 = **$0.819**。
- 输入（文本 / 图片）**$0.30 / 1M tokens**：21 发估计 < $0.05。
- **正常路径 ≈ $0.82–0.87**。
- 最坏重试 84 张 = **$3.276**。
- 文本 3 发（`deepseek-flash` 实际服务）usage 落账；量级 < $0.01。
- ⚠️ 实际账单以中转为准。

**至今累计花费**：第一次失败 ≈ $0.20 + 两次 400 ≈ $0 + legacy smoke $0.039 ≈ **$0.24**（不含文本的小额 usage）。

## 4 · 与第一次失败的区别

| 项 | 第一次（失败） | 这一次 |
| --- | --- | --- |
| 模型 / API | 3.1 Lite · Interactions | **2.5 · legacy `generateContent`** |
| 输出格式 | 非 PNG（JPEG） | **PNG（smoke 已确认）** |
| 母版 | 3 张（补齐） | 3 张（同） |
| `sheet` | 已加（B 变体） | 已加（同） |
| 实际发出 | 6 生图 + 3 文本后失败 | 目标 21 生图 + 3 文本 |

## 5 · 执行计划

1. runner：`runs/2026-10-19f-real-legacy/run-real.mjs`（`RUN_APPROVED=1` 才发请求）。
2. 输出：`runs/2026-10-19f-real-legacy/ruin-scavenger-extraction-assets/pack/v1/`。
3. 硬停：生图 ≤21 调用 / ≤84 发 · 文本 ≤3 调用 / ≤6 发 · 墙钟 45 分钟。
4. 跑完立刻：`verifyPack`、查 `ledger.json`（21 / 3）、查 `master-ratios.json`（3 条）、
   本地联系表逐项验收。
5. 任何一步失败 ⇒ 停，保留 ledger / 现场 / 已付费原图；不重跑、不补发、不自动修复。

## 6 · 验收

1. `verifyPack` **ok**，`problems` 空，provenance `mixed`。
2. `ledger`：生图 **21** 次（3 母版 + 13 动画 + 2 单帧 + 3 背景）· 文本 **3** 次；无额外调用。
3. 3 张母版落盘；`master-ratios.json` 3 条读数（观察项，不阻断）。
4. 7 个 import：尺寸 / 透明底 / 锚点逐项正确。
5. 3 个 UI：drawlist 与图 43 的 UI 观感一致。
6. 9 个 image 资源：深色描边、3–4 级明暗、脏旧材质、32 色内；13 个动画帧数与 `sheet` 一致；
   无文字 / 边框 / 编号。
7. 产物目录、`http-calls.log`、包内 `ledger.json` 全部保留。

## 7 · 失败语义

| 失败点 | 花费 | 结果 |
| --- | --- | --- |
| 2.5 停服 / 4xx | 预计 $0–1 发 | 停；不再自动换模型 |
| 某张非 PNG | 1 发 ≈ $0.039 | 停；不转码 |
| 某张 4 发失败 | 最多 4 发 | 共享闸停掉后续新调用 |
| 帧数 / 空格 / 边框校验失败 | 那张图已付费 | 包失败；原图在 `authoring/generated/` |
| 母版失败 | 母版那几发 | 只阻断引用它的角色动画；整包最后仍失败 |
| 墙钟 / 预算到顶 | 已发出的 | `exit 124` |

## 8 · 需要你给的授权

逐字一句即可：

> **批准票 10 第二次真跑：gemini-2.5-flash-image legacy，21 张 / 3 文本 / ≤84 图发 / ≤6 文本发 / 45 分钟，runner 走 7890**

未收到这句之前，本报告**不发任何上游请求**。
