# 模型路线：`gemini-2.5-flash-image` 停服后怎么跑批

- 票：[05. 2.5 停服后的模型路线](../issues/05-model-migration.md)
- 日期：2026-10-20
- 边界：**零付费**（没有调用任何生图 / 文本 API；只做了官方文档、免费 API discovery / models.list、仓库本地资料与离线 JPEG 模拟）；**未改源码、未改 `game-maker.local.json`、未换 provider**。
- 记号：**【文档】** = 官方文档 / API schema 原文；**【实测】** = 本仓库真跑或 smoke 的已记录事实；**【模拟】** = 本次在本地用真实管线函数跑的离线实验；**【推断】** = 由前两者推出、尚未付费验证。

---

## 0. 一句话结论

**推荐走 A：Interactions API + JPEG 解码，模型选 `gemini-nano-banana-2.1`；现有 2.5 产物先冻结，2.5 legacy PNG 只作为已批准的小补丁的临时旁路。**

关键前提是一条硬事实：**Interactions API 的图片输出 MIME 枚举里根本没有 PNG，只有 JPEG**（v1 / v1alpha / v1beta 三个 discovery 版本一致，revision `20261019`）。所以「换一台支持 PNG 的 Gemini 模型」在 Interactions 上不成立——换 `gemini-3.1-flash-image` 或 `gemini-3-pro-image` 也仍然是 JPEG；换模型本身不解决格式问题。

---

## 1. 现状与约束

### 1.1 `gemini-2.5-flash-image` 的真实状态：三份官方口径互相打架

