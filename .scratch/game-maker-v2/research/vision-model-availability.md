# 这个仓库今天有哪些模型能看图？

> 票 24 的产出。**只读本地**（配置、代码、文档、`.scratch/` 里的实测记录），**未发任何网络请求**。
> 票 25 负责真发一次。

## 结论

**有一条路能，而且它已经跑通过 —— 是「文本上游」，不是四套生图协议。**

具体是：`${ANTHROPIC_BASE_URL}/v1/messages`，用 Anthropic 形状的
`{type:"image", source:{type:"base64", media_type:"image/png", data:<b64>}}` 内容块，
请求模型 id `deepseek-v4-pro`、`thinking: disabled`，回应从 `content[].text` 取文字。
**仓里已经有这条路的实现**：`packages/assets/src/review.ts` 的 `reviewPack()`
（`review.ts:93` 是图片块、`:111` 是端点、`:113` 是鉴权头）—— 它不是新东西，是票 22 就落地的。

**而且它被真量过，不是推测**：`.scratch/` 里躺着原始记录 ——
`runs.nothink-5x.json` 5 次全 `http=200`、2.6–3.1 s；`runs.thinking-3x.json` 3 次全 200；
`reference-image-draft/out/extractions.json` 三张图各一次、**`schemaOk: true` 3/3**
（即回的是能过 `StyleSpec` schema 的**结构化 JSON**，不是自由文本）；
`real-generation/README.md:51-61` 记着 `reviewPack()` 真跑出来的观察条目。
⇒ 「图 → 结构化文本」这件事在本仓库**是既成事实**，不是待验证的假设。

**四条生图协议一条都不行，且这不是「暂时不行」而是「形状上就不是那件事」**：
`openai` / `minimax` / `dashscope-mcp` / `gemini` 全都是**出图**调用
（`image-gen.ts` 的三个解析器 —— `imageFromGemini:286-293`、`imageFromOpenAI:420-430`、
`urlFrom:141-153` —— **唯一的成功条件是"回了一个图"，回文字一律当错**）。
Gemini 的 `inline_data` 与 OpenAI 的 `/images/edits` 是**出图调用的输入侧**（图进图出），
不是读图；DashScope 的 MCP 工具连输入图都收不下（`image-gen.ts:163` 只解构出 `prompt/size/negativePrompt`）；
`minimax` 的客户端根本没写（`ops.ts:683-684` 直接抛）。**所以票 08 不要去接 `image-gen.ts` 那套。**

**但有一条必须一起记住的限定**：这套「能看图」的实测**最新一笔是 2026-09-25**，
而代理的上游配置一直在变（两张图自己都警告过：`game-creation-v1/map.md:217-218`、
`game-maker-v2/map.md:87-89`）—— **今天（2026-10-01）是否仍然成立，本地证据答不了，归票 25。**

## 证据

### A. 配置里有什么

- `game-maker.local.json:5-11` —— **生效的只有 `image` 这一段**：`protocol: "gemini"`、
  `baseUrl: https://generativelanguage.googleapis.com/v1beta`、`model: "gemini-2.5-flash-image"`、
  `proxy: http://127.0.0.1:9098`，`apiKey` 有值（此处不抄）。
- `game-maker.local.json:12-38` —— `_openai` / `_minimax` / `_dashscope-mcp` / `_gemini` **四段全是死的**
  （前缀下划线）。依据是 `image-config.ts:73` 只读 `doc.image`，其余键从不解析。
  其中 `_openai.baseUrl` 指向一个中转 `https://api-slb.krill-code.net/codex/v1`、`model: gpt-image-2.5`。
- `game-maker.local.example.json:5-11` —— 示例文件生效段是 `openai` + `gpt-image-2.5`（与真文件不同）。
- 示例文件的**注释键**说的是（两相对照用）：
  - `:4 _shape`「protocol 必填，**三选一**」—— ⚠️ 与实际四个协议对不上，示例文件自己的措辞有误。
  - `:3 _优先级`「环境变量 `GAME_MAKER_IMAGE_*` 优先于本文件」。
  - `:23 _proxy`「OpenAI 在境内直连不通、且 Node 原生 fetch 不认 `HTTPS_PROXY`，所以这一项对 openai 协议是必需的」。
  - `:25 _gemini._baseUrl`「Google AI Studio 是 `…/v1beta`；走中转就填中转的地址」。
  - `:21 _dashscope-mcp.apiKey`「必须是**按量付费**的 sk-，不是 Token Plan 的 sk-sp-」。
