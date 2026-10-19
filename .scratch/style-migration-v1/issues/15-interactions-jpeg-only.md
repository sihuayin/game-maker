# 15. Interactions 输出只有 JPEG：加 JPEG 解码 / 回退 2.5 / 探针转码

Type: grilling
Status: resolved
Owner: claude (2026-10-19 认领 · 人裁 B · 已施工、已关)
Blocked by: —
Map: ../map.md
> 派生自票 10 的两次 smoke 失败（2026-10-19）：
> [lite 失败](../report-10-smoke-failure-2026-10-19.md) · [M1 失败](../report-10-smoke-m1-failure-2026-10-19.md)。
> ⚠️ 本票只裁路线，不批准任何付费跑、不批准施工。

## Question

`gemini-3.1-flash-lite-image` 与 `gemini-nano-banana-2.1` 的 Interactions API 都只接受
`response_format.mime_type: "image/jpeg"`，拒绝 `image/png`（HTTP 400，实测两次）。
文档里的 `image/png` 示例与实际行为不一致。

要裁：

- **J2**：`gemini-nano-banana-2.1` + 请求 JPEG + 加纯 JS JPEG 解码器（`jpeg-js` / `@types/jpeg-js`）；
  零付费施工 + 离线 fixture；修好后 1 发 smoke 评估伪影。
- **J1**：`gemini-3.1-flash-lite-image` + JPEG 解码；输入更便宜，质量定位更低。
- **B**：恢复 `gemini-2.5-flash-image` 的 legacy `generateContent`（PNG，C/C2 已验证）；
  $0.039 / 张；2.5 已标注停服。
- **P**：试 `gemini-3-pro-image` 要 PNG（1 发 smoke；更贵；很可能同样只支持 JPEG）。
- **D**：runner 层 `sips` 转码 —— 只算探针，不作为生产链。

## 验收

- 一条明确裁定。
- 若选 J1 / J2：施工另立票；验收含 JPEG 解码 fixture、非 PNG/非 JPEG 的明确失败、全量测试、零付费；
  修好后先 1 发 smoke，再决定是否发满 21 张。
- 若选 B：恢复 legacy 分支的施工另立票；真跑另出预算报告 + 逐字点头。
- 若选 P：1 发 smoke 也须逐字授权。

## 边界

- 不批准付费调用；不改 `game-maker.local.json`；不自动换模型 / 回退 / 转码。
- 不改母版 / 网格 / 风格判据；本票只解决输出格式。

## Answer

**人裁（2026-10-19 逐字）**：「裁 B：恢复 2.5 legacy PNG，先零付费恢复分支 + 1 发 smoke。」

### 裁定

**B**：恢复 `gemini-2.5-flash-image` 的 **legacy `generateContent`** 分支（PNG 路径）；
3.x / nano-banana 仍走 Interactions（它们只回 JPEG）。

### 施工记录（零付费）

- `packages/assets/src/image-gen.ts`：
  - `GeminiOptions.api?: "auto" | "generateContent" | "interactions"`；
  - `"auto"`（默认）：`gemini-2.5-*` ⇒ legacy `generateContent`；其余 ⇒ Interactions；
  - 恢复 `imageFromGenerateContent()`（`candidates[].content.parts[].inlineData`），
    非 PNG 明确失败；
  - 两条路共用 attempts / 重试 / 记账；请求体分别为 legacy `contents+generationConfig`
    与 Interactions `model+input+response_format`。
- 测试：`image-gen.test.ts` 新增 legacy 段（端点 / 请求体 / 参考图 / 非 PNG / auto 选路），
  Interactions 段强制 `api:"interactions"`；CLI / MCP / pipeline 假上游同时支持两种回应形状。

### 五闸

| 闸 | 结果 |
| --- | --- |
| 全量测试 | ✅ **102 文件 / 1624 条**（+4） |
| `pnpm build` | ✅ |
| `pnpm typecheck` | ⚠️ 仅剩两条既有、与本票无关的红（`pack-sheet-grid.test.ts:150` · `prompt.test.ts:257`） |
| `check:deps` | ✅ 9 包 |
| `check:links` | ✅ 400 份文档 / 2127 条 |

### 边界

- 零上游、零付费；`game-maker.local.json` 未动；没改母版 / 网格 / 风格判据。
- 下一步：按已授权预算发 **1 发 legacy smoke**（`gemini-2.5-flash-image`，1 张 / ≤4 发 / 15 分钟）；
  确认 PNG 后再回完整 21 张预算。
