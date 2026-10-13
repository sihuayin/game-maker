# 56. 理解层四步的散文与契约 gate **系统性一致性审计** —— 「提示词的哪几句话合起来要求了一件契约禁止的事」这一类还有别处吗

Type: task
Status: resolved
Owner: claude (2026-10-13 · 一次量，不是一次决定 —— 只读了仓库内的文件，**零付费、零改动**：
源码一个字节没动、契约语义一个字没松、`packages/qa` 一行没碰、`game-maker.local.json` 一个字没动、
`.scratch/**/experiments/` 的现场只读。派生的四张票见 `## Answer §4`)
Blocked by: —
Map: ../map.md
> 派生自[票 42](42-cross-array-id-uniqueness.md) 的 Q8 = A 记进地图的**雾 ②**
> （「提示词的哪几句话，合起来要求了一件契约禁止的事」—— 这一类还有别处吗）。
> ⚠️ 人裁 2026-10-13（[票 54](54-mechanic-omitted-vs-coverage.md) 的 Q4 = A）：
> **另开一票、系统审查理解层四步散文与契约 gate 的一致性**；
> [票 54](54-mechanic-omitted-vs-coverage.md) 的补充裁定 4 明文：「另开理解层四步散文审计票，
> **不在票 54 内执行系统扫描**」。
> ⚠️ **本票不挡票 23** —— 它是一次**量**，不是链上的拦路石。

## 1 · Question

**理解层那四步的散文（提示词）与它们各自契约的 gate，还有没有别处是这样打架的：
提示词里的话合起来要求了一件契约禁止（或判据必拒）的事。**

## 2 · 为什么今天非扫不可（n=2 了，而且两个都是真跑撞出来的）

这一类今天有**两个**真实样本，**都不是推理出来的、是真跑撞出来的**：

1. **DNA 那一层**（票 42 量到的）：`characterIndividualBrief` 把 `player` 与同 id 的 npc **并列**列出，
   又要求这一族的 `id`「**恰好**覆盖这些实体」，而 `CharacterDNA` 契约**禁重复**。
   ⚠️ 它已被票 42 **堵在设计层**（重 id 到不了那一发），但**文书里的缺陷仍在**：
   `characterEntities` / `characterSetGate` 拿 **`Set`** 比较，**重 id 会静默塌成一条** ⇒
   将来若有**别的**路把重 id 送进来，那两句话**原样复活**。
2. **设计层那一处**（票 54）：提示词第 2 条说「挑不出对家就**整条省掉**」，而 `mechanics` 台账说
   「`id` **照抄意图层**」⇒ 合起来 = 「意图里每条机制都要出现在设计里」⇒ **只能填近似值**。
   第八跑实测：**唯一听话的那一条死了**（`wasteland-bg`），拿近似值顶替的六条活了。

⚠️ **别把 n=2 读成「只有这两处」**：两次都是**真跑撞见**才被发现的 ——
也就是说这一类**没有一道闸在看它**，全靠跑出去撞。那正是本票要补的**一次量**。

### ⚠️ 2026-10-13 更新：**n=2 → n=3**（[票 64](64-palette-two-shapes-same-name.md) 收口时补记）

**第三个样本来了，而且它比前两个更该让你警觉** —— 因为**它不在「四步的散文台账」那张表里**：

**`analyze-reference` 那一层**（票 64，第十三次真跑撞见 · 三发全灭）：**两处散文合起来指向了一件
gate 明令禁止的事** —— `TOOL_DESCRIPTION` 第 3 条在**同一句**里引出两个同名的键
（「六桶（`palette.primary` 等）与 `materials.*.color` 里的 `palette:N`，必须指向你**自己刚写下的那份**
`style.palette`」），**从头到尾没说顶层那个 `palette` 是一个对象、不是数组**；而用户轮那句
**不加限定**的「`palette` 的选择标准是**能不能画出这个世界里的东西**」指的恰恰是**色值数组**。
⇒ 合起来 = 「把色值数组摆到顶层 `palette` 上」。⚠️ **gate 要的是六个桶、桶里装 `palette:N` 引用** ⇒
`palette: Invalid input: expected object, received array`。

⚠️ **它给本票加的三条信息**（不是「又多了一个例子」，是**方法的输入**）：

1. **这一类不只在「字段台账 / 提示词骨架」里** —— 票 64 那两处**一处住在工具说明
   （`TOOL_DESCRIPTION`）、一处住在用户轮那段文本**。⇒ 本票 §3 那张表**按「散文住在哪」去扫是不够的**
   （那张表把 `packages/vision/src/prompts.ts` 整份圈进来了，所以**恰好够得着**这一处；
   但要提防别处**散在契约的 `.describe()`、工具 `input_schema` 的 `description`、甚至 `Field.SKILL` 之类**）。
