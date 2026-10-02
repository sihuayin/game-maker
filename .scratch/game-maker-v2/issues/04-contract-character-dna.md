# 04. `CharacterDNA` 落盘成契约 —— 它是「跨资产同一份」，不是一次调用的中间量

Type: grilling
Status: resolved
Owner: amber
Blocked by: —
Map: ../map.md
> 依据 **R14**（Q16①）。母版机制**已经在跑**，缺的是契约。
> ⚠️ **2026-10-01（票 28）：本票造的是 V2 契约 —— 请用 `import { z } from "zod/v4"` 写**（不是 `from "zod"`）。
> 理由与代价见[票 28 的 Answer](28-structured-call-substrate.md)：`toolInputSchema` 只能转 v4 的 schema，而 v3/v4 的 schema **不许互相嵌套**。
> 另：**封口用 `z.strictObject`** —— 普通的 `z.object` 不产出 `additionalProperties: false`。

## Question

`01-contracts.md` §7 给的 `CharacterDNA`：

```ts
{ id, identity, bodyProportions, silhouette, face, clothing,
  equipment[], palette[], accessories[], visualConstraints[] }
```

R14 定了：**落盘成契约**，进 `run/v<N>/`。要答的是**形状与来源**。

### 1. 它从哪来

两条路，要选（或都要）：

- **(a) 从 `VisualWorldSpec.character` 派生** —— `01-contracts.md:118-124` 里
  `character: {proportions, silhouette, poseLanguage, clothing, faceAbstraction}` 就是它的雏形。
  派生的话，DNA 是**世界语法在某个角色上的特化**。
- **(b) 由一次 LLM 调用产出** —— 从「世界 + 这个角色是谁」生成一份 DNA。

⚠️ 若走 (a)，那 `VisualWorldSpec.character` 与 `CharacterDNA` 是不是**同一件事的粗细两版**？
——**这正是票 09 删 `GameSpec` 的那条理由，要对它正面回答**。

### 2. 它和 `01 §6` 的 `AssetDependency` 怎么咬合

§6 给了 `{dependsOn[], derivedFrom?, masterAsset?, referenceAssets?}`，并画了：

```text
player-master
 ├── player-idle
 ├── player-run
 ├── player-jump
 └── player-attack
```

今天的实况（别重新量）：`ImageSource.reference`（`recipe.ts:60-65`）已经是一张**文件路径**的母版；
`fixtures/recipes/shift-change-image-anim.json:46` 已经在用；多帧是**一次调用画一行、按墨迹间隙切**
（`pack.ts:340-342,377` + `sheet.ts`）。**缺的只是契约**。

要答：`masterAsset` 是**资产 id**（新，图上一条边）还是**沿用今天的文件路径**？
若换成 id，图和边**谁来拓扑排序**（谁先造谁）？今天 `assets` 是**扁平数组、零依赖边**。

### 3. `03 §16` 那句「而不是 idle/run/jump 分别重新设计角色」

今天的**机制已经满足**这条（一次调用画一行 ⇒ 帧间一致）。要答的是：
**它是不是已经够了**，还是 DNA 契约能买到今天买不到的东西（例如**跨两个资源**的一致性：
`player` 与 `npc-trader` 是两个 AssetSpec，今天没有任何东西保证它俩像同一个世界的人）。

## Answer

**结论：`CharacterDNA` 落地成契约（`packages/contracts/src/character-dna.ts`，v4），
并顺手把「母版」立成配方里的一等公民（`AssetRecipe.authoring[]`）。
判据三条全绿：**30 条新测试**（其中三条变异验过会红）· 套件 **657/657**（此前 627）·
`tsc -b` 干净 · `check:deps` / `check:links` 绿。**

### 0. 裁决表（五轮共 38 条）

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | R1-Q1 | DNA 的消费者 = **R13 的重生成**（主）+ 提示词（次）；**跨资产一致性排除**（那个已由原图内联买到） | 文件头 |
| 2 | R1-Q2 | `VWS.character` = **类**，DNA = **个体**；五个字段**不许机械复制** | 文件头 |
| 3 | R1-Q3 | 砍 `bodyProportions`（**可派生的副本**，不是零消费者）；留 `silhouette` / `face` | `character-dna.ts` |
| 4 | R1-Q4 | `palette` → **`PaletteRef[]`** | 同上 |
| 5 | R1-Q5 | 母版**进配方**，成为一等资产；**不交付** | `recipe.ts` |
| 6 | R2-Q1 | 创作态用**独立数组** `authoring[]`（**结构性**，不是判别式） | 同上 |
| 7 | R2-Q2 | 母版**不复用 `AssetSpec`**；**不收 `styleId`** | `AuthoringAsset` |
| 8 | R2-Q3 | `characterRef`（路径）+ `characterId`（id）；**单文件装全部角色** | `recipe.ts` |
| 9 | R2-Q4 | DNA ← **VWS + `GameDesignSpec` 实体**（一次 LLM 调用） | 票 31 |
| 10 | R2-Q5 | `AssetSpec.role` / `description` **降格为资产级** | `asset-spec.ts` |
| 11 | R3-Q1 | `clothing: string` + **`gear: string[]`**（合并 `equipment`/`accessories`） | `character-dna.ts` |
| 12 | R3-Q2 | **全部必填**，非人形写明确值（`"none"` / `[]`） | 同上 |
| 13 | R3-Q3 | DNA 的 `id` **沿用设计层实体 id**；有 DNA 的 = `player` + `enemies` + `npcs` | 同上 |
| 14 | R3-Q4 | **`DNA → 母版 → 动画`**；`Master → DNA` **禁止** | `03 §16` 按 R17 反转 |
| 15 | R3-Q5 | `AuthoringAsset.characterId` **必填** | `recipe.ts` |
| 16 | R4-Q1 | DNA 产出 → **新票 31**，住 `packages/game-design/` | 票 31 |
| 17 | R4-Q2 | `AuthoringAsset.size` **恢复**（**画布**，与资产的**缩放目标**同名不同义）；两者比例必须一致 | `recipe.ts` |
| 18 | R4-Q3 | `AssetSpec.characterId` **可选**；引用校验**只在 pipeline** | 票 15 |
| 19 | R5-Q1 | `masterAsset` 这一条边**归本票**（补的是让 `authoring[]` 不成死字段的那一条） | `asset-spec.ts` |
| 20 | R5-Q2 | 文件形状 = `{format, characters[]}`，**不是裸数组**；记录不带 `format` | `character-dna.ts` |

