# 24. 这个仓库今天有哪些模型**能看图**？

Type: research
Status: resolved
Owner: —
Blocked by: —
Map: ../map.md
> 由票 08 §1 顶出来的：整条 V2 链的**第一步**（参考图 → `VisualWorldSpec`）需要一个
> **能看图的模型**，而仓库里**没有任何一条被验证过**。

## Question

现状（别重新量）：文本上游是手写 `fetch` 打到 `${ANTHROPIC_BASE_URL}/v1/messages`，
模型 id 写死 `deepseek-v4-pro`（`ops.ts:174`）；生图上游是**另一套**四个协议
（`image-gen.ts`：`openai` / `minimax` / `dashscope-mcp` / `gemini`），它们的用途是**出图**。

要查的（**只查本地**——配置文件、代码、文档；**不要**发网络请求，那件事归票 25）：

1. `game-maker.local.json`（已 gitignore，装着凭据）里配了哪些协议、哪些 base URL、哪些模型 id？
   `game-maker.local.example.json` 的注释键里写着每种协议要什么 —— 两相对照。
2. `packages/assets/src/image-config.ts` 的 **`resolveImageTransport`** 决议了哪些环境变量与
   文件键（它是纯函数，`{env, cwd}` 进、配置出，`image-config.ts:10-13`）——
   有没有**任何一处**是给视觉理解用的（而不是给生图用的）？
3. `image-gen.ts` 里哪个协议**收得下输入图**、以什么形式？已知三条线索（**要去核实，别照抄**）：
   Gemini 走 `inline_data` base64（`:299-312`）· OpenAI 有输入图时走 `/images/edits` multipart（`:460,469-474`）·
   DashScope 的 `image_edit` 需要**公网 URL**、接不了本地文件（`recipe.ts:60-63`、`image-gen.ts:56-68`）。
   ⚠️ **关键区分**：这些是**出图**调用（出图），不是**看图**调用（读图出文字）——
   两者是不是同一条路，要**明确回答**。
4. `docs/文档.md` 与三张旧图（`.scratch/*/map.md`）里有没有量过**模型看不看得懂图**的红字？
   `game-creation-v1` 的 map 里有大量「实测」条目，翻一翻。
5. `README_zh.md` 的「配置」一节只列了**文本上游**与**生图上游**两套 —— 确认**没有第三套**。

### 产出

一份 **`.scratch/game-maker-v2/research/vision-model-availability.md`**，回答：
**今天这个仓库里，哪一个已配置的模型（如果有）能完成「图 → 结构化文本」这件事？**
逐条列**证据**（`file:line`），并把**不知道的**明确标成不知道 ——
票 08 要靠它的结论决定第一段怎么接，**猜错的代价是整条链的第一步就没有。**

⚠️ **不要**把凭据值抄进产出文件（`game-maker.local.json` 已 gitignore，不是为了让它出现在 `.scratch/`）。

## Answer

（待解）

---

## Answer

**✅ 2026-10-01 已决议。完整证据在 [`research/vision-model-availability.md`](../research/vision-model-availability.md)。**

### 答案

**有 —— 而且不是四个生图协议里的任何一个，就是既有的文本上游。**

```text
${ANTHROPIC_BASE_URL}/v1/messages
  + content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: … } }]
  + model: "deepseek-v4-pro", thinking: { type: "disabled" }
  → content[].text
```

**而且这条路已经在代码里跑着**：`packages/assets/src/review.ts:90-93` 的 `reviewPack()` 就是这么发的
（`:111` 是 `${baseUrl}/v1/messages`，`:113` 是 `x-api-key` + `anthropic-version`，
`:116-119` 读 `content[].text`）。

⚠️ **但它是「库里有、没有入口」**：`reviewPack` 在 `packages/cli/src/cli.ts` 与
`packages/mcp/src/server.ts` 里**零命中**（已 grep 核实）—— 它被 `index.ts` 导出，
消费者只有测试与 v1 的 experiments。**票 22 要用它，得先给它一个入口。**

### ⚠️ 它纠了本票自己的三条线索

票面 §「要查的」第 3 条列了三条「协议收得下输入图」的线索（Gemini `inline_data` ·
OpenAI `/images/edits` · DashScope 公网 URL）—— **三条都是真的，但三条的方向都反了**：

- `image-gen.ts:315` 的 `responseModalities: ["IMAGE"]`，以及三个响应解析器
  （`imageFromGemini:286-293` · `imageFromOpenAI:420-430` · `urlFrom:141-153`）
  都把「回复里没有图」当成**错误** ⇒ 这些是**出图**调用，`inline_data` / `image_url` 是**输入侧**。
- **四个协议里没有一个是视觉**。DashScope 连输入图都收不下（`:163` 只解构 `prompt/size/negativePrompt`），
  minimax 根本没有客户端（`ops.ts:683-684` 直接抛）。
- `resolveImageTransport` **一个字都没提视觉**（`image-config.ts:1,32,47,102,143` 全是生成侧）。

⇒ **「生图那套」与「看图」是两条不同的路**，本票原来的措辞把它们混了。

### 已量到的（不是推断）

`.scratch/` 下的原始 JSON 记着 2026-09-25 的真跑：**5/5 与 3/3 都是 HTTP 200**，
`servedModel=deepseek-flash`，2.6–14.6 s；`extractions.json` 里 `schemaOk: true` **3/3**
—— **图进、符合 schema 的结构化 JSON 出**。`game-creation-v1/map.md:168-172` 有三条佐证，
**其中一条是左右空间判别正确**。

### ⚠️ 承重的那条保留

**最新实测停在 2026-09-25，今天是 2026-10-01**，而两张图都写着「代理的上游配置一直在变」。
这条路此前**正好经历过**「收得下图块、模型看不见图」那个状态（`map.md:193-200`）。
⇒ **今天是否还成立，本地证据判不了。**

### 对票 08 的含义

1. 第一段**大概率不用新接一个上游** —— 复用 `/v1/messages` 的图块形状即可（照 `review.ts` 抄）。
2. **但先吃票 25 的数**：它量「今天这个端点还认不认图块」，与本票是同一条命。
   ⇒ 已把票 25 加进票 08 的 `Blocked by`。
3. 本票没量的两件事（票 25 量）：一次能不能吐出**整个** `VisualWorldSpec`（十一个块）、
   `tool_choice` 认不认。