2. **「两处散文互斥」这一形状要读宽一点**：票 64 那两句话**单独看都说得通**，
   只有**合起来、再对比 gate 的形状**才成为冲突 ⇒ 扫描时**不能只看单句**，要把
   「模型读完这整份提示词，会以为 `X` 是什么形状/什么取值域」当成**一次读取**来核。
3. ⭐ **它今天已经被治了**（2026-10-13 · 人裁 Q9 = (a) · 两处散文按量出来的读数落地：
   A/B 探针把这一件事从 **5/6 压到 0/6**，p=0.0152）—— ⚠️ **但治的是那一处，不是这一类**。
   本票要的是：**这一类还有别处吗**。票 64 只是又证明了问句值得问一次。

⚠️ **票 64 那两处**按上面的分类属于本票 §3 的第四种形状（「**gate 判的东西散文一个字没说**」）
与第三种（「**散文许了一个下游必拒的值**」）**叠在一起** ⇒ 分类时别硬归一类，**两条都写**。

### ⚠️ 2026-10-13 补记：**又冒出一处，但它在 §3 那张表之外**（第十五次真跑撞见 · [票 23](23-e2e-fixture-wasteland.md)）

**这一处不是加进本票范围的，是标出「本票扫不到它」** —— 记在这里免得下一个 session 以为覆盖过了。

**它长这样**：段 A 的清单问话把 `recipeShapeSpec()`（`packages/assets/src/prompt.ts:491`）**逐字**插进
提示词（`:798`），而那份**样板**写的是 `{"name":"sky","parallax":0.3}` —— **不平铺**（紧跟一句
「不平铺的层**别写 tileable**」），**整段文本没有一个字**说「不平铺 ⟹ parallax 必须 0」。
⇒ 模型照样板写了 `sky` p=0.1 / `silhouette` p=0.4，而 `demo/src/site.ts:39` `auditGeometry`
（**装配期** · 调用点 `:216`）**两条 error、硬失败、不产出 `site/`**：11 张图 + 30 发往返**全花完**才被告知。

⚠️ **为什么本票扫不到它**（两条各自都够）：
1. **它不在「理解层四步」里** —— 清单是**第五步**（`plan-assets`），而 §3 那张表写的是四步；
2. ⚠️⚠️ **更要紧的是：闸门不在这四步各自的契约里** —— 它在**装配期**（段 B），
   而本票的整个方法是「散文 vs **该步自己契约的 gate**」。⇒ **形状是新的**：
   **散文里的样板 vs 一个住在下游很远的闸门**（不是「一句话许了一个下游必拒的值」——
   样板根本没提那句话，它只是**示范了一个必死的形状**）。

⚠️ **本票的处理**：**只记，不改范围**。要不要把这第五种形状并进来、还是另立一票，
**要人裁**（三条出路：(a) 改散文样板 · (b) 把判据提前到花钱之前 · (c) 都不动 ⇒ 见地图 `Not yet specified`）。
⚠️ **样本 1（一跑读数）** —— 不足以据此断言「这一类还有多少处」。


## 3 · 扫什么（范围就是「理解层四步」）

**范围**：理解层那四步各自的**散文**（工具说明 / 字段台账 / 提示词骨架）与它们**各自契约的 gate**。

| 步 | 散文住在 | gate 住在 |
|---|---|---|
| `analyze-reference` | `packages/vision/src/prompts.ts` | `VisualWorldSpecSchema` 的 gate |
| `analyze-intent` | `packages/game-design/src/prompts.ts`（`TOOL_DESCRIPTION` + `FIELD_HINTS`） | `GameIntentSpecSchema` 的 gate |
| `compile-design` | 同上（`DESIGN_TOOL_DESCRIPTION` + `DESIGN_FIELD_HINTS`） | `GameDesignSpecSchema` 的 gate + R12 的拒绝（`build-design.ts`） |
| 第四条（起草时先按目录核一遍是哪一步、散文与 gate 各住哪） | 待核 | 待核 |

⚠️ **第四步是哪一步、它的散文与 gate 各在哪，开工时先量清楚再写下来** ——
本票的票面**不预设**它，别拿票面的表当既定事实。

**找的是什么形状**（不止一种）：

- **散文与它自己的 gate 互斥**：提示词叫模型做一件契约明令禁止的事（票 54 那种）。
- **两处散文互斥**：两条规矩合起来没有合法解（票 53 那种：第 3 条「不许删」 vs 第 4 条「别写」）。
- **散文许了一个下游必拒的值**：某条路今天走得通、明天换一路必死。
- **gate 判的东西散文一个字没说**：模型看不见那条规矩（`toJSONSchema` 丢 `superRefine`）。

