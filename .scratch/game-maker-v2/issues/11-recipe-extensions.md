# 11. `AssetRecipe` 扩展：策略进清单 + `dependsOn` / `masterAsset` 的图与边

Type: grilling
Status: resolved
Owner: claude (2026-10-05)
Blocked by: 02, 03
Map: ../map.md
> 依据 **R10**（Q11c）。`docs/v2/01-contracts.md` §5/§6/§13。

## Question

R10 定了「策略住清单里、LLM 出初稿、人可改」。这一票把它落成**契约**。

### 1. 三种新策略各是什么，且各自有实现

§5 的策略枚举六个：`image | character-reference | image-edit | drawlist | procedural | import`。
今天 `AssetSource`（`recipe.ts:108`）是**三个**：`drawlist` / `image` / `import`。

- `character-reference` —— 见票 13（母版 → DNA → 动画）。
- `image-edit` —— ⚠️ 今天生图那条**已经有**「带输入图走 edits 端点」的行为
  （`image-gen.ts:460,469-474`：有输入图时 OpenAI 走 `/images/edits`）。
  要答：`image-edit` 是**新策略**，还是给「`image` + `reference`」一个**名字**？
- `procedural` —— ⚠️ **这个词在本仓库是被拆掉的降级链的遗留**（`CONTEXT.md:448-454`）：
  它现在是**失败**的意思，不是一种策略。R11 之前的三轮里没有裁决它。
  **这一票要正面答**：要么给「碰撞体」一个**不叫 `procedural`** 的名字，
  要么按 [[地形]] 的定义「**不引用任何资源**」**不给碰撞体建资产**。
  ⚠️ `03 §14` 给碰撞体开了 `procedural` 资产，而 `CONTEXT.md:295-298` 说「看不见的进地形」——
  **这两条打正面冲突，本票必须判一个**。

### 2. 依赖是**图**，今天是**扁平数组**

§6 要 `{dependsOn[], derivedFrom?, masterAsset?, referenceAssets?}`。
今天 `recipe.ts` 的 `assets` 是**扁平数组**，跨资产引用**一条都没有**
（唯一的引用是文件路径：`ImageSource.reference` 与配方级 `referenceImage`）。

要答：
- 引用用的是**资产 id** 还是**路径**？（票 04 在问同一件事的另一半）
- **谁**做拓扑排序（`player-master` 先于 `player-run`）？`pack.ts` 今天的并发
  （`--concurrency`）遇上依赖边怎么退化？
- 环怎么拒？——⚠️ 判据要可断言：一个**含环**的配方必须**当场拒绝**，不是跑到一半死。

### 3. 与 `03 §5` 的兼容

旧 fixtures（`fixtures/recipes/*.json`，8 份）**必须继续解析**。所有新字段一律 `optional`。
要答：`AssetGenerationStrategy` 是**新字段**还是给今天的 `kind` **改名**？
⚠️ 改名会让 8 份配方当场读不出来 ⇒ 这条**几乎只能是新字段**，但要说出来。

> ⚠️ **2026-10-02（[票 04](04-contract-character-dna.md) 已关）：`AssetDependency` 四条边里，`masterAsset` 已经落了。**
> 落在 **`AssetSpec.masterAsset`**（指向 `AssetRecipe.authoring[].id`），校验在配方的 `superRefine` 里
> —— 因为那是**同一份文件内**的引用族，契约自己看得见。
> ⇒ **本票接手剩下三条**：`dependsOn` / `derivedFrom` / `referenceAssets`，**以及拓扑排序**。
> ⚠️ 还欠一个形状的认识：**`AuthoringAsset`**（`{id, role, description, source, characterId, size}`，
> 在 `recipe.ts` 里，**不进交付包** —— 它以「独立数组」而非判别式实现，是**结构性**的）。
> 依赖图若要从母版走到资产，另一头就是它的 `id`。
> ⚠️ 母版的画布 `size` 与资产的缩放 `size` **同名不同义** —— 别在依赖图里把它们当成一件事。

