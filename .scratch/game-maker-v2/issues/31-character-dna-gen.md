# 31. `character-dna-gen`：`VisualWorldSpec` + 设计层实体 → `CharacterDNA`

Type: grilling
Status: resolved
Owner: claude (2026-10-06)
Blocked by: 04, 07
Map: ../map.md
> 由[票 04](04-contract-character-dna.md) 的 **Q4 / 第 4 轮 Q1** 毕业。
> §16 的链被反转成 `DNA → 母版 → 动画` 之后，**DNA 的产出**从票 13 里拆了出来 ——
> 它住在理解层（`packages/game-design/character-dna.ts`），不是生成层。

## Question

契约已经落地（`packages/contracts/src/character-dna.ts`，票 04）。
本票要造**产出它的那一步**，并回答它自己的几个问题。

### 1. 它是不是一次 LLM 调用，输入到底是什么

票 04 Q4 已裁：**输入 = `VisualWorldSpec`（类）+ `GameDesignSpec` 里的那个实体（个体）**，
经由一次 **`tool_choice` 强制工具调用**（R16 新协议；底座在票 28，**别实现第二遍**）。

要答的：

- **喂进去的是哪几格**？`GameDesignSpec.player` / `enemies[]` / `npcs[]` 的字段（`behavior` /
  `threat` / `role` / `interaction`）够不够填出 `identity` / `silhouette` / `face` / `clothing` / `gear`？
  ⚠️ 票 03 给这些字段标的是 ① 档（欠条）—— 本票是**第一个**真正兑现它的地方。
- **`VisualWorldSpec.character` 那五格怎么进去**？⚠️ 票 04 明令：
  **`VWS.character` 的五个字段一个都不许机械复制进 DNA** ——
  世界说「类」，DNA 说「个体」。要给出**喂法与防复制**的具体做法。

### 2. 一条 DNA 一个角色：怎么批

`player` + `enemies[]` + `npcs[]` 可能有好几个角色。
- 一次调用产**一条**，还是产**一整个数组**（`character-dna.json` 是单文件装全部，票 04 Q3）？
- ⚠️ 若一次产全部，**`max_tokens` 与截断**要算（票 27 实测过 `input={}` 那一档）。

### 3. `id` 的沿用是一条**判据**，谁来兑现

票 04 Q3 定了：DNA 的 `id` **沿用 `GameDesignSpec` 那个实体的 `id`**。
⇒ 「模型照抄 id」是**不可靠**的（票 02 的裁决 21 已经处理过同款：`style.id` 由**调用方注入**、
解析后**强制覆盖**）。要答：这里是不是照同一条办。

### 4. 非人形怎么写

票 04 Q2：`face` / `clothing` 写 `"none"`、`gear` 写 `[]`，**不允许省略**。
要答：提示词怎么说清「不存在要显式写 `none`」—— ⚠️ 模型很容易**省略**可选性看起来合理的字段，
而契约会把它判红（那时是一次**重采样**的代价）。

### 5. 判据

- **引用族**：`character-dna[].id` ⊆ `GameDesignSpec` 的角色实体 id 集合。
- **构造性**：每个角色实体**恰好**有一条 DNA。
⚠️ 两条都要在**构建期**执行（R3；票 15 的 pipeline 是落点之一）。

## Answer

**结论：`compile-character-dna` 落地**（`packages/game-design/` 三个源文件 + 契约两处），
**理解层的第五发调用**，也是**第一条「一次调用产一族记录」的调用**。
12 条裁决 · **48 条新测试** · 套件 **976/976**（此前 928）· `tsc -b --force` 干净 ·
两个守卫绿（146 份文档 · 777 条链接）· **16 发变异全部验过会红** · **真探针 n=4（首发过 Zod 4/4）**。

