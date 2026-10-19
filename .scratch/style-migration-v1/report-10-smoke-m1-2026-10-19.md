# 票 10 smoke M1：`gemini-nano-banana-2.1` 确认 PNG（付费，已授权）

- **日期**：2026-10-19
- **授权（人裁逐字）**：
  > **换 gemini-nano-banana-2.1，先按 smoke 预算 1 张 / ≤4 发 / 15 分钟确认 PNG**
- **依据**：[票 14](issues/14-lite-only-jpeg-model-choice.md) 的 M1 裁定；[smoke 失败报告](report-10-smoke-failure-2026-10-19.md)。
- **不改** `game-maker.local.json`；不隐藏重试；不自动回退 / 转码。

## 0 · 一句话

把 smoke 的模型从 `gemini-3.1-flash-lite-image` 换成 **`gemini-nano-banana-2.1`**，
其余不变：**1 张 `office-debris`（96×64）· ≤4 发 · 0 文本 · 15 分钟**，
验证 Interactions API 是否接受 `response_format.mime_type = "image/png"` 并真的回 PNG。

## 1 · 输入与预算

| 项 | 内容 |
| --- | --- |
| 配方 | `runs/2026-10-19d-smoke-m1/asset-recipe.json`（1 条 `office-debris` 96×64） |
| 风格 / 参考图 | 同目录 `stylespec.json`（32 色）· `reference.png` |
| 模型 | **`gemini-nano-banana-2.1`**（runner 显式覆盖；config 不动） |
| 端点 | `POST {baseUrl}/interactions` · `response_format.mime_type = "image/png"` |
| 代理 | `127.0.0.1:7890` |
| 生图调用 | **1** |
| 生图 HTTP | **≤4 发**（仅 5xx / 429 / 网络 / 无图重试；4xx / 非 PNG 不重试） |
| 文本 | **0** |
| 墙钟 | **15 分钟硬停** |
| 正常费用 | 图 $0.0336 + 输入（$1.50 / 1M，量级 < $0.01）≈ **$0.034** |
| 最坏费用 | 4 × $0.0336 ≈ **$0.134** |

输出：`runs/2026-10-19d-smoke-m1/smoke-interactions/pack/v1/`（新目录）。

## 2 · 验收

1. HTTP **200**，`http-calls.log` 里有 `IMG-MIME #1 image/png`。
2. `ledger.json`：生图 **1** 次调用 · 文本 **0** 次。
3. `verifyPack` **ok**，`problems` 空。
4. 交付的 `office-debris` 是 96×64；深色描边、3–4 级明暗、脏旧材质可辨。
5. 失败即停：保留日志 / 现场 / 已付费原图；不重跑、不换模型、不转码。

## 3 · 失败语义（先说清）

| 失败点 | 花费 | 结果 |
| --- | --- | --- |
| 400（模型仍不接受 PNG） | 预计 $0 | 停；再在 M2 / J 里选 |
| 200 但非 PNG | 1 发 ≈ $0.034 | 停；`IMG-MIME` 落真实 MIME |
| 200 但无图 | ≤4 发 | 停；报文带 `steps` 摘要 |
| 解码 / 量化 / `verifyPack` 失败 | 1 发 ≈ $0.034 | 停；现场保留 |

## 4 · 授权状态

已收到逐字授权；本报告只记录这一次 **1 张** smoke，不延伸到完整 21 张。
完整真跑须另出预算报告 + 逐字点头。