## 4 · 产出（一次量，不是一次决定）

**一张逐条列清的对照表**，每条至少带：

- 散文的原话 + 它的位置（文件:行）
- 与之冲突的 gate / 判据的原话 + 位置
- **这条冲突今天够不够得着**（生产路径上跑得到吗？还是已被另一条闸堵在前面）
- **有没有真跑证据**（撞过 / 只推理得出）

⚠️ **本票只量、不裁**。量完每一条**独立成立**的冲突，各自**另开票**
（照票 53 / 54 的先例：散文类的收口与判据类的收口都不是同一件事）。
⚠️ **别在扫描票里顺手改散文** —— 那是「一次决定」，不是「一次量」。

## 5 · 边界

- **不动 R 表**（要动按 R17 另开票）· **不改任何契约的语义** · **不加重试 / 修复循环 / 自动重生成**（R13）。
- `packages/qa` 一行不碰 · `game-maker.local.json` 一个字不动。
- **不执行任何付费真跑**（这是读仓库内文件的活）。
- 扫描**只读**：`.scratch/**/experiments/` 的现场一个字不动。

---

## Answer

**一次量做完了：四步全扫 · 两个 `prompts.ts` 逐句核过 · 八行读数（三条成立、五条阴性或不成立）·
派生四张票。** 下面按票面 §4 要的四列写。

### §0 · 先把「四步」量清（票面 §3 表格第四行的「待核」，**这是本票的第一件产出**）

| 步 | 契约 | 散文住在 | gate 住在 |
|---|---|---|---|
| `analyze-reference`（[票 08](08-vision-analyze-reference.md)） | `VisualWorldSpec` | `packages/vision/src/prompts.ts`（97 行 —— `TOOL_DESCRIPTION:42` + `visionPrompt:74`） | `VisualWorldSpecSchema` 顶层 `superRefine`（六桶 ref 越界 · `materials.*.color` 越界 · 色板重色）+ `StyleSpecShape` / `PaletteShape` 的 `strictObject` |
| `analyze-intent`（[票 09](09-intent-analyzer.md)） | `GameIntentSpec` | `packages/game-design/src/prompts.ts`（`TOOL_DESCRIPTION:48` + `FIELD_HINTS:129` + `intentPrompt:114`） | `GameIntentSpecSchema.superRefine`（①–⑤c） |
| `compile-design`（[票 10](10-design-compiler.md)） | `GameDesignSpec` | 同上（`DESIGN_TOOL_DESCRIPTION:184` + `DESIGN_FIELD_HINTS:227` + `designPrompt:262`） | `GameDesignSpecSchema.superRefine`（①–⑥）+ **R12 的拒绝**（`build-design.ts`） |
| `compile-character-dna`（[票 31](31-character-dna-gen.md)） | `CharacterDNA` | 同上（`CHARACTER_DNA_TOOL_DESCRIPTION:339` + `DNA_FIELD_HINTS:367` + `characterDnaPrompt:413`） | `CharacterDNAFileSchema.superRefine` + `characterSetGate` + `verbatimCopyGuard`（`build-character-dna.ts`） |

⚠️ **第四步是 `compile-character-dna`**（票面说「开工时先量清楚」）——
它在链上的位置见 `packages/pipeline/src/create-game.ts:280`，**在 `compile-design` 之后、`plan-assets` 之前**。

⭐ **本次量的第一条结论：扫描面是封闭的、可以枚举的。** 模型面向的散文**只在两个文件里**，
三处都验过：
1. **全仓 V2 契约 `.describe(` 0 处**（`grep -rn "\.describe(" packages/contracts/src/` 输出为空）；
2. **四个驱动一个字不加** —— `analyze-reference.ts` / `analyze-intent.ts` / `compile-design.ts` /
   `compile-character-dna.ts` 只做 `forcedTool(NAME, TOOL_DESCRIPTION, Schema)` + 调提示词函数，
   没有第三处文案；
3. 票 64 点名要提防的那三处（契约 `.describe()` · 工具 `input_schema` 的 `description` ·
   `Field.SKILL` 之类）**都不存在**。
⇒ 票 64 加的那条方法论警告（「别处有没有散落的散文」）**这次检过、是干净的** ——
**两个 `prompts.ts` 就是全部**，所以「这一类还有别处吗」这个问句，答案**穷尽在下面那张表里**。

### §1 · 对照表（八行，逐条都写）

