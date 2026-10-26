# 07. 切换文本上游到 Gemini（直连，不走 cc-switch）

Type: task
Status: resolved
Owner: main session · 2026-10-25
Blocked by: 06
Map: ../map.md

## Question

按票 06 裁定的后续（2026-10-25 用户改）：**不走 cc-switch**，把文本上游从 `deepseek-v4-pro` 直连切到
**Gemini（gemini-3.1-flash）**，key 复用 `game-maker.local.json` `image` 段的 gemini key。做法 = 改仓库代码：
给文本上游加 native gemini 协议（镜像生图 gemini 客户端）+ 新增 `game-maker.local.json` `text` 段 +
模型名接成可配。改完零付费验证 `emit_asset_recipe` 稳定产出有效 recipe，再进入票 05 的付费 E2E 授权流程。

边界：零付费；本票**允许改 repo 代码**（覆盖票 06 边界 #2）；不改重试策略语义（`EMPTY_INPUT_ATTEMPTS` 等不动）；
不动 `image` 段与生图路径。

## 进度（2026-10-25 · 代码已落，真 gemini 验证待授权）

**代码已落，零付费验证已过**（全仓 1973/1973 · typecheck 绿 · check:deps 绿）：

- `packages/contracts/src/gemini-call.ts`（新）：gemini 形状层 —— `geminiToolSpec` / `parseGeminiFunctionCall` /
  `geminiUsageOf` + 统一入口 `buildTextRequest` / `parseTextResponse` / `textUsageOf` / `buildPlainTextRequest` /
  `parsePlainText` + `TextTransport`（protocol/model/proxy）+ `textModelOf`/`textProtocolOf`。+9 单测。
- `packages/assets/src/text-config.ts`（新）：`resolveTextTransport` 读 `game-maker.local.json` 的 `text` 段
  （`ANTHROPIC_*` env 优先、文件回落 —— 与 image-config 同纪律）。
- `game-maker.local.json` 加 `text` 段（protocol gemini · model gemini-3.1-flash · key/proxy 复用 image）；example 同步。
- 6 处调用点按协议分支：`analyze-intent` / `compile-design` / `compile-character-dna`（game-design）；
  `ops.ts` 的 `onceThroughTool`（plan-assets + compile-runtime）+ `callText`（derive/td-game）；`generate.ts`（drawlist）。
- CLI / MCP：`resolveTextTransport` + 代理 fetch（`createProxyFetch`，gemini 直连 Google 境内要它）。
- +2 端到端单测（analyze-intent 走 gemini：`:generateContent` + `x-goog-api-key` + `functionCall` 解析 + `MAX_TOKENS`→truncated）。

**待授权（付费，Q4 零付费默认）**：真 gemini 调用验证 `emit_asset_recipe` 大 schema 是否**稳定**产出有效 recipe。
这一步只有真 gemini 调用能证（假上游只证了「形状对」），需单独书面预算 + 逐字授权，**不自动执行**。

**操作前置**：env 优先，所以切换前需 `unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN`（否则旧的 cc-switch env 会盖掉文件里的 gemini）。

## 探针结果（2026-10-25 · 真 gemini 单跑 · ✅ 成功）

- **`create`（不带 `--yes`）Stage A exit 0**，停在清单检查点；`runDir = wasteland-scavenger-recipe/run/v1`。
- **5 步全过、全 0 重试**（`attempts=1`）：analyze-reference → analyze-intent → compile-design → character-dna → plan-assets。
  服务模型报的是 `gemini-3.6-flash`（`gemini-3.5-flash` 的别名/服务侧版本）。
- **plan-assets（`emit_asset_recipe` 大 schema）一发过契约**（in 7641 / out 1433 token）—— 正是 deepseek 卡 1/8 的地方。
- 文本 token 合计 ≈ in 19.4k / out 5.0k / reasoning 12.8k；生图 0（Stage A 停在清单处）。
- 清单：9 资源（animation×2 · sprite×4 · background×1 · ui×2），下一段 **imageCalls=13**。
- **途中修的 gemini schema 兼容性**（probe 逐字抓的 400）：`const`→`enum`、剥 `additionalProperties`/`propertyNames`、
  `exclusiveMinimum/Maximum`→`minimum/Maximum`（`geminiParameters` 落 `gemini-call.ts`）。模型名 `gemini-3.1-flash` 不存在 → 改用 `gemini-3.5-flash`。

**结论**：gemini 对 `emit_asset_recipe` 大 schema 一次跑通、0 重试 —— 相比 deepseek 约 1/8 成功率是**质的改善**。
单跑是 1 个样本，若要更高置信度可再跑几发（预算 ≤25 请求，本次用了 5）。

**下一步 = 票 05（付费 E2E · Stage B 生图）**，单独书面授权，不在本票。

## Answer（收口 · 2026-10-25）

文本上游直连 Gemini 的代码 + 真 gemini 探针都完成：`create` Stage A exit 0、5 步全 0 重试、
`emit_asset_recipe` 大 schema 一发过契约。**本票收口** —— 文本上游切换已验证；E2E 的下一段（生图/配置/站点）
归票 05（已跑 Stage B，卡在背景层覆盖，另立票 08）。
