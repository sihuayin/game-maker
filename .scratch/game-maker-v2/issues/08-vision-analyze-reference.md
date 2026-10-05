# 08. `packages/vision` + `analyze-reference.ts`：把参考图变成 `VisualWorldSpec`

Type: grilling
Status: resolved
Owner: claude (2026-10-02)
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
>
> **⚠️ 2026-10-02（本 session）就地更新：票 27 的「首发 80%（4/5）」不能搬到落地契约上。**
> 实测核对 `.scratch/game-maker-v2/experiments/tool-choice-probe/run.mjs:64-97`：那份 tool schema 是**手抄的**，
> 照的是票 02 之前的 `01-contracts.md §2` 旧形状，与落地契约**只有 5 个键重合**
> （`camera`/`palette`/`materials`/`character`/`environment`），且**顶层没有 `additionalProperties: false`**
> ⇒ 它比落地契约**更松**，**低估**了难度。
>
> **新探针 `.scratch/game-maker-v2/experiments/vws-schema-probe/` 实测（零网络）**：
> `toolInputSchema(VisualWorldSpecSchema)` **不炸** —— 13 个顶层键、11 个 `strictObject` 节点**逐个**拿到
> `additionalProperties: false`、开集 `materials` **没被替它表态**（映射开、值形状封）、
> `format` 落成 `const`、`.optional()`/`.default()` 在 `io:"input"` 下行为正确、
> **零 `$ref`/零 `$defs`**、单份自包含、**3956 B ≈ 1000 token**。
>
> **⚠️ 但它抓到一条新的**：`superRefine` 被 `toJSONSchema` **静默丢掉**（既不抛也不警告）。
> 契约里**已有**的 `PaletteShape`「色板不得有重复色」与 `StyleReferencePath` 三条路径检查
> **在模型看见的 schema 里一点痕迹都没有**，而 `safeParse` 照旧会拒
> ⇒ **一次静默的重采样被烧掉，而模型永远学不会**（重采样是重抽，不把错误喂回去）。
> 这条与票面 §5 的 `palette:N` 越界是**同一个决定**（见本轮 Q6）。
>
> **⚠️ 2026-10-02/03（本 session）真探针已跑完：8 发，量出两个数。**
> 探针 `.scratch/game-maker-v2/experiments/vws-first-shot/`（`run.mjs` + `raw/` 8 份，零凭据落盘）。
> 喂：真图 `fixtures/reference/halt-dusk.png` + `inputs/last-train/PROMPT.md` 的需求文本，
> tool schema = **落地契约生成**的 `VisualWorldSpecSchema.omit({styleReferences:true})`（3742 B / 12 键），
> 强制 `tool_choice`，`max_tokens=16000`。
>
> **① 首发过 Zod：`6/8`（75%）** —— 与票 27 手抄 schema 上的 4/5 接近，那个数**大体搬得过来**。
> 失败全部是 `schema`，**没有** `no-tool-use` / `empty-input` / `truncated`。
> 输出 **1742–2156 token**（高于票 27 的 1135–1660，多出来的是 `style` 子树），单发 **9.5–11.3s**，
> `servedModel` 八发**全是 `deepseek-flash`**（请求的是 `deepseek-v4-pro`，代理又换了一次）。
>
> **② 两发失败 100% 出在内嵌的 `style` 子树，不在新视图：**
> - 第 05 发：`style.camera` / `style.composition` / `style.lighting` 被填成了**字符串数组**
>   —— 它们在 schema 里是**没有 properties 的开放对象**（`{type:"object", propertyNames:{…}, additionalProperties:{}}`），
>   模型没有依据，于是选了数组。其余全对。
> - 第 06 发：模型**自造了一个键** `environmentStyle`（还丢掉了 `shapeLanguage`），被 `strictObject` 拒。
>
> **→ 这两条都是「`style` 子树没有任何形状指引」这一个病根。** 而它恰是票 02 判的
> 「原样搬运的旧子树」，其中 **6 个字段全仓库零读取**，5 个还带 `.default()`。
>
> **③ 过 Zod 的 6 发里，1 发有「模型看不见的违规」**：第 07 发 `highlight=palette:9` 与
> 三个 `materials.*.color=palette:9`，而它自己那份 `style.palette` **只有 9 个色**（下标 0–8）
> ⇒ 越界 gate（Q6）实测**不是假想**。重色 0 发、六桶全空 0 发。色板长度 9–16 波动。
>
> **④ 按 R16 的 3 次地板算：≈98.4%**（首发 75% 独立重抽）—— 地板撑得住，但 n=8，误差棒宽。
>
> ⚠️ 本探针**刻意没加任何提示词补丁**（没把看不见的约束写进 `description`、没给示例）——
> 量的是**原始契约**的率。给补丁的收益另算（本轮 Q5/Q6）。

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