- ⚠️ **配置文件里根本没有文本上游的键**。文本上游只走环境变量
  （`packages/cli/src/cli.ts:77-78` 是**全仓唯一**读 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 的地方）。

### B. `resolveImageTransport` —— 逐字段都是生图，没有一处是视觉理解

- `image-config.ts:1` 文件头第一句：「**生图上游**的凭据」。
- `image-config.ts:20-25` `IMAGE_ENV` = `GAME_MAKER_IMAGE_{PROTOCOL,BASE_URL,API_KEY,MODEL}`。
- `image-config.ts:32` `IMAGE_PROTOCOLS = ["openai","minimax","dashscope-mcp","gemini"]` —— 四个都是生图协议。
- `image-config.ts:47` `model` 字段的注释：「**生图模型名**。不给则由客户端按上游填默认值」。
- `image-config.ts:102` 函数注释：「解析**生图上游**。没有就是没有」。
- `image-config.ts:143` `describeImageTransport()` 未配置时的返回值：「**生图上游：未配置**」。
- `image-config.ts:153-157` `imageEndpointOf()` —— `Bearer` 头 + JSON，是生图形态。
- `image-config.ts:10-13` 它读的全是 `{env, cwd}`，环境变量表就是上面那四个，**没有第五个**。

⇒ **`resolveImageTransport` 里没有一个字段、一条注释、一个默认值是为「图进文字出」服务的。**
票 08 若把视觉步接到它的产物上是接错了。

### C. `image-gen.ts` 的三个协议 —— 全是「出图」，明确回答

| 协议 | 输入图收得下吗 | 以什么形式 | 这个调用是「出图」还是「看图」 |
|---|---|---|---|
| `gemini` | ✅ 收 | `inline_data` base64 内联（`:312`） | **出图** |
| `openai` | ✅ 收 | `/images/edits` multipart `image[]`（`:471,:474`） | **出图** |
| `dashscope-mcp` | ❌ 连参数都没有 | —（`:163` 只解构 `prompt/size/negativePrompt`） | **出图** |
| `minimax` | 未实现 | —（`ops.ts:683-684` 抛） | — |

**Gemini —— 线索核实结果（`:299-312` 属实，但性质是"出图"）**：

- `:299` 解构 `{ prompt, size, negativePrompt, reference, styleReference }` —— 确实收两张输入图。
- `:302` URL = `${baseUrl}/models/${model}:generateContent`。
- `:309` `parts` 以一个 **text** 块起头。
- `:311-312` 把 `styleReference` / `reference` 作为 `{ inline_data: { mime_type:"image/png", data:<b64> } }` 推入 `parts`。**线索属实。**
- 🔴 `:315` `generationConfig: { responseModalities: ["IMAGE"], … }` —— **要求上游回图**。
- 🔴 `:286-293` `imageFromGemini()` **只**从回应里找 `inlineData.data`，找不到就 `throw "回应里没有图"`。
- `:297` 默认模型 `gemini-2.5-flash-image`（与 `game-maker.local.json:9` 一致）—— **这是个生图模型**。

⇒ **Gemini 这条路是 `文字 + 图 → 图`。它把「模型回了文字」当成错误。**
`inline_data` 是**出图调用的输入**，不是读图。**线索是真的，但推不出"Gemini 能看图"。**

**OpenAI —— 线索核实结果（`:460,469-474` 属实，同样是"出图"）**：

- `:466-468` 注释自己写死了这条：「有输入图就走 `/images/edits`：`/images/generations` 是纯文本端点，收不下图」。
- `:469` `inputs = [styleReference, reference].filter(...)`；`:471` `inputs.length > 0 ? /images/edits : /images/generations`。
- `:474` multipart 字段 `model / prompt / n / size` + `image[]`（字段名带方括号，`:448`）。
- 🔴 `:420-430` `imageFromOpenAI()` **只**认 `data[0].b64_json`；回了 `url` 或没有 b64 一律抛。
- `:364-366` 的注释把 `images/edits` 定性为「**要输入图时走这条**」，回应形状与 `generations` **完全一样**（都是 b64 图）。