### 1. 落地物

```text
packages/contracts/src/character-dna.ts   ← 新（v4）
packages/contracts/src/recipe.ts          ← AuthoringAsset + authoring[] + characterRef + superRefine
packages/contracts/src/asset-spec.ts      ← COMMON 加 characterId / masterAsset
packages/contracts/src/index.ts           ← 一行导出
packages/contracts/tests/character-dna.test.ts   ← 新
packages/contracts/tests/recipe.test.ts          ← 追加两节
CONTEXT.md                                ← 补「母版」「CharacterDNA」（此前两个词都没有条目）
docs/v2/01-contracts.md                   ← §6 / §7 按 R17 改写
docs/v2/03-claude-code.md                 ← §16 箭头反转
.scratch/.../31-character-dna-gen.md      ← 新票
```

### 2. 判据（三条变异验过会红）

| 变异 | 结果 |
|---|---|
| `face` 改成 `.optional()` | **2 条红**（「全必填」+「不许省略」） |
| `palette` 收自由字符串 | **1 条红**（PaletteRef） |
| 拿掉 `masterAsset` 的存在性校验 | **1 条红**（引用族） |

另有一条**兼容判据**（`03 §5`）：`fixtures/recipes/` 里每一份**一字不改**仍然合法 ——
新加的四个键全是 optional。

### 3. 落地时**量到的**（别重新量）

- ⚠️ **`AssetSpec.styleId` 在 `packages/` 里源码零读取** —— 只出现在
  `asset-spec.ts:19` 的定义、`ops.ts:86` 让模型照抄的模板、`prompt.ts:396` 的键清单三处。
  而 `recipe.styleRef`（路径那一半）是**活的**（`ops.ts:840` 真读）。
  ⇒ 「照 `styleRef`/`styleId` 的先例」要拆成两半：**路径那半是活的，id 那半是因为
  「一份配方只有一个风格」才死的**。⇒ 于是 `characterId` **不是**同款仪式字段：
  多角色时它是真信息。**新形状（`AuthoringAsset`）当场没有再收一份 `styleId`。**
- ⚠️ **`spec.role` 字面就是身份**：`prompt.ts:360` 的「这个角色是：`${spec.description}`（`${spec.role}`）」，
  而 fixture 里 `role` = 「玩家角色：中年店主 Odin Haraldsson」——**那正是 `identity` 想说的话**。
  ⇒ DNA 一进来，「角色是谁」就会有**三个**来源（`description` / `role` / DNA），所以那一条降格是必须的。
- ⚠️ **`VWS.character` 是搬运来的**（`git show 5a4f937` 第 70-75 行），
  票 02 的「R7 的门只管新字段、不管搬运的旧子树」**合法地**放过了它 —— **不是疏漏**。
  但它在 /v1 视图里零读取，而那条豁免实际是照着 **`style` 子树**画的。
- ⚠️ **`masterAsset` / `derivedFrom` / `CharacterDNA` 全仓库零命中**；
  `inputs/master-to-animation/player-master.png` 是一张 **1.2MB、人类给的** PNG。
- ⚠️ **`CONTEXT.md` 里既没有「母版」也没有「DNA」** —— 一个已经在跑的机制不在词汇表里。已补。

### 4. 两处**由本票自己的裁决造成的**返工（都当场接了）

- **票 13 的标题与 §2 一半作废**：它的标题就是 `母版 → DNA → 动画`，§2 第一句问「第一环谁产」。
  R3-Q4 反转箭头之后，那半张票面就死了。⇒ 已重写（标题 + §2），并把 DNA 那一环拆成**票 31**。
- **`authoring[]` 的入边洞**：R2 与 R4 两次把 `AssetDependency` **整块**推给票 11，
  而 §6 的四个字段里有一个是 `masterAsset` —— **那正是「资产 → 母版」的边**。
  推走它之后 `authoring[]` 会是一张**没有任何东西指向它**的表。
  ⇒ 第 5 轮专门为此开了一问，判**只补这一条边**（其余三条仍归票 11）。

### 5. 播下

`11`（接手剩下三条边 + 拓扑排序）· `12`（三个新键 + **planner 不重复校验**）·
`15`（**两条统一校验**：`characterId` 的引用族 + 母版与资产的比例一致）·
`31`（新票，DNA 的产出）· `13`（重写：只做母版与动画）。

### 6. 明确的未决（留给下游，不是遗漏）

- **`silhouette` / `face` / `clothing` 的 ① 档区分是推的、不是量的**：
  我说「数值指令模型不听（票 22 实测）、画法它听」—— **这一条没有实测支撑**。
  若票 31 / 13 写提示词时发现它们不生效，当场出局。
- **`interactable` 与 `npc` 的边界**（会说话的自动售货机）—— 已进 `## Not yet specified`。
