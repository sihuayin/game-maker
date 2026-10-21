# 替代动画模型候选：零付费官方资料研究（2026-10-21）

- 票：[13. 替代动画模型候选：零付费官方资料研究](../issues/13-alternative-animation-models-research.md)
- 上游标准：[12. 替代动画模型](../issues/12-alternative-animation-model.md) 的 Answer（动画验收标准、候选资格线、Q7 裁定）
- 日期：2026-10-21
- 边界：**0 次付费调用**；只读官方文档 / 定价页 / discovery / 模型页；未改源码、配置、fixtures、`map.md`；未切换分支。
- 记号：**【文档】** = 官方文档 / 定价页原文；**【schema】** = 官方 API discovery / SDK 字段定义；**【仓库】** = 本仓库已记录的零付费/历史事实；**【估算】** = 由官方价格推导、非官方逐项报价；**【未验证】** = 官方一手资料没有给出可确认说法，本文不猜测。

> 本报告只做资格筛选与成本量级估算。**不选胜者、不排序、不预授权任何付费筛查。**
> 短名单只是“最多 2 个可进入下一轮付费筛查的候选”；是否筛查、预算多少，须另票、另出书面预算报告并逐字点头。

> **2026-10-21 补注（08 已落地，晚于本报告成稿）**：本报告把「当前 PNG-only 管线」当作前提；
> [08](../issues/08-jpeg-decoder.md) 已在同一天落地 `decodeJPEG` + Interactions `image/jpeg` 请求。
> 因此 Gemini 3 Pro 的「JPEG 解码施工」条件**已满足**，不需要新施工；短名单两个候选在当前代码下
> 都可直接进入付费筛查。报告 §0/§1/§5 中「先做零付费 JPEG 解码施工」的条件按此补注作废；其余事实不变。

---

## 0. 一句话结论

**短名单（≤2，无序）：**

1. **`gemini-3-pro-image`，Gemini API Interactions** —— 现有 Gemini key + 7890 代理即可接入；官方明确支持“风格参考 + 角色参考”两类参考图；无停服日；代价是 Interactions 仍 **JPEG-only**；08 已落地 JPEG 解码，格式条件已满足（2026-10-21 补注）。
2. **OpenAI `gpt-image-2.5-sunburst` / `gpt-image-2.5-flare`** —— 默认 **PNG**，可 JPEG / WebP、可透明背景；官方明确支持多张参考图（`image[]`，示例 4 张）；无已知停服日；代价是新 provider key + 可能需要 organization verification，且官方自己承认“ recurring characters 跨多次生成可能不稳定”。

**没有进入短名单但值得记录的：**

- **Vertex Gemini 3.x（3 Pro / 3.1 Flash / Nano Banana 2.1）**：不是“PNG 入口”已被证实；Vertex 现行 `response_format.image.mimeType` 枚举仍只有 JPEG；旧 `imageConfig.imageOutputOptions.mimeType` 是自由字符串、官方 PNG 示例只配 `gemini-2.5-flash-image`，**Gemini 3.x 是否兑现 PNG 未验证**。接入需 GCP 项目 + OAuth/ADC；3 Pro / 3.1 Flash 模型页还写着 retirement **2027-05-28 或更晚**（比资格线只多 37 天）。因此列为“备选/条件候选”，不进短名单。
- **Gemini Nano Banana 2.1**：便宜、无停服、现有 key 可接入；官方支持最多 14 张参考图（10 物体 + 4 角色），但参考图能力表把 **style references 标为 N/A（仅 3 Pro 有最多 3 张风格参考）**。对本管线的“风格图 + 母版”语义只能算“通用多参考图”，不是明确风格参考槽；作为 3 Pro 的成本后备，不占短名单。
- **Gemini 3.1 Flash Image**：已于 2026-10-06 被官方标为 deprecated（无停服日期），官方建议迁到 2.1；淘汰。
- **Gemini 3.1 Flash Lite Image**：官方表明确写 character / style 参考为 N/A，且“不为多参考输入优化”；淘汰。
- **Gemini 2.5 Flash Image**：Deprecations 表 shutdown **2027-03-15**（早于 2027-04-21），且 2.5 系列自 2026-09-18 起限制为历史用户；淘汰。
- **Imagen 4（Gemini API）**：2026-08-17 已 shutdown；淘汰。
- **Black Forest Labs FLUX.2 [pro]/[max]**：官方文档支持最多 8 张 API 参考图并有身份一致性宣传、官方定价页存在；但本次能读到的官方页没有明确输出 MIME，也没有停服/弃用承诺。**不满足“明确可查”的资格线，不纳入。**

**关键事实变更（相对 2026-10-20 的 [模型路线研究](model-route-2026-10-20.md)）：**

1. Vertex 不再是“已验证的 PNG 入口”。现行 Vertex `response_format.image.mimeType` schema 为 JPEG-only；PNG 只出现在 deprecated `imageConfig.imageOutputOptions` 的自由字符串示例里，而且示例模型是 2.5。**Vertex Gemini 3.x 的 PNG 交付仍未验证。**
2. Vertex Gemini 3 Pro Image / 3.1 Flash Image 模型页出现 **Retirement date: May 28, 2027 or later**。虽然晚于 2027-04-21，但只剩 37 天余量，属于“合格但生命周期很窄”。
3. 官方参考图能力表显示：**只有 Gemini 3 Pro Image 明确列出“最多 3 张风格参考图”**；Nano Banana 2.1 / 3.1 Flash 只有物体与角色参考，没有风格参考槽。票 12 的“风格图 + 母版”资格线因此不再自动等于“选 2.1”。
4. OpenAI 现行图像模型是 **`gpt-image-2.5-sunburst` / `gpt-image-2.5-flare`**，质量档 `low` / `medium` / `high` / `xhigh` / `max`；旧的 GPT Image 1.x / chatgpt-image-latest 将在 2026-12-01 下线，2.5 是官方替换。

---

## 1. 资格线与判定口径

票 12 §4 的资格线（原文口径）：

1. 决策后六个月内无已知停服日（本票日期 2026-10-21 ⇒ **不得早于 2027-04-21 停服**）；
2. 具备明确可用的接入路径；
3. 不受“仅历史用户”限制；
4. 输出格式兼容获准的资源处理路径；
5. 官方定价可查；
6. 官方文档明确支持**两张参考图**（风格图 + 母版），并检查跨帧角色一致性。

判定口径：