### 0. 裁决表（第 1 轮 5 问 + 人类的三处收紧 + Q5 的边界）

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | 1-Q1 | 喂**两半**：**类**（`vws.character` 五格 + `styleIdentity` + 六桶 + `materials` + `shapeLanguage` + `constraints`）× **个体**（设计层那条实体的行为字段 + 它的 `id`） | `prompts.ts` |
| 2 | 1-Q1（人类收紧） | **「逐字相同」可以做** —— 但它的名字、错误消息、契约注释**一律**写成「**守门人 · 必要不充分**」，**不许**被引用成「不许复制」这条语义规矩的判据 | `build-character-dna.ts`（`COPY_GUARD`）· `character-dna.ts` 文件头 |
| 3 | 1-Q2 | **一次产一整个数组**（β），不一次一条 | `compile-character-dna.ts` |
| 4 | 1-Q3 | `id` 沿用走「**提示词给 id + 装配核集合**」，**不是**注入 + 强制覆盖 | `build-character-dna.ts` |
| 5 | 1-Q3（人类收紧） | **集合相等升格为本票最核心的构造性 gate**（不是顺带的一条校验） | `CHARACTER_SET_GATE` |
| 6 | 1-Q4 | 兑现 `01-contracts.md §7` **已经写下、契约里没人实现**的那条判决：加**顶层结构性空值 gate** | `contracts/character-dna.ts` |
| 7 | 1-Q4 | `"none"` 是**合法值**；gate **只查「空」，不查「是不是 `none`」** | 同上 |
| 8 | 1-Q5 | 落地形状全表（见 §4）：落点 / 协议 R16 / 账 / 工具名 / `max_tokens` / 不做 CLI / 不写文件 | 三个源文件 |
| 9 | 1-Q5（人类裁定） | **两条检查都阻断**（都算 `schema` ⇒ 重采样），但**称谓分明** | `build-character-dna.ts` |
| 10 | 1-Q5 | 真探针 **n=4**，两臂（normal ×2 / robotic ×2） | `experiments/dna-first-shot/` |
| 11 | 补（本票自己发现） | 契约：`LedgerStep += "character-dna"`（不动任何旧值） | `contracts/ledger.ts` |
| 12 | 补 | 落点文件名跟兄弟文件同款：`compile-character-dna.ts`（Q5 表里我写的是 `character-dna.ts`） | 文件划分 |

### 1. Q1：喂哪几格，以及那个**守门人**

外观的两半摆在一起，而设计层**一个外观字段都没有**（票面 F3：`behavior` / `threat` / `role` 说的全是「它干什么」）：

- **类**（世界语法管所有角色）：`vws.character` 的五格**逐个具名**插值 + `styleIdentity` + **六桶色板** +
  `materials` + `shapeLanguage` + 世界的 `constraints`（后者是为了说清「你的 `visualConstraints` 是**叠加**，不是替代」）；
- **个体**（设计层）：`player` / `enemies[]` / `npcs[]` 的行为字段**逐条摊开**，每条**带着它的 `id` 一起给**。

⚠️ **无可比的那两格**：`proportions` / `poseLanguage` 在 DNA 里**没有同名字段**
（`bodyProportions` 已被票 04 的裁决 3 砍掉，理由是它是 `headCount(size.h)` 的可派生副本）
⇒ 它们**只作为提示词的输入**，不参与下面的逐字比较。这条写在了 `COPY_GUARD_PAIRS` 上方 —— 免得下一个人以为漏了。

**守门人比的三对**（逐字、trim 之后）：`dna.silhouette` ↔ `vws.character.silhouette` ·
`dna.clothing` ↔ `…clothing` · `dna.face` ↔ `…faceAbstraction`（⚠️ **最后一对名字不同、语义对应**）。
世界那格**缺席或空白** ⇒ 无可比、跳过（不是通过也不是失败）。

**人类收紧后的措辞纪律，落到三处**：

1. **契约注释**（`character-dna.ts` 文件头）：「票 31 给这条硬约束配了一个守门人，**而它只是个守门人**……
   换一个标点、加一个「的」就绕过了 ⇒ **不许**被引用成判据」；
