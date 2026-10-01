# 19. Intent QA：覆盖度是**集合差**，不是打分

Type: grilling
Status: open
Owner: —
Blocked by: 06, 09, 10
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> 依据 **R3**（Q13）。`03 §23` 要「判断是否实现用户主要意图，**必须输出缺失项**」。

## Question

R3 给了 Intent QA 一个**可精确算**的形式：**集合差** ——
「`GameIntentSpec` 里每个实体/机制**在 `GameDesignSpec` 里有对应项**」。

这一票要把它**做出来**，并回答它最大的难点：**「对应」怎么算**。

### 1. 「有对应项」是字符串相等还是别的

- `GameIntentSpec.entities[].id` 与 `GameDesignSpec` 的 `enemies[]/npcs[]/interactables[]`
  —— 名字**大概率不会一模一样**（一个是用户的说法，一个是编译出来的）。
- **(a) 结构化的对应**：要求 `GameDesignSpec` 的每一项**回指** `GameIntentSpec` 的某一项
  （加一个 `fromIntent: string` 之类的字段）⇒ 集合差是**构造上可判**的。
  ⚠️ 代价：多一个字段，且它必须**过 R7 的门**（谁读它 —— 就是这一票）。
- **(b) 让编译器对齐 id**：`compile-design` 被要求**沿用**意图里的 id。简单，但只对 id 不存在的项有效。
- **(c) 判成观察**：用 LLM 判「覆盖了吗」—— ⚠️ 那就**不是**判据了（R3），退回打分。

要选一个。⚠️ **(a) 是唯一让这条路成为「判据」的**，因为只有它精确可算。

### 2. 缺项的落点

`01-contracts.md` §11 给的是 `IntentQAResult { coverage: Record<string, boolean>;
score: number; missingRequirements: string[] }`。
R3 之后 `score` **没有位置**。要答：`coverage` 那个 `Record<string, boolean>` 的**键**是什么
（意图里的哪一层：实体？机制？核心循环的每一步？）—— 键选错了，覆盖度就是**一个好看但没用的百分比**。

### 3. 它和 `ambiguity` 的关系

`GameIntentSpec.ambiguity: string[]`（票 09 §2）记着「需求没说清楚的地方」。
要答：缺项（`missingRequirements`）与歧义（`ambiguity`）**是不是同一件事**？
⚠️ 一个说的是「我们没做」，另一个说的是「你没说」—— 混起来会让报错指向错误的一方（用户 vs 我们）。

### 4. 判据可断言

要能给出一条**先红后绿**的用例：一份故意漏掉某个实体的 `GameDesignSpec` ⇒ 覆盖度**红**，
且 `missingRequirements` 里**正好**是那一个。变异检验：把集合差换成「非空即通过」⇒ 用例必须红。

## Answer

（待解）