- **合格**：六条均有官方一手依据；需要施工/新 key 的，写清条件。
- **备选**：资格线的大部分满足，但有一项关键事实【未验证】或接入成本显著更高。
- **淘汰**：任一条有官方一手证据表明不满足（停服早于 2027-04-21、仅历史用户、明确不支持双参考图等）。
- **输出格式兼容**：当前 `packages/assets` 的 legacy 路径**只接受 PNG**，Interactions 路径请求 `image/png` 并在非 PNG 时明确抛错（【仓库】`packages/assets/src/image-gen.ts`）。因此：
  - “默认 PNG” = 直接兼容；
  - “JPEG-only” = **不是**直接兼容，必须先做零付费 JPEG 解码施工；本报告把它记为“附条件合格”，不当作免费通过；
  - “PNG 未验证” = 不能按 PNG 入口规划，记为备选/未验证。
  - **口径提醒**：本报告把 JPEG-only 记为“可经零付费施工兼容”的**条件合格**；如果按“今天不改代码、当前 PNG-only 路径直接可处理”严格读，则 JPEG-only 候选应降为备选，短名单只剩 OpenAI 一家。这个口径是政策判断，本报告不替人裁。

---

## 2. 候选资格表

> 价格均为官方 list price（Standard，除非注明）；1K 单张按官方等价图价或官方计算器口径。  
> “双参考图”一列区分“官方明确支持任意两张参考图”与“官方明确有风格参考槽”。  
> 价格列只列**图片输出**；输入 tokens / 参考图另计，见 §4。各候选的置信度见 §3 各节末尾，未验证项汇总见 §6。

| 候选 | 接口 / 接入 | 输出格式（1K） | 双参考图（风格 + 母版） | 官方输出价（1K 单张） | Batch | 停服 / 弃用 | 仅历史用户 | 跨帧一致性风险 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **`gemini-3-pro-image`** | Gemini API **Interactions**；现有 Gemini key + 7890；无 OAuth/ADC | **JPEG-only**（`ImageResponseFormat.mimeType` 枚举只有 `IMAGE_JPEG`） | **明确**：最多 6 物体 + 5 角色 + **3 风格参考**，总 14 | **$0.134**（输入 $2/M；图片输出 $120/M） | $0.067 | **无停服日**（2026-05-28 GA） | 否 | 官方支持 5 角色参考；无跨帧几何/像素级保证 | **合格（附 JPEG 解码条件）** |
| `gemini-3-pro-image`（Vertex） | Vertex GenerateContent；**GCP 项目 + OAuth/ADC**（`gcloud auth print-access-token`） | PNG **【未验证】**；现行 `response_format.image.mimeType` 为 JPEG-only；旧 `imageConfig.imageOutputOptions` 为自由字符串，PNG 示例只配 2.5 | Vertex 页只写“最多 14 张图”；风格/角色拆分未在 Vertex 页文档化 | **$0.134** | $0.067 | 模型页：**2027-05-28 or later** | 否 | 同模型；Vertex 无额外一致性承诺 | **备选（不进短名单）** |
| **`gpt-image-2.5-sunburst` / `flare`** | OpenAI Images API / Responses API；**新 provider key**；可能需 organization verification | **PNG 默认**；可 JPEG / WebP；透明背景（PNG/WebP） | **明确**：`image[]` 多参考图，官方示例 4 张；风格/角色未分槽 | **$0.00588 / $0.01317 / $0.05268 / $0.09366 / $0.21072**（low / medium / high / xhigh / max，1024²） | 半价（输出 $15/M） | 无已知停服日；旧 GPT Image 1.x 于 **2026-12-01** 下线，2.5 是替换 | 否 | **官方明确警告**：recurring characters / brand elements 跨多次生成可能不稳定 | **合格** |
| `gemini-nano-banana-2.1` | Gemini API Interactions；现有 key + 7890 | JPEG-only | 14 张（10 物体 + 4 角色）；**style 参考槽 N/A** | **$0.0336**（输入 $1.50/M；输出 $30/M） | $0.0168 | 无停服日（2026-10-06 GA） | 否 | 官方称多轮角色一致性改进；无跨帧保证 | **备选（成本后备）** |
| `gemini-nano-banana-2.1`（Vertex） | Vertex；GCP + OAuth/ADC | PNG **【未验证】** | 最多 14 张；风格/角色拆分未在 Vertex 页文档化 | **$0.034** | $0.0168 | 模型页未列 retirement date | 否 | 同上 | **备选** |
| `gemini-3.1-flash-image` | Gemini API Interactions | JPEG-only | 14 张（10 物体 + 4 角色）；style N/A | **$0.067** | $0.034 | **2026-10-06 deprecated，无停服日**；官方建议迁 2.1 | 否 | 上一代；多参考一致性有宣传 | **淘汰（已弃用 + 上一代）** |
| `gemini-3.1-flash-lite-image` | Gemini API Interactions | JPEG-only | 14 物体；**character / style 均 N/A** | **$0.0336** | $0.0168 | 无停服日 | 否 | 官方明确“不为多参考输入优化” | **淘汰（双参考图不达标）** |
| `gemini-2.5-flash-image` | legacy `generateContent` | PNG（2.5 legacy） | 官方称最多 3 张输入效果最好 | **$0.039** | $0.0195 | **2027-03-15**（早于 2027-04-21） | **2.5 系列自 2026-09-18 限制历史用户** | 已知基线；但生命周期不合格 | **淘汰** |
| `imagen-4.0-*`（Gemini API） | — | — | — | — | — | **2026-08-17 已 shutdown** | — | — | **淘汰** |
| BFL FLUX.2 [pro]/[max] | BFL API；新 key | **【未验证】**（本次官方页未写输出 MIME） | 最多 8 张 API 参考图；官方称身份一致性 | 官方定价页存在，本次未逐模型核到 1K 价 | 【未验证】 | **【未验证】** | 【未验证】 | 官方宣传“identity across complex scenes” | **不纳入（资格线不完整）** |

---

## 3. 逐候选细节

### 3.1 `gemini-3-pro-image` · Gemini API Interactions

**接入路径【文档】**

- Gemini API 的 REST 示例使用 `https://generativelanguage.googleapis.com/v1beta/interactions`，鉴权头 `x-goog-api-key: $GEMINI_API_KEY`。⇒ **现有 Gemini key 即可，不需要 OAuth / ADC / GCP 项目**。
- 本仓库自 2026-10-19/20 的 smoke 与真跑通过 `127.0.0.1:7890` 代理访问 Gemini API（【仓库】[模型路线研究](model-route-2026-10-20.md) §1.2/§3.1）；代理是本地网络条件，不是 Gemini API 的鉴权要求。
- `gemini-3-pro-image` 在 Gemini API 文档里的状态是 **Stable / GA**；发布日 2026-05-28；Interactions 的“interleaved text and images”官方示例直接使用 `model="gemini-3-pro-image"`。