2. **错误消息**：`【守门人 · 必要不充分（换一个标点就绕过）】…`，并明说「真正该做的是**重写这一格**」；
3. **提示词**：⚠️ 这里**反着写** —— 工具说明里**不出现「逐字」两个字**（说成天网只会教会模型绕），
   说的是**语义规矩**（「这一类共有」vs「把它**落到这一个身上**」）。有一条测试钉着
   `expect(TOOL_DESCRIPTION).not.toContain("逐字")`。

⚠️ 而且它**只比整句、不比相似**：相似度要阈值，阈值就是**分数**（R3 把「不评分」钉在判定层上）——
这条检查之所以还能存在，正因为它只做**精确可算**的那一半（票 02 裁决 21 的同款取舍）。

### 2. Q3：集合相等就是这票的核心，而 `id` 沿用的机制**换了形状**

**那一族**= `player` + `enemies[]` + `npcs[]`（票 04 裁决 13）。`player` 必填 ⇒ 这一族**永远不会空**
⇒ 那条 gate **永远不会因为「没有角色」而恒真**（一条永远绿的判据就是废的）。

**两头都报、报告的措辞不一样**，因为它们是两种错：

| 哪一头 | 报的话 | 读者该去改什么 |
|---|---|---|
| 少一条（设计层有、DNA 里没有） | 「**没有 DNA** —— 把用户见过的那个角色做丢了」 | 让模型补上 |
| 多一条（DNA 有、设计层没有） | 「**在设计层没有对家** —— 要么 id 抄错了，要么凭空造了一个角色」+ 明写「`interactables[]` / `resources[]` **没有基因**」 | 删掉 / 改 id |

**为什么不是「注入 + 覆盖」**（票面 §3 引的票 02 裁决 21）：`style.id` 是**一个标量**，覆盖是平凡的；
而 DNA 的 `id` 是**每条记录的键** —— 「覆盖成**谁**的 id」在 N 条上没有良定义。
⚠️ 按位置覆盖更糟：位置一错位就**静默错配**（把玩家的脸安在敌人身上）。
⇒ 那条裁决的**原则**（身份由调用方给、不由模型观察）在这里**完全适用**，只是**机制随形状变**：
标量 ⇒ 覆盖，键集 ⇒ 校验。**而那条校验正好就是票面 §5 要的构造性判据** —— Q3 与 §5 合成一条。

⚠️ **已知噪声（留档）**：若模型把**同一个角色写了两遍、起两个 id**（`e-drone` / `e-drone-2`），
报出来的是「少一条 + 多一条」两面 —— 人读得出「这其实是同一个角色」，机器说不出。
它不产生**静默**的错误（一定响），只是措辞指不出那个真相。

### 3. Q4：那条「文档里早就判过、实现没有」的空值 gate

`01-contracts.md §7` 原话：**「⚠️ 因此空串（`""`）也不算 —— 否则它会变成第二个隐形缺省。」**
—— 与票 09 / 票 10 各立过一遍的**同一条 gate**，落在这份契约上时只剩一句自白。本票兑现它：

- **进 gate**：五个必填字符串 **trim 后**非空（`.min(1)` 挡不住 `"   "`）· `gear[]` / `visualConstraints[]` 的**元素**非空
  （`palette[]` 的元素由 `PaletteRefShape` 的正则保证）；
- **不进 gate**（逐条写在契约里，免得下一个人往里加）：**`"none"` 是合法值**（那是**写下来的不存在**）·
  三个数组**本身可空**（无人机没有装备）—— ⚠️ 「`[]` 也是一种**说出来**」，它是「确实没有」与「忘了填」之间那道分界的一部分；
- **落点是装配步的重过**：`superRefine` 只在**整份文件**这个形状上跑得起来（与票 10 让 gate 响在重过那一次同款）。

### 4. Q5：落地形状 + **两条检查的档位**（人类裁定：都阻断，称谓分明）

