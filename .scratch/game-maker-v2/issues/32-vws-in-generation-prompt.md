# 32. `VisualWorldSpec` 进生成提示词：六桶与 `materials` 今天零消费者

Type: grilling
Status: resolved
Owner: claude (2026-10-12)
Blocked by: —
Map: ../map.md
> 派生自[票 12](12-asset-planner.md) 的 Q2（人类裁定「**另票，不在本票接**」）。
> `docs/v2/03-claude-code.md` §15 · `02-implementation-plan.md` Phase 8。
> ⚠️ **2026-10-06 更新（票 31 关掉时）**：**「六桶与 `materials` 零消费者」这句现在只对生图那一步成立** ——
> [票 31](31-character-dna-gen.md) 的 `characterDnaPrompt` 是它们的**第一个读者**：六桶按「**颜色分工**」
> 逐桶摊开（`primary=palette:6,7,11 · accent=…`）、`materials` 按 `appearance` / `texture` / `color` 摊开，
> 供**角色基因**选色与选材质（⚠️ 那是**角色**层，产物是 `character-dna.json`）。
> ⇒ 本票的射程（**生图**提示词）与那处**不重叠**，票面其余部分**一字不动**；
> 题名里「零消费者」那半句按上面这段读。

## Question

`03 §15` 写着：**「生成 Prompt 必须结合：Original Reference Image · VisualWorldSpec · AssetSpec ·
CharacterDNA · Generation Strategy」**，并且补一句**「不要只把 VisualWorldSpec 转成文本 Prompt」**；
`02 Phase 8` 是同一张单子。而**今天 `VisualWorldSpec` 一个消费者都没有**：

> ⚠️ **2026-10-07 更新（票 15 关掉时）**：`buildAssetPack` 的入参里**现在有了** `visualWorld?`
> （票 15 的 Q15 α：把一份 `VisualWorldSpec` **拷进包**的 `authoring/visual-world.json`）。
> ⚠️ **但那是「带一份」，不是「读它」** —— 生图提示词那一侧仍然零消费者，本票的问题一个字没变。

- `buildAssetPack`（`pack.ts:37`）的入参里**根本没有 VWS** —— 那是个结构子集类型，只有
  `{recipe, style, referenceImage, assets}`；
- `imagePrompt(spec, style)` / `renderPrompt(spec, style)` 各只拿**两样**；
- ⇒ **六桶**（`palette.primary|secondary|accent|background|shadow|highlight`）与 **`materials`**
  在 `packages/*/src` 里**零读取** —— 而它们正是票 08 费劲长出来的东西（判据：「`palette` 是
  [[绘制词汇]]，**不是**画面分布的摘要」）。⚠️ 一个零消费者的字段正是 R7 的门要砍的东西。

### 要答

1. **接线方式**，两条路各有代价：
   - **(a)** `buildAssetPack({…, visualWorld?})` —— pipeline（票 15）手里**就有** VWS，直接传；
     **契约一个字不改**，但 `pack` 多一个可选入参，且「包内要不要带 VWS」那件事（票 15 的旧账）
     仍悬着。
   - **(b)** 配方里加一条 `visualWorldRef?`（与 `styleRef` / `characterRef` 同形）——
     自描述、可复跑，但**配方契约要动**，而且它是**唯一人工编辑点**，多一条路径就多一处能写错。
2. **接进去之后说什么**：六桶说的是「**颜色的分工**」（主色 / 强调色 / 背景色 / 阴影 / 高光），
   而生成那一步只认 `palette:N` —— 提示词里怎么把「这一笔用**强调色**」说清楚？
   `materials` 那一侧（`{appearance, texture?, color?}`）怎么进提示词？
3. ⚠️ **那几个提示词是「真跑调出来的」**：`backgroundLayerPrompt` 的注释里记着「票 51 四次真跑」
   量出来的一段话（「别去跟一段量出来的话对着写」）。往里加东西**要配自己的探针**。
4. §15 那张单子里还有 `AssetSpec` 与 `CharacterDNA` —— 它们的接线归**票 12 / 票 13**，
   **本票只管 VWS 那一样**。

## Answer

### 0 · 四条裁定（2026-10-12，人类作答；副本在 [`clarifications/32-round-1.md`](../clarifications/32-round-1.md)）