**输出格式【schema】**

- Gemini API 的 Interactions 输出格式 schema `ImageResponseFormat.mimeType` 在 **v1 / v1alpha / v1beta 三个 discovery 版本**（revision `20261019`，2026-10-21 取）里都只有：
  - `MIME_TYPE_UNSPECIFIED`
  - `IMAGE_JPEG`
- 没有 `IMAGE_PNG`、`image/png`。枚举是端点级而非模型级；`gemini-3-pro-image` 也走同一 Interactions 端点。
- 官方 image-generation 页的示例仍有 `image/png` 与 `image/jpeg` 混用；这属于示例不一致，不能覆盖 schema。本仓库两次 2026-10-19 的 400 原文也印证了 `image/png` 被拒绝（【仓库】[模型路线研究](model-route-2026-10-20.md) §3.1）。
- ⇒ **Interactions 仍是 JPEG-only；没有 alpha 通道。** 当前 PNG-only 管线要做 JPEG 解码施工，才能把 3 Pro 的产物接入。

**双参考图与一致性【文档】**

官方 image-generation 页的参考图能力表（原文列）：

| 参考图类型 | Gemini 3.1 Flash Lite Image | Gemini Nano Banana 2.1 & 3.1 Flash Image | Gemini 3 Pro Image |
| --- | --- | --- | --- |
| 物体高保真 | 最多 14 | 最多 10 | 最多 6 |
| 角色一致性 | N/A | 最多 4 | 最多 5 |
| 风格参考 | N/A | N/A | **最多 3** |

- 同一页还写：`gemini-3-pro-image` supports 5 images with high fidelity, and up to 14 images in total；Nano Banana 2.1 / 3.1 Flash support character resemblance of up to 4 characters and 10 objects。
- ⇒ **3 Pro 是 Gemini 家族里唯一官方明确给出“风格参考槽”的模型**；同时支持最多 5 个角色参考。对“风格图 + 母版”来说，这是最直接的官方依据。
- 官方对跨帧一致性的表述是“角色一致性最多 5 个角色”“360 视图时把之前生成的图继续放进后续 prompt”“复杂姿势提供姿势参考图”，**没有**承诺独立生成的多帧之间 bbox / alpha / 像素几何稳定。对票 12 的机械闸，这仍需付费 smoke 才能验证。
- 官方 limitations 还写：模型不一定会给出用户要求的准确图像数量；生成文本时要先文本后图像。这些都会影响逐帧跑批的重试率。

**定价【文档】**

- 输入：$2.00 / 1M tokens（text/image），图片输入等价 **$0.0011 / 张**。
- 图片输出：$120 / 1M tokens；1K 与 2K 均 **$0.134 / 张**；4K **$0.24 / 张**。
- Batch：输入 $1.00 / 1M（text）、$0.0006 / 张（image）；输出图片 **$0.067 / 1K·2K**、$0.12 / 4K。
- Flex：与 Batch 同价；Priority：输入 $3.60 / 1M、图片输出 $216 / 1M。
- 没有“质量档位”；只有分辨率档位（1K / 2K / 4K）。

**1K 单张与 6 帧资格场景【估算】**

- 单张输出：$0.134。
- 6 帧（每帧 2 张参考图 + 约 1,000 text tokens）：
  - 输出：6 × $0.134 = **$0.804**
  - 参考图输入：6 × 2 × 560 tokens × $2/M = **$0.01344**
  - 文本输入：6 × 1,000 × $2/M = **$0.012**（假设）
  - **base ≈ $0.829**
  - 若按 50% 重试（9 发）：**≈ $1.244**；若 12 发：≈ $1.66。均低于票 12 的资格阶段上限 $2.00 / 候选。
- 结论：3 Pro 的成本约为 2.1 的 4 倍，但资格阶段仍在预算上限内；真正的成本风险在“每合格动画”的重试率，需付费筛查才能测。

**置信度**

- 接入 / 价格 / JPEG-only / 参考图槽位：**高**（官方文档 + discovery）。
- 跨帧几何稳定性 / 像素风保真：**低**（无官方一手资料；必须付费 smoke）。

---

### 3.2 Vertex Gemini 3.x（3 Pro / 3.1 Flash / Nano Banana 2.1）

**接入路径【文档】**

- Vertex 的官方 REST 示例使用 `Authorization: Bearer $(gcloud auth print-access-token)`，端点形如 `https://${API_ENDPOINT}:generateContent`。
- ⇒ 需要 **GCP 项目、启用 Vertex AI / Agent Platform API、OAuth/ADC**；**不能只用现有 Gemini API key**。这与 Gemini API 的 `x-goog-api-key` 是两条不同的接入路径。
- 三个模型的 Vertex 模型页都写 **Global** 可用；3.1 Flash 还有 us / eu multi-region。没有“仅历史用户”限制的文档。

**停服 / 生命周期【文档】**

- `gemini-3-pro-image`（Vertex）：Launch stage **GA**，Release date **May 28, 2026**，**Retirement date: May 28, 2027 or later**。
- `gemini-3.1-flash-image`（Vertex）：GA，Release date **May 28, 2026**，**Retirement date: May 28, 2027 or later**。
- `gemini-nano-banana-2.1`（Vertex）：GA，Release date **October 6, 2026**；模型页没有列出 retirement date。
- ⇒ 3 Pro / 3.1 Flash 的 retirement 晚于 2027-04-21，**形式上通过**；但只多 37 天，且原文是“or later”（不是“不会早于”的承诺）。对六个月决策窗口来说，这是很窄的余量；如果决策拖到 2026 年底，2027-05-28 就只剩不到 5 个月。
- Vertex 的 deprecations 页本次只列出“Generative AI module in the Vertex AI SDK”一项，没有列出这些图像模型的 shutdown；生命周期以各模型页的 retirement date 为准。

**输出格式：PNG 入口是否兑现？【schema + 未验证】**

- Vertex 现行 `GenerationConfig.response_format` 里的 `image.mimeType`：
  - `GoogleCloudAiplatformV1ImageResponseFormat.mimeType` 枚举 = `MIME_TYPE_UNSPECIFIED` / **`IMAGE_JPEG`**；
  - `GenaiVertexV1ImageResponseFormat.mimeType` 枚举 = `TYPE_UNSPECIFIED` / **`TYPE_JPEG`**。
  - ⇒ **现行 Vertex 响应格式 schema 也是 JPEG-only。**
