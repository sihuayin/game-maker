# 11. `AssetRecipe` 扩展：策略进清单 + `dependsOn` / `masterAsset` 的图与边

Type: grilling
Status: open
Owner: —
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

## Answer

（待解）