| 项 | 定法 |
|---|---|
| 落点 | `packages/game-design/src/`：`build-character-dna.ts`（纯：两条检查 + 重过契约）· `compile-character-dna.ts`（I/O）· `prompts.ts` 加第三段 |
| 两条检查的档位 | **都算 `schema`** ⇒ 调用方**重采样**。⚠️ 名字 / 错误消息 / 注释**分得清清楚楚**：一条是**构造性 gate**、一条只是**守门人** |
| 注入 | **一个都没有** —— `format` 是字面量（模型照抄、契约判）、`id` 是**核**出来的。⚠️ 与票 09 的干净**同款、理由相反**（那里是「模型全知」，这里是「身份由设计层给」）。而**装配步仍然要**（两条检查 + gate 的重过都住在那里） |
| 协议 | R16（`forcedTool` + `parseToolUse` + 3 次地板） |
| 账 | `LedgerStep += "character-dna"` · `target = "character-dna"` · 工具名 `emit_character_dna` · `max_tokens = 16_000` |
| CLI | **不做入口**（照 08 / 09 / 10 的前例） |
| 写文件 | **不写**：本步只返回值，`run/v<N>/character-dna.json` 由票 15 落盘 |
| 出发前的免费拦停 | 凭据没配 · **设计不过契约** · **世界不过契约**（后两条是「从磁盘读回来的产物」那道口子，与 `compile-design` 同款） |

⚠️ **本步只有一条错误路**：DNA 那一侧**没有 R12 那种「拒绝」**（拒绝面在票 10 与票 15）。
⇒ 与 `compile-design` 的对照很干净：那一步两档（`schema` / `rejected`），这一步一档。

### 5. 真探针（n=4）—— 四件事的读数

跑法：`node .scratch/game-maker-v2/experiments/dna-first-shot/run.mjs`。
输入是**现成的真东西**：设计取票 10 探针第 1 发的入参、世界取票 08 探针第 1 发的入参
（那份 `character` 五格**是填满的** ⇒ 守门人**有得比**）。两臂各 2 发，`max_tokens=16_000`。

| 发 | 臂 | 耗时 | served | out_tok | 过 Zod | 装配 | 抄了世界那五格 |
|---|---|---|---|---|---|---|---|
| 01 | normal（2 角色） | 7.99s | `deepseek-flash` | 1195 | ✅ | ok | 无 |
| 02 | normal（2 角色） | 6.54s | `deepseek-flash` | 935 | ✅ | ok | 无 |
| 03 | robotic（3 角色） | 7.71s | `deepseek-flash` | 1130 | ✅ | ok | 无 |
| 04 | robotic（3 角色） | 7.66s | `deepseek-flash` | 1155 | ✅ | ok | 无 |

- **① 首发过 Zod：4/4（100%）**。⚠️ 与前三票的量级不同（08 是 75%、10 的那一臂也是 4/5），
  而 n=4 **不构成因果** —— 只能读成「这一发的形状今天没露怯」。
- **② 非人形会不会老实写「没有」。** robotic 臂那条**人为加的** `e-drone`：两发都写 `face: "none"` /
  `clothing: "none"`，而 `gear` **反而给了两条具体物**（「机身正面嵌一枚圆形信号灯…」「机身下沿一条细长取景槽…」）
  —— ⚠️ 这正是那一格该有的样子：「没有脸」与「身上有什么」是**两件事**，被**分别**说出来了。
  ⚠️ **诚实地说**：normal 臂那条「非人形」标签是**我自己贴的**（`e-mutant`「游荡的变异体」），
  而模型把它当**人形**写了（给了脸与衣服的散文）⇒ **normal 臂其实没量到这一格**，
  真正量到它的只有 robotic 臂。人形 / 非人形在这一发里**没有兜底**：靠的是实体自己的说法。
- **③ 有没有整句抄世界那五格：0/4**（守门人一次都没响）。⚠️ **这条读数弱，别当结论**：
  世界那份 `character` 是**英文**（`boxy hat brim, tall rectangle body…`）、产物是**中文**，
  逐字抄的**先天概率就低**。四条产出的做法是**把类翻译并落到这一个身上**（「比同类窄一号，左肩塌下去」那类）。
  ⇒ 守门人的**失败路径**不靠探针覆盖，靠**测试与变异**（M3/M4 两发变异专门打它）。