| 行 | 步 | 形状（票面 §3 那四种） | 今天够不够得着 | 真跑证据 | 处置 |
|---|---|---|---|---|---|
| **A** | `compile-design` | ③ 散文许了一个下游必拒的值（+ 两处散文互斥） | ✅ 够 —— 13a 那条真跑就踩过 | ⭐ **有，n=3** | 已被 [票 54](54-mechanic-omitted-vs-coverage.md) 裁过（后果说清、**R12 一个字没松**）⇒ **不另开票** |
| **B** | `compile-design` | ② 两处散文互斥 ⇒ **没有合法输出** | ✅ 结构上够（固定 fixture 今天够不着） | ❌ 无（n=0） | ⭐ **另开票 → [票 67](67-design-all-mechanics-unmappable-corner.md)** |
| **C** | `compile-character-dna` | ③ 散文许了一个下游必拒的值（**后果说反**） | ✅ 够 | ❌ 无（**阴性 n=9**，零尸体） | ⭐ **另开票 → [票 68](68-dna-palette-hex-consequence-stated-wrong.md)** |
| **D** | `compile-character-dna` | ④ 的**镜像**：散文要求的东西**没有 gate 在看** | ✅ 够 | ❌ 无（**阴性 n=9**，零尸体） | ⭐ **另开票 → [票 69](69-dna-palette-ref-bounds-unjudged.md)** |
| **E** | `analyze-reference` | 两个同名 `constraints`、散文**不分家** | ⚠️ 够，但**没有判据可能被违反** | ✅ 有（**阴性读数**：七份真跑无一相等） | 契约自己登记为**未定**、地图 `Not yet specified` **已经有这一条** ⇒ **不另开票** |
| **F** | 四步 | 散文/测试里**手抄了一份契约**（写死的 `8` / `12`） | —（今天 `8==8`、`12==12`，**不成立**） | — | **只记**（见 §3-F） |
| **G** | `analyze-intent` | ① ② ③ ⑤ ⑤b ⑤c **六组全部披露** | — | — | ⭐ **阴性且值钱**（见 §3-G） |
| **H** | `analyze-intent` | ④ `progression`/`challenge` 空壳 —— **散文一个字没说** | ✅ 够（但很窄） | ❌ 无（**阴性 n=13**，零空壳） | ⭐ **另开票 → [票 70](70-intent-optional-shell-gate-undisclosed.md)** |

### §2 · 逐条详述（散文原话 + 位置 · 冲突的 gate 原话 + 位置）

#### A · `compile-design`：听话的那一条路**必死**（已被票 54 处置）

- **散文**：`packages/game-design/src/prompts.ts:195-196`（第 2 条）——
  「**意图里哪条机制在这个表里找不到对家，就整条省掉** —— **不许**挑一个「近似的」顶上去
  （把「二段跳」写成 `jump` 是**静默丢东西**，比省掉更糟）」；`:243`（台账）同款。
  而 `:243` 那句**前半截**是「`id` **照抄意图层**」。
- **判据**：`packages/contracts/intent-coverage.ts`（`auditIntentCoverage`）—— 意图里的机制
  **按 id** ⊆ 设计层的 `mechanics[].id`；`build-design.ts` 的 `REJECT_REASONS` 里那一档叫
  `intent-mechanic-missing`。⇒ 「省掉 ⇒ 必拒」，因为 id 不在设计里了。
- **够得着**：✅ 够。
- **真跑证据：有，n=3**（⚠️ 这是全表**唯一**有阳性证据的一行）：
  1. `experiments/e2e-wasteland/raw/run-2026-10-13a.json`：`exitCode 4`，
     报「意图里的机制「废土背景」（`wasteland-bg`）在设计层没有对家」——
     同一次还有一条 `intent-entity-missing`；
  2. ⭐ **`experiments/design-first-shot/raw/03-hostile.json` 与 `04-hostile.json`**（两发探针）：
     `"dropped": ["m-double-jump"]` · `"approximated": []` · `"assembled": "rejected:intent-mechanic-missing"`
     ⇒ **模型照散文省掉了，然后被判死** —— 这是「听话的那条路必死」最干净的一发读数。
- **处置**：**不另开票**。票 54 的 Q2 已经把它裁过：R12 **不松**（那是**有意的**叫停，
  比悄悄丢东西强），只把「后果」在原话里说清楚。⚠️ **但要说清它今天仍然成立** ——
  本票的 A 行是**复核**，不是新发现；同时**「近似顶替能过、而且没有判据看着」那一半也仍成立**
  （票 19 已裁定它**不可机械判定**，R3 的门不收）⇒ 两半都写在这里，免得有人以为票 54 把它消掉了。

