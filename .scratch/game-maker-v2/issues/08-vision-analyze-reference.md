# 08. `packages/vision` + `analyze-reference.ts`：把参考图变成 `VisualWorldSpec`

Type: grilling
Status: open
Owner: —
Blocked by: 02, 07, 24, 25
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> `docs/v2/03-claude-code.md` §6/§7。这是整条链的**最前端**，也是**今天完全没有**的一段。

## Question

§6 要 `Style Reference Image → Vision LLM → VisualWorldSpec`，且
「模型输出**必须严格符合** Contract。**不得输出自由文本替代 JSON**」。

### 1. 谁来当这个 Vision LLM —— 这是本票最大的未知

现状（别重新量）：文本上游是手写 `fetch` 打到 `${ANTHROPIC_BASE_URL}/v1/messages`，
模型 id 写死 `deepseek-v4-pro`、`thinking: disabled`（`ops.ts:174`）；
生图上游是**另一套**（`image-gen.ts` 的四个协议）。**没有一条被验证过能看图。**

⇒ 这一票的**第一件事**是吃 **票 24 的答案**（这个仓库今天有哪些模型能看图）。
- 若代理支持 vision：走 `/v1/messages` 的内容块，与文本那条**同一个上游**。
- 若只有生图协议的某家支持：那是一条**新的调用路径**，要与 `image-gen.ts` 的协议表对齐。
- 若都不支持：**这是终点级的坏消息**，要当场报到地图上（终点里 `VisualWorldSpec` 是第一步）。

### 2. 提示词要分析的那十一项（§7）

`Rendering / Camera / Composition / Palette / Lighting / Materials / Character / Environment /
Animation / Readability` —— 特别注意 `pixel density` · `outline` · `shading` · `dithering` ·
`texture density` · `character proportions` · `object scale` · `camera angle`。

⚠️ **已有的家**：`prompt.ts` 里 `styleBrief` / `paletteLine` 等是**反过来**用的
（把 StyleSpec 转成生成提示词）。视觉这一侧是**新的方向**，别硬塞进同一批函数。
⚠️ 参照物：`docs/stylespec-extraction.md` 是**人肉**做同一件事的操作规程 —— 它是**今天的基线**，
也是「机器做这件事要追上什么」的清单。

### 3. 视觉模型的实际限制（要实测，别假设）

今天 `prompt.ts` 的生成侧是**纯文本**、不用 `tool_choice`（`generate.ts:11` 的实测）。
视觉这一侧喂的是**图 + 文**，且要吐一份**大 JSON**。要量：

- 一次调用能不能吐出**整个** `VisualWorldSpec`（十一个块），还是必须**分块多次调用**？
- 吐出来的 JSON 通过 `VisualWorldSpecSchema` 的**成功率**是多少？（票 25 在量同一族的另一件事）
- **原图的分辨率**喂多大（`fixtures/reference/halt-dusk.png` 的实际尺寸是多少）？

### 4. 参考图**必须保留**（§8 / R15）

链路上不许中途丢掉原图：`VisualWorldSpec.references.styleImages` **存引用**（路径），
二进制留在 `fixtures/` / `inputs/`。要答：**谁**负责把它登记进去（vision 这一票，
还是 pipeline 那一票，见票 15）。

### 5. `confidence`

`VisualWorldSpec.confidence` 是 `0..1`。今天 `StyleSpec.confidence` 也是。
要答：这个数是**模型自报**还是**我们算**？⚠️ 若是自报，它**进不了判据**（R3）。

## Answer

（待解）