- **④ 一族一次的输出 token**：935~1195 / 2~3 角色（**单角色 377~598**）⇒ `max_tokens = 16_000` 有 ~13 倍余量。
  **Q2 那条「截断要算」的答案：今天算得过来**（10 个角色的族也就 4K~6K 量级）。
- ⚠️ **一条读数不可信**：`input_tokens` 在四发之间从 **144 跳到 3418** —— 那是代理那一侧的事
  （票 25 的「代理一直在变」对它同样成立），**别拿它推因果**。
- raw 落盘 4 份（`raw/01-normal.json` … `raw/04-robotic.json`，含模型输出与用量，无凭据）。

### 6. 未决 / 派生（⚠️ 本票**没做**的那些，别当成漏了）

- ⚠️ **DNA 的 `palette:N` 今天没有任何东西查它落不落在世界色板里。** `CharacterDNASchema.palette`
  只由 `PaletteRefShape` 的正则保证**形状**（`palette:<数字>`），**越界**（如 `palette:99`）要拿
  世界的 `style.palette` 长度才判得出 —— 那是**跨契约**的，与本票那两条**同款** ⇒ **装配步是它天然的落点**。
  ⚠️ **本票没做，是故意的**：票面 §5 只点了两条判据，第 1 轮 Q5 也只裁了两条（人类还专门把它们的两档分法收紧过）
  —— **加第三条检查会动那次的裁定**。⇒ 记为派生问题，交给人开票。
  （探针里 4/4 发的 refs **全在 0..15 之内**，所以它今天**不是活的**。）
- ⚠️ **票 32 的票面说「六桶与 `materials` 零消费者」—— 这句话现在只对生图那一步成立**：
  本票的提示词是它们的**第一个读者**（六桶按「颜色分工」摊开、`materials` 按 `appearance` / `texture` / `color` 摊开）。
  ⚠️ 票 32 的射程本来就只有生图那一步（它的 §3 明写「本票只管 VWS 那一样」），所以这句话已在那边改掉。
- ⚠️ **票 04 §6 那条未决本轮仍没量到**：「`silhouette` / `face` / `clothing` 的 ① 档区分是**推的、不是量的**」——
  本票量的是「**模型会不会写出来**」（会，而且写得很具体），**不是**「生图那一步听不听」。
  ⇒ 那要等**票 13** 真跑图。**押给票 13，本票不认领。**
- 「`interactable` 与 `npc` 的边界」那团雾**只缩不毕业**：票 04 留的那个「`interactables[]` / `resources[]`
  **默认**没有 DNA」的口子，被本票**关掉了**（变成「就是没有」+ 多一条就报错）；而
  「一台会说话的自动售货机该归哪一类」仍是**设计层的**问题、仍无消费者。
- ⚠️ **票 13 当场解冻**（它的 blockers 里 `31` 是最后一个）。

### 7. 改了哪些文件

| 文件 | 改什么 |
|---|---|
| `packages/contracts/src/character-dna.ts` | 顶层空值 gate（trim 后非空 + 数组元素非空）+ 文件头那条「守门人」的措辞纪律 |
| `packages/contracts/src/ledger.ts` | `LedgerStep += "character-dna"` |
| `packages/game-design/src/build-character-dna.ts` | **新**：`characterEntities` · `characterSetGate` · `verbatimCopyGuard` · `buildCharacterDna` |
| `packages/game-design/src/compile-character-dna.ts` | **新**：I/O、重采样、账、三处免费拦停 |
| `packages/game-design/src/prompts.ts` | **新**：`CHARACTER_DNA_TOOL_NAME/_DESCRIPTION` · `characterDnaPrompt` · `DNA_FIELD_HINTS` · 两个 brief |
| `packages/game-design/src/index.ts` · `package.json` | 导出与一句描述 |
| 测试 | `contracts/tests/character-dna.test.ts`（+5）· `game-design/tests/{build-character-dna,compile-character-dna,dna-prompts}.test.ts`（**新**，+43）· `tests/fixtures.ts`（+4 个夹具） |
| 探针 | `experiments/dna-first-shot/run.mjs` + `raw/` 4 份 |
