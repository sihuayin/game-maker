# 13. Interactions API 生图适配（A2 施工）

Type: task
Status: resolved
Owner: claude (2026-10-19 认领 · 人裁「施工 票 13」· 已施工、已关)
Blocked by: —
Map: ../map.md
> 派生自[票 12](12-gemini-non-png-output.md) 的裁定 A2（2026-10-19）。
> ⚠️ **立票 ≠ 批准施工**；本票零付费，但施工须另行点头。

## Question

把 Gemini 生图适配器从 legacy `generateContent` 改成 **Interactions API**，
在请求里显式要求 `response_format: { type: "image", mime_type: "image/png" }`，
并按 Interaction 的 `steps[]` 解析回图。目标：`gemini-3.1-flash-lite-image` 不再回非 PNG。

## 施工要点

- **端点**：`POST {baseUrl}/interactions`，`x-goog-api-key`。
- **请求体**：
  - `model` = 当前 transport 的 model；
  - `input` = 文本 + 参考图（`type:"image"`, `mime_type:"image/png"`, `data` base64；
    顺序先风格图、后母版）；
  - `response_format` = `{ type:"image", mime_type:"image/png", aspect_ratio: geminiAspect(size), image_size:"1K" }`。
- **回应**：从 `steps[]` 里找 `type === "model_output"` 的 `content[]`，
  取 `type === "image"` 的块（`data` base64）；兼容顶层 `output_image`。
  **不要再假设** `candidates[].content.parts[].inlineData`。
- **错误**：上游 `error`、没有图、非 PNG、HTTP 失败都要有明确报文（点名 `mime_type` / `steps`）。
- **重试**：保留现有 attempts 语义（默认 4）；只对 5xx / 429 / 网络 / 无图重试，不隐藏重试。
- **兼容**：旧 `generateContent` 路径是否保留，由施工时的测试面决定；至少现有 2.5 fixture / 桩跑不能静默坏掉。

## 验收

1. 请求体 fixture：断言 URL、`response_format.mime_type === "image/png"`、`aspect_ratio`、`image_size`、参考图顺序。
2. 回应 fixture：`steps[]` 里取到 PNG；`output_image` 兼容路径各一条。
3. 失败 fixture：HTTP 4xx/5xx、上游 error、无图、非 PNG；报文可归因。
4. 全量测试全绿；**零上游、零付费**。
5. 不在本票里跑真实生图；修好后另出真跑报告 + 逐字点头。

## 边界

- 不改 `game-maker.local.json`；不扩玩法；不改母版 / 网格判据。
- 不跑付费上游；不自动回退 2.5；不自动重生成。

## Answer

**一句话**：Gemini 生图适配器已改到 **Interactions API**，请求显式要 `image/png`，回应按
`steps[].model_output.content[]` 解析；全量 **102 文件 / 1620 条全绿**，零上游、零付费。

### 施工记录

- **源码**：`packages/assets/src/image-gen.ts`
  - `createGeminiGenerator`：端点 `POST {baseUrl}/interactions`；请求体
    `{ model, input:[{type:"text",…},{type:"image",mime_type:"image/png",…}], response_format:{type:"image",mime_type:"image/png",aspect_ratio,image_size:"1K"} }`；
  - `imageFromInteraction`：从 `steps[].type==="model_output"` 的 `content[]` / `parts[]` 取图；
    兼容顶层 `output_image` / `outputImage` 与 snake_case / camelCase；
    `mime_type` 存在且不是 `image/png` ⇒ **明确失败**，不静默解码；
    没有图 ⇒ 报文带 `steps` 摘要；
  - 重试判据加入 `no image` / `没有图`；`NO_IMAGE` / 5xx / 429 / 网络仍重试；4xx / 非 PNG 不重试。
  - `geminiAspect()` 与支持比例列表**未改**（9 个比例都在 Interactions 支持范围内）。
- **测试**：`packages/assets/tests/image-gen.test.ts` 重写 Gemini 段（请求体 / 参考图顺序 /
  negativePrompt / `output_image` 兼容 / 无 mime / 非 PNG / 形状错 / 4xx vs 5xx / upstream error）；
  `packages/cli/tests/cli-create.test.ts`、`packages/mcp/tests/create-game-no-digest.test.ts`、
  `packages/pipeline/tests/upstream.ts` 的假上游同步改成 Interactions 回应。
- **附带修**：票 09 的一条相对链接 `../../assets/crop-table.md` → `../assets/crop-table.md`
  （与本票无关的既有断链；修它是为了让 `check:links` 回绿）。

### 五闸

| 闸 | 结果 |
| --- | --- |
| 全量测试 | ✅ **102 文件 / 1620 条**（+4） |
| `pnpm build` | ✅ |
| `pnpm typecheck` | ⚠️ 仍是那两条**既有、与本票无关**的红：`pack-sheet-grid.test.ts:150`（假生成器缺 `requestedSize`）· `prompt.test.ts:257`（`CharacterDNA` 未导入）。本票没有新增类型错。 |
| `check:deps` | ✅ 9 包 |
| `check:links` | ✅ 394 份文档 / 2115 条（修了票 09 的断链） |

### 边界

- 零上游、零付费；`game-maker.local.json` 一字未动；没改母版 / 网格判据。
- **没有**验证真实 Interactions 请求（那需要付费调用）—— 下一次真跑才是第一次实测。
- 票 10 现已解除对票 13 的阻塞；但真跑仍需**重新出预算报告 + 逐字点头**。