**判据**：票 08 落地。新增 **49 条测试**（`packages/vision` 36 + `visual-world-gate` 8 + `assets` 2 + `structured-call` 3）·
套件 **761/761**（此前 712）· `tsc -b` 干净 · `check:deps` / `check:links` 绿（716 条链接）· **13 发变异全部验过会红**。
⚠️ 一处**先前就有**的类型错误仍在（`packages/contracts/tests/qa.test.ts:48` 的 TS2783，`HEAD` 版本一字不差）——
**不是本票的，也没顺手改**（那会去动票 06 的产物）。它让 `pnpm typecheck` 在今天这个仓库上是红的。

### 0. 16 条裁决

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | R1-Q1 | 参考图 **+ 原始需求文本**一起喂；**不吃** `GameIntentSpec` ⇒ 两步**并列** | `prompts.ts` · `03 §6/§14` · `00 §3/§6` |
| 2 | R1-Q2 | `styleReferences` **调用方注入**；模型面向的 schema 把它 `omit` | `analyze-reference.ts` |
| 3 | R1-Q3 | `style.confidence` **模型自报**，只存于契约，**不做门禁** | `visual-world.ts` 自白 |
| 4 | R1-Q4 | 提示词**以落地契约为唯一字段清单** | `prompts.ts` · `03 §7` |
| 5 | R1-Q5 | `prompts.ts` **重写**；迁移两条实测纠正；人肉规程标「已被取代」 | `prompts.ts` · `stylespec-extraction.md` |
| 6 | R1-Q6 | 顶层 `superRefine` 做 palette **越界 gate** | `visual-world.ts` |
| 7 | R1-Q7 | 参考图**原字节 base64 直传**；不解码、不缩放 | `analyze-reference.ts` |
| 8 | R2-Q1 | 接受输入/输出形状；装配后**再走一次 `safeParse`** | `build-visual-world.ts` |
| 9 | R2-Q2 | `styleId` = 参考图 basename 的 slug；CLI 生成，本票只接收 | `build-visual-world.ts` |
| 10 | R2-Q3 | `UPSTREAM_TIMEOUT_MS` 上移 `contracts`；`max_tokens = 16_000` | `structured-call.ts` · `generate.ts` |
| 11 | R2-Q4 | gate **只查越界**（六桶 + `materials.*.color`） | `visual-world.ts` |
| 12 | R2-Q5 | 用 `forcedTool.description` 补足 schema 表达不了的约束 | `prompts.ts` |
| 13 | R2-Q6 | **保留完整 `style` 子树**，不做模型侧投影 | `build-visual-world.ts` |
| 14 | R2-Q7 | **不做** CLI/MCP 入口 | 无 |
| 15 | R1-Q9 | `LedgerStep += "analyze-reference"`；返回 `LedgerCall[]` | `ledger.ts` · `analyze-reference.ts` |
| 16 | R1-Q8 | 先跑真探针（8 发，已授权） | `experiments/vws-first-shot/` |

### 1. ⚠️ 一处**勘误**：票 27 那个 80% 量的是**另一份 schema**

票面把它当成「已知」，但实测核对 `experiments/tool-choice-probe/run.mjs:64-97`：那份 tool schema 是**手抄**的，
照的是**票 02 之前**的 `01-contracts.md §2` 旧形状，与落地契约**只有 5 个键重合**，且**顶层没有
`additionalProperties: false`** ⇒ 它比真契约**更松**、**低估**了难度。而且**`toolInputSchema()` 从没被跑过**。