- 旧的 `GenerationConfig.imageConfig` 在 aiplatform discovery 里已被标为 **deprecated**（“Use `response_format.image` instead”）；它的 `imageOutputOptions.mimeType` 是自由字符串，SDK 文档只写“The image format that the output should be saved as”，没有枚举、没有列出支持值。
- 官方 “Edit images with Gemini” 的 REST 示例确实有：
  ```json
  "imageConfig": {
    "aspectRatio": "16:9",
    "imageSize": "4K",
    "responseModalities": ["TEXT", "IMAGE"],
    "imageOutputOptions": { "mimeType": "image/png" }
  }
  ```
  但该示例的模型是 **`gemini-2.5-flash-image`**（同一页的代码示例 `modelId`），不是 Gemini 3.x。
- 各 Gemini 3.x 模型页的 “Supported MIME types: image/png, image/jpeg, image/webp, image/heic, image/heif” 出现在 “Image” 技术规格里，和 “Maximum file size / Maximum images per prompt” 等输入约束并列；它描述的是**输入** MIME，不能当作输出 PNG 的证据。
- ⇒ **“Vertex `imageOutputOptions.mimeType` 对 Gemini 3.x 兑现 PNG” = 【未验证】。** 目前能确认的是：
  1. PNG 字段存在（旧字段，已 deprecated）；
  2. 官方 PNG 示例只配 2.5；
  3. 现行 `response_format` 枚举只有 JPEG；
  4. 没有任何官方页明确写“Gemini 3.x on Vertex returns PNG”。
- 因此，**不能把 Vertex 当作已验证的 PNG 入口**；若要用，必须先做零付费探针（另票）或把输出按 JPEG 规划。

**双参考图【文档】**

- Vertex 模型页：`gemini-3-pro-image` / `3.1-flash-image` / `nano-banana-2.1` 的 “Maximum images per prompt” 都是 **14**；limitations 页写 “For best results using Gemini 3 Pro Image, include a maximum of 14 images in an input.”
- 但 Vertex 页没有像 Gemini API image-generation 页那样给出“6 物体 + 5 角色 + 3 风格”的拆分；**风格参考槽在 Vertex 文档里未单独文档化**。同一模型 ID 在 Gemini API 页有拆分，但严格按“官方文档明确支持”应标为：**两张参考图可支持；风格参考语义在 Vertex 侧未验证。**
- 3 Pro 的 Vertex limitations 没有跨帧一致性承诺；只列了语言、输出数量、文本先于图像等限制。

**定价【文档】**

- Vertex 定价页的 Nano Banana 段与 Gemini API 价格一致：
  - Gemini 3 Pro Image：输入 $2.00 / 1M（text, image），图片输出 $120 / 1M；**$0.134 / 1K·2K**，$0.24 / 4K；Batch **$0.067 / 1K·2K**。
  - 3.1 Flash Image：输入 $0.50 / 1M，图片输出 $60 / 1M；**$0.067 / 1K**；Batch $0.034 / 1K。
  - Nano Banana 2.1：输入 $1.50 / 1M，图片输出 $30 / 1M；**$0.034 / 1K**；Batch $0.0168 / 1K；**不支持 Flex**。
- 3 Pro 的 Vertex 模型页还给出：输入图 560 tokens / 张；1K/2K 输出 1,120 tokens；4K 2,000 tokens。

**1K 单张与 6 帧资格场景【估算】**

- 3 Pro：单张 $0.134；6 帧 base ≈ **$0.829**（与 Gemini API 同价，输入 token 口径相同）。
- 2.1：单张 $0.034；6 帧 base ≈ **$0.231**。
- 3.1 Flash：单张 $0.067；6 帧 base ≈ **$0.413**。
- 另加 GCP 项目 / 出网 / OAuth 运维成本（非 token 价格，未量化）。

**结论**

- **备选，不进短名单。** 理由不是价格，而是：
  1. PNG 交付未验证，且现行 schema 是 JPEG-only；短名单不该建立在未验证的格式优势上；
  2. 接入需要 GCP + OAuth/ADC，明显重于现有 key；
  3. 3 Pro / 3.1 Flash 的 retirement 2027-05-28 只比资格线多 37 天。
- 如果后续有人愿意先做零付费的 Vertex PNG 探针（或接受 JPEG），Vertex 3 Pro 可以重新进入比较；但那是另一张票。

---

### 3.3 OpenAI `gpt-image-2.5-sunburst` / `gpt-image-2.5-flare`

**可用性与接入【文档】**

- 官方 image-generation guide 的现行模型是 **`gpt-image-2.5-sunburst`**（“editing precision”）与 **`gpt-image-2.5-flare`**（“fast, high-quality everyday”）。OpenAI models 页的 Image 段也只列这两个。
- 两条 API：Images API（generation / edits）与 Responses API（image_generation tool）。本仓库已有 `openai` 协议（generations + edits），但当前指向中转 `gpt-image-2.5`；接官方端点需要改 base URL / 模型 / 质量档 / 参考图语义，并重新验证。
- 接入需要 **新的 OpenAI provider key**；官方还写：“you may need to complete the API Organization Verification … before using GPT Image models.” ⇒ 不是现有 Gemini key 能覆盖的路径。
- 没有“仅历史用户”限制的文档。

**停服 / 弃用【文档】**

- OpenAI deprecations 页：2026-06-02 通知，旧的 `gpt-image-1-mini` / `gpt-image-1.5` / `chatgpt-image-latest` 于 **2026-12-01** 下线；推荐替换正是 `gpt-image-2.5-sunburst` 或 `gpt-image-2.5-flare`。
- `gpt-image-2` 不在 2026-12-01 下线表里；`gpt-image-2.5` 也没有已知停服日。
- OpenAI 的 deprecation policy：GA 模型至少提前 **6 个月**通知（特殊情况除外）。⇒ 对于资格线“2027-04-21 前不停服”，可以按“无已知停服日 + 6 个月通知”判断为通过；但仍不是永久承诺。

**输出格式【文档】**

- Image API 返回 base64；**默认 `png`**，也可 `jpeg` / `webp`；JPEG / WebP 可用 `output_compression` 0–100。
- 透明背景：`background: "transparent"` + `output_format: "png"` 或 `"webp"`。
- 尺寸：推荐 1024×1024、1536×1024、1024×1536；也支持自定义 `WIDTHxHEIGHT`，宽高为 16 的倍数、比例 1:3–3:1、单边 ≤ 3840、总像素 655,360–8,294,400。
- 质量档：`low` / `medium` / `high` / `xhigh` / `max` / `auto`（2.5 新增 xhigh、max；旧模型最高 high）。
- ⇒ **PNG 默认 + 可选透明**，与当前 PNG 管线直接兼容；这是它相对 Gemini 的核心格式优势。

**双参考图【文档】**