⇒ **`/images/edits` 是"图生图"，不是"图生文"。** 线索属实，结论同样推翻。

**DashScope**：`recipe.ts:62-63` 与 `image-gen.ts:58` 都记着「`image_edit` 要**公网 URL**，本机文件传不进去」。
但更硬的一条是 `image-gen.ts:163` —— 客户端**连 `reference` 都没接**，
`:179-191` 的 `tools/call` 参数只有 `prompt / size / negative_prompt / prompt_extend`。
⇒ 于它而言不是"要不要公网 URL"的问题，是**根本没有输入图这个参数**。

### D. 文本那条路本身有没有图像能力？**没有**

- `ops.ts:152` 签名：`callText(opts: Transport & { prompt: string; … })` —— 只有字符串。
- `ops.ts:170` `${baseUrl}/v1/messages`；`:173` `x-api-key` + `anthropic-version: 2023-06-01`。
- `ops.ts:174` body：`{ model:"deepseek-v4-pro", max_tokens:32_000, thinking:{type:"disabled"},
  messages:[{role:"user", content: opts.prompt}] }` —— **`content` 是纯字符串**，装不下内容块数组。
- 三个调用方都走这一条：`ops.ts:110`（derive）、`:347`（compile-game）、`:586`（compile-td-game）。
- `generate.ts:116-126` 同样的形状，`:124` 也是 `content: prompt`。

⇒ **`derive` / `compile-*` / drawlist 生成，一条都传不了图。**
**但同一条上游、同一个端点、同一把 key 换个体就能** —— 见下。

### E. 真正能看图的那条路：`review.ts`

- `review.ts:1` 文件头：「让**视觉模型**只说差异、不判分」。
- `review.ts:59` 注释（**票 22 的实测结论**）：「视觉端点的路径。默认 `/v1/messages`
  （**票 22 实测：那条路仍然能收图**）」。
- `review.ts:87` `model: opts.model ?? "deepseek-v4-pro"` —— **与文本路同一个模型 id**。
- `review.ts:93` `{ type: "image", source: { type: "base64", media_type: "image/png", data: encodePNG(sheet).toString("base64") } }` —— **图片块在文本块之前**。
- `review.ts:111` `${opts.baseUrl}${opts.endpoint ?? "/v1/messages"}`。
- `review.ts:113` `{ "content-type":"application/json", "x-api-key": opts.apiKey, "anthropic-version":"2023-06-01" }`。
- `review.ts:118` 从 `j.content` 里 filter `type === "text"` 拼出文字 —— **文字出**。
- `review.ts:89` `thinking: { type: "disabled" }`（与文本路一致）。
- 出口：`packages/assets/src/index.ts:23` `export * from "./review.js"`。
- ⚠️ **但它没有接进任何入口**：`cli.ts` 的七个命令是
  `derive/pack/compile-game/compile-td-game/site/verify/inspect`（`cli.ts:88,94,111,124,139,157,162`），
  MCP 的六个工具是 `derive_recipe/build_asset_pack/verify_asset_pack/inspect_asset_pack/compile_game/assemble_site`
  （`server.ts:20,37,55,63,71,89`）—— **都没有 review**。它只被测试（`review.test.ts:58,65,73,82`）
  与 v1 的实验脚本调用。**是一条"写好了、没接线"的路。**

### F. 「模型看不看得懂图」的红字 —— 确实存在，在 v1 的 map 里

按票面要求翻过 `game-creation-v1` 的 map（大量「实测」条目就在这里）：

- `game-creation-v1/map.md:168-172` —— **2026-09-24 21:xx 实测：视觉路径现在通了**（"第三次翻转"）。
  三次探测：纯红 64×64 → 答「红色 `#D12E2E`」；纯青 `#4EBBA4` → 答「青绿色 `#66B0A3`」；
  左青右橙两色块 → 答「2块。左侧为蓝绿色，右侧为红褐色」——**连左右分界都对**。
  响应的 `model` 字段是 `deepseek-flash`。
