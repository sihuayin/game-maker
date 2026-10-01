# 08. `packages/vision` + `analyze-reference.ts`：把参考图变成 `VisualWorldSpec`

Type: grilling
Status: open
Owner: —
Blocked by: 02, 07, 24, 25, 28
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> `docs/v2/03-claude-code.md` §6/§7。这是整条链的**最前端**，也是**今天完全没有**的一段。

> **⚠️ 2026-10-01 就地更新：票面 §1 与 §3 的两大未知已被[票 25](25-prototype-structured-output.md) 答掉。**
> **§1「谁来当 Vision LLM」** ⇒ **既有的文本上游**（`/v1/messages` + base64 图块），
> 而 `review.ts:90-93` 的 `reviewPack` **已经在这么发**（⚠️ 但它库里有、CLI/MCP 里零命中，得先给入口）。
> **§3「模型的实际限制」** ⇒ 已实测：合成图判别**通过**（真看见）· 11 块 JSON **一次吐完、无围栏**。
> ⚠️ 两项都是 **n=1** —— 是「能不能」，不是「成功率」。
> **⇒ 本票剩下的只有 §4（原图登记）与 §5（`confidence`）。**
> **「按哪套协议要 JSON」已由[票 27](27-json-via-tool-choice.md) 答掉** ⇒ 见地图的 **R16（新）**：
> 走 `tool_choice: {type:"tool"}` 强制工具调用，**入参过 Zod 才算成功**
> （`stop_reason === "tool_use"` **不是**成功信号 —— 票 27 第 1 发实测 `input={}`），重采样 **3 次**。
> ⚠️ 那套东西的**代码**在[票 28](28-structured-call-substrate.md) 里，**先等它落地**。

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

- 一次调用能不能吐出**整个** `VisualWorldSpec`，还是必须**分块多次调用**？
- 吐出来的 JSON 通过 `VisualWorldSpecSchema` 的**成功率**是多少？

> **⚠️ 2026-10-01 就地更新：这三问已被[票 27](27-json-via-tool-choice.md) 的七发探针答掉大半。**
> **① 一次吐得完** —— 用**全 14 键**的 tool schema 实测：**4/5 成功**，成功那四发
> 顶层 14 键**全齐**，输出 **1135~1660 token**，从未撞 `max_tokens`。
> **② 成功率 = 首发 80%**（4/5），失败的那一发**不是模型的问题**（见下），
> 所以配 R16（新）的 **3 次重采样**后 ≈ 99%。
> **③ 失败长什么样**（第 1 发）：`stop_reason = tool_use`、`blocks = [tool_use]`、**`input = {}`** ——
> **代理把工具入参丢了**。⇒ **`stop_reason === "tool_use"` 不是成功信号，入参必须过 Zod。**
> ⚠️ 票面原文写的「十一个块」是**错的**：`01-contracts.md §2` 的 `VisualWorldSpec` 是 **14 个顶层键**，
> 票 25 那发只点名了 11 个 —— 本票**按 14 键**写。
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
