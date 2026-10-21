# 13. 替代动画模型候选：零付费官方资料研究

Type: research
Status: resolved
Owner: research subagent (2026-10-21 认领)
Blocked by: —
Map: ../map.md
> 派生自 [12](12-alternative-animation-model.md) 的 Q7 裁定（2026-10-21）：先做零付费官方资料研究，
> 再对至多 2 个候选做付费筛查。
> ⚠️ **零付费**：只查官方文档 / discovery / 定价页；不发任何生图 / 文本请求；不改源码 / 配置 / fixtures。

## Question

核实替代动画模型的候选资格，产出候选资格表与至多 2 个候选的短名单。

候选至少：

- `gemini-3-pro-image`（Gemini API Interactions）；
- Vertex Gemini 3.x 图像模型；
- OpenAI `gpt-image-2.5`（及其他相关变体）；
- 其他满足资格线、值得纳入的模型（可补充，但需给出来源）。

每个候选要核实：

- 可用性与接入路径（现有 key + 7890 代理，或明确的新路径；是否需要 OAuth / ADC / GCP 项目）；
- 是否受「仅历史用户」限制；停服 / 弃用日期（决策后 6 个月内无停服日 = **2027-04-21 前不停**）；
- 输出格式（Interactions 是否仍只有 JPEG；Vertex 的 `imageOutputOptions.mimeType` 是否对 Gemini 3.x
  兑现 PNG；OpenAI 的 PNG / JPEG / WebP 与透明背景）；
- 官方定价（输入 / 输出；1K 单张；batch 价；质量档位）；
- 是否官方文档明确支持**两张参考图**（风格图 + 母版）与跨帧角色一致性；
- 已知的跨帧一致性风险 / 官方限制；
- 来源 URL 与访问日期（2026-10-21）。

## 交付

- `research/alternative-animation-models-2026-10-21.md`：候选资格表 + 短名单（≤2）+ 依据 + 来源。
- 资格表至少列：候选 / 接口 / 输出格式 / 双参考图 / 定价 / 接入 / 停服日 / 一致性风险 /
  结论（合格 / 备选 / 淘汰）。
- 短名单只按 [12](12-alternative-animation-model.md) 的资格线筛；**不选胜者、不预授权付费筛查**。
- 0 次付费调用；不改源码 / 配置 / fixtures。

## 边界

- 只用官方文档 / discovery / 定价页；不做生成调用；不换 provider。
- 付费筛查另立票、另出预算报告 + 逐字点头。

## Answer（2026-10-21 · research subagent）

**报告：** [research/alternative-animation-models-2026-10-21.md](../research/alternative-animation-models-2026-10-21.md)

**0 次付费调用。** 未调用任何生图 / 文本生成端点；只读官方文档、定价页、API discovery、官方模型页与 SDK 文档；未改源码 / 配置 / fixtures / `map.md`，未切分支。

### 资格表摘要

| 候选 | 结论 | 关键依据 |
| --- | --- | --- |
| `gemini-3-pro-image` · Gemini API Interactions | **合格（附 JPEG 解码条件）** | 现有 Gemini key + 7890；无停服日；官方明确 6 物体 + 5 角色 + **3 风格参考**；Interactions 仍 JPEG-only |
| OpenAI `gpt-image-2.5-sunburst` / `flare` | **合格** | 默认 PNG、可 JPEG/WebP、可透明；`image[]` 多参考图（示例 4 张）；无已知停服日；官方承认 recurring character 跨多次生成可能不稳定 |
| Vertex Gemini 3.x（3 Pro / 3.1 Flash / 2.1） | **备选（不进短名单）** | 需 GCP + OAuth/ADC；**PNG 交付未验证**（现行 `response_format.image.mimeType` 仅 JPEG；PNG 示例只配 2.5）；3 Pro / 3.1 Flash retirement **2027-05-28 or later**，仅比资格线多 37 天 |
| `gemini-nano-banana-2.1` | **备选（成本后备）** | 无停服、现有 key、$0.0336/1K；但官方参考图表 **style references = N/A**，只有 10 物体 + 4 角色；JPEG-only |
| `gemini-3.1-flash-image` | **淘汰** | 2026-10-06 官方 deprecated；上一代；style N/A |
| `gemini-3.1-flash-lite-image` | **淘汰** | character / style 参考均 N/A；官方明确不为多参考输入优化 |
| `gemini-2.5-flash-image` | **淘汰** | shutdown **2027-03-15**（早于 2027-04-21）；2.5 系列自 2026-09-18 限制历史用户 |
| Imagen 4（Gemini API） | **淘汰** | 2026-08-17 已 shutdown |
| BFL FLUX.2 [pro]/[max] | **不纳入** | 多参考与官方定价页存在，但输出 MIME / 停服承诺未在本次官方页核实，不满足“明确可查” |

