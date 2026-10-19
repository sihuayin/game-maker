# 12. 3.1 生图回应非 PNG：适配路线（解码 / Interactions API / 回退 2.5）

Type: grilling
Status: resolved
Owner: claude (2026-10-19 认领 · 人裁 A2 · 已裁定)
Blocked by: —
Map: ../map.md
> 派生自[票 10](10-hybrid-migration-real-run.md) 的第一次真跑失败（2026-10-19）。
> ⚠️ 本票只裁路线，不批准任何付费跑、不批准施工。

## Question

`gemini-3.1-flash-lite-image` 的 `generateContent` 回了 **200 + 非 PNG 的 inline data**；
管线的 `imageFromGemini()` 只调 `decodePNG()`、不看 `inlineData.mimeType` ⇒ 6 张图全部在解码处失败，
母版造不出来，包失败（详见[失败报告](../report-10-failure-2026-10-19.md)）。

要裁的是**适配路线**：

- **A1 · 按 MIME 解码 + 加纯 JS JPEG 解码器**：改动小、可离线测；需要动依赖 allowlist；
  JPEG 伪影可能影响 1px 描边。
- **A2 · 生图适配器改用 Interactions API，显式要求 `mime_type: "image/png"`**：从源头拿 PNG；
  请求 / 回应形状都要改，改动更大。
- **B · 回退 `gemini-2.5-flash-image` 真跑**：现有路径已验证回 PNG；但 2.5 已标注停服，且不修 3.1。
- **C · 先发 1 张诊断（≈$0.034）**：用 runner 已加的 `IMG-MIME` 日志确认到底是 JPEG / WebP / 其它，
  再在 A1 / A2 里选。
- **D · runner 里用 `sips` 转 PNG**：只可能是探针，不作为生产链；与 Destination 的「不依赖人工抢救」冲突。

## 验收

- 一条明确裁定：A1 / A2 / B / C（若选 C，裁定里同时写明 C 之后默认走哪条）。
- 若选 A1 / A2：施工另立票；施工验收必须包含**非 PNG 回应的离线 fixture**、
  错误报文点明 `mimeType`、以及全量测试全绿；**零付费**。
- 若选 B：另出真跑预算报告 + 逐字点头。
- 若选 C：单张诊断也须另出报告 + 逐字点头（票面只给上限，不授权调用）。

## 边界

- 不批准付费调用；不改 `game-maker.local.json`；不自动回退 / 自动重试 / 自动修复。
- 不改「母版 / 动画 / 网格」的既有判据；本票只解决**回应格式**。

## Answer

**裁定（人裁 2026-10-19 逐字）**：「裁定：A2 · 改 Interactions API，显式要求 image/png。」

### 选择

**A2**：Gemini 生图适配器改用 **Interactions API**，在 `response_format` 里显式要求
`mime_type: "image/png"`。不走 A1（JPEG 解码 + 依赖），不走 B（回退 2.5），不走 D（sips 抢救）。

### 依据（免费查证）

- legacy `generateContent` 的 `ImageConfig`（v1beta discovery）只有 `aspectRatio` 与 `imageSize`，
  **没有输出 MIME 入口** ⇒ 无法在旧路径上要求 PNG。
- Interactions API 的 REST 形状（官方 image-generation 文档）：

```http
POST https://generativelanguage.googleapis.com/v1beta/interactions
x-goog-api-key: <key>
content-type: application/json

{
  "model": "gemini-3.1-flash-lite-image",
  "input": [
    { "type": "text", "text": "<prompt>" },
    { "type": "image", "mime_type": "image/png", "data": "<base64>" }
  ],
  "response_format": {
    "type": "image",
    "mime_type": "image/png",
    "aspect_ratio": "3:4",
    "image_size": "1K"
  }
}
```

- 回应是 Interaction 资源，图在 `steps[]` 的 `model_output` 内容块里
  （`content_block.type === "image"`，`data` 为 base64）；SDK 的 `output_image` 只是便利属性，
  **原始 REST 要按 `steps` 解析**（并保留对 `output_image` 的兼容读取）。
- `geminiAspect()` 现有的 9 个比例都在 Interactions 支持列表内；3.1 Flash Lite 只支持 **1K**。
- 参考图（风格图 / 母版）按 `input[]` 的 `type:"image"` 内联，顺序保持「先风格图、后母版」。

### 交给施工票

- 施工另立[票 13](13-interactions-api-image.md)；本票只裁路线，**不批准施工、不批准任何付费跑**。
- 施工验收必须包含：请求体 fixture（PNG / aspect / model）、回应 `steps[]` 解析 fixture、
  `output_image` 兼容、无图 / 错误 / HTTP 失败的错误报文、全量测试全绿、**零上游**。

### 后续（2026-10-19）· A2 的前提被实测推翻

- smoke 实测：`gemini-3.1-flash-lite-image` 的 Interactions API **只接受 `image/jpeg`**，
  拒绝 `image/png`（HTTP 400 invalid_request）。
- 票 12 的 A2「显式要 PNG」在 3.1 Lite 上**不成立**；新的路线裁在[票 14](14-lite-only-jpeg-model-choice.md)。
- 票 13 的适配器本身仍成立（PNG 模型可用；非 PNG 会明确失败）。