| 问 | 裁定 | 人类给的理由（原话） |
|---|---|---|
| **Q1** §15「不要只把 VWS 转成文本 Prompt」是闸还是护栏 | **(b) 护栏** | 「是实现方向的约束，**不应未经证据就提升为独立验收门槛**。但"参考图已存在"只能证明**图像输入存在**，不能单独证明 **VWS 的视觉信息已被正确使用**。」 |
| **Q2** 「结合 VWS」指整份文档还是特指新 view | **(b) 特指新 view**（⚠️ **与我的推荐相反**） | 「**不将**「结合 VisualWorldSpec」解释为整个文档的所有字段**都必须**接入生图。应**针对 §15 所讨论的新 view 判断**；否则容易把已有的 prompt-facing `style` 与新 view 的接线范围**混为一谈**。」 |
| **Q3** R6 那份分工是决定还是描述 | **(a) 是决定** | 「**R6 不能被当成对现状的随手描述**。如果 Q2 的解释要求改变 R6 已定边界，**应依 R17 先走独立变更票**，不能在当前票里悄悄改写。」 |
| **Q4** 落点 | **(c)** 记账 + 补文档说明 + 把六桶的**可计算**用途转给[票 47](47-unreached-constraints-enforcer.md) | 「**本轮不直接扩大实现范围**，也不把六个 buckets 自动提升为 QA 判据。由票 47 单独处理其可计算用途。」 |

**边界（人类原话，逐条进 Answer）**：

> - 当前票按**记账与文档说明**收敛，**不新增生图接线实现**。
> - 记录 **VisualWorldSpec 新 view 与现有 prompt-facing `style` 的范围区别**。
> - 六个 buckets 的**可计算**用途交由**票 47**。
> - **不做付费 probe**。若后续第 2 轮确实需要 probe，**必须先有独立报告，并取得明确授权**。
> - **不顺手处理票 22 的过期声明**；它仍是地图上待核查的问题。

### 1 · 本票最要紧的一行：**Q2 的答案让缺口从「假」变「真」，而 Q3 的答案让它无法在本票里被关上**

票面问的是「六桶为什么不进生图提示词」，我准备的推荐是「§15 已经由载体满足 ⇒ 无实现可做」。
**人类把这半条否掉了**：`style` 是 **prompt-facing 的载体**，而 §15 说的 VWS **是新 view** ——
⇒ **两者不是同一件事，拿载体去销账就是把范围混为一谈**。
⚠️ 而 Q1 的**附带条件**把另一半也堵上了：「参考图已存在」只证明**图像输入存在**，
**不能单独证明 VWS 的视觉信息已被正确使用**。

⚠️ **于是结论是：缺口是真的** —— 新 view（六桶 / `materials` / `composition` / `environment` /
`camera` / `lighting`）**今天确实不到生图那三张模板眼前**，而 §15 要的正是它。

⚠️ **而它是"真的"不等于"本票要关它"**：Q3 裁「R6 那份分工是**决定**」
（`visual-world.ts:9-24` 写着「新视图 → 给**代码**读 · `style` → 给**提示词**读」，**且带理由**：
「提示词要的是**原话**，而原话在封闭枚举里放不下」）⇒ **要接新 view 进生图，就必须先动 R6 的边界，
而那按 R17 得走一张独立的变更票**（先例：[票 33](33-r13-amendment.md) 改 R13 · [票 43](43-r18-amendment.md) 改 R18）。
⇒ **本票**（一张普通 grilling 票）**没有被授权改它**，所以它只**记账**、不施工。
**这不是把缺口丢了，是把它钉在一个说得出名字的去处上。**

### 2 · 记账：票面那句「VWS 一个消费者都没有」只对生图那一步成立（票面自己的 2026-10-06 注只收窄了一半）

票面（含它自己那半条更正）说六桶与 `materials` 的第一个读者是票 31。**量下来是两个，且都是把"分工"渲染成提示词文本**：

| 谁 | 在哪 | 读什么 · **读成什么** |
|---|---|---|
| [票 12](12-asset-planner.md) 资源规划 | `assets/src/prompt.ts:698-713` `worldBrief()` | 六桶（`:700`）+ `materials`（`:701`）→ **文本**进 `assetPlanPrompt` |
| [票 31](31-character-dna-gen.md) 角色基因 | `game-design/src/prompts.ts:355-382` `characterClassBrief()` | 六桶（`:358-360`）+ `materials`（`:361-366`）+ 一行 `N=hex` 对照（`:375`） |
| [票 10](10-design-compiler.md) 设计编译 | `game-design/src/compile-design.ts:137-142` `assertUpstream()` | `vws.camera.mode`（R12 那条拒绝面） |