#### B · `compile-design`：「**全都**挑不出对家」是一个没有合法输出的角 —— 派生 [票 67](67-design-all-mechanics-unmappable-corner.md)

- **散文**：`:243` —— 两条方向相反的规矩**住在同一句里**：
  「挑不出对家就**整条省掉**……**至少一条**」；`:191` 第 1 条也把 `mechanics` 列进「至少一条」那一档。
- **gate**：`packages/contracts/src/game-design.ts:255-259` —— ④ 非空数组，
  `mechanics` 空了就 `issue("…… 做成了零条就是没干活")`。
- **合起来**：意图里那几条机制**一条都对不上**那张 8 值封闭枚举时 ——
  「整条省掉」⇒ `mechanics: []` ⇒ **gate ④ 判失败**；而**唯一能过的路是散文禁止的「近似顶替」**。
  ⚠️ 更糟的是 `build-design.ts` 那处**有意的次序**（注释 `:150`、正文 `:160-173`：
  **契约先过、R12 在后**）⇒ 这个角**走不到**
  R12 那条「**外壳做不了它**」的诚实报文，3 发重采样**全是盲的**，
  而最后落到人眼前的理由是「**没干活**」—— **说错了那一方**。
- **够得着**：✅ 结构上够（`analyze-intent` 的散文 `:83` **明令**把「外壳做不了的真机制照原话记进
  `mechanics[]`」⇒ **满足这个角的输入是上游被要求生产的**）。
  ⚠️ **固定 fixture 今天够不着**：`run-out-2026-10-13h` 那份意图的 5 条机制**全部有对家**。
- **真跑证据**：❌ **无（n=0）** —— 盘上 12 份真设计的 `mechanics` 长度是
  `4/5/5/5/5/5/7/8/8/8/8/9`，**一份 `[]` 都没有**。
  ⚠️ 一处**只能记成疑似**的读数：`run-2026-10-13a.json` 那一发 `compile-design`
  `failures: ["schema","empty-input"]` —— 那个 `schema` **可能**就是本角，但逐次入参没留在盘上
  （票 60 那只容器是后落地的）⇒ **归因未明，不当证据**。

#### C · `compile-character-dna`：写 hex 的**后果说反了** —— 派生 [票 68](68-dna-palette-hex-consequence-stated-wrong.md)

- **散文**：`:378-379`（`DNA_FIELD_HINTS.palette`）——
  「不许写 hex 或颜色名（**写了下游会被量化掉，等于没写**）」。
- **gate**：`packages/contracts/src/visual-world.ts:79-81`（`PaletteRefShape`，DNA 那一侧**原样复用**
  —— `character-dna.ts:111`）：`regex(/^palette:\d+$/, "必须是 palette:<下标> 引用；硬编码色值无法通过 schema")`。
- **冲突**：散文给的是「**有损但走得通**」（量化掉 = 这一格白填），
  实际是「**当场 `schema` 失败、整发重来**」。⇒ 票面 §3 的**第三种形状**。
- ⚠️ **同一句错话抄在契约自己的注释里**：`character-dna.ts:104-110` 写着
  「⚠️ 写成自由 hex 会**静默失效**：下游 `quantize.ts` 会把色板外的颜色量化掉」——
  那条注释写在 `PaletteRefShape` 之前，而**同一个文件第 111 行的正则已经把它堵死了**。
- **够得着**：✅ 够（DNA 那一发在链上，`palette` 是必填八键之一）。
- **真跑证据**：❌ **无** —— **9 份**真 `character-dna.json`（**20 个角色 · 96 个 `palette` 元素**）
  **全是** `palette:<下标>`（`/^palette:\d+$/` 一次没拒过），**一次 hex 都没写过**。
  ⚠️ 按票 54 的先例（Q2 =「把后果说清楚」被判值得做），**零尸体不削弱这一条**：
  要治的是「散文里有一句关于管线的假话」，不是「模型会写 hex」。

#### D · `compile-character-dna`：`palette:N` **越界没人判**，而 `dnaBrief` 把悬空引用原样写进提示词 —— 派生 [票 69](69-dna-palette-ref-bounds-unjudged.md)

- **散文**：`:358`（工具说明第 4 条）——「`palette` 只能写 `palette:<下标>`（**从上面那份色板里选**）」。
  ⚠️ **这句话是一个要求，但散文里没有一处说「越界了会怎样」** —— 因为**没有判据**。
- **对照**：`visual-world.ts` 顶层 `superRefine` **对六桶与 `materials.*.color` 里的每一个 ref**
  逐个查 `< v.style.palette.length`（注释里把这件事叫「文书自己跟自己矛盾」）；
  `CharacterDNAFileSchema` **没有**同款检查，而**两份契约引用的是同一份 `style.palette`**。