- “The image edits endpoint lets you … Generate new images using other images as a reference … You can use one or more images as a reference to generate a new image. In this example, we’ll use 4 input images…”
- Images API 的 edits 示例使用 `image[]=@body-lotion.png`、`image[]=@bath-bomb.png` 等 4 张；⇒ **两张参考图明确支持**。
- 官方没有像 Gemini 那样区分“风格参考槽 / 角色参考槽”；风格图与母版都作为普通 reference image 传入。对“风格 + 母版”的语义，属于**通用多参考图**，不是分槽文档。

**跨帧一致性【文档】**

- 官方 Limitations 原文：
  > “Consistency: While capable of producing consistent imagery, the model may occasionally struggle to maintain visual consistency for recurring characters or brand elements across multiple generations.”
- 还有：“Complex prompts may take up to 2 minutes to process.”
- ⇒ 官方**主动承认** recurring character 跨多次生成会波动；这正是本管线“同一角色跨 61 帧”的核心风险。它不是 disqualifier（官方没有说不能做），但必须在付费筛查中用同一动画多帧验证。

**定价【文档 + 官方计算器】**

- 标准价：图片输入 **$8 / 1M**，缓存图片输入 $2 / 1M；图片输出 **$30 / 1M**；文本输入 $5 / 1M，缓存文本 $1.25 / 1M。
- Batch：图片输入 $4 / 1M，图片输出 **$15 / 1M**，文本输入 $2.50 / 1M。
- 1024×1024 输出（官方 `GptImageTokenCalculator` 的 2.5 参数；low 为页面直接显示，其余用同一官方组件公式计算）：

| 质量档 | 输出 tokens | 图片输出成本 / 张 | 6 帧输出成本 |
| --- | ---: | ---: | ---: |
| low | 196 | **$0.00588** | $0.0353 |
| medium | 439 | **$0.01317** | $0.0790 |
| high | 1,756 | **$0.05268** | $0.3161 |
| xhigh | 3,122 | **$0.09366** | $0.5620 |
| max | 7,024 | **$0.21072** | $1.2643 |

> 计算器组件里的 2.5 参数为 `{low:16, medium:24, high:48, xhigh:64, max:96}`，token 公式会乘 `(2e6 + w*h)/4e6`；页面默认 low/1024² 显示 196 tokens / $0.00588，与上表一致。以上是**官方价格 + 官方页面计算逻辑**的推导，不是逐档官方静态表。

- 输入图 token：2.5 guide 只说“always processes image inputs at high fidelity”“image input tokens can be higher”，**没有给出 2.5 的静态每图 token 数**。官方 vision 页明确写明 GPT Image 的输入 token 规则与 vision calculator 不适用。⇒ 6 帧输入成本只能估算。

**6 帧资格场景【估算，输入 token 为未验证假设】**

- 假设：6 帧 = 拾荒者 idle 首/中/尾 3 帧 + 敌人 patrol 首/中/尾 3 帧；每帧 2 张 1K 参考图 + 约 1,000 text tokens；非 batch。
- 输出成本：见上表，low $0.035 – max $1.264。
- 参考图输入：12 张 1K 图。按旧 GPT Image 1 的高保真规则（1024² 约 4,354 tokens/图：65 base + 1 tile × 129 + 4,160 high-fidelity）估，12 张 ≈ 52,248 tokens × $8/M ≈ **$0.418**；按更低的 vision 高细节口径（约 1,229 tokens/图）估，约 **$0.118**。2.5 的真实值在两者之间或更高，**【未验证】**。
- 文本输入：6,000 tokens × $5/M = **$0.03**（假设）。
- 总计（base，含输入估算区间）：
  - low：**$0.18–$0.48**
  - medium：**$0.23–$0.53**
  - high：**$0.46–$0.76**
  - xhigh：**$0.71–$1.01**
  - max：**$1.41–$1.71**
- 若按 50% 重试（9 发）：low ≈ $0.28–$0.73；medium ≈ $0.34–$0.79；high ≈ $0.70–$1.15；xhigh ≈ $1.07–$1.52；**max ≈ $2.12–$2.57，可能超过票 12 的 $2.00 资格上限**。
- ⇒ 如果要控制资格阶段预算，OpenAI 应优先 low / medium / high；xhigh 需单独说明，max 不建议在资格阶段使用。

**置信度**

- 模型 / 格式 / 多参考图 / 输出价格：**高**（官方文档 + 官方计算器）。
- 2.5 的参考图输入 token：**低**（无官方静态数字）。
- 跨帧一致性：**中**（官方有明确 caveat，但没有量化）。

---

### 3.4 其他候选（已筛掉或未纳入）

#### Gemini Nano Banana 2.1（Gemini API / Vertex）

- 官方定位：high-efficiency workhorse；2026-10-06 GA；无停服日；现有 Gemini key 可接入（Interactions）。
- 参考图：最多 14 张（10 物体 + 4 角色），但 **style references = N/A**；官方说“multi-image fusion … character consistency for up to 4 characters and object fidelity for up to 10 objects”。
- 输出：Interactions JPEG-only；Vertex PNG 未验证。
- 价格：$0.0336 / 1K（Batch $0.0168）；Vertex $0.034。
- 结论：**备选（成本后备）**。如果 3 Pro 的付费筛查证明质量不够而其成本不可接受，2.1 是最便宜的同 provider 后备；但它没有明确风格参考槽，且同样受 JPEG 约束，所以不占短名单的 2 个名额。
- 这也是对 2026-10-20 研究结论的一个重要修正：当时推荐 2.1 主要基于“新一代 + 参考图能力更强 + 生命周期最长”；票 12 的资格线把“风格参考”单独提出后，2.1 的官方表并不支持“风格参考槽”，不能直接沿用旧结论。

#### Gemini 3.1 Flash Image

- 2026-10-06 官方 changelog 明确 `deprecated (no shutdown date announced)`，建议迁 `gemini-nano-banana-2.1`；image-generation 页称其为 “previous-generation high-efficiency workhorse”。
- 参考图：10 物体 + 4 角色；style N/A；输出 JPEG-only；$0.067 / 1K。
- 结论：**淘汰**。不是停服日期不合格（无日期），而是官方已弃用 + 上一代 + 无风格参考槽；继续选它等于把新功能建在一条已宣布退场的线上。

#### Gemini 3.1 Flash Lite Image

- 官方定位：最便宜最快；**“Not optimized for multiple reference inputs or multi-turn sequential editing.”**
- 参考图表：14 物体；character 与 style 均 N/A。
- 结论：**淘汰**。本管线每帧要风格图 + 母版两张参考，正好踩在官方明确不擅长的点上。

#### Gemini 2.5 Flash Image

