# 14. 3.1 Lite 只支持 JPEG：换 PNG 模型 / 加 JPEG 解码

Type: grilling
Status: resolved
Owner: claude (2026-10-19 认领 · 人裁 M1 · 已裁定)
Blocked by: —
Map: ../map.md
> 派生自[票 10 的 smoke 失败](../report-10-smoke-failure-2026-10-19.md)（2026-10-19）。
> ⚠️ 本票只裁路线，不批准任何付费跑、不批准施工。

## Question

`gemini-3.1-flash-lite-image` 的 Interactions API **只接受** `response_format.mime_type: "image/jpeg"`，
拒绝 `image/png`（HTTP 400 invalid_request）。票 12 的 A2 前提在这台模型上不成立。

要裁：

- **M1**：换 `gemini-nano-banana-2.1`（文档示例支持 PNG；$0.0336/1K 图；输入 $1.50/1M；零源码改动）。
- **M2**：换 `gemini-3.1-flash-image`（文档示例支持 PNG；$0.067/1K 图；输入 $0.50/1M；零源码改动）。
- **J（A1）**：保留 3.1 Lite，请求 JPEG，加纯 JS JPEG 解码器（需依赖；JPEG 伪影可能伤描边）。
- **B**：回退 `gemini-2.5-flash-image`（legacy 路径回 PNG；2.5 已标注停服）。
- **D**：runner 层 `sips` 转码 —— 只可能是探针，不作为生产链。

## 验收

- 一条明确裁定；若选 M1/M2，须再用 smoke 预算（1 张 / ≤4 发 / 15 分钟）确认 PNG，再回完整 21 张。
- 若选 J：施工另立票；离线 fixture；全量测试；零付费；修好后另出 smoke / 真跑报告。
- 若选 B：另出预算报告 + 逐字点头。

## 边界

- 不批准付费调用；不改 `game-maker.local.json`；不自动换模型 / 不自动回退 / 不自动转码。
- 不改母版 / 网格 / 风格判据；本票只解决模型输出格式。

## Answer

**人裁（2026-10-19 逐字）**：「换 gemini-nano-banana-2.1，先按 smoke 预算 1 张 / ≤4 发 / 15 分钟确认 PNG。」

### 裁定

**M1**：把 smoke / 真跑的模型换成 **`gemini-nano-banana-2.1`**。

- 依据：官方 Interactions 文档的 `response_format` 示例明确用 `mime_type: "image/png"`；
  models 列表今天列出该模型；图像单价与 3.1 Lite 相同（$30 / 1M image tokens ≈ $0.0336 / 1K），
  输入单价 $1.50 / 1M（本跑量级很小）。
- 零源码改动：只改 runner 的模型名（脚本，不是 `packages/` 源码）。
- 先发 **1 发 smoke**（1 张 / ≤4 发 / 15 分钟）确认 PNG；确认后再回完整 21 张预算。
- 若 smoke 仍拒绝 PNG ⇒ 停，再在 M2（3.1-flash-image）/ J（JPEG 解码）里选。
- 不自动换模型、不自动回退、不自动转码。

### 后续（2026-10-19）· M1 也被实测否定

- 按本票裁定换了 `gemini-nano-banana-2.1` 发 1 发 smoke：
  **同样**只接受 `image/jpeg`，拒绝 `image/png`（HTTP 400）。
- 失败报告：[`../report-10-smoke-m1-failure-2026-10-19.md`](../report-10-smoke-m1-failure-2026-10-19.md)
- 新的路线裁在[票 15](15-interactions-jpeg-only.md)。
