# 15. 用参考图真跑一次 StyleSpec 提取，并固化为 fixture

Type: task
Status: open
Blocked by: 04, 01
Map: ../map.md

> 🔴 **升为关键路径**（2026-09-24，[票 34](34-wan-quota-facts.md)）：
> 「参考图 → StyleSpec」的自动路径已不可用（配额 + 条款），
> 所以本票产出的 fixture StyleSpec **现在不是兜底，是唯一可用的 StyleSpec**。
> 建议扩展本票产出：不只固化成 fixture，还要把**「人在会话里交互式提取 StyleSpec」
> 的操作流程**写下来（用哪张图、prompt 长什么样、产物存哪）—— 那是合法路径，
> 且它是产物 A 在「参考图」这一侧的入口。

> 本票未改范围，仅改地位（2026-09-24，R6）：产出的 fixture **同时是**降级兜底与
> **新资源风格一致的参考基准**（Destination 验收第 2 条靠它比对）。

## Question

这是第一张**真的把 AI 接进来**的票：拿票 04 造的参考图，
按票 01 查清的调用契约打 `deepseek-v4-pro`，产出一份真实的 `StyleSpec`，
Zod 校验通过后固化成 `demo/projects/<id>/fixtures/style-spec.json`。

阻塞在票 04（要有图）和票 01（要知道怎么调）。

要做的：

1. **写 prompt**：让模型从图里提取文档第 12 节列的 12 个维度
   （Camera / Composition / Perspective / Palette / Lighting / Shape /
   Material / Texture / Environment / Character / UI / Rendering），
   输出严格符合 `StyleSpecSchema`（`demo/src/contracts/index.ts`）的 JSON。
   核心原则（文档第 11 节）：**不复制图片，而是提取视觉语法。**
2. **跑通调用**：按票 01 的结论发真实请求，处理图片编码
   （票 01 第 3 条会说明 base64 还是 URL、能传几张）。
3. **Zod 校验**：`StyleSpecSchema.parse()`。
   **校验失败率是多少**？跑 5 次看稳定性 —— 
   如果 5 次里有 2 次校验不过，那票 09 第 7 条（schema 严格度）
   和票 14 第 5 条（fixture 策略）的权重就完全不一样了。
4. **质量评估**：产出的 StyleSpec 是否**真的**抓住了图的风格？
   特别是 `palette`（颜色名是 `"warm green"` 这种词还是 hex？
   契约里是 `z.array(z.string())`，两种都合法 —— 但票 12 的
   静态色板校验需要 hex，**这个不一致必须在本票暴露**）。
   `shapeLanguage` / `material` 是不是空洞的套话？
   `confidence` 是模型自己报的还是算出来的？能信吗？
5. **多图输入的语义**：Q1 说「一张**或者多张**图片」。
   票 04 第 2 条会问要不要支持多图。如果支持，多图下 StyleSpec 是
   取交集（更保守、更一致）还是并集（更丰富、可能自相矛盾）？
   本票用真实调用验证一下两种 prompt 的差异。
6. **固化 fixture**：把通过校验的结果写进 `fixtures/`，
   连同**产出它的那张图的引用、prompt 全文、模型名、时间戳**一起存档
   —— 否则以后没人知道这份 fixture 是怎么来的，也没法重新生成。
7. **反例验证**：如果票 04 造了赛博朋克反例图，用它再跑一次，
   确认 StyleSpec **真的不一样**（防止 prompt 里写死了 cozy 风格、
   导致模型不管看到什么都返回农场风格）。

产出：`fixtures/style-spec.json` + prompt 全文 + 5 次运行的稳定性数据 +
一份「哪些维度提取得好、哪些是套话」的诚实评估。
**如果结论是「这个模型提取不出可用的 StyleSpec」，那是对整条路线的重大否定，
必须直接说出来，不要粉饰。**

## Answer

_（待填）_

---

## 来自票 01 的更新（2026-09-23）—— 调用方式已确定，不用再摸索

票 01 已把调用契约全部实测清楚，本票**直接照做即可**：

### 必须这样调

- **端点**：`POST {ANTHROPIC_BASE_URL}/v1/messages`（Anthropic Messages 协议）
  **⚠️ 不能用 `/v1/chat/completions`** —— 那条路的上游是 DeepSeek，
  它收到的是 `[Unsupported Image]` 占位符，**看不到图**。