- **越界会发生什么（读出来的）**：`packages/assets/src/prompt.ts:83` ——
  `style.palette[Number(ref.slice("palette:".length))] ?? ref` ⇒ 越界时 `undefined` 落回 `?? ref`，
  把字面量 `palette:9` **原样拼进生图提示词**，而同一个文件的文件头逐字写着
  「**模型不认 `palette:3` 这个说法**，它认颜色」⇒ 走到的是**翻译失败**那一档，**没有任何东西会红**。
- **形状**：⚠️ **票面 §3 那四种都不完全是它** —— 它是第四种（「gate 判的东西散文一个字没说」）的
  **镜像**：「**散文要求的东西没有任何 gate 在看**」，而**同一个不变量在隔壁契约里被 gate 着**。
  单看「要求没有判据看着」那是 R3 门下的**常态**（见 §3-G）；**它之所以立案，是那个不对称**。
- **够得着**：✅ 够（越界与否完全由模型自己决定）。
- **真跑证据**：❌ **无（阴性 n=9）** —— **9 份**真 `character-dna.json`
  （色板长度 `11/12/14/11/11/6/6/12/11` · 20 个角色 · **96 个 `palette` 元素**），越界 ref **0 个**。
  ⇒ ⚠️ **这是全表最弱的一条**（只靠推理得出），票面上写清了。

#### E · `analyze-reference`：两个同名的 `constraints`，散文**不分家**（**不立案**）

- **散文**：`packages/vision/src/prompts.ts:87-89` ——
  「constraints 只写**生成新资源时必须遵守的规则**，⚠️ **不要**写「某色面积 < X%」这类数值上限」
  —— **不说哪一个 `constraints`**。
- **契约**：`packages/contracts/src/visual-world.ts:249-252` —— 顶层那张与 `style.constraints`
  是**两张**：`imagePrompt()` 读 `style` 里那张，**顶层那张的消费者是 DNA 那一发**（票 31）；
  并逐字记着「两张该不该派生 / 合并：票 30 的 Q3 判**「本票不碰」** —— 今天记为**未定**」。
- **形状**：**同名两形状、散文不分家** —— 与 [票 64](64-palette-two-shapes-same-name.md)（两个 `palette`）
  **同族**；⚠️ 但**这一处没有任何 gate 碰得到**（两张都是 `string[]`，形状一模一样，
  gate 连分辨都分辨不出来 —— 票 64 那处好歹有 `expected object, received array` 能撞）。
- **真跑证据**：✅ **有，但是阴性读数** —— 契约注释记着「两批内容**七份真跑没有一次相等**（逐份比过）」
  ⇒ 模型没把它们当同一件事，**零尸体**。
- **处置**：**不另开票**。三条理由：① 它不是一条「冲突」（**没有判据可能被违反**）；
  ② 契约**自己**已经登记为未定、地图 `## Not yet specified` **已经有这一条**
  （「VWS 里那两张同名 `constraints` 要不要派生 / 合并」—— `map.md` 的 `## Not yet specified` 里那一条）—— 重复立案是噪声；
  ③ 这件事真要做，是**一次决定**（派生还是合并），不是本票量得出来的东西。

#### F · 散文与测试里**手抄了一份契约**（今天不成立，**只记**）

- `packages/vision/src/prompts.ts:50-53` 写死「`style` 的键集**是封的**，只有这 **12** 个」；
  `packages/game-design/src/prompts.ts:194` · `:243` 写死「**8** 个值」、`:246` 写死「**8** 个能力名」。
  而两张词表本身是**插值**进去的（`prompts.ts:307-308`：`MECHANICS.join(" · ")` / `CAPABILITIES.join(" · ")`）
  ⇒ **表是派生的、「数」是手抄的**。
- **今天 `8==8`、`12==12` ⇒ 不成立**。⚠️ 但**没有任何闸门**：
  `grep -rn "MECHANICS.length\|CAPABILITIES.length" packages/` **0 处**；
  而 `packages/vision/tests/prompts.test.ts:45` 那 12 个键名**也是在测试里手抄一遍**、
  **不是**从 `StyleSpecShape` 派生（⚠️ 对照：同一批测试里 `packages/vision/tests/prompts-wire.test.ts:74`
  的六个桶名**是**从 `PALETTE_BUCKETS` 派生的 —— **同一份代码里两种做法并存**）。
- **为什么不立案**：它不是一条「冲突」（今天没有任何东西是错的），是一条**没有闸门**的漂移风险；
  要不要立一条派生式测试属于**口味**。⚠️ 记在这里，免得下一轮扫描重扫一次。

