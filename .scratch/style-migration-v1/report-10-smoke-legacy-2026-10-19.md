# 票 10 smoke legacy：2.5 `generateContent` 确认 PNG（已授权）

- **授权（人裁逐字）**：
  > **裁 B：恢复 2.5 legacy PNG，先零付费恢复分支 + 1 发 smoke**
- **依据**：[票 15](issues/15-interactions-jpeg-only.md) 已施工（legacy 分支恢复）；两次 Interactions smoke 只回 JPEG。
- **不改** `game-maker.local.json`；不自动回退 / 转码 / 重跑。

## 0 · 一句话

用恢复后的 legacy 路径发 **1 张** `office-debris`（96×64）：
`gemini-2.5-flash-image` · `POST /models/{model}:generateContent` · **1 张 / ≤4 发 / 0 文本 / 15 分钟**；
确认它今天仍回 **PNG**，再决定是否发满 21 张。

## 1 · 预算

| 项 | 上限 |
| --- | --- |
| 模型 | `gemini-2.5-flash-image`（runner 显式覆盖；config 不动） |
| 端点 | `POST {baseUrl}/models/gemini-2.5-flash-image:generateContent` |
| 生图调用 | **1** |
| 生图 HTTP | **≤4 发**（默认 attempts=4；4xx / 非 PNG 不重试） |
| 文本 | **0** |
| 墙钟 | **15 分钟** |
| 正常费用 | 1 × $0.039 ≈ **$0.039** |
| 最坏费用 | 4 × $0.039 ≈ **$0.156** |

输出：`runs/2026-10-19e-smoke-legacy/smoke-interactions/pack/v1/`。

## 2 · 验收

1. HTTP **200**；`IMG-MIME #1 image/png`（shape=`candidates`）。
2. `ledger.json`：生图 **1** 次 · 文本 **0** 次。
3. `verifyPack` **ok**，`problems` 空。
4. 交付 `office-debris` 是 96×64；深色描边、3–4 级明暗、脏旧材质可辨。
5. 失败即停：保留日志 / 现场 / 已付费原图；不换模型、不转码、不重跑。

## 3 · 失败语义

| 失败点 | 花费 | 结果 |
| --- | --- | --- |
| 2.5 已停服（404/400） | 预计 $0 | 停；再在 J2（JPEG 解码）里选 |
| 200 但非 PNG | 1 发 ≈ $0.039 | 停；`IMG-MIME` 落真实 MIME |
| 200 但无图 | ≤4 发 | 停 |
| 解码 / 量化 / `verifyPack` 失败 | 1 发 ≈ $0.039 | 停；现场保留 |