## Answer

**结论：票面那三问各有答案，而其中一个**是「否」** —— 契约**只加了一个字段**（`dependsOn`），
六值策略枚举**不成立**，`procedural` 连同「给碰撞体建资产」一起**出局**。**
17 条裁决 · **19 条新测试** · 套件 **880/880**（此前 861）· `tsc -b --force` 干净 ·
两个守卫绿（145 份文档 · 759 条链接）· **12 发变异全部验过会红**。

### 0. 裁决表

| # | 轮/问题 | 裁决 | 落点 |
|---|---|---|---|
| 1 | Q1 | **不加 `AssetGenerationStrategy` 字段**：策略**就是** `source.kind`，而它**早就住在清单里**（R10 今天已满足） | 无（只改文档） |
| 2 | Q1 | 策略只有 **`drawlist` / `image` / `import`** 三个 | `recipe.ts` 不动 |
| 3 | Q1 | **`image-edit` 是别名** —— 就是 `image` + `reference`（`image-gen` 已自动翻 `/images/edits`） | 无 |
| 4 | Q1 | **`character-reference` 是别名** —— 就是 `image` + `masterAsset` | 无 |
| 5 | Q2 | **碰撞体不建资产**：它是 [[地形]]，`GameConfig` 的 `terrain` 是它的家 | `03 §14` · `02 §6.1` 回填 |
| 6 | Q2 | **`procedural` 出局**（在本仓库它是**失败**的意思）—— 不是改名，是**不许建** | 六处文档一起清 |
| 7 | Q3 | **`dependsOn?: string[]` 留下**（资产 → 资产）—— 唯一的依赖表达 | `asset-spec.ts` |
| 8 | Q3 | **`derivedFrom` 出局**（与 `masterAsset` 同一件事） | 无 |
| 9 | Q3 | **`referenceAssets` 出局**（与 `source.reference` 路径重叠） | 无 |
| 10 | Q3 | **归一化**：图 = `dependsOn ∪ {masterAsset}`，人**不写两遍** | `recipe.ts` |
| 11 | Q4 | **环在契约里判**（`findCycle`，走**两类边**）—— 时机是这条判据的一半 | `recipe.ts` |
| 12 | Q4 | **排序在 `pack` 里做**：promise-DAG；闸门与 `--concurrency` 语义**不变** | `pack.ts` |
| 13 | Q4 | ⚠️ **`masterAsset` 的**运行消费**归票 13**（`pack` 连 `authoring[]` 都够不着） | 播给票 13 |
| 14 | Q5 | **兑现母版画布的比例判据**（票 04 写在注释里、没人实现的那一条） | `recipe.ts` |
| 15 | Q5 | `AuthoringAsset.role` / `description` 的**空串不进 gate**（这是**唯一的人工编辑点**） | 无 |
| 16 | Q6 | **`authoring` 不改名**，但术语表把「输入母版 / 输出出处」**写清** | `CONTEXT.md` |
| 17 | Q6 | 新增词条 [[资产依赖]]（此前依赖词汇**在术语表里没有锚**） | `CONTEXT.md` |

### 1. 六值枚举逐值裁（票面第 1 问）

⚠️ **反直觉的起点**：R10 说「策略住清单里」，而**今天已经满足** —— `source.kind` 就是「这个资产怎么造」，
它就在清单里、人可改。§5 那个 `AssetGenerationStrategy` 在**代码里零命中**。

⇒ 所以这一问不是「加不加字段」，而是「那六个数里哪几个是**别名**」：

- `image-edit` —— **别名**。`image-gen.ts:468-471` 已经按「有没有输入图」**自动**在
  `/images/edits` 与 `/images/generations` 之间翻（`/generations` 收不下图，会**静默忽略**并回一张无关的图）。
  再加一个 `kind` 值 = 同一件事的第二个说法。