#### G · ⭐ **阴性且值钱**：`analyze-intent` 那六组 gate **逐条都在散文里活着**

- gate ①（必填字符串非空）↔ 散文第 5 条「不许有空串：必填的字符串字段都得有内容」；
  gate ②（数组元素非空，含 `entities[].role`）↔ 同句「数组里也不许留空串占位」；
  ③（`coreLoopSteps`/`player.goals`/`mechanics` ≥ 1）↔ 同句逐条点名 + **并列出四个可以空数组的**；
  ⑤（各自数组内 id 唯一）↔ 第 6 条；
  ⑤b（**跨数组** `entities[].id` × `mechanics[].id`）↔ 第 6 条逐字（票 54 加的 gate，散文早就有）；
  ⑤c（`id` 不许写成类名 / 桶名）↔ 第 7 条（票 52 加的）。
- ⚠️ **`entities: []` 是人类专门从 gate 里划出去的**（`game-intent.ts:99-105`），
  散文也逐字对上了（「`entities` / `winConditions` / `loseConditions` / `ambiguity` **可以是空数组**」）。
- ⇒ **在 G 这一组里，这一类是零**。这是本票**唯一**一次可以下「这里没有」的结论，
  而它值钱的地方在于：**它把「散文跟着 gate 一起改」这件事在 `analyze-intent` 上验成了既有纪律**
  （**两次**加 gate —— 票 54 的 ⑤b、票 52 的 ⑤c —— 散文那一次都跟上了）。
  ⚠️ **但 H 行就在同一个文件里** —— 所以「上了纪律」不等于「没漏」。

#### H · `analyze-intent` gate ④ **散文一个字没说** —— 派生 [票 70](70-intent-optional-shell-gate-undisclosed.md)

- **gate**：`packages/contracts/src/game-intent.ts:221-226` ——
  「可选对象**若出现**，不得是空壳（整个省掉合法，`{}` 不合法）」，
  管 `progression` 与 `challenge`；⚠️ 两个字段在 schema 里都是 **`optional`**
  ⇒ **`{}` 过 Zod、被 gate 拒** —— 这条规矩**只住在 `superRefine` 里**，
  而 `toJSONSchema` 会**静默丢掉**它 ⇒ **模型看不见**。
- **散文**：`prompts.ts:154-155`（`FIELD_HINTS`）最接近的一句是
  「需求提了才填，给一句就够；**推不出就整个省掉**」；
  `:89-90` 第 5 条那句只管「**必填的**字符串字段」与「数组里」，**不覆盖**它
  （`progression.type` / `.description` **不是必填**）。⇒ 票面 §3 的**第四种形状**。
- ⚠️ **更要紧的一处**：`game-intent.ts:119-121` **自己声称**
  「这条 check 模型看不见……而「让模型知道有这条规矩」那件事，
  **由 `game-design/src/prompts.ts` 在工具 `description` 里补**」——
  ⚠️ **这句话对 ① ② ③ ⑤ ⑤b ⑤c 六组成立、对 ④ 不成立**。
  ⇒ 这不是「散文漏了一句」，是**契约里写着一句对其中一组不成立的断言**，
  而它是**给下一个读代码的人看的**（与 C 行那处**同款**：文书关于自己的断言过时了）。
- **够得着**：✅ 够（窄）：要撞上，模型得在 `progression`/`challenge` 上写出 `{}` 或 `{type:""}`。
- **真跑证据**：❌ **无（阴性 n=13）** —— 13 份真意图里 **12 份两份字段整个缺席**、
  **1 份**（`run-out/wasteland-scavenger-run/run/v1/game-intent.json`）**两份都填满**、
  **空壳 0 份** ⇒ 模型实测的行为正是 gate 想要的那个二选一。
  ⚠️ **但这不构成不立案**：这类判据**只在真跑撞见时才会被发现**，而本票的立案方式正是「读」。

### §3 · 五条**阴性 / 不成立**（逐条写下来，免得下一轮重扫）

1. **`analyze-intent` 的 ① ② ③ ⑤ ⑤b ⑤c —— 全部披露**（见 §2-G）。
2. **两张封闭词表与「8」**（见 §2-F）：今天不成立，**只记**。
3. ⭐ **R3 门下「散文比 gate 严」是常态、不是病** —— 这一条是**方法的读数**，
   扫描时最容易读反。例：`analyze-reference` 的
   「每个色都**必须真的出现在这张图里**」（`:83`）·「**不要**按画面占比从高到低排序」（`:84`）·
   `analyze-intent` 的「`ambiguity[]` 每句必须以字段名开头」（`:73`）—— 这些**故意没有判据**
   （R3：判据只收「精确可算 + 错了一定不是设计」）⇒ **别把它们读成**
   「gate 判的东西散文一个字没说」的**反面**而立案。⚠️ D 行（§2-D）之所以**还是**立了票，
   唯一理由是**隔壁契约对同一个不变量有 gate**——**不是**因为「散文要求没判据」。