⚠️ 票 31 那段注释**自己写着**六桶的 payload 是什么，本票照抄不改：
「它们的**原话**模型读不懂，但**分工**（哪一笔是主色 / 强调色 / 背景色）**就是这一层要用的东西**」。
⇒ **空的只有生图那三张模板** —— 而按 Q2，那正是缺口所在。

### 3 · 记账：§15 那张单子的**另外两项今天已经落地，而且代码自己点着 §15 的名**

`docs/v2/03-claude-code.md:493-503` 那张单子是**五项**，票面只盯了第二项。量到的另外两项：

- ✅ **第一项（`Original Reference Image`）已满足**：`ops.ts:236` 把世界的风格参考图**拷进配方目录**
  并设成 `referenceImage`，那句注释**逐字写着**「（`03 §15` 要求原图必须参与）」；
  `pack.ts:597-598` 读它、`:668` **每一次**生图调用都带上 `styleReference`。
- ⚠️ **第二项（VWS）今天只到了"提示词面"那一半**：`ops.ts:229-231` 把**这个世界的 `style` 子树**
  落成配方旁的 `stylespec.json`（注释逐字：「R6 说的那个**兼容载体**」）⇒ `pack` 读它 →
  `styleBrief(style)`（`prompt.ts:99-106`）+ `style.palette` 进三张模板。
  ⚠️ **而按 Q2，这一半不算替新 view 销账** —— 本条记的是**事实**，不是**结案**。

⇒ **这两条合起来正是 Q2 那个坑的形状**：载体在，**新 view 不在**，而两者在同一份文档里长得像同一件事。

### 4 · 本票做了什么（三处，全是账）

| 落点 | 改法 |
|---|---|
| `docs/v2/03-claude-code.md §15` | 加**带日期的注**（R17 的表达层）：§15 的「结合 VisualWorldSpec」**指新 view**；今天活着的两条路是**原图内联**与 **`stylespec.json` 载体**，而**新 view 的读者是理解层**（票 10 / 12 / 31）；接新 view 进生图**要按 R17 另开变更票**（因为 R6 已经把读者分工定死）。⚠️ **原文一字未删**，注在原文之下。 |
| [票 47](47-unreached-constraints-enforcer.md) | 加**带日期的注**：本票把**六桶是"强调色面积上限"那条约束唯一可算的来源**这件事**交给它**。⚠️ **播 ≠ 裁** —— 本票**不**替票 47 回答「要不要执行者、给在哪」，也**不**把六桶提升成判据。 |
| 本票 + 地图 | Answer（本文件）· 地图的 `Decisions so far` 一行 · 地图的 `Not yet specified` 一格（残留：**要不要按 R17 重开 R6 把新 view 接进生图**）。 |

### 5 · 明确**没做**的（照抄人类的边界）

- **不新增生图接线实现**（三张模板 · `imagePrompt` / `ImagePromptTarget` · `buildAssetPack` 的提示词侧，**一行没碰**）。
- **不重开 R6 / 票 02**（那是 Q3 指的那张独立变更票，本票**没被授权**）。
- **不做付费 probe · 一张图未买 · 零付费跑**。
- **不碰 `game-maker.local.json`** · **不碰 `packages/qa`**。
- **不顺手处理[票 22](22-review-with-reference-image.md) 的过期声明**（人类明确划出）。
- **`.scratch/**/experiments/` 的现场一个字未动**（那是量出来的证据）。

### 6 · 播下

- ⚠️ **[票 47](47-unreached-constraints-enforcer.md)**：六桶的**可计算**用途（含「强调色面积上限」可算的那一半）**正式转到它名下**。
- ⚠️ **一张"将来"的票（今天**不开**）**：**要不要按 R17 重开 R6、把新 view 接进生图提示词** ——
  它进地图的 `Not yet specified`，**不进前沿**。⚠️ **为什么今天不开**：人类裁的是「本轮不直接扩大实现范围」，
  而**更靠前的障碍是判据** —— 按 R3 没有任何东西判得了「加了六桶以后图有没有变好」，
  而地图的 Destination **明写**「像不像同一个视觉世界」**不是**终点。⇒ 开它之前，先有人得说出**判据**是什么。

✅ **32 关。**