- `character-reference` —— **别名**。票 04 的原话是「一张被当作**参考图喂给生图模型**的角色位图」：
  机制一模一样，只是参考图多了一条边（`masterAsset`）。
- `procedural` —— **出局**（见 §2）。

⚠️ **顺带解掉票面 §3 的担心**：「`AssetGenerationStrategy` 是改名还是新字段」—— **两者都不是**，
因为策略**已经**是 `source.kind`。本票**不动 `kind` 的值集** ⇒ 8 份 fixture 一个字不改（兼容判据已在位）。

### 2. `procedural` 与碰撞体（票面说这一条本票必须判）

`procedural` 在本仓库**是「失败」的意思**：`CONTEXT.md` 的 [[Degradation]] 词条明写它随降级链一起删了
（「连带删除的落点：… `procedural.ts` / `degrade.ts`」），而它在 `docs/v2` 的**六处**还活着。

⇒ **碰撞体不建资产**，它是 [[地形]]（`GameConfig` 里**只有碰撞、没有画面**的那部分），
而 [[地形]] 的定义就是「**它不引用任何资源**」。三条理由：① 一份「不引用资源的资产」是自相矛盾的说法；
② 外壳从 `terrain` 解算碰撞，画出来**也没人看** ⇒ 花钱生一张看不见的图；③ 可见的碰撞体（行李堆、台阶）
按定义是 [[实体]]，走**已有**的 `image` / `drawlist`。
⚠️ 票面给的另一条退路（「给它一个**不叫 `procedural`** 的名字」）**不采用** —— 名字不是问题，**建资产**才是。

### 3. 四条边 → 两条（票面第 2 问）

```ts
dependsOn?: string[]      // 资产 → 资产（asset-spec.ts 的 COMMON，与 masterAsset 并排）
masterAsset?: string      // 资产 → 母版（票 04 已落）
```

- `derivedFrom` **出局**：与 `masterAsset` 说的是同一件事，而 `masterAsset` 是它在**角色那一档的具体化**
  （票 04 立母版为「一号公民」的理由正是**命名** —— 那就别再加一条泛化的别名）。
- `referenceAssets` **出局**：与 `source.reference`（**路径**）重叠。分野是干净的：
  **引配方外的文件用 `reference`，引配方内的资产用 `dependsOn`**。
  ⚠️ 票面问的「引用用 id 还是路径」因此有答案：**图用 id，文件用路径，两不相干**。
- ⚠️ **归一化**：`masterAsset` 是语义命名，它在图上就是一条边 —— 那条边由契约**派生**，
  **不要求人写两遍**（这份文件是**唯一人工编辑点**，让人写两遍就是让人写错一遍）。

### 4. 环与排序（票面第 2 问的后半）

- **环在契约里判**（`recipe.ts` 的 `findCycle`，DFS，**走两类边**）。
  ⚠️ **时机是这条判据的一半**：`packAssets` **第一行就 `parseRecipe`**（`ops.ts:837`）
  ⇒ 含环的清单在**任何生图、任何排版之前**被拒（退出码 4），不是跑到一半死。
  报错**抄得出那个环**（`a → b → a`），不是只说「有环」。
- **排序在 `pack` 里做**：**promise-DAG** —— 每个资产挂一个自己的 promise，依赖它的先 `await` 它。
  ⚠️ **闸门与 `--concurrency` 的语义一个字不变**（两道门只管同时在飞几笔）；今天 8 份 fixture
  **一条依赖都没有** ⇒ 行为**恒等于全并发**（有一条判据专门盯着这个不退化）。
- ⚠️ **`masterAsset` 的**运行消费**归票 13**：`pack` 今天连 `authoring[]` 都够不着
  （`BuildPackOptions.recipe` 是结构子集类型 —— 那是票 04「不交付是结构性的」的直接后果）。
  ⇒ 本票只保证**顺序**，**不保证数据**。环判据走两类边，是为了母版哪天进了运行图时**这条判据不用改**。