- Deprecations：**shutdown 2027-03-15**（早于 2027-04-21）；Pricing 页另有一句 “shut down on October 2, 2026”（已过期但未停，官方口径互相矛盾）。
- 2.5 系列自 2026-09-18 起限制为“历史上活跃使用过的用户”；是否逐模型覆盖图模没有逐模型文档，但风险已经足够。
- 输出：legacy `generateContent` 仍返回 PNG（【仓库】2026-10-20 lurker 真跑 6 张成功），但生命周期不合格。
- 结论：**淘汰**；只能作为已批准的小批量临时旁路，不作为长期候选。

#### Imagen 4（Gemini API）

- 2026-06-15 changelog：Imagen 4 三个端点 **2026-08-17 shutdown**；models 页标记 “Imagen 4 (Shut down)”。
- 结论：**淘汰**。即使 Vertex 侧仍有 Imagen 4 的计费行，Gemini API 侧已不可用，且本次没有拿到其双参考图能力的官方一手证据。

#### Black Forest Labs FLUX.2 [pro] / [max]（未纳入）

- 官方 docs：FLUX.2 支持 **最多 8 张 API 参考图**（playground 10 张），官方宣传 “identity across complex scenes”“8 consistent characters from reference images”；FLUX.2 [max] 强调 “highest editing consistency”。
- 官方 pricing 页存在，但本次能读到的页面对输出 MIME（PNG/JPEG/WebP）、质量档、停服/弃用承诺都没有明确说明；API reference 的 `get_result` 页也没有输出格式字段。
- 结论：**不纳入**。它看起来是“多参考 + 身份一致性”的有力候选，但资格线要求“输出格式兼容可查 + 官方定价可查 + 无已知停服日”；本次官方页没有把这几项同时说清，不能按“明确合格”处理。若未来要做第三方 provider 扩展，建议单独开票核 FLUX 的输出 MIME、SDK、停服政策和 1K 价。

#### DashScope

- 2026-10-20 研究已判：参考图必须公网 URL（本机文件传不进去）、背景渐变洋红、实测抠底不可靠，不满足本管线“内联风格图 + 母版”的前提。本次没有新的官方资料推翻该结论，维持**不纳入**。

---

## 4. 成本汇总：1K 单张 + 6 帧资格场景

### 4.1 官方单价（Standard / 1K）

| 模型 | 输入 | 图片输出 | 1K 单张 | Batch 1K |
| --- | --- | --- | ---: | ---: |
| Gemini 3 Pro Image | $2.00 / 1M（图 $0.0011/张） | $120 / 1M | **$0.134** | $0.067 |
| Gemini Nano Banana 2.1 | $1.50 / 1M（1,120 tokens/图） | $30 / 1M | **$0.0336** | $0.0168 |
| Gemini 3.1 Flash Image | $0.50 / 1M（1,120 tokens/图） | $60 / 1M | **$0.067** | $0.034 |
| Gemini 3.1 Flash Lite Image | $0.25 / 1M（1,120 tokens/图） | $30 / 1M | **$0.0336** | $0.0168 |
| Gemini 2.5 Flash Image | $0.30 / 1M | $0.039/张 | **$0.039** | $0.0195 |
| OpenAI gpt-image-2.5 low | $5 text / $8 image per 1M | $30 / 1M | **$0.00588** | $0.00294 |
| OpenAI gpt-image-2.5 medium | 同上 | $30 / 1M | **$0.01317** | $0.00659 |
| OpenAI gpt-image-2.5 high | 同上 | $30 / 1M | **$0.05268** | $0.02634 |
| OpenAI gpt-image-2.5 xhigh | 同上 | $30 / 1M | **$0.09366** | $0.04683 |
| OpenAI gpt-image-2.5 max | 同上 | $30 / 1M | **$0.21072** | $0.10536 |

> Vertex 与 Gemini API 同模型同价（Vertex 定价页口径）；Vertex 3 Pro 1K/2K 均 $0.134，2.1 $0.034，3.1 Flash $0.067。  
> OpenAI 的 low–max 为 1024×1024、官方计算器口径；Batch 为输出半价，未计输入。

### 4.2 6 帧资格场景（票 12：拾荒者 idle 首/中/尾 + 敌人 patrol 首/中/尾）

**共同假设（【估算】）：**

- 每帧 2 张参考图（风格 + 母版），1K 输出；
- 每帧约 1,000 text tokens（提示词 + 风格约束；实际 prompt 可能更长，影响很小）；
- 非 batch；不含失败重试的 base 列；另给 +50% 重试敏感性；
- 6 帧只是“资格阶段样本”，不是完整动画，也不是“每合格动画成本”。

| 候选 | 输出 6 帧 | 参考图输入 6 帧 | 文本输入 6 帧 | **base 合计** | **+50% 重试** | 对照 $2.00 上限 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Gemini 3 Pro Image | $0.804 | $0.0134 | $0.012 | **≈ $0.829** | **≈ $1.244** | 通过 |
| Gemini 3 Pro Image（Vertex） | $0.804 | $0.0134 | $0.012 | **≈ $0.829** | ≈ $1.244 | 通过（另加 GCP 运维） |
| Gemini Nano Banana 2.1 | $0.2016 | $0.0202 | $0.009 | **≈ $0.231** | ≈ $0.346 | 通过 |
| Gemini 3.1 Flash Image | $0.403 | $0.0067 | $0.003 | **≈ $0.413** | ≈ $0.619 | 通过（但已弃用） |
| Gemini 3.1 Flash Lite Image | $0.2016 | $0.0034 | $0.0015 | **≈ $0.206** | ≈ $0.310 | 通过（但双参考不达标） |
| OpenAI 2.5 low | $0.0353 | $0.118–$0.418 | $0.03 | **$0.18–$0.48** | $0.28–$0.73 | 通过 |
| OpenAI 2.5 medium | $0.0790 | $0.118–$0.418 | $0.03 | **$0.23–$0.53** | $0.34–$0.79 | 通过 |
| OpenAI 2.5 high | $0.3161 | $0.118–$0.418 | $0.03 | **$0.46–$0.76** | $0.70–$1.15 | 通过 |
| OpenAI 2.5 xhigh | $0.5620 | $0.118–$0.418 | $0.03 | **$0.71–$1.01** | $1.07–$1.52 | 通过 |
| OpenAI 2.5 max | $1.2643 | $0.118–$0.418 | $0.03 | **$1.41–$1.71** | **$2.12–$2.57** | base 通过；+50% 重试超限 |

**读法：**