- `game-creation-v1/map.md:193-200` —— 🔴 **已被推翻的反面记录（保留供追溯）**：
  更早时往 `/v1/messages` 发图片块返回 200，但 `model` 是 `deepseek-flash` 且「**它看不到图**」——
  对一张 1×1 的图编出「light pink / salmon」。**这条已作废**，别当成现状。
- `game-creation-v1/map.md:342` —— ⭐ 账里抓到：**每一次的 `model` 都是 `deepseek-flash`，
  而生成器请求的是 `deepseek-v4-pro`** ⇒「代理会换模型」当场复现。**这条对视觉同样成立。**
- `game-creation-v1/map.md:935` —— 票 01：「代理是 CC Switch，三种协议都通但走不同上游，
  **视觉只能走 `/v1/messages`**」。
- `game-creation-v1/map.md:987` —— 票 15 实测：「**9 次调用全 200，2.1–14.6 s**」。
- `game-creation-v1/map.md:175-182` + `:184-188` —— 票 04 与票 15 归因：
  **上游会重编码图片 ⇒ 精确读色不可能**（送纯单色图 5 次零精确，`#6b4a33` 被读成 `#8e7c68`）。
  ⚠️ 这条**只否掉"精确读色"，不否掉"看得懂图"** —— 两件事。

**原始数据文件（比 map 的转述更硬）**：

- `.scratch/game-creation-v1/experiments/stylespec-extraction/out/runs.nothink-5x.json` ——
  `image: fixtures/reference/test.png`、`requested model: deepseek-v4-pro`、`at: 2026-09-25T08:18:38Z`；
  5 次全部 `http=200`、`servedModel=deepseek-flash`、`stop=end_turn`、2.57–3.08 s，
  每次 `input_tokens` 168–296（**图确实被计费进去了**）。
- `…/out/runs.thinking-3x.json` —— 3 次全 200，6.3–14.6 s（thinking 开着慢约 5 倍）。
- `.scratch/game-creation-v1/experiments/reference-image-draft/out/extractions.json` ——
  A/B/C 三张图各一次，**`schemaOk: true` 3/3**，1.9–2.5 s ⇒ **图 → 过 schema 的结构化 JSON，实测 3/3**。
- `…/out/scale-probe.json` —— 两个分辨率（480×270 原生 / 960×540 2×）都出了可解析的 spec。
- `.scratch/game-creation-v1/experiments/stylespec-extraction/extract.mjs:26-35` ——
  探针源码，`{type:"image", source:{type:"base64",…}}` 打到 `/v1/messages`。
- `.scratch/game-creation-v1/experiments/real-generation/README.md:51-61` ——
  `reviewPack()` 真跑出来的观察清单（抓到"人工导入的背景被量化到 9 色但仍不是像素画"）。
- `.scratch/game-creation-v1/issues/22-asset-generator.md:182-190` —— 同上，票面记录版。

### G. 文档与旧图里**没有**的

- `docs/文档.md` —— 搜 `视觉模型` / `vision` / 读图 / 看图 / `image.*source`：**零命中**。
  （它只在"视觉风格""视觉语法"这种**美术**意义上用"视觉"二字。）**这份文档没有一个字量过模型看不看得懂图。**
- `docs/stylespec-extraction.md:11-12` —— R11 把「参考图 → StyleSpec」定成
  「**人在 Claude Code 会话里让模型看图**、产出 JSON、**管线只消费文件**」——
  这是**人肉规程**，不是仓库里的自动化路径。`:63-100` 是要人复制的提示词全文。
- `.scratch/image-route-v1/map.md` 与 `.scratch/td-compile-v1/map.md` —— 搜
  `视觉` / `看图` / `读图` / `vision` / `/v1/messages`：**零命中**。三张旧图里**只有
  `game-creation-v1` 那张**记过这件事。
- `docs/v2/03-claude-code.md:163-215`（§6/§7）—— 要 `packages/vision/` + `analyze-reference.ts` +
  「Style Reference Image → Vision LLM → VisualWorldSpec」。**这个包不存在**
  （`packages/` 只有 `assets / cli / contracts / demo / mcp`）。

