# 31. `character-dna-gen`：`VisualWorldSpec` + 设计层实体 → `CharacterDNA`

Type: grilling
Status: open
Owner: —
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

（待解）