- Gemini 侧的数字来自官方单价 + 官方输入图 token 数（3 Pro 560/图；2.1/3.1 1,120/图），文本 1k/frame 是假设；误差在几美分内。
- OpenAI 侧的输出价是官方计算器口径；参考图输入 token 是**未验证估算**（官方没有给 2.5 的静态每图 token 数），所以 base 合计给区间而不是单值。
- 票 12 的资格阶段上限是 **$2.00 / 候选**；上表说明：
  - 3 Pro 即使 50% 重试也在上限内；
  - OpenAI 在 low–xhigh 的 50% 重试内也在上限内；**max + 50% 重试可能超限**，资格阶段不应默认用 max；
  - 2.1 / 3.1 Lite 的成本极低，但资格问题不在成本，而在参考图/生命周期。
- **这些是估算，不是报价；不含网络、代理、GCP、失败帧的额外重试、以及“每合格动画”的分母。**

---

## 5. 短名单与理由（不排序、不选胜者）

### 短名单（2 个）

1. **`gemini-3-pro-image` · Gemini API Interactions**
   - 为什么进：现有 Gemini key + 7890 即可；无停服日；官方明确 3 张风格参考 + 5 张角色参考 + 6 张物体参考（总 14）；$0.134/1K 在资格阶段预算内；Interactions 已支持该模型（官方 interleaved 示例）。
   - 条件：**JPEG-only**，当前 PNG-only 管线必须先做零付费 JPEG 解码施工；跨帧几何稳定性未验证，必须用同动画多帧 smoke。
   - 风险：成本是 2.1 的 4 倍；像素风/1px 描边/平涂背景的实际质量没有任何官方一手证据；2.5 的现有 fixture 不能直接复用。

2. **OpenAI `gpt-image-2.5-sunburst` 或 `gpt-image-2.5-flare`**
   - 为什么进：PNG 默认、可 JPEG/WebP、可透明；官方明确多参考图（`image[]`，示例 4 张）；无已知停服日；输出价低（medium $0.013/张，high $0.053/张）；与当前 PNG 管线格式兼容。
   - 条件：新 provider key + 可能需要 organization verification；本仓库现有 `openai` 协议指向中转，接官方端点需改 base URL / 模型 / 质量档 / 参考图语义，并重做质量基线。
   - 风险：官方承认 recurring characters 跨多次生成可能不稳定；跨帧一致性必须付费 smoke；2.5 的参考图输入 token 成本未文档化，预算有不确定性。

### 为什么不把 Vertex / 2.1 放进短名单

- **Vertex Gemini 3.x**：PNG 未验证（现行 `response_format` JPEG-only；PNG 示例只配 2.5）+ GCP/OAuth 接入重 + 3 Pro/3.1 Flash retirement 2027-05-28 仅比资格线多 37 天。它不是“不合格”，而是“资格优势没有被官方资料兑现”；在短名单只有 2 个名额时，不应占位。
- **Gemini Nano Banana 2.1**：成本最低、生命周期好，但官方参考图表没有风格参考槽；对本管线的“风格图 + 母版”只能算通用多参考图。它可以作为 3 Pro 失败后的成本后备，但不进本轮短名单。
- **3.1 Flash / 3.1 Lite / 2.5 / Imagen 4**：已弃用、双参考不达标、停服早于 2027-04-21、或已 shutdown，直接淘汰。
- **FLUX.2**：多参考与身份一致性看起来有吸引力，但输出格式/停服/1K 价没有在本次官方页面上同时核实，不能按“明确合格”纳入。

**口径敏感性：** 若把票 12 的“输出格式兼容获准的资源处理路径”严格解释为“当前 PNG-only 代码不改即可处理”，则短名单只剩 OpenAI 2.5 一个；Gemini 3 Pro 降为备选。本报告按“允许零付费 JPEG 解码施工”的条件口径给出 2 个短名单，但**不替人裁定**应采用哪种解释。
> （**2026-10-21 补注**：08 已落地 JPEG 解码；当前代码已接受 JPEG，严格 PNG-only 的口径不再适用。）

**再次声明：短名单不是排名，也不是选型结论；本报告没有授权、也没有发起任何付费筛查。**

---

## 6. 未验证 / 未决项（必须带进下一票）

1. **Vertex Gemini 3.x 的 PNG 交付**：`imageConfig.imageOutputOptions.mimeType` 对 Gemini 3.x 是否真的返回 PNG，官方没有一手说明；现行 `response_format.image.mimeType` 只有 JPEG。若要走 Vertex，需另票做零付费探针或直接接受 JPEG。
2. **Interactions 在 `mime_type` 留空时的默认输出**：schema 有 `MIME_TYPE_UNSPECIFIED`，但文档没写默认回什么；不要把它当 PNG 方案。
3. **Gemini JPEG 编码参数**：quality、4:2:0/4:4:4、progressive 均未公开；只能用付费 smoke 测真实字节。
4. **所有候选的跨帧 bbox / alpha / 位置稳定性**：没有一家官方文档给出“独立生成帧之间的几何稳定”承诺；必须用同一动画 2 帧（筛查）/ 6 帧（资格）实测票 12 的机械闸。
5. **OpenAI 2.5 的参考图输入 token 规则**：官方只给 $8/M 的单价和“high fidelity”描述，没有 2.5 的静态每图 token 数；6 帧输入成本是估算。
6. **OpenAI 2.5 的长期停服承诺**：只有 GA 模型至少 6 个月通知的政策 + 当前无已知日期；不是永久承诺。
7. **Gemini 3 Pro 的像素风 / 1px 描边 / 平涂背景质量**：没有任何官方一手资料；必须付费 smoke + 联系表人眼判定。
8. **2.5 的“仅历史用户”是否逐模型覆盖图模**：官方只写“2.5 models”，没有逐模型点名；2.5 已因停服日期淘汰，不影响本轮短名单，但影响临时旁路的可用性判断。
9. **Gemini 3.1 Flash Image 的最终停服日**：官方只说 deprecated、无 shutdown date；不能假设它一定活到 2027-04-21 之后。
10. **BFL FLUX.2 的输出 MIME / 停服政策 / 1K 价**：本次官方页未同时核实；若要做第三方 provider 扩展，需单独立票。

---

## 7. 来源清单（全部 2026-10-21 访问）