### 5. 落地时量到的：**又一种「测试因为错误的理由而绿」**

第 11 发变异（把「前置失败也照跑」的守卫拿掉）**没有变红**。查下来是：
`pack` 早有一道**共享的失败闸**（`stop`，串行时代留下的保险），它让「已经知道失败了」之后
**排进闸门的**调用不再发出去 ⇒ 我那条测试里的 b（依赖者）**本来**就被 `stop` 挡住了，
**与依赖边无关** —— 拿掉依赖边它照样绿。
⇒ 修法：改用**闸门之外**的失败（让 a 给出与 `framePlan` 对不上的帧数 —— 那句 throw 在
`await textGate(...)` **之后**，`stop` 一个字节都没设过），并**另加一条**测试明确「闸门内的失败由 `stop` 兜」。
⚠️ 这是「判据看着的那句话」那种病的**第五个变体**：这次不是变异瞄错了，而是**测试的因与果接错了**
（绿是对的，理由是错的）。**每一条「A 挡住了 B」的判据，都要问一句「还有谁挡住了 B」。**

### 6. 播下

- **`12`（Asset Planner）**：① 你的「校验只在 `recipe.ts` 的 `superRefine`」那条纪律**已满足** ——
  新字段与新判据**都在那一处**，别另写一份；② **策略只有三个值**，你出的初稿里不会也不该有
  `character-reference` / `image-edit`（那是 `reference` / `masterAsset` 两个参数化）；
  ③ **碰撞体不进清单** ⇒ 你不用给它排资源；④ ⚠️ `pack.ts:76-84` 手抄了一份 `AssetSourceLike` 三变体
  （契约 `AssetSource` 的本地镜像）—— 你加 `source` 侧字段时**两处都要改**，否则就是两套真相。
- **`13`（母版 → DNA → 动画）**：① 两条边都在契约里活着，但**运行消费归你**（`pack` 够不着 `authoring[]`）
  —— 「把母版的位图当参考图喂进去」那条管道是你的；② **母版画布的比例判据已经在了**（票 04 写在注释、
  本票兑现）：它与你票面写的「母版宽高比 ⊆ 引用它的资产的宽高比集合」是**同一件事**
  （一个母版被多个资产引用 ⇒ 那些资产的宽高比必须**彼此相等**）；
  ③ ⚠️ 「带参考图在某协议上会**静默不成立**」（你 §3 那一问）**仍然归你** ——
  本票没有碰协议能力那一层。
- **`15`（pipeline）**：跨文件的引用族（`characterId` → `character-dna.json`）仍然是你统一校验；
  ⚠️ 环与宽高比这两条**已经**在 `parseRecipe` 里判了，别再写第三份。
- **`17`/`18`/`19`/`22`/`26`**：无涉。

### 7. 连带改动（都记账，不是重开 R 表）

`asset-spec.ts`（加 `dependsOn?`）· `recipe.ts`（`findCycle` + 三条 `dependsOn` 判据 + 母版画布比例）·
`pack.ts`（promise-DAG；把原来那段「资源之间没有任何数据依赖」的注释改写成事实）·
`docs/v2/01-contracts.md`（§5 六值逐值裁 · §6 四边 → 两边 + 判环/排序/碰撞体）·
`03-claude-code.md`（§13 · §14 · §17）· `02-implementation-plan.md`（Phase 6 · §6.1 · Phase 10）·
`00-overview.md`（§2.4 + §10 的对账表加一行，末句改「最后六行」）·
`CONTEXT.md`（[[母版]] 与 [[Asset Recipe]] 各补一句 `authoring` 的指路；**新增 [[资产依赖]]** ——
此前依赖词汇在术语表里**没有锚**）。

⚠️ **没有派生新票**：本票解出来的东西都能落在既有的 12 / 13 / 15 上。