### 短名单（≤2，不排序、不选胜者）

1. **`gemini-3-pro-image` · Gemini API Interactions** —— 现有 key + 7890；无停服日；官方明确“风格参考 + 角色参考”。条件：先做零付费 JPEG 解码施工；跨帧几何稳定性必须付费 smoke 验证。
2. **OpenAI `gpt-image-2.5-sunburst` 或 `gpt-image-2.5-flare`** —— PNG 默认、可直接接入当前 PNG 管线；官方多参考图（`image[]`）。条件：新 provider key + 可能需 organization verification；官方一致性 caveat 需同动画多帧验证。

**格式口径提醒：** 若把“输出格式兼容获准的资源处理路径”严格读成“当前 PNG-only 代码不改即可处理”，则 Gemini 3 Pro 应降为备选，短名单只剩 OpenAI 2.5。报告按“允许零付费 JPEG 解码施工”的条件口径给出 2 个，但不替人裁定。

### 成本量级（官方价格；详见报告 §4）

- 1K 单张：3 Pro **$0.134**；2.1 **$0.0336**；3.1 Flash **$0.067**；OpenAI 2.5 low **$0.00588** / medium **$0.01317** / high **$0.05268** / xhigh **$0.09366** / max **$0.21072**。
- 6 帧资格场景（3 拾荒者 idle + 3 敌人 patrol，每帧 2 张参考图）：
  - 3 Pro：**≈ $0.83 base**；+50% 重试 **≈ $1.24**，低于 $2.00 资格上限。
  - OpenAI 2.5：medium **≈ $0.23–$0.53**；high **≈ $0.46–$0.76**（含未验证的参考图输入估算）；max + 50% 重试可能超过 $2.00。
- 以上均为【估算】，不是报价，也不构成预算授权。

### 关键未验证

- **Vertex 的 `imageOutputOptions.mimeType` 对 Gemini 3.x 是否兑现 PNG**：官方无一手确认；现行 `response_format.image.mimeType` 为 JPEG-only；PNG 示例只配 `gemini-2.5-flash-image`。
- 所有候选的跨帧 bbox / alpha / 位置稳定性：无官方承诺，必须付费 smoke。
- OpenAI 2.5 的参考图输入 token 规则：官方未给静态每图数字。
- Interactions 在 `mime_type` 留空时的默认格式：官方未写。

**边界：** 本票不选胜者、不排序、不预授权任何付费筛查；任何 smoke / 跑批须另票、另出书面预算报告并逐字批准。


### 2026-10-21 补注（08 已落地）

- [08](08-jpeg-decoder.md) 已把 Interactions 请求改为 `image/jpeg` 并实现 `decodeJPEG` / MIME 分派。
- 报告中「当前 PNG-only 管线需先做零付费 JPEG 解码施工」的条件**已满足**；Gemini 3 Pro 的格式条件
  不再需要新施工。两个短名单候选在当前代码下都可直接进入付费筛查。
- 其余资格事实不变；本票仍不授权任何付费筛查。