| 来源 | 用途 |
| --- | --- |
| <https://ai.google.dev/gemini-api/docs/deprecations> | Gemini API 图像模型 release / shutdown：3 Pro 无停服日；2.1 无停服日；3.1 Flash deprecated 无停服日；2.5 shutdown 2027-03-15 |
| <https://ai.google.dev/gemini-api/docs/pricing> | 3 Pro / 2.1 / 3.1 Flash / 3.1 Lite / 2.5 的输入、输出、1K/2K/4K、Batch、Flex、Priority 价格 |
| <https://ai.google.dev/gemini-api/docs/image-generation> | 模型定位；参考图能力表（物体/角色/风格）；Interactions 示例；2.1 与 3 Pro 的多参考图描述；输出格式示例的不一致 |
| <https://ai.google.dev/gemini-api/docs/models> | 图像模型清单；2.5 系列“仅历史用户”提示；Imagen 4 shut down |
| <https://ai.google.dev/gemini-api/docs/changelog> | 2026-10-06 2.1 GA + 3.1 Flash deprecated；2026-09-18 2.5 历史用户限制；2026-06-15 Imagen 4 shutdown |
| <https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image> | 3 Pro 的 Stable / 能力 / token limits |
| <https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1> | 2.1 的 14 张参考图、4 角色 / 10 物体、Stable |
| <https://generativelanguage.googleapis.com/$discovery/rest?version=v1> | Interactions `ImageResponseFormat.mimeType` 只有 `IMAGE_JPEG`；revision 20261019 |
| <https://generativelanguage.googleapis.com/$discovery/rest?version=v1alpha> | 同上，排除“只是 v1 漏了 PNG” |
| <https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta> | 同上 |
| <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-pro-image> | Vertex 3 Pro：GA、release 2026-05-28、retirement 2027-05-28 or later、最多 14 图、输入图 560 tokens、1K/2K 1,120 tokens、4K 2,000 tokens |
| <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image> | Vertex 3.1 Flash：GA、retirement 2027-05-28 or later、最多 14 图、支持的输入 MIME |
| <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/nano-banana-2-1> | Vertex 2.1：GA、无 retirement date、14 图、1,120 tokens/输入图 |
| <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/image-generation> | Vertex 生成图 REST 示例：`gcloud auth print-access-token`；`responseModalities` / `imageConfig` |
| <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/gemini-edit-images> | Vertex `imageOutputOptions.mimeType: image/png` 示例（模型为 2.5）；多轮编辑支持列表 |
| <https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/gemini-image-generation-limitations> | Vertex 3 Pro 最多 14 图；语言/输出数量限制 |
| <https://cloud.google.com/vertex-ai/generative-ai/pricing> | Vertex 上 3 Pro / 2.1 / 3.1 Flash / 3.1 Lite 的 1K/2K/4K、Batch、输入图 token 脚注 |
| <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/deprecations> | Vertex 生成式 AI 的 deprecations 页（本次只列 SDK 弃用） |
| <https://aiplatform.googleapis.com/$discovery/rest?version=v1> | Vertex `GenerationConfig.imageConfig` 已 deprecated；`response_format.image.mimeType` 仅 `IMAGE_JPEG` / `TYPE_JPEG`；`imageOutputOptions.mimeType` 为自由字符串；revision 20261012 |
| <https://googleapis.github.io/java-genai/javadoc/com/google/genai/types/ImageConfig.html> | SDK 侧确认 `outputMimeType` / `imageOutputOptions` 不在 Gemini API 支持，属于 Vertex 侧字段 |
| <https://developers.openai.com/api/docs/guides/image-generation> | 2.5 sunburst/flare；默认 PNG、JPEG/WebP、透明；质量档；多参考图（`image[]`，4 张示例）；官方一致性 caveat；organization verification |
| <https://developers.openai.com/api/docs/pricing> | 2.5 标准 / Batch 输入输出价格；旧 GPT Image 2 对照价 |
| <https://developers.openai.com/api/docs/deprecations> | 旧 GPT Image 1.x / chatgpt-image-latest 2026-12-01 下线；GA 至少 6 个月通知 |
| <https://developers.openai.com/api/docs/models> | 当前 Image 模型仅 GPT-Image-2.5 Sunburst / Flare |
| <https://developers.openai.com/api/docs/guides/vision> | GPT Image 输入 token 与 vision calculator 不适用的说明；旧 GPT Image 1 的高保真 token 规则（用于输入成本区间估算） |
| <https://developers.openai.com/_astro/GptImageTokenCalculator.react.ttCc55Ch.js> | 官方 image-generation 页内嵌计算器的 2.5 token 参数与公式（用于 medium/high/xhigh/max 的 1024² 输出 token 推导） |
| <https://docs.bfl.ai/flux_2/flux2_overview> | FLUX.2 多参考（最多 8 API / 10 playground）、身份一致性宣传、官方定价入口 |
| <https://docs.bfl.ai/flux_2/flux2_image_editing> | FLUX.2 image editing 的 `input_image_2` 多参考示例 |
| <https://bfl.ai/pricing> | BFL 官方定价页（本次未逐模型核到 1K 价 / 输出格式） |

**仓库内证据（非官方上游，但与官方 schema 相互印证）：**

| 文件 | 用途 |
| --- | --- |
| [`.scratch/asset-integration-v1/research/model-route-2026-10-20.md`](model-route-2026-10-20.md) | 2026-10-20 的 Interactions JPEG-only、两次 400 原文、2.5 真跑、OpenAI 初筛 |
| `packages/assets/src/image-gen.ts` | 当前 legacy 路径只接受 PNG；Interactions 请求 `image/png` 并对非 PNG 抛错 |
| `packages/assets/src/import.ts` / `quantize.ts` | 抠底 → 裁框 → 面积降采样 → alpha 二值化 → 最近邻量化的真实管线；逐帧模式各自裁框 |
| `packages/assets/src/prompt.ts` | “1 像素深色描边”等硬要求 |
| `.scratch/style-migration-v1/report-10-smoke-failure-2026-10-19.md` / `report-10-smoke-m1-failure-2026-10-19.md` | 两次 `image/png` 400 的原文与日志 |
| `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/` | 2026-10-20 2.5 仍可用、6 帧 ≈$0.20–0.23 的实测记录 |

---

## 8. 方法与边界声明

- **0 次付费调用**：没有调用任何生图 / 文本生成端点；没有发 `generateContent`、`interactions`、`images/generations`、`images/edits` 或任何 provider 的生成请求。
- 只做了公开的 HTTP GET：官方文档页、官方定价页、官方 discovery 文档、官方 SDK 文档、官方定价页内嵌计算器 JS；没有使用任何需要付费或需要新 provider key 的接口。
- **未改**源码、配置、fixtures、`map.md`；**未切分支**；只在 `research/` 下新增本报告，并在票 13 追加 Answer / 改状态。
- 所有金额均为**官方 list price 或由官方价格推导的估算**；已用【估算】/【未验证】标记，不构成报价或预算授权。
- 短名单只按票 12 的资格线筛选；**不选胜者、不排序、不预授权付费筛查**。任何 smoke / 跑批必须另票、另出书面预算报告并获得逐字批准。