4. **票面 §2 那第五种形状（散文样板 vs 装配期闸门）本票没碰**，票面已经写清「只记，不改范围」，
   三条出路仍待人裁 —— **本票一个字没往那儿挪**。
5. **第五步 `plan-assets` 不在射程内**（票面 §3 定的范围是四步）。它的散文
   （`packages/assets/src/prompt.ts` 那一族）**这次一个字没读**——
   ⚠️ 若将来要扫它，§0 那条「面是封闭的」**不适用于它**（那是**另一个包、另一族模板**）。

### §4 · 派生票（create-then-wire，四张，全部 `Blocked by: —`）

| 票 | 问题 | 类型 |
|---|---|---|
| ⭐ [票 67](67-design-all-mechanics-unmappable-corner.md) | `compile-design` 的「**全都**挑不出对家」是**没有合法输出**的角：照散文做 ⇒ gate ④ 判 `schema` 失败（**而且报错说「没干活」**）；唯一能过的路是散文禁止的近似顶替 | `grilling` |
| ⭐ [票 68](68-dna-palette-hex-consequence-stated-wrong.md) | `DNA_FIELD_HINTS.palette` 把「写 hex」的后果说成**有损**，实际是**当场判失败** —— 同一句错话还抄在契约注释里 | `grilling` |
| ⭐ [票 69](69-dna-palette-ref-bounds-unjudged.md) | `CharacterDNA.palette` 的 `palette:N` **没有越界判据** —— 而 VWS 的六桶有同款 gate，且 `dnaBrief` 把悬空引用**原样**写进生图提示词 | `grilling` |
| ⭐ [票 70](70-intent-optional-shell-gate-undisclosed.md) | 意图层 gate ④（`progression`/`challenge` 出现但两个字段都空）**散文一个字没说** —— 而契约文件头正**声称**「这条规矩由 `prompts.ts` 补」 | `grilling` |

⚠️ **四张票的落法照票面 §4 的先例**（「散文类的收口与判据类的收口**不是同一件事**」）：
67 与 69 里各有**要动判据/契约**的那一半，**都不在本票内动**，只在票面上写成问题；
68 是**散文类**、70 两半都有。**四张全部 `Status: open` / `Owner: —` / `Blocked by: —`**（可直接领）。
⚠️ **C 与 D 住同一句话**（`DNA_FIELD_HINTS.palette`）⇒ 68 与 69 的票面里**互相指了对方**、
并写明「落地时对一眼」—— 这是本票唯一一处**需要跨票协调**的地方。

### §5 · 边界（票面 §5 逐条对账）

- **不动 R 表**（要动按 R17 另开票）✅ —— 本票**没动任何文件**（除本票自己的票面与地图指针）。
- **不改任何契约的语义** ✅ · **不加重试 / 修复循环 / 自动重生成（R13）** ✅。
- `packages/qa` 一行不碰 ✅ · `game-maker.local.json` 一个字不动 ✅。
- **不执行任何付费真跑** ✅ —— 读的全是仓库内的文件与既有 raw（**零发上游调用**）。
- **扫描只读** ✅ —— `.scratch/**/experiments/` 的现场**一个字没动**
  （读到的都是既有文件；本票没有写任何 raw）。
- **不在扫描票里顺手改散文** ✅ —— 散文**一个字没改**（C/F/H 三处要改的都进了派生票）。

### §6 · 这次量**证明不了**的事（写在明处）

1. ⚠️ **它证明不了「这一类还有多少处」** —— 它只证明了**在这两个 `prompts.ts` × 这四个契约里，
   今天数得出来的是这几条**（八行，三条成立）。§0 那条「面是封闭的」**只管这四步**。
2. ⚠️ **三条成立的里，两条（C、D、H）是零尸体 / 纯阴性读数** ——
   它们靠的是**读**，不是**撞**。真要辩「值不值得治」，那是**四张派生票各自的 Q**，不是本票能裁的。
3. ⚠️ **本票没有真跑读数**（不是没跑，是**不许跑** —— 票面 §5 逐字写了「这是读仓库内文件的活」）。
   ⇒ 所以它给不出「模型实际会怎么读这一段」的读数；那是 A/B 探针的活（票 64 的先例）。

