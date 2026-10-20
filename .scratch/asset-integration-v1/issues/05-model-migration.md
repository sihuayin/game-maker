# 05. 2.5 停服后的模型路线

Type: research
Status: open
Owner: —
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