⇒ 另起探针 `experiments/vws-schema-probe/`（纯本地）**先回答「转换器行不行」**：
**行**。13 个大写键全在、11 个 `strictObject` 节点**逐个**拿到 `additionalProperties: false`、
开集 `materials` **没被替它表态**（映射开、值形状封）、`format` 落成 `const`、
`.optional()`/`.default()` 在 `io:"input"` 下行为正确、**零 `$ref`/零 `$defs`**、**3956 B ≈ 1000 token**。

### 2. 探针量到的（8 发真请求，`experiments/vws-first-shot/`）

- **首发过 Zod：`6/8`（75%）** —— 与票 27 那个数接近，**大体搬得过来**。
  失败**全是 `schema`**：没有 `no-tool-use` / `empty-input` / `truncated`。
- 输出 **1742–2156 token**（多于票 27 的 1135–1660，多出来的是 `style` 子树）· 单发 **9.5–11.3s** ·
  `servedModel` 八发**全是 `deepseek-flash`**（请求 `deepseek-v4-pro`，代理又换了一次）。
- ⚠️ **两发失败 100% 出在「内嵌的 `style` 子树」，新视图零失败**：
  第 05 发把 `style.camera` / `composition` / `lighting` 填成了**字符串数组**
  （schema 里它们是**没有 `properties` 的空对象**，模型没有依据）；
  第 06 发**自造了一个键** `environmentStyle`。⇒ 这两条是**同一个病根**，也正是 R2-Q5 那三句话的来历。
- 过 Zod 的 6 发里 **1 发越界**（`palette:9` 打在 9 色的色板上，落在 `highlight` + 三个 `materials.*.color`）
  ⇒ **gate 实测不是假想**。重色 0 发 · 六桶全空 0 发 · 色板长度 9–16 波动。
- 按 R16 的 3 次地板估算 **≈98.4%**。⚠️ n=8，误差棒宽。
- ⚠️ 探针**刻意没加任何提示词补丁** —— 量的是**原始契约**的率。

### 3. 落地时量到的（票面没有的）

1. **`superRefine` 被 `toJSONSchema` 静默丢掉**（既不抛也不警告）⇒ 契约里**已有**的
   「色板不得重色」与 `StyleReferencePath` 的三条路径检查**模型一个都看不见**，而 `safeParse` 照旧会拒。
   这正是「**一次静默的重采样被烧掉，而模型永远学不会**」（重采样是**重抽**，不把错误喂回去）。
2. **`.omit()` 会把 `superRefine` 摘掉**（v4 实测）⇒ gate **挂不上**模型面向的 schema，
   它的落点只能是**装配后的重校验**。而 `.superRefine()` 本身**保得住** `.omit()` ⇒ 链式写法成立。
   这两条合起来才解释了 R1-Q6 与 R2-Q1 为什么必须**配对**存在。
3. **`export { X } from "…"` 是纯再导出、不引入本地绑定** —— 而 `generate.ts` 自己还要用那个名字。
   第一版就这么写了：**类型检查看不出来**，运行期 `setTimeout(fn, undefined)` **立刻触发**，
   `assets` 那边 **24 条测试当场变红**。教训写进了 `generate.ts` 的注释与一条判据里。
4. **zod 会把键序归一成契约的次序** ⇒ 落盘的 `visual-world.json` 顺序稳定（可 diff），不必自己排。
5. `contracts` 的测试去 import `assets` 的源码是**越层** —— `tsconfig.spec.json` 的 `rootDir` 会同一条 import
   把整个 `assets` 拖进来（13 条 TS6059）。那条断言已挪进 `packages/assets/tests/generate.test.ts`。

### 4. 四处**当场偏离**了轮次里的字面（都请复核）

1. **改了票 02 的测试 fixture**：`tests/visual-world.test.ts` 的 `MINIMAL.style.palette` 从 **1 个色加到 4 个**。
   理由：那两条测试用 `palette:1` / `palette:3` 考的是引用的**形式**（是 `palette:<下标>`、不是 hex），
   而新 gate 会把「色板只有 1 个色却引用 `palette:3`」判成悬空引用。**断言一个字没动**，改的是 fixture。