| 来源 | 说法 | 性质 |
| --- | --- | --- |
| [Deprecations](https://ai.google.dev/gemini-api/docs/deprecations) 的 Nano Banana 表 | `gemini-2.5-flash-image` · 发布 2025-10-02 · **shutdown 2027-03-15** · 推荐替换 `gemini-3.1-flash-lite-image` | 【文档】 |
| [Pricing](https://ai.google.dev/gemini-api/docs/pricing) 的 2.5 Flash Image 段 | “is deprecated and will be shut down on **October 2, 2026**; migrate to Gemini 3.1 Flash Image or Gemini 3.1 Flash Lite Image” | 【文档】 |
| [Changelog 2026-09-18](https://ai.google.dev/gemini-api/docs/changelog) | “2.5 models”被限制为**只对历史上用过 2.5 的用户开放**，并称“**not deprecated** … until further notice”。⚠️ 该条没有逐模型点名；`models` 页把它放在 2.5 Flash 文本模型段落下，是否覆盖图模未明确 | 【文档】 |
| 本仓库 2026-10-20 的 lurker 真跑 | 6 张图成功，模型 `gemini-2.5-flash-image`，legacy `generateContent`，返回 PNG | 【实测】 |

结论：**不要相信任何一个「安全日期」**。2026-10-02 已经过去 18 天而模型仍在服务，说明 Pricing 页那句至少是过期或日期已滑；Deprecations 表给的 2027-03-15 是目前最像“硬日期”的一条，但 Changelog 又说“未弃用、另行通知”。对一个要花钱跑批的工程，正确姿态是：

- **今天仍可用**，可以继续作为已批准的小批量旁路；
- **随时可能不可用**，不能把新功能建立在新 2.5 跑批上；
- 2.5 可能被限制在“以前用过它的账号”（Changelog 2026-09-18 的“2.5 models”，未逐模型点名），新 key / 新环境未必有权限——这是一条不会在停服表格里体现的可用性风险。

### 1.2 现有适配器怎么选路

`packages/assets/src/image-gen.ts`：

- `GeminiOptions.api = "auto" | "generateContent" | "interactions"`；默认 `auto`。
- `auto` 下：`gemini-2.5-*` 走 legacy `generateContent`；其余（3.x / nano-banana）走 Interactions。
- legacy 路径只接受 `image/png`；Interactions 路径请求 `response_format.mime_type: "image/png"`，收到非 PNG **明确抛错，不静默解码**。
- 配置层 `packages/assets/src/image-config.ts` 只有 `protocol / baseUrl / apiKey / model / proxy`，没有 `api` 字段；靠 `auto` 规则选路。

⇒ **只把 `game-maker.local.json` 的 model 从 3.1-lite 改成 2.1，仍然会 400**：请求体还是 `image/png`。当前配置（3.1-lite + 已失效的 9098 代理）原样跑，会在第一发请求前被上游拒绝（不扣费）；最终跑批都是脚本显式覆盖成 2.5 + 7890 的。

### 1.3 包对上游的要求（决定质量风险有多大）

- 最终包：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/` —— 34 色、61 动画帧、19 资源。
- 提示词硬要求：**“轮廓清晰，带 1 像素深色描边”**（`packages/assets/src/prompt.ts:223`）。
- 上游原图是 1K 级（实测 raw：864×1184 / 896×1152 / 1024×1024），最终帧只有 24×24 ~ 48×64。管线做的是：
  **抠背景 → 裁框 → 面积平均降采样（约 19×）→ alpha 二值化 → 最近邻量化到 34 色**。
- 最终包的动画走 **`source.kind: "frames"`（逐帧模式；6 个 animation 资源、61 帧）**：每帧是一次独立生图、一次独立 `importFrames`，**每帧各自裁自己的 ink 包围盒**，不是整段动画共用一个并集框。⇒ 任何会让 ink 包围盒漂移的噪声（JPEG 也是）都可能变成帧间轻微抖动。
- 这条管线对压缩噪声有两层“吸收”：大面积降采样会平均掉高频；量化会把所有颜色吸附回色板。**最终交付不可能出现色板外颜色**；JPEG 的风险不是“引入新色”，而是“把边缘/描边映射到相邻的另一个色板色”，以及背景众数色漂移导致抠底变化。
- 参考图是刚需：每帧通常内联 **风格参考图 + 母版**两张图。选模型时不能只看“能出图”，还要看多参考图保真。

---

## 2. 候选方案对比

成本按最终包同量级 **66 次生图调用（61 帧 + 2 sprite + 3 背景层）** 估；单张按 1K 输出、输出单价为主，输入 token 另加几分钱。

| 方案 | 模型 / 接口 | 单张输出成本 | 66 次量级 | 质量风险 | 施工量 | 停服风险 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A. Interactions + JPEG** | `gemini-nano-banana-2.1` | **$0.0336**（输入 $1.50/1M） | **≈ $2.4–2.5** | 模型换代 + JPEG 压缩；压缩本身温和，但逐帧裁框会受噪声影响 → 需同动画多帧 smoke | 中：`jpeg-js` + 解码分派 + 测试；0.5–1.5 人日，零付费 | 低：2026-10-06 GA，**无停服日期**；是 3.1-flash-image 的官方替换 | **主推** |
| A′. Interactions + JPEG | `gemini-3.1-flash-lite-image` | $0.0336（输入 $0.25/1M） | ≈ $2.3 | **官方明说“不为多参考图优化”**；本管线每帧两张参考图 | 同 A | 低：无停服日期 | 只做降本实验，不做默认 |
| B. 换 3.1-flash-image 要 PNG | `gemini-3.1-flash-image` + Interactions | $0.067（输入 $0.50/1M） | ≈ $4.5 | **拿不到 PNG**（见 §3.1）；且模型已于 2026-10-06 被弃用 | 同 A（仍要 JPEG 解码） | **已弃用**，无日期 | 不选 |
| C. 换 3-pro 要 PNG | `gemini-3-pro-image` + Interactions | $0.134（输入 $2.00/1M） | ≈ $9.2 | **拿不到 PNG**；成本 4×；像素风收益未经证实 | 同 A | 低：无停服日期 | 仅作 A 失败后的画质备选 |
| D. Vertex GenerateContent + PNG | 3.x / 2.5 on Vertex | 未核对（Vertex 另计价） | 未核对 | Vertex `ImageConfig.imageOutputOptions.mimeType` 存在，但**Gemini 3.x 是否兑现 PNG 未文档化** | 高：OAuth/ADC + 新端点/配置 + 测试；2–5 人日 + GCP 运维 | 与模型同；另加基础设施风险 | 条件备选，不做首选 |
| E. 冻结 2.5 产物 | 无上游 | $0 | **$0** | 零：现有 34 色 / 61 帧就是已验收产物 | 0 | **零**（产物在本地） | 近期默认姿态 |
| F. 继续 2.5 legacy | `gemini-2.5-flash-image` + `generateContent` | $0.039 | ≈ $2.6 | 零（就是当前包） | 0；每次脚本显式覆盖 | **高且日期矛盾**；访问可能受历史用户限制 | 只作临时旁路 |
| G. 其他 provider | OpenAI `gpt-image-2.5-*` | 约 $0.006（low，官方计算器示例）~ $0.05–0.21（medium/high，参照同价率 GPT Image 2 表）/1024² | 约 $0.4–$14 | **默认 PNG**、可透明；但官方承认角色跨图一致性会波动，风格参考语义未经本仓验证 | 中：适配器已存在，需改端点/模型 + 重做质量基线 | 低–中（当前在售） | 备选，不做首选 |

> 关于 DashScope：仓里有协议，但参考图要公网 URL、背景是渐变洋红，且实测抠底不可靠——不满足本管线“内联风格图 + 母版”的前提，**不作为候选**。

---

## 3. 每个方案的细节与证据

### 3.1 为什么“换模型要 PNG”在 Gemini Interactions 上不成立

**【文档】** 官方 v1beta discovery（revision `20261019`，2026-10-20 取）里，Interactions 的 `ImageResponseFormat.mimeType` 是：

```json
{
  "enum": ["MIME_TYPE_UNSPECIFIED", "IMAGE_JPEG"],
  "enumDescriptions": ["Default value. This value is unused.", "JPEG image format."]
}
```

同一个枚举在 v1 与 v1alpha 里**完全一样**；三者都没有 `IMAGE_PNG` 或 `image/png`。PNG 字样只出现在“输入媒体”的示例描述里，不在输出枚举里。

**【实测】** 本仓库两次 smoke 的 400 报文逐字相同：

> `The value 'image/png' is not supported for 'response_format.mime_type'. Supported values: 'image/jpeg'.`

- `gemini-3.1-flash-lite-image`：2026-10-19，`runs/2026-10-19c-smoke/`，1 发 400，未扣费。
- `gemini-nano-banana-2.1`：2026-10-19，`runs/2026-10-19d-smoke-m1/`，1 发 400，未扣费。

**【文档】文档自身也不一致**：官方 image-generation 页的同一个 `gemini-nano-banana-2.1` 示例里，Python 用 `image/jpeg`、JavaScript 用 `image/png`、Java / Go / REST 又用 `image/jpeg`，而文件都存成 `.png`。这不是“某台模型支持 PNG”的证据，只是示例没对齐。票 12 的 A2 和票 14 的 M1 都是被这些示例带偏的；**API schema 与两次 400 才是硬事实**。

因此：

- `gemini-3.1-flash-image` / `gemini-3-pro-image` 通过 Interactions **极大概率同样只接受 JPEG**（枚举是端点级的，不是模型级的）。花 1 发 smoke 去证伪并非不可能，但即使某台模型例外，也是未文档化的行为，不能作为长期基础。
- 唯一**已验证**的 Gemini PNG 路径仍是 2.5 的 legacy `generateContent`。3.1-lite 的 legacy `generateContent` 在票 10 真跑里返回过 200 + 非 PNG（当时未记录 MIME，随后在解码处失败）；legacy 的 `ImageConfig` 只有 `aspectRatio` / `imageSize`，**没有任何输出 MIME 入口**，所以这条路的格式只能听天由命。
- 一个未验证的缝隙：`response_format.mime_type` 留空（`MIME_TYPE_UNSPECIFIED`）时上游默认回什么，文档没写。不要把它当 PNG 方案；若日后 smoke 顺手验证，可以记录，但不应依赖。

### 3.2 成本细节（官方 list price，2026-10-20）

| 模型 | 输入（text/image） | 图片输出 | 1K 单张 | 来源 |
| --- | --- | --- | --- | --- |
| `gemini-2.5-flash-image` | $0.30 / 1M | $30 / 1M | **$0.039** | Pricing「2.5 Flash Image」 |
| `gemini-nano-banana-2.1` | $1.50 / 1M | $30 / 1M | **$0.0336** | Pricing「Nano Banana 2.1」 |
| `gemini-3.1-flash-lite-image` | $0.25 / 1M | $30 / 1M | **$0.0336** | Pricing「3.1 Flash Lite Image」 |
| `gemini-3.1-flash-image` | $0.50 / 1M | $60 / 1M | **$0.067** | Pricing「3.1 Flash Image」 |
| `gemini-3-pro-image` | $2.00 / 1M | $120 / 1M | **$0.134**（1K/2K） | Pricing「3 Pro Image」 |

- Batch 价都是 Standard 的一半左右（2.1：$15/1M 图 ≈ $0.0168/1K）；当前 runner 不是 batch，本文按 Standard。
- 单张输入还有提示词 + 两张参考图。2.1 的参考图 token 数没有在定价页逐项写死，按 1K–3K input tokens 估是 **$0.0015–$0.0045/张**，不影响量级判断；66 张的输入总额约 **$0.1–$0.3**。
- 本仓最近一次 6 帧真跑（2.5）实测 7 发 / 6 张成功 / ≈$0.20–0.23，与 $0.039×6 吻合。

### 3.3 模型选择：为什么是 2.1，而不是 3.1-flash / 3.1-lite / 3-pro

**【文档】官方 image-generation 的模型定位：**

- `gemini-nano-banana-2.1`（2026-10-06 GA）：**“primary high-efficiency workhorse”**，视觉质量、提示词遵循、多轮一致性、文本渲染都比上一代强；支持 1K/2K/4K 与全部需要的比例。
- `gemini-3.1-flash-image`：**上一代**；官方明确写 **“Recommended for all new projects to use Nano Banana 2.1”**，并在同日 changelog 里被标为 **deprecated（无停服日期）**。选它等于从一台将死的模型换到另一台已弃用的模型。
- `gemini-3.1-flash-lite-image`：最便宜，但官方写 **“Not optimized for multiple reference inputs or multi-turn sequential editing”**。本管线每帧要带风格图 + 母版两张参考，正好踩在它不擅长的点上；省下的输入费（每张约 $0.002）不值得拿母版保真去换。
- `gemini-3-pro-image`：画质/世界知识最强，但 $0.134/张是 2.1 的 4 倍；对“1px 描边、平涂色板”的像素风没有证据表明它比 2.1 更合适。留作 A 失败后的画质备选。

**没有一项文档能证明 2.1 画像素风比 2.5 好**——它只是“新一代 + 参考图能力更强 + 生命周期最长”。这必须靠 smoke 的肉眼判定，而不是文档。

### 3.4 JPEG 质量风险：本仓管线下的离线模拟（【模拟】）

方法：取最终包的真实 2.5 PNG 原图（4 帧，覆盖 864×1184 / 896×1152 / 1024×1024 / 1024×1024），用 Pillow 分别编码成 **q95 4:4:4 / q90 4:2:0 / q80 4:2:0** JPEG，再解回像素，送入**仓库真实的** `importFrames`（34 色、目标 48×64 / 48×48 / 48×56 / 24×24、容差 30、dropSpecks / dropBottomLines 与最终包一致），与原始 PNG 路径逐像素比较。

固定裁框（排除裁框漂移后，只测压缩本身）：

| 帧（目标） | q95 alpha 掩码差 | q90 alpha 掩码差 | q80 alpha 掩码差 | q90 颜色平均 L1 / 最大 L1 |
| --- | --- | --- | --- | --- |
| scavenger idle1（48×64） | 0 / 3072 | 1 / 3072 | 0 / 3072 | 2.3 / 17 |
| wasteland enemy patrol1（48×48） | 0 / 2304 | 4 / 2304 | 5 / 2304 | 2.4 / 25 |
| ceiling lurker hang1（48×56） | 1 / 2688 | 5 / 2688 | 5 / 2688 | 3.7 / 33 |
| scrap resource idle1（24×24） | 0 / 576 | 0 / 576 | 0 / 576 | 3.1 / 22 |

**但真实管线不固定裁框。** 最终包是逐帧模式（§1.3），每帧的 ink 包围盒独立计算；JPEG 噪声会让 1K 原图的包围盒漂移 **1–8 px**（相对 1000 px 级尺寸 < 1%）。不固定裁框、完全按真实路径重跑的结果：

| 帧（目标） | 包围盒漂移（x,y / w×h） | q95 alpha 掩码差 | q90 alpha 掩码差 | q90 颜色改变像素 / 平均 L1 |
| --- | --- | --- | --- | --- |
| scavenger idle1（48×64） | 0,0 0×1 → 0,0 2×6 | 0 / 3072 | 2 / 3072 | 62% / 2.3 |
| wasteland enemy patrol1（48×48） | 0,−8 0×8 → −2,−3 4×4 | 1 / 2304 | 4 / 2304 | 61% / 2.4 |
| ceiling lurker hang1（48×56） | −1,0 1×0 → 0,0 0×0 | 0 / 2688 | 13 / 2688 | 85% / 4.5 |
| scrap resource idle1（24×24） | −1,−1 1×2 → 0,0 −1×0 | **37 / 576（6.4%）** | **39 / 576（6.8%）** | 99% / 32.7 |

这张表说明：

- 压缩本身（固定裁框）很温和；**逐帧模式下真正的 JPEG 风险是包围盒抖动** —— 1K 上 1–8 px 的漂移在最终 48 px 帧上造成亚像素级的缩放/位移，表现为轮廓边缘在相邻帧之间轻微“呼吸”。
- 小道具（24×24）最敏感：包围盒变动 1 px 就能让 6% 的 alpha 像素和几乎全部颜色索引变化；不过这类资源的画布小、肉眼容差也大，且 v7 里的 `scrap-resource` 是 4 帧动画，抖动是否可见要看联系表。
- 这不是“1px 描边被抹掉”，而是“描边落点在帧间漂移”。**付费 smoke 必须至少覆盖同一动画的 2 帧**，否则单帧看不出抖动。

解释与边界：

- **1px 描边没有被压缩抹掉**：固定裁框时 alpha 轮廓在最终分辨率上基本不变（0–0.2% 像素），因为上游 1px 描边在 1K 里约有 20 px 宽，且管线做了约 19× 面积平均；逐帧模式的抖动见上一张表。
- **颜色变化几乎都在相邻色板色之间**：量化保证最终仍是 34 色；平均 L1 在 q90 下约 2–4，属于肉眼很难单独挑出的偏移。真正的风险是边缘附近个别像素映射到更亮/更暗的相邻色，形成轻微“毛边”，需要看联系表确认。
- **这张表只测压缩，不测换模型**。2.1 的笔触、背景平涂程度、对提示词的遵循度都与 2.5 不同；那部分的差异可能远大于 JPEG。
- **Pillow 的编码器不等于 Gemini 的编码器**：真实 API 的 quality / subsampling 未公开。q80 4:2:0 可视为悲观下界；q95 4:4:4 是乐观上界。付费 smoke 必须记录真实 MIME 并把图跑完整条管线。

### 3.5 施工量：JPEG 路线要动什么

零付费施工面（预估 **0.5–1.5 人日**）：

- `packages/assets/package.json` + `pnpm-lock.yaml`：加 `jpeg-js@0.4.4`（运行时）与 `@types/jpeg-js@0.3.7`（dev）。
  - `jpeg-js`：纯 JS、零依赖、BSD-3、约 76 KB、最后一次发布 2022-10-31；仓库未归档，2025-10 仍有提交。CVE-2022-25851（无限循环）在 **0.4.4 已修**；CVE-2020-8175 在 0.4.0 已修。decode 自带 `maxResolutionInMP` / `maxMemoryUsageInMB` 上限。
  - **不需要改 `scripts/check-deps.mjs`**：那张表只管兄弟包之间的边，外部 npm 依赖由 pnpm 管。票 12 说的“依赖 allowlist”是误解。
- 新增 `packages/assets/src/jpeg.ts`（或并入 `png.ts`）：`jpeg.decode` → RGBA `RasterImage`；校验宽高；JPEG 无 alpha，alpha 恒 255。
- `packages/assets/src/image-gen.ts`：
  - Interactions 请求：`response_format.mime_type` 从 `image/png` 改成 `image/jpeg`；
  - `imageFromInteraction`：按 `mime_type` 分派（JPEG / PNG 兼容，其它明确失败）；无 mime 时按文件签名嗅探；
  - 格式错误不重试；legacy 路径继续只认 PNG。
- `packages/assets/tests/image-gen.test.ts`：请求体断言改为 `image/jpeg`；新增离线 JPEG fixture（可用现有 PNG 本地转码生成，不付费）；新增“JPEG 能解码 / WebP 明确失败 / 无 mime 嗅探 / 格式错不重试”用例。现有“非 PNG 就失败”的用例改写成“非 JPEG/PNG 才失败”。
- `packages/pipeline/tests/upstream.ts`、`packages/cli/tests/cli-create.test.ts`、`packages/mcp/tests/create-game-no-digest.test.ts`：假上游目前都回 PNG。适配器若同时接受 PNG，这些测试可以不动；但建议至少加一条“Interactions 回 JPEG”的桩，避免只测兼容路径。
- 打包无额外工作：CLI / MCP 用 esbuild `--bundle`，`jpeg-js` 会被打进 `dist/cli.mjs` / `dist/server.mjs`。
- **可选加固（若 smoke 看到帧间抖动）**：给逐帧模式加一个**动画级共享裁框**。`ImportOptions.trimBox` 已经存在，但 `pack.ts` 目前没有暴露它；做法是为同一动画的帧先算一个并集/中位包围盒，再逐帧传同一个 `trimBox`。这能同时消掉 JPEG 噪声与 2.5 逐帧绘制带来的缩放抖动，但属于另一张施工票，不塞进 JPEG 解码票。

**不在零付费施工里做**：改 `game-maker.local.json`、换默认模型、付费验证、替换 model-paint fixtures。

### 3.6 冻结 2.5 产物：能做什么、不能做什么

**【实测】** 本图最近三张票已经证明了零上游后处理的能力：

- [02 lurker](../issues/02-lurker-pose-semantics.md)：4 张被拒的付费帧用**原 raw 180° 旋转**补足，包 v7 只差 6 帧。
- [03 ground-line](../issues/03-ground-line-cleanup.md)：61 张 raw 里 30 张的地面线用零付费后处理清掉。
- [06 olive palette](../issues/06-olive-palette-curation.md)：34 色策展 + 零付费重建，玩家 18.95% 像素变橄榄而背囊不变。

⇒ **只要不新增“画面上没有的姿势 / 资源 / 帧”，冻结足够把现有包修到可交付。**
⇒ 一旦需要新角色、新动作、新道具，冻结就无解；这正是本次路线调研存在的原因。

### 3.7 继续 2.5 legacy 的停服风险（具体会怎么坏）

- 端点消失（404/403）时：当前 runner 会在第一次图片调用失败，包不会生成；健康模式下不会静默产出坏包。
- 访问被收紧（只对历史用户开放）时：本机老 key 可能还能用，新环境 / CI 不一定；`models.list` 仍可能列出模型但不能生成——**列表可见 ≠ 有权调用**。
- 如果只把请求改成 JPEG、却没先加解码器：会拿到 HTTP 200 并**计费**，然后在本地因“要求 image/png”抛错；这是最坏的花钱方式。施工顺序必须是**先解码器、后改请求**（同一提交内完成也可）。

### 3.8 其他 provider（备选，不主推）

**OpenAI `gpt-image-2.5-sunburst` / `flare`**【文档】：

- 默认输出就是 **PNG**，也可选 JPEG / WebP；支持透明背景（`background: "transparent"` + PNG/WebP）。
- 价格：图片输出 **$30/1M tokens**；图片输入 $8/1M；文本输入 $5/1M。官方计算器示例 low 档约 **$0.00588/张**；同价率的 GPT Image 2 表在 1024² 下是 low $0.006 / medium $0.053 / high $0.211。像素风若要高保真，按 medium–high 估，66 张约 **$3.5–$14**。
- 官方自己列的局限包括：**“may occasionally struggle to maintain visual consistency for recurring characters”**——这正好是本管线的核心诉求（同一角色跨 61 帧）。
- 本仓 `openai` 协议已存在（generations + edits），但当前指向中转 `gpt-image-2.5`；改官方端点、质量档位、参考图语义与负向提示词都需要重新验证。**PNG 是它的优势，跨帧一致性是它的已知弱点。**

**DashScope**：协议已有，但参考图必须公网 URL（本机文件传不进去）、背景是渐变洋红，票 35 之前已判不可靠；不适合本管线。

---

## 4. 推荐路线与前置条件

### 4.1 路线

1. **现在（零付费）**：冻结 2.5 产物；未获批的新跑批一律不动。已有包继续做本地后处理 / 站点集成。
2. **下一步（零付费施工，另立票）**：按 §3.5 加 JPEG 解码与 Interactions JPEG 请求，**先不改配置默认值**。完成标准：离线 JPEG fixture、非 JPEG/PNG 明确失败、全量测试全绿。
3. **付费 smoke（另立票 + 逐字批准）**：`gemini-nano-banana-2.1` · Interactions · JPEG · **同一动画的 2 帧**（例如 idle1 / idle2），预算 ≤4 发 / ≤$0.16 / ≤15 分钟；把两张都送完整管线，和同提示词的 2.5 PNG 逐帧 + 联系表对比，重点看轮廓是否抖、背景众数色是否稳定。
4. **fixture 重基线（付费，另立票）**：smoke 通过后再做。16 张（5 + 5 + 6）按新模型重量，更新 `fixtures/model-paint*/README.md` 的读数与断言；不要放宽断言来“兼容”新模型。
5. **若 smoke 看到帧间抖动（可选，另立票）**：先做逐帧模式的动画级共享裁框（§3.5 的可选加固），再决定是否接受 JPEG；不要把“抖动”留给肉眼在最终站点里发现。
6. **切默认（人工改配置）**：smoke + fixture 都通过后，再改 `game-maker.local.json` 的 `image.model` 与可用代理（当前 9098 没在监听，实际跑批用 7890）。然后才允许完整包付费跑（66 次 ≈ $2.4–2.5）。

### 4.2 为什么不是立刻切

- 不能只换模型：请求仍是 `image/png`，会 400（§3.1）。
- 不能先改请求：没有解码器会把计费成功的图丢掉（§3.7）。
- 不能拿旧 fixtures 验新模型：`model-paint*` 的 16 张 fixture 明确写着上游是 `gemini-2.5-flash-image`，颜色是 2.5 交付的；换模型后继续跑它们，只会得到“旧模型曾经交付的颜色”这一过时保证。

### 4.3 需要人裁的点

1. **是否接受 JPEG 作为未来上游格式**（在不切 Vertex / 不换 provider 的前提下，这是唯一可走的路）。
2. **长期默认模型是否定为 `gemini-nano-banana-2.1`**（而不是更便宜的 3.1-lite 或更贵的 3-pro）。
3. **是否批准零付费施工票**（加 `jpeg-js` + 改请求 + 测试）。
4. **是否批准同动画 2 帧的 smoke 预算**（≈$0.08–$0.16；按仓库纪律必须逐字批准）。
5. **2.5 的内部截止日**：官方日期互相矛盾，建议内部按 **2026-12-31** 停止依赖 2.5 跑新批次（给 2027-03-15 留缓冲），但这只是建议，需人定。
6. **若 smoke 看到帧间抖动，是否追加“动画级共享裁框”施工票**（`ImportOptions.trimBox` 已有，`pack.ts` 未暴露）。
7. **fixture 重基线的方式**：替换现有 16 张，还是保留 2.5 旧集并新增一套 2.1 集。按现有 README 的纪律，**替换**更一致。

---

## 5. 未决 / 不确定项

- **Interactions 真实 JPEG 编码参数未知**：quality、4:2:0 还是 4:4:4、是否 progressive。本文模拟覆盖了悲观/乐观两端，但只有付费 smoke 能测到真实字节。
- **`mime_type` 留空时的默认输出格式未知**：文档未写；不要作为 PNG 方案。
- **`gemini-3.1-flash-image` / `3-pro-image` 走 Interactions 是否也 400**：未逐台实测；API schema 说是端点级 JPEG-only，【推断】同样会拒绝 PNG。若要彻底证实，3-pro 一发 smoke 约 $0.134。
- **Vertex 的 Gemini 3.x 是否兑现 `imageOutputOptions.mimeType: "image/png"`**：API 有字段，Imagen 文档列了 PNG/JPEG，但 Gemini 3.x 的 Vertex 模型页没有明确写输出 MIME；需要 GCP 项目 + 免费/付费探针，本报告未验证。
- **2.5 的最终停服日**：Deprecations 说 2027-03-15，Pricing 说 2026-10-02（已过期未停），Changelog 说“未弃用、另行通知”。无法从官方文档得到一个可信日期。
- **2.5 的“历史用户限制”对现有 key 的长期影响**：今天可用，明天是否仍可用没有保证；该限制是否覆盖图模也没有逐模型文档。
- **2.1 对像素风 / 1px 描边 / 平涂背景的实际交付质量**：没有任何一手文档能回答，必须 smoke + 联系表人眼判定。
- **OpenAI 路线的跨帧一致性**：官方已承认会波动；未在本仓验证。
- **逐帧裁框抖动**：本报告只做了 4 帧离线模拟；真实 JPEG 编码器的噪声会让包围盒漂移多少、是否在 61 帧动画里可见，必须用同动画多帧 smoke 验证。
- **成本里的输入 token**：2.1 的参考图 token 数未逐项文档化；本文只给量级。

---

## 6. 来源清单（全部于 2026-10-20 访问）

| 来源 | 用途 |
| --- | --- |
| <https://ai.google.dev/gemini-api/docs/deprecations> | 2.5-flash-image 停服日期 2027-03-15、3.1-flash-image 已弃用、2.1 无停服日期 |
| <https://ai.google.dev/gemini-api/docs/pricing> | 2.5 的 2026-10-02 停服警告；五台模型的输入/输出单价 |
| <https://ai.google.dev/gemini-api/docs/image-generation> | 模型定位（2.1 / 3.1-flash / 3.1-lite / 3-pro / 2.5）；PNG/JPEG 示例不一致；多参考图能力 |
| <https://ai.google.dev/gemini-api/docs/models> | 模型 ID、2.5 访问限制提示、生成媒体模型列表 |
| <https://ai.google.dev/gemini-api/docs/changelog> | 2026-10-06 2.1 GA + 3.1-flash 弃用；2026-09-18 2.5 访问限制 |
| <https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta> | `ImageResponseFormat.mimeType` 只有 JPEG；revision 20261019 |
| <https://generativelanguage.googleapis.com/$discovery/rest?version=v1alpha> | 同上，排除“只是 v1beta 漏了 PNG” |
| <https://generativelanguage.googleapis.com/$discovery/rest?version=v1> | 同上 |
| <https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-flash-image> | Vertex 3.1 支持 GenerateContent、Interactions 预览不支持、输入 MIME 列表 |
| <https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images> | Imagen `outputOptions.mimeType` 支持 image/png、image/jpeg |
| <https://docs.cloud.google.com/dotnet/docs/reference/Google.Cloud.AIPlatform.V1/latest/Google.Cloud.AIPlatform.V1.ImageConfig.Types.ImageOutputOptions> | Vertex `imageConfig.imageOutputOptions.mimeType` / `compressionQuality` 字段 |
| <https://developers.openai.com/api/docs/guides/image-generation> | GPT Image 2.5 模型、默认 PNG、jpeg/webp、透明背景、角色一致性局限 |
| <https://developers.openai.com/api/docs/pricing> | 图片输出 $30/1M、图片输入 $8/1M、文本输入 $5/1M |
| <https://registry.npmjs.org/jpeg-js> / <https://www.npmjs.com/package/jpeg-js> | jpeg-js 0.4.4、BSD-3、零依赖、最后发布 2022-10-31 |
| <https://registry.npmjs.org/@types/jpeg-js> | @types/jpeg-js 0.3.7 |
| <https://github.com/jpeg-js/jpeg-js> | 仓库未归档、2025-10 仍有提交；README 的 decode 选项与内存上限 |
| <https://api.osv.dev/v1/query>（jpeg-js） | CVE-2022-25851 在 0.4.4 修复；CVE-2020-8175 在 0.4.0 修复 |

仓库内证据：

| 文件 | 用途 |
| --- | --- |
| `packages/assets/src/image-gen.ts` | `auto` 选路、legacy PNG-only、Interactions `image/png` 请求、非 PNG 抛错 |
| `packages/assets/src/image-config.ts` | 配置字段只有 protocol/baseUrl/apiKey/model/proxy |
| `packages/assets/src/prompt.ts` | “1 像素深色描边”与 `keyColorFor` 的硬要求 |
| `packages/assets/src/import.ts` / `quantize.ts` | 抠底 → 面积降采样 → 二值化 → 最近邻量化的真实实现 |
| `packages/assets/tests/image-gen.test.ts` | Interactions/legacy 请求体、非 PNG 失败、auto 选路的现有断言 |
| `packages/pipeline/tests/upstream.ts`、`packages/cli/tests/cli-create.test.ts`、`packages/mcp/tests/create-game-no-digest.test.ts` | 假上游目前都回 PNG |
| `fixtures/model-paint/README.md`、`fixtures/model-paint-layers/README.md`、`fixtures/model-paint-despill/README.md` | 16 张 2.5 交付色 fixture；换模型必须重量、换掉，而不是放宽断言 |
| `.scratch/style-migration-v1/report-10-smoke-failure-2026-10-19.md` | 3.1-lite 的 400 原文与日志 |
| `.scratch/style-migration-v1/report-10-smoke-m1-failure-2026-10-19.md` | nano-banana-2.1 的 400 原文与日志 |
| `.scratch/style-migration-v1/report-10-failure-2026-10-19.md` | 3.1-lite legacy `generateContent` 返回 200 + 非 PNG（未记录具体 MIME） |
| `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/lurker-report.md` / `budget-report.md` / `generate-result.json` | 2026-10-20 2.5 仍可用；6 帧 ≈$0.20–0.23 |
| `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/` | 34 色 / 61 帧 / 19 资源的最终包与 raw 尺寸 |

---

## 7. 方法与边界声明

- **没有发任何生图 / 文本请求**；没有调用 3.1 / 2.1 / 3-pro 的生成端点。
- 只做了两类免费上游动作：官方 discovery 文档下载；带现有 key 的 `models.list`（元数据，不计费）。
- 离线 JPEG 模拟只写在 `/tmp/jpegsim/`，未改仓库源码 / fixtures / 配置；模拟用的是 Pillow 编码器，不是 Gemini 的编码器，结论只用于判断“压缩本身有多伤”，不能替代付费 smoke。
