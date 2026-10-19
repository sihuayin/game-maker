# 票 10 smoke：Interactions PNG 请求被拒 —— 失败报告（2026-10-19）

- **状态**：**失败即停**。没有生成图；没有包；没有自动重试 / 回退。
- **授权**：人裁逐字「批准票 10 smoke：1 张 / ≤4 发 / 15 分钟，gemini-3.1-flash-lite-image，Interactions PNG，runner 走 7890」
- **实际**：**1 发 HTTP**，`400 invalid_request`，3.8 秒；没有图。
- **预计花费**：**$0**（上游在生成前拒绝；账上记 1 次尝试，以账单为准）。
- **现场**：`.scratch/style-migration-v1/runs/2026-10-19c-smoke/http-calls.log`

## 0 · 一句话

`gemini-3.1-flash-lite-image` 在 Interactions API 里**只支持 `image/jpeg`**，
不支持我们要求的 `image/png`：

```json
{"error":{"message":"The value 'image/png' is not supported for 'response_format.mime_type'. Supported values: 'image/jpeg'.","code":"invalid_request"}}
```

⇒ 票 12 的 A2 前提（「显式要 PNG 就能拿到 PNG」）对这个模型**不成立**。
要么换一个支持 PNG 的模型，要么保留 lite 并接受 JPEG 解码。

## 1 · 证据

`http-calls.log`：

```
START smoke model=gemini-3.1-flash-lite-image proxy=http://127.0.0.1:7890 maxImageReq=4 maxTextReq=0
IMG-REQ #1 https://generativelanguage.googleapis.com/v1beta/interactions
IMG-RES #1 400
IMG-MIME #1 none b64len=0 stepTypes=
FAIL Gemini 生图失败（4 次内）：上游返回 HTTP 400：{"error":{"message":"The value 'image/png' is not supported for 'response_format.mime_type'. Supported values: 'image/jpeg'.","code":"invalid_request"}}
```

- 4xx 不在重试判据里 ⇒ 只发了 **1 发**，没有隐藏重试。
- 上游在生成前拒绝 ⇒ 没有生成图，预计 **$0**。
- 没有 `pack/v1`，没有 ledger 文件（失败在资产段之前；异常携带的账里只有这 1 次尝试）。

## 2 · 这意味着什么

| 事实 | 后果 |
| --- | --- |
| 3.1 Lite 的 Interactions 只接受 `image/jpeg` | A2「显式要 PNG」在这台模型上**走不通** |
| 现有适配器收到非 PNG 会明确失败（票 13 的行为） | 不会静默解码 JPEG |
| 要保留 3.1 Lite | 必须**接受 JPEG**：加 JPEG 解码（A1），或 runner 层转码（只算探针） |
| 要保留 PNG | 必须**换模型**：换一个 `response_format.mime_type` 接受 `image/png` 的模型 |

## 3 · 可选路线

| 路线 | 做法 | 图像单价 | 输入单价 | 源码改动 | 主要风险 |
| --- | --- | --- | --- | --- | --- |
| **M1（推荐）** | 换 `gemini-nano-banana-2.1` | **$0.0336 / 1K** | $1.50 / 1M | **0**（runner 改一行模型名） | 需 1 发 smoke 确认 PNG；输入贵 5×（本跑量级可忽略） |
| **M2** | 换 `gemini-3.1-flash-image` | **$0.067 / 1K** | $0.50 / 1M | **0**（runner 改一行） | 每张约 2×；需 1 发 smoke 确认 PNG |
| **J（A1）** | 保留 3.1 Lite，请求 `image/jpeg`，加纯 JS JPEG 解码 | **$0.0336 / 1K** | $0.25 / 1M | 需要 JPEG 解码器 + 依赖 | JPEG 伪影可能伤 1px 描边；要改解码层 |
| **B** | 回退 `gemini-2.5-flash-image`（legacy `generateContent` 回 PNG） | $0.039 / 张 | $0.30 / 1M | 需要保留 legacy 分支 | 2.5 已标注停服；不回 3.1 |

**M1 的依据**：官方 image-generation 文档的 `response_format` 示例里，
`gemini-nano-banana-2.1` 明确使用 `"mime_type": "image/png"`；models 列表今天也列出它。
图像单价与 Lite 相同（$30 / 1M image tokens ≈ $0.0336 / 1K），输入单价更高但本跑量级很小。
质量定位高于 Lite（官方称 improved visual quality）。

⚠️ 以上都是**文档 / 列表证据**；是否真的接受 PNG 要再发 **1 发 smoke** 才能确认。
⚠️ 不自动换模型：换模型须你裁。

## 4 · 建议

**先裁 M1**（换 `gemini-nano-banana-2.1`），再按同样的 smoke 预算发 **1 张**确认 PNG；
确认后回到完整 21 张预算。

- 预期：1 发 ≈ **$0.034**；最坏 4 发 ≈ **$0.134**。
- 若 M1 也拒绝 PNG ⇒ 停，再在 M2 / J 里选。
- 不自动回退、不自动转码、不重跑。

## 5 · 需要你给的授权

逐字一句即可，例如：

> **裁 M1：换 gemini-nano-banana-2.1，先按 smoke 预算 1 张 / ≤4 发 / 15 分钟确认 PNG**

或

> **裁 J：保留 3.1 Lite，加 JPEG 解码，先零付费施工**

未收到这句之前，不发任何上游请求、不改源码。