2. **`R2-Q3` 的小落点**：超时常量放进 `structured-call.ts`（不是新开模块）—— 对账时说的是这个，照办了，
   而理由补写在那条常量旁边（超时与重采样次数是这一层**政策**的另一半，`STRUCTURED_CALL_ATTEMPTS` 就住隔壁）。
3. **传输入口的失败不重采样**（`http` / `timeout` 立刻抛，且**不进** `failures[]`）——
   与 `assets` 那条链一致；R16 的重采样是给「入参不过 Zod」用的，把两者混进同一个分母
   正是票 27 的 Q4(ii) 立 `CallFailure` 要治的病。已在 `analyze-reference.ts` 的文件头写明。

   > ⚠️ **2026-10-03 标为过时**（[票 09](09-intent-analyzer.md) 的 1-Q3，人类裁定）：
   > **后半句与落地的代码不符。** `analyze-reference.ts:243-247` 恰恰把 `http` / `timeout`
   > **trip 进了** `failures[]`（`call.trip({ failure: once.failure })`）。
   > **以后者为准** —— 账里 `failures` 的定义是「**每一次没成的往返**的原因」，
   > 而一次 HTTP 500 就是一次没成的往返；丢掉它，账上会写着 `attempts: 1` 却**不说为什么**
   > （那正是票 28 修过的 `compile-game` 那个病）。
   > ⇒ 票 09 已照**代码**抄（见该票 Answer §0 第 4 条）。
   > ⚠️ 当时的测试只断言了 `attempts === 1`、**没断言 `failures`**，所以票面与代码的这处分歧两边都没红。
4. **三处出发前的「免费」拦停**（缺凭据 / 需求文本空 / 参考图不是恰好 1 张）都在**第一个请求上路之前**抛，
   因此**不记账** —— 与「账只记真的发出去过的往返」同一条纪律，也避免**调用方的错去烧三次重采样**。

### 5. 播给下游的

- **[票 15](15-pipeline-create-game.md)（pipeline）**：`analyzeReference` **只返回值、不写文件** ——
  `run/v<N>/visual-world.json` 与 `ledger.json` 的落盘归它；`styleId` 也归它（或 CLI）生成（R2-Q2）。
  它返回的账是 `LedgerCall[]`（**一格**，`attempts` 累加），它造不出 `Ledger`（那要 `packId`）。
- **[票 16](16-cli-create.md)（CLI）**：`--style-id` 是**覆盖**口；默认值是**参考图 basename 的 slug**（R2-Q2）。
- **[票 17](17-qa-visual-judgements.md)（QA）**：⚠️ **「palette 越界」那条判据在 VWS 这一侧永远不再触发**
  —— gate 住进契约后，越界的 `visual-world.json` 在**解析时**就被拒。config / drawlist 那一侧的那条还在。
  这句自白写在 `visual-world.ts` 的文件头（照票 05 的先例），**别当它坏了**。
- **[票 09](09-intent-analyzer.md) / [10](10-design-compiler.md) / [31](31-character-dna-gen.md)**：
  照抄这一步的形状 —— `forcedTool` + `parseToolUse` + `STRUCTURED_CALL_ATTEMPTS` 的循环、
  同形的 `spentCall`（各包自理，见 `analyze-reference.ts` 文件头）、
  **失败抛一个自带 `CallFailure` + `LedgerCall[]` 的错**、**每步在 `LedgerStep` 里先有一个值**。
  而 **R2-Q5 那个杠杆**（`description` 是「schema 说不清的东西」唯一的家）**对它们同样适用**。
- **[票 22](22-review-with-reference-image.md)**：`reviewPack` 在 `assets` 里，而 `assets` **够不着 `vision`**
  ⇒ 「读原图字节 → base64 块」那一小段（`vision` 的 `MEDIA_TYPES` + `fs.readFileSync`）它要**自己再写一份**，
  这不是疏漏，是 R11 的结构性代价。
- **[票 26](26-multiple-style-references.md)**：`role` 今天由调用方给固定值 `"global"`；
  `analyzeReference` 在收到 **>1** 张时会**当场抛**并点名「实现延后到票 26」。