- **model 字段**：写什么都行，**一律路由到 qwen3.8-max**。
  建议仍写 `deepseek-v4-pro` 以保持与其他调用点一致，但**要知道它不是真的 DeepSeek**。
- **鉴权**：`x-api-key: $ANTHROPIC_AUTH_TOKEN`。代理其实不校验，但仍应发送。
- **图片格式**：
  `{type:"image", source:{type:"base64", media_type:"image/png", data:<b64>}}`
  放在 content 数组的**文本之前**。多图直接并列多个 image 块（已验证 2-3 张可用）。
- **⚠️ 不要用 `tool_choice` 强制 JSON** —— 完整 12 字段 schema 下只有 **1/3** 通过。
  **改用纯文本 JSON**：在 prompt 里描述结构，要求「只输出 JSON 本体、不要围栏」，
  实测 **3/3 通过、零围栏**。
- **`max_tokens ≥ 3000`**：实测输出 2208-2842 token（其中约 80% 是推理 token）。
  给 1500 会被推理吃光、正文截断。
- **超时 ≥ 180 s**：实测 47-63 s，最坏一次 136 s。
- **解析**：`JSON.parse` → `StyleSpecSchema.parse()`。虽然实测 3/3 干净，
  仍应保留剥围栏的兜底逻辑。

### 第 4 条已有答案：palette 是 hex，且**会被补全**

- ✅ 模型确实返回 `#RRGGBB` hex（不是 "warm green" 这种颜色词）——
  票 12 的静态色板校验**可行**。
- ⚠️ 但**会多返回图中不存在的颜色**：4 色图返回了 5-6 色
  （多出的 `#ECF0F1`、`#2C3E50` 是幻觉）。
  真实存在的 4 个颜色 **hex 精确命中**。
  → 本票第 4 条要**专门记录这个现象**，并评估要不要在 fixture 里
  人工剔除幻觉色（还是原样固化、把剔除留给票 12 的反向校验）。
- ⚠️ `confidence` 自报 0.9-0.92，**在含幻觉色板时同样报 0.92** → 不可用作可信度判据。

### 第 3 条（稳定性）已有初步数据

纯文本 JSON 路线 **3/3** 通过 schema 校验。
本票要跑 5 次做正式确认，但**预期是稳定的** —— 票 01 的 9 次调用
（3 次 StyleSpec + 6 次 GameSpec）零解析失败。

### 第 7 条（反例验证）现在更重要了

票 01 用的是一张**抽象的四象限色块图**，模型仍然报出了
`identity: ["cozy"...]` 之类的风格词吗？—— 没有，它报的是
`shapeLanguage: ["square","right-angle hard edge","equal partition",...]`，
**准确描述了实际几何**。这说明模型**没有**被 prompt 里的 "cozy" 引导跑偏。
但本票仍需用真实的农场风格图和赛博朋克反例图各跑一次做正式确认。


---

## 来自 2026-09-23 实验的配方修正

票 22 的实验在真实参考图（`demo/test.png`，1218×685）上跑通了 StyleSpec 提取，
质量**远超**四象限测试图：`shapeLanguage` 与 `constraints` 都给出了可执行内容，
且**没有色板补全幻觉**（prompt 里显式要求「只列真实存在的颜色」有效）。

两处配方修正：

1. **视觉路径目前 thinking 是开着的，花 61s。**
   DeepSeek 文本路径已确认 `thinking:{"type":"disabled"}` 能快 18 倍。
   **qwen 视觉路径是否有同开关未测** —— 测一下，可能把 61s 砍到 10s 内。
   （归票 22 问题 5，但本票跑 5 次稳定性测试前应该先知道答案，
   否则 5 次 × 61s = 5 分钟纯等待。）
2. **prompt 里加「只列真实存在的颜色，不要补全猜测色」可消除色板补全幻觉。**
   票 01 在四象限图上观察到的幻觉，在真实图 + 这句约束下**没有出现**。
   本票的 prompt 应带上这句，并把「有无幻觉」作为正式记录项
   （若仍出现，则票 12 的反向校验才需要复活）。
