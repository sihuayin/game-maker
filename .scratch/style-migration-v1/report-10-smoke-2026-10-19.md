# 票 10 smoke：Interactions API 单张验证报告（付费，待点头）

- **日期**：2026-10-19
- **状态**：**报告已出，尚未发出任何上游请求**。
- **依据**：[票 13](issues/13-interactions-api-image.md) 已完工（Gemini 适配器改 Interactions API，显式 `image/png`）；
  [票 10 失败报告](report-10-failure-2026-10-19.md) 记录上一跑的 6 张非 PNG 失败。
- **目的**：用**最小代价**验证新适配器的真实请求形状与 PNG 回应，再决定是否发满 21 张。
- **不改** `game-maker.local.json`；不隐藏重试；不自动修复。

## 0 · 一句话

只发 **1 张** `office-debris`（96×64 sprite），走完整 `packAssets` 路径：
Interactions 请求 → `steps[]` 解析 → PNG 解码 → 32 色量化 → 出包 → `verifyPack`。
**1 次生图 / ≤4 发 / 0 文本 / 15 分钟**，正常 ≈ **$0.034**，最坏 ≈ **$0.134**。

## 1 · 输入

| 项 | 内容 |
| --- | --- |
| 配方 | `runs/2026-10-19c-smoke/asset-recipe.json`（`id: smoke-interactions`，1 条 sprite） |
| 资产 | `office-debris` · 96×64 · anchor (0.5, 1) · 无 `characterId` / 无母版 |
| 风格 | 同目录 `stylespec.json`（32 色）+ `reference.png`（图 43 裁切） |
| 模型 | `gemini-3.1-flash-lite-image`（runner 显式覆盖；config 不动） |
| 端点 | `POST {baseUrl}/interactions` · `response_format.mime_type = "image/png"` |
| 代理 | 生图走 `127.0.0.1:7890` |
| 文本 | **0**（配方里没有 drawlist） |

`parseRecipe` 已过；`imageCallsOf` = **1**（single 1）。

## 2 · 这一跑验证什么

1. Interactions 请求体被真实上游接受（不是 4xx / 参数错）。
2. 回应里有 `steps[].type === "model_output"` 的图片块。
3. 图片 MIME 是 **`image/png`**（不是 JPEG / WebP）。
4. `decodePNG` 成功，且 96×64 的 3:2 画布没有把物体拉坏（管线会裁到包围盒）。
5. 32 色量化 + 出包 + `verifyPack` 全绿；`ledger` 记 **1 次生图 / 0 次文本**。
6. runner 的 `IMG-MIME` 日志留下真实 MIME / base64 长度 / step 类型。

**不验证**：母版→动画的 `reference` 路径、固定网格切帧、其余 8 个 image 资产的风格一致性。
那些留给 smoke 通过后的完整真跑。

## 3 · 预算与硬停

| 项 | 上限 |
| --- | --- |
| 生图调用 | **1** |
| 生图 HTTP | **≤4 发**（Gemini 默认 attempts=4；只对 5xx / 429 / 网络 / 无图重试） |
| 文本调用 | **0**（runner 直接阻断） |
| 墙钟 | **15 分钟硬停** |
| 正常费用 | 1 × $0.0336 ≈ **$0.034** |
| 最坏费用 | 4 × $0.0336 ≈ **$0.134** |

- 4xx / 非 PNG ⇒ **不重试**，1 发即停。
- 没有图 ⇒ 最多 4 发，然后停。
- 任何一步失败 ⇒ 保留 `http-calls.log`、失败现场与已付费原图；**不重跑、不补发**。
- 输出：`runs/2026-10-19c-smoke/smoke-interactions/pack/v1/`（新目录，不覆盖任何现有产物）。

## 4 · 失败后果

| 失败点 | 花费 | 结果 |
| --- | --- | --- |
| 上游 4xx（请求形状错） | 1 发（通常不计费） | 停；日志里有真实错误报文 |
| 上游 200 但非 PNG | 1 发 ≈ $0.034 | 停；`IMG-MIME` 记下真实 MIME |
| 上游 200 但没有图 | ≤4 发 | 停；报文带 `steps` 摘要 |
| PNG 解码 / 量化 / `verifyPack` 失败 | 1 发 ≈ $0.034 | 停；失败现场保留 |
| 墙钟 / 预算到顶 | 已发出的 | `exit 124` |

## 5 · 验收

1. `http-calls.log` 里有 `IMG-MIME #1 image/png`（或明确的非 PNG 失败）。
2. `ledger.json`：生图 **1** 次调用 · 文本 **0** 次调用。
3. `verifyPack` **ok**，`problems` 空。
4. 交付的 `office-debris` 是 96×64；深色描边、3–4 级明暗、脏旧材质可辨。
5. 失败时：现场、日志、已付费原图都在；没有生成半成品 `pack/v1`。

## 6 · 需要你给的授权

逐字一句即可：

> **批准票 10 smoke：1 张 / ≤4 发 / 15 分钟，gemini-3.1-flash-lite-image，Interactions PNG，runner 走 7890**

未收到这句之前，本报告**不发任何上游请求**。
