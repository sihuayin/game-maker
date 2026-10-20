# 05. 2.5 停服后的模型路线

Type: research
Status: resolved
Owner: claude (2026-10-20 认领 · research · 已交报告、已关)
Blocked by: —
Map: ../map.md
> 派生自最终包的模型选择：`gemini-2.5-flash-image` 官方已标注停服（今天仍可用）。

## Question

调研并给出未来跑批的路线：

- Interactions API + JPEG 解码（`jpeg-js` / `@types/jpeg-js`）；
- 换 3.1-flash-image / 3-pro-image / 其他 provider；
- 或冻结 2.5 产物、只做本地复用 / 后处理。
- 需要覆盖：成本、质量（1px 描边 / 像素风）、施工量、停服时间风险。
- 只用文档 / API discovery / 本地资料；**不发付费调用**。

## 验收

- 一份 research 报告（或 `## Answer`），给出推荐路线与理由。
- 若需要施工 / 付费验证，另立票。

## 边界

- 零付费；不改源码；不换 provider。

## Answer（2026-10-20 · research 完成）

**推荐路线**：现在**冻结 2.5 产物**；战略路线走 **A：Interactions API + JPEG 解码，模型 `gemini-nano-banana-2.1`**；
2.5 legacy PNG 只保留为「已逐字批准的小补丁」的临时旁路。
完整报告（来源 / 离线模拟 / 施工面）：[`../research/model-route-2026-10-20.md`](../research/model-route-2026-10-20.md)。

### 决定路线的那几条硬事实

- **Interactions 的输出 MIME 枚举只有 JPEG**：v1 / v1alpha / v1beta discovery（revision `20261019`）里
  `ImageResponseFormat.mimeType` = `MIME_TYPE_UNSPECIFIED | IMAGE_JPEG`。端点级限制，**换模型不解决格式** ——
  `gemini-3.1-flash-image` / `3-pro-image` 走 Interactions 仍是 JPEG。官方示例 PNG / JPEG 自相矛盾；
  本仓两次 400 原文只允许 `image/jpeg`。
- **2.5 的停服日期三份官方口径互相打架**：Deprecations 表 `2027-03-15`；Pricing 页 `2026-10-02`
  （已过期却仍在服务）；Changelog 2026-09-18 说「未弃用、另行通知」。⇒ 今天可用，但必须按
  「随时可能没」处理，不能把新功能建立在新 2.5 跑批上。
- **模型选择**：`gemini-3.1-flash-image` 已于 2026-10-06 被 2.1 取代并标记 deprecated；
  `gemini-3.1-flash-lite-image` 官方明说**不为多参考图优化**（本管线每帧两张参考图）；
  `3-pro-image` 约 4× 成本且像素风收益未经证实。2.1 无停服日期，是 3.1-flash 的官方替换。
- **成本（66 次量级）**：2.1 ≈ **$2.4–2.5**；2.5 ≈ $2.6；3.1-flash ≈ $4.5；3-pro ≈ $9.2；冻结 = $0。
- **JPEG 离线模拟**（真实 2.5 raw + 真实 `importFrames`）：固定裁框下压缩温和（alpha 差 0–0.2%，
  q90 平均 L1 2–4）；**真正的风险是逐帧裁框抖动** —— q90 下 1K ink bbox 漂移 1–8 px，
  24×24 道具 alpha 变化 6.4%。⇒ 付费 smoke 必须覆盖**同一动画至少 2 帧**。
- **施工量（零付费）**：`jpeg-js@0.4.4` + `@types/jpeg-js@0.3.7`、`packages/assets/src/jpeg.ts`、
  `image-gen.ts` 按 MIME 分派 + 请求改 JPEG、测试；约 **0.5–1.5 人日**。顺序必须是
  **先解码器、后改请求**，否则会拿到 200 计费后在本地丢图。

### 没有选的路

- **换 3.1-flash / 3-pro 要 PNG**：Interactions 端点级 JPEG-only，换模型不解决格式。
- **Vertex + `imageOutputOptions.mimeType`**：字段存在，但 Gemini 3.x 是否兑现 PNG 未文档化；
  施工 2–5 人日 + GCP 运维，条件备选。
- **OpenAI `gpt-image-2.5`**：默认 PNG 是优势，但官方承认跨图角色一致性会波动，正是本管线的核心诉求；
  本仓未验证。
- **DashScope**：参考图要公网 URL、渐变洋红抠底不可靠，不满足「内联风格图 + 母版」的前提。

### 人裁点（本票不预授权）

1. 是否接受 **JPEG 作为未来上游格式**（不切 Vertex / 不换 provider 时，这是唯一可走的路）。
2. 长期默认是否定为 **`gemini-nano-banana-2.1`**（而非更便宜的 3.1-lite / 更贵的 3-pro）。
3. 是否批准**零付费施工票**（JPEG 解码 + Interactions JPEG 请求 + 测试）。
4. 是否批准**同动画 2 帧 smoke**（≤4 发 / ≤$0.16 / ≤15 分钟），须逐字点头。
5. 2.5 的**内部截止日**（报告建议 2026-12-31，给官方 2027-03-15 留缓冲）。
6. 若 smoke 看到帧间抖动，是否追加**动画级共享裁框**（`ImportOptions.trimBox` 已有，`pack.ts` 未暴露）。
7. fixture 重基线：**替换**现有 16 张 2.5 fixture，还是新增一套 2.1 fixture（报告建议替换）。

⇒ 以上已立为 [07. 模型路线定稿](07-model-route-ratification.md)。施工 / 付费验证按 07 的裁定
另立票；本图 Destination 只要求「路线有结论」，落地施工不预授权。

### 边界

- **零付费**：未发生图 / 文本调用；只做了官方 discovery 文档、带现有 key 的 `models.list` 元数据
  （不计费）与本地离线 JPEG 模拟（`/tmp/jpegsim/`）。
- 未改源码、未改 `game-maker.local.json`、未换 provider。