### H. 只有两个上游，没有第三个

- `README_zh.md:128-147`：「**配置** —— **两个互相独立的上游**」，然后
  `:132-137` 文本上游（`ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`）·
  `:139-145` 生图上游（`game-maker.local.json` 或 `GAME_MAKER_IMAGE_*`）。**没有第三套，确认。**
- `README.md:128-145` 英文版同构。
- 全仓 grep 环境变量名，只出现这两族（`image-config.ts:20-25` 与 `cli.ts:77-78`），
  外加 MCP 壳里三处拷贝 `ANTHROPIC_*`（`server.ts:149,155,167`）。**没有第三种凭据。**

## 不知道的

1. **今天（2026-10-01）还灵不灵。** 最新一笔实测是 **2026-09-25**，中间隔了一个国庆假期。
   两张图自己都写着「代理的上游配置一直在变」（`game-creation-v1/map.md:217-218`、
   `game-maker-v2/map.md:87-89`）。**本地证据答不了，归票 25 ②。**
2. **到底是谁在读图。** 我们请求 `deepseek-v4-pro`，回应自报 `deepseek-flash`
   （`map.md:342`，视觉探针同款）。`deepseek-flash` 是真多模态、还是代理把带图的请求转给了
   第三个 provider —— **仓库里没有任何东西能证明**。这决定了它会不会某天毫无征兆地再次"看不到图"
   （`map.md:193-200` 那次就是这么发生的）。
3. **一次调用能不能吐出完整的 `VisualWorldSpec`。** 已量的最大件是 `StyleSpec`（11 个字段，
   3/3 过 schema）。`VisualWorldSpec` 更大，**没量过** —— 归票 25 ③（截断的表现是"JSON 不合法"，
   `generate.ts:11-16` 记过这个坑）。
4. **认不认 `tools` / `tool_choice`（强制 JSON）。** 视觉这条从没量过；
   文本那条量的还是**旧端点**上的 1/3（`generate.ts:11-14`）。归票 25 ①。
5. **生图那几家的端点能不能兼职做视觉。** 本地只能证明**今天的代码不能**
   （解析器只认图，`image-gen.ts:286-293 / 420-430`），且**配的模型 id 是生图模型**
   （`gemini-2.5-flash-image`）。但"换个 `responseModalities` / 换个模型 id 行不行"是**网络事实**，
   本地无法证否 —— 归票 25 ②。⚠️ **不要据此假设它能**。
6. **`fixtures/reference/halt-dusk.png` 喂多大合适。** 票 08 §3 问了这个；
   `scale-probe.json` 里有 480×270 与 960×540 两档的记录，但**没有结论**（两个都出得来东西）。

## 对票 08 的含义

**第一段不需要新上游、新凭据、新协议 —— 接既有文本上游就行。**
`review.ts:93/:111/:113` 就是可直接照抄的调用形状（图片块在前、`x-api-key` + `anthropic-version`、
从 `content[].text` 取文字），`reviewPack()` 已经在仓里躺着了，**票 08 要做的是新 prompt + 新 schema，
不是新传输层**。⚠️ **绝对不要把视觉步接到 `image-gen.ts` 那四套协议上** ——
它们的成功条件是"回了一个图"，把期望是文字的回应交给它们只会得到 `NO_IMAGE`。

三条纪律要带过去：① **开工前先让票 25 确认今天还灵** —— 这一条是硬前置，
本票的全部实测都停在 09-25，而这条路的上一状态就是"能收图但模型看不到"（`map.md:193-200`）；
② **不要依赖精确色值**（票 04 已证不可能，`map.md:175-182`）——
票 08 若把 `palette` 当成"从图上读出来的准确颜色"就一定会写错；
③ **按 `generate.ts:103` 那套「纯文本 JSON + 剥围栏 + 有界重采样」来**，
因为 3/3 过 `StyleSpec` schema 不等于大得多的 `VisualWorldSpec` 也 3/3。
最后：`review.ts` 这条**已经存在的路没接进任何 CLI/MCP 入口**，
票 08 若要复用它得自己接线（或把它抽成一个公用的视觉调用层）——
别重复实现第二份 `fetch /v1/messages` + 图片块。
