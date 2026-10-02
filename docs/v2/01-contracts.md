# Game Maker V2 Contracts

> 所有模块必须通过 Contract 通信。
>
> 禁止模块直接依赖其他模块内部实现。

---

# 1. Contract 总览

```text
StyleReference
      ↓
VisualWorldSpec

User Intent
      ↓
GameIntentSpec

VisualWorldSpec
+
GameIntentSpec
      ↓
GameDesignSpec

GameDesignSpec
+
VisualWorldSpec
      ↓
AssetRecipe

AssetRecipe
      ↓
AssetPack

GameDesignSpec
+
RuntimeProfile
      ↓
GameConfig

Playable Game
      ↓
QAReport
```

---

# 2. VisualWorldSpec

文件：

```text
packages/contracts/src/visual-world.ts
```

⚠️ **本节已按[票 02](../../.scratch/game-maker-v2/issues/02-contract-visual-world.md) 的 25 条裁决改过**（2026-10-01）。
**R 表是决策记录，本文件是它的表达层**（R17）—— 冲突时改这里，改 R 表要重新开票。

⚠️ **一份文档里有两层，读者先看这一段**：

```text
styleIdentity / camera / palette / …   ← 新视图。下游的唯一入口，**给代码读**。
style                                  ← 兼容与提示词载体（一份完整的 StyleSpec 形），**不是第二事实源**。
```

两者的消费者不同（新视图 → 票 10 / 12 / 14；`style` → `styleBrief` 与旧链），
**不一致时不设判据** —— 两份由模型的**同一次调用**填出，不一致是措辞差异，够不上 R3 的「错了一定不是设计」。

结构：

```ts
export interface VisualWorldSpec {
  // ── 新视图：下游唯一入口 ──
  format: "visual-world/v1";          // 判别式。⚠️ 不是自由字符串的 `schemaVersion` —— 那个判别式写不出来

  styleIdentity: {                    // ⚠️ 不叫 `identity`：与 `StyleSpec.identity: string[]` 同名不同型
    styleName?: string;
    keywords: string[];
    description: string;
  };

  camera: {
    mode: "side" | "top-down" | "isometric" | "first-person" | "other";
    projection?: string;
    angle?: number;
    elevation?: number;
    perspective?: string;
  };                                  // ⚠️ 原话住 `style.camera` —— 这里**不再设** `description` 逃生口

  composition: {
    foreground?: string; midground?: string; background?: string;
    objectScale?: string; characterScale?: string; density?: string;
  };

  palette: {                          // 六桶**必填**、**允许空数组**、装 `palette:<下标>`
    primary: string[]; secondary: string[]; accent: string[];
    background: string[]; shadow: string[]; highlight: string[];
  };                                  // ⚠️ 取值域**仍是** `style.palette` 那份有序数组：世界只有一个颜色来源

  lighting: { direction?: string; softness?: string; contrast?: string; mood?: string };

  materials: Record<string, {         // 键**开集**（材质名由世界自己起）、值**封口**
    appearance: string; texture?: string; color?: string[];
  }>;                                 // ⚠️ `color` 也是 `palette:<下标>` —— 见上

  character: {
    proportions?: string; silhouette?: string; poseLanguage?: string;
    clothing?: string; faceAbstraction?: string;
  };

  environment: { architecture?: string; terrain?: string; props?: string; textureDensity?: string };

  shapeLanguage: string[];            // 与 `constraints` 都**进**：它们有**今天就在跑**的消费者
  constraints: string[];              // （`prompt.ts` 的 `styleBrief` / `review.ts`），不是「将来会有」

  styleReferences: { path: string; role: string }[];
  // ⚠️ 摊平（旧稿的 `references.styleImages`）。`characterImages` / `materialImages` 零消费者，不进。
  // ⚠️ **不设 `maxItems`**：第一阶段 `maxItems === 1` 由**调用方**执行（多给了报错、CLI 退出码 2）。
  //    写进 schema 就是让过渡期永久化 —— 票 26 正是来拿掉它的。
  // ⚠️ `role` 是不是封闭枚举，推迟到票 26。

  // ── 兼容载体：**不是**第二事实源 ──
  style: StyleSpec;
}
```

`style` 子树里那 12 个字段与 `StyleSpecSchema` **一字不差**。
⚠️ 其中 6 个（`camera` · `composition` · `lighting` · `environment` · `characterStyle` · `confidence`）**全仓库零读取**，
照旧保留 —— **R7 的门只管新字段，不管原样搬运的旧子树**：它们在**旧链里也是零读取**，
不是 V2 引入的负债，砍掉会当场破坏 §5 的兼容要求。

⚠️ **相对本节旧稿删掉的**：`confidence`（零消费者，且长得像分数）· `rendering`（潜在消费者是「将来会有」）·
`animation` · `readability` · `characterImages` · `materialImages`。理由逐条见票 02 的 Answer。

⚠️ **实现上的代价**（票 28 的边界）：本契约用 `zod/v4` 写，而 `StyleSpec` 是 `zod`(v3) ——
两边**不许互相嵌套** ⇒ 文件里有四处 **v4 镜像**（`StyleSpecShape` / `PaletteShape` / `PaletteRefShape`
/ `StyleReferencePath`），并配一条**漂移测试**盯着它们与 v3 原件同形。

---

# 3. GameIntentSpec

文件：

```text
packages/contracts/src/game-intent.ts
```

⚠️ **本节已按[票 03](../../.scratch/game-maker-v2/issues/03-contract-intent-and-design.md) 的裁决改过**（2026-10-02）。
**R 表是决策记录，本文件是它的表达层**（R17）—— 冲突时改这里，改 R 表要重新开票。

⚠️ **本层与 §4 有 13 处重名 —— 那是故意的**：

```text
GameIntentSpec  =「用户说的」（可以缺、可以说错、可以说得不清楚）
GameDesignSpec  =「我们做成的」（必须完整、必须可执行）
```

重名**不是**冗余：Intent QA（§11）的覆盖度判据**正是拿两层的同名字段相减**。
若两层各存一份不相干的东西，**没有可以相减的两个集合**，R3 的判据当场蒸发、退回 LLM 打分。
⇒ 因此本层的自由文本**不许因为设计层也有就被砍**。

⚠️ 唯一的不对称：`title` 本层**可空**（用户真可能不起名），§4 的 `game.title` **必填**
（起名是**设计行为**，空着 `compile-design` 得造一个）。

⚠️ **`mechanics[].name` 是自由文本，故意的** —— 用户要二段跳、要 boss 战，**必须记得下来**，
哪怕外壳做不了。记下来之后 §4 那条封闭枚举**填不出来**，R12 的拒绝才会在**生图之前**发生
（见 §8 与 `packages/contracts/src/vocabulary.ts`）。
两边都上枚举的话，用户要的东西**根本进不了契约**，也就没有东西可以被拒绝 ——
`03 §11` 要防的「偷偷实现」正是死在这里。

结构：

```ts
export interface GameIntentSpec {
  format: "game-intent/v1";           // 判别式。⚠️ 不是自由字符串的 `schemaVersion` —— 那个判别式写不出来

  title?: string;                     // ⚠️ 可空；§4 的 `game.title` 必填

  genre: string;
  subgenre?: string;
  camera?: string;
  targetExperience: string;

  coreLoop: string[];                 // ⚠️ 裸串：减集靠「沿用原文」，噪声见 §11

  player: { role: string; goals: string[] };

  world: { theme: string; setting: string; atmosphere: string };

  mechanics: Array<{ id: string; name: string }>;   // ⚠️ `name` 自由文本，见上

  entities: Array<{ id: string; type: IntentEntityType; role: string }>;
  //                          ↑ 封闭枚举 enemy | npc | interactable | resource，
  //                            与 §4 的四个数组**一一对应**

  progression?: { type?: string; description?: string };
  challenge?: { type?: string; description?: string };

  resources: string[];                // ⚠️ 裸串；§4 那份 {id,purpose}[] 才是被造出来的东西

  winConditions: string[];
  loseConditions: string[];

  ambiguity: string[];                // ⚠️ 消费者是**清单检查点**，不是终点那份 QA 报告
}
```

⚠️ **被砍掉的**（连同理由）：

| 字段 | 为什么砍 |
|---|---|
| `confidence: number` | 零消费者 + 长得像分数，与 Destination 的「不带分数」正面冲突。想拿它阈值化也不行：R9 只留了一个人工点且在**清单处**，那时本契约早就过去了 |
| `interactions: string[]` | 没有独有的活：用户说的「能推箱子」要么是实体（进 `entities[]`）、要么是机制（进 `mechanics[]`）。与 §4 砍 `interactionModel` 对称 |
| `schemaVersion: string` | → `format: z.literal(...)` |

⚠️ **① 档字段的欠条** —— 门收三种**具名**读取：① 提示词按名字插值 · ② 判据 · ③ 映射进下游契约。
本层靠 **①** 单独活着的：`subgenre` · `camera` · `targetExperience` · `world.atmosphere` ·
`player.role` · `entities[].role`。
⇒ **这是欠条不是永久判决**：票 10 写提示词时每个都得**具名**出现一次
（`spec.world.atmosphere`，**不是** `JSON.stringify(spec)` 整份兜底 —— 整包 JSON 消费不算读）。
没露脸的当场出局。

---

# 4. GameDesignSpec

文件：

```text
packages/contracts/src/game-design.ts
```

⚠️ **本节已按[票 03](../../.scratch/game-maker-v2/issues/03-contract-intent-and-design.md) 的裁决改过**（2026-10-02）。R17：冲突时改本文件。

⚠️ **本层是「我们做成的」，与 §3 的 13 处重名是故意的**（理由与「不许砍意图层」那条，见 §3）。

结构：

```ts
export interface GameDesignSpec {
  format: "game-design/v1";           // ⚠️ 本节补的：此前连 `schemaVersion` 都没有，两份契约里只有它是匿名的

  game: {
    title: string;                    // ⚠️ 必填（§3 的 `title` 可空）
    genre: string;
    camera: string;
    runtimeProfile: { id: string; version: string };  // ⚠️ 引用不是裸串 —— 单一个名字对不上版本
  };

  coreLoop: string[];                 // ② 判据：与 §3 的同名数组相减

  player: { id: string; role: string; abilities: string[]; goals: string[] };

  enemies: Array<{ id: string; behavior: string; threat: string }>;
  npcs: Array<{ id: string; role: string; interaction: string }>;
  interactables: Array<{ id: string; type: string; behavior: string }>;
  resources: Array<{ id: string; purpose: string }>;
  //  ↑ 四个桶与 §3 的 `entities[].type` 一一对应；每项 `id` **沿用 §3**（不加 `fromIntent` 回指，
  //    靠 id 延续 —— 两个集合的 id 相等是**算出来的**，不是声明出来的）

  world: { theme: string; setting: string; structure: string };

  levels: Array<{ id: string; purpose: string; layout: string; entities: string[] }>;

  progression: { model: string; description: string };
  difficulty?: { model: string; description: string };

  mechanics: Array<{ id: string; mechanic: Mechanic }>;   // ⚠️ 封闭枚举，见 `vocabulary.ts`

  winConditions: string[];
  loseConditions: string[];

  runtimeRequirements: Capability[];  // ⚠️ 封闭能力集，不是自由文本
}
```

⚠️ **三个 `*Requirements` 里砍了两个** —— 它们是被删的 `GameSpec.requirements` 拆成三份又长回来的：

| 字段 | 裁决 |
|---|---|
| `assetRequirements` | **砍** —— Asset Planner 的真实输入是**结构化的**四个桶；再来一份自由文本是同一事实的第二个来源，且没有 `id`、减不了集 |
| `visualRequirements` | **砍** —— 视觉语法**已经住在 `VisualWorldSpec`**；留它等于给「这个资产长什么样」造第三个来源 |
| `runtimeRequirements` | **留，但改成封闭能力集** —— R12 要拿它跟 `RuntimeProfile` 比出**拒绝**，而两串自然语言求差集得到的**不是判据，是噪声** |

⚠️ 同批砍掉：`interactionModel: string[]` —— 它与 `player.abilities` + `interactables[].behavior`
**说的是同一件事**，而那两个在场上。

⚠️ **① 档字段的欠条** —— 靠 **① 单独**活着的：`world.theme` · `world.setting` · `world.structure` ·
`player.role` · `player.abilities` · `enemies[].behavior` · `enemies[].threat` · `npcs[].role` ·
`npcs[].interaction` · `interactables[].type` · `interactables[].behavior` · `levels[].purpose`。
⇒ 同上：票 10 / 票 14 的提示词模板里没**具名**出现就出局。

---

# 5. AssetRecipe 扩展

现有 AssetRecipe 保留。

增加：

```ts
export type AssetGenerationStrategy =
  | "image"
  | "character-reference"
  | "image-edit"
  | "drawlist"
  | "procedural"
  | "import";
```

Asset source：

```ts
interface AssetSource {
  kind: AssetGenerationStrategy;

  referenceAssets?: string[];

  masterAsset?: string;

  dependsOn?: string[];

  parameters?: Record<string, unknown>;
}
```

---

# 6. Asset Dependency

⚠️ **[票 04](../../.scratch/game-maker-v2/issues/04-contract-character-dna.md) 的裁决（2026-10-02）**：这四个字段里**只有 `masterAsset` 落了**，
落点在 **`AssetSpec.masterAsset`**（指向 `AssetRecipe.authoring[].id`，校验在配方的 `superRefine` 里）。
**其余三个（`dependsOn` / `derivedFrom` / `referenceAssets`）与拓扑排序仍归[票 11](../../.scratch/game-maker-v2/issues/11-recipe-extensions.md)。**

⇒ 那条边先落的理由是**结构性的**：没有它，`authoring[]` 就是一张**没有任何东西指向它**的表，
而「零消费者的字段不进契约」正是票 04 一直在用的那把尺子。

⚠️ **「母版」这个词见 [`CONTEXT.md`](../../CONTEXT.md)**：它是**基因的一张渲染图**，
`DNA → 母版 → 动画`；`Master → DNA` **禁止**（那会让权威倒挂）。
母版**不进交付包**，且「不交付」是**结构性**的 —— 它与交付资产在两个不同的数组里。

剩下的（票 11 接手）：每个资产支持

```ts
interface AssetDependency {
  dependsOn: string[];

  derivedFrom?: string;

  masterAsset?: string;

  referenceAssets?: string[];
}
```

例如：

```text
player-master
 ├── player-idle
 ├── player-run
 ├── player-jump
 └── player-attack
```

---

# 7. CharacterDNA

文件：

```text
packages/contracts/src/character-dna.ts
```

⚠️ **本节已按[票 04](../../.scratch/game-maker-v2/issues/04-contract-character-dna.md) 的裁决改过**（2026-10-02）。
**R 表是决策记录，本文件是它的表达层**（R17）—— 冲突时改这里，改 R 表要重新开票。

⚠️ **三层的关系是「世界 = 类 · DNA = 个体 · 资产 = 一次渲染」**：

```text
VisualWorldSpec.character  ← 「这个世界的角色都矮壮、方头、硬边」（管**所有**角色）
CharacterDNA               ← 「Odin 本人戴绿毛线帽」（管**一个**角色）
AssetSpec                  ← 「这个资产画什么」（待机三帧 / 行走六帧）
```

⇒ 硬约束：**`VWS.character` 的五个字段一个都不许机械复制进 DNA**。
若两层的同一格可以是同一句话，它们就是**同一件事的粗细两版** —— 那正是票 09 删 `GameSpec` 的理由。
⇒ 三层里**「这个角色是谁」只有 DNA 一个家**：`AssetSpec.role` / `description` 已降格为**资产级**。

⚠️ **它的主消费者是修复**（R13 的资源级重生成），不是提示词。
没有一份一字不变的角色描述，重画出来就**不是同一个角色** —— 修复会**静默地换掉主角**。
⚠️ **跨资源一致性不是它的功劳** —— 那个由世界参考图内联进每一次生图调用承担（`pack.ts:328-329`）。

文件形状（`run/v<N>/character-dna.json`，**单文件装全部角色**）：

```ts
export interface CharacterDNAFile {
  format: "character-dna/v1";       // 判别式。⚠️ 不是裸数组 —— 裸数组没地方放它
  characters: CharacterDNA[];       // ⚠️ 每条记录**不带** format（一族一次就够）
}

export interface CharacterDNA {
  id: string;              // ⚠️ **沿用 GameDesignSpec 那个实体的 id**，不许自己起名
  identity: string;        // 「这一个是谁」—— ⚠️ 唯一的具体角色身份来源

  silhouette: string;      // 形态语言（**画法**，不是数值比例）
  face: string;            // 无脸写 "none"
  clothing: string;        // 一段散文。无服装写 "none"
  gear: string[];          // 携带物/器械清单。无则 []

  palette: PaletteRef[];   // ⚠️ `palette:<下标>`，**不是**自由 hex
  visualConstraints: string[];  // ⚠️ **叠加**在世界约束之上，不是替代
}
```

⚠️ **全部必填，一个 `optional` 都没有**（票 04 Q2）—— 包括非人形角色。
理由直接来自 R13：DNA 的全部意义是**重生成时一字不变**，
而一个可选字段会让「**这个角色确实没有脸**」与「**模型忘了填**」在文件里**长得一模一样**。
⇒ **「没有」也必须被说出来**：`face` / `clothing` 写 `"none"`，`gear` 写 `[]`。
⚠️ 因此空串（`""`）也不算 —— 否则它会变成第二个隐形缺省。

⚠️ **被砍掉的**（连同理由）：

| 字段 | 为什么砍 |
|---|---|
| `bodyProportions` | **可派生**（`headCount(size.h) = clamp(round(h/12),2,5)`，`prompt.ts:58-68`）。它不是「零消费者」，是**更糟的一种：一个会与事实分叉的副本**。票 22 实测：自由文本的比例指令模型**不执行**，真正的约束是画布尺寸 |
| `equipment` + `accessories` | **合并成 `gear`** —— 两者之间是**假**边界：消费者都是 ①（同一段提示词），差别只在标签 |
| `palette: string[]` | → **`PaletteRef[]`**。票 02 的裁决 25 判过一模一样的形状：否则这个世界就有了**第二套颜色来源**，而写成自由 hex 会**静默失效**（下游 `quantize.ts` 把它量化掉） |

⚠️ **哪些实体配有 DNA**：`player` + `enemies[]` + `npcs[]`。
`interactables[]` / `resources[]` **默认没有**（木条箱没有基因）。

⚠️ **`silhouette` / `face` / `clothing` / `gear` 都是 ① 档**（只靠提示词具名插值活着）——
票 10 / 票 13 写模板时它们必须**具名出现**，没露脸的当场出局。

---

# 8. RuntimeProfile

文件：

```text
packages/contracts/src/runtime-profile.ts
```

✅ **2026-10-02 落地**（[票 05](../../.scratch/game-maker-v2/issues/05-contract-runtime-profile.md)）—— 下面是**已实现**的形状，不是设想。

```ts
export const RuntimeProfileSchema = RuntimeProfileRefSchema.extend({
  mechanics: z.array(MechanicSchema),       // ⟸ vocabulary.ts
  capabilities: z.array(CapabilitySchema)   // ⟸ vocabulary.ts
});
// 身份 = id + version。`platformer/v1` 是**拼出来的**（`runtimeProfileRef`），不以字面量存在
// —— 存两种拼法就是两个事实源。`v` 是**显示**前缀，`version` 里存的是裸号 `"1"`。
export const RuntimeProfileRefSchema = z.strictObject({
  id: z.string().min(1).regex(/^[^/]+$/),      // 不许含 `/`：`<id>/v<version>` 要能拼回去
  version: z.string().min(1).regex(/^[^/]+$/)
});
```

**只有四个字段** —— R7 的门是「说不出**具名**消费者的不进契约」：

| 字段 | 谁读它 |
|---|---|
| `id` · `version` | `GameDesignSpec.game.runtimeProfile` 那条**引用**；Runtime Compiler 拿它给拒绝**署名** |
| `mechanics[]` | Runtime Compiler 的差集 `mechanics[].mechanic − profile.mechanics` |
| `capabilities[]` | Runtime Compiler 的差集 `runtimeRequirements − profile.capabilities` |

**砍掉的六个，连同死因**（票 05 Q4 / Q7）：

| 砍掉的 | 死因 |
|---|---|
| `inputModel` | 零消费者 |
| `entityTypes[]` | 零消费者 —— `EntityKind` 是**渲染桶**、设计层四个桶是**角色**，两轴不同 |
| `winConditions[]` · `loseConditions[]` | 设计层同名字段是**自由文本** —— 封闭表减自由文本**是噪声不是判据** |
| `cameraModel` · `genre` | **可派生的副本**（不是零消费者，是更糟的一种）：取值域就是 `capabilities` 里的 `camera:*`，而 `genre` 的值就是 `id`。同票 04 砍 `bodyProportions` 的理由 |

⇒ `compile-design` 要相机 / 题材的取值，**现从 `id` 与 `capabilities[]` 取**，不要为它另立字段。

## 它凭什么叫「事实投影」

⚠️ **「事实性」由测试保证，不由类型保证**（票 05 Q10 / Q12）。R12 的「同源同算」落地成三件事：

- **同源** —— 两条表都从 `game-config/v1` 的四条构造出发（`EntityKind` · `Motion` · `PlayerMove` · `Objective`）。
- **转录** —— 真正机器派生的**只有一条**：`EntityKind → MECHANICS`（`vocabulary.test.ts` 的 `ENTITY_KIND_FATE`）。
  其余是**带行号的转录**（`vocabulary.ts` 的注释里写着它投影的是哪一行）。
- **见证判据** —— `packages/demo/tests/shell-capability-witness.test.ts` 逐条读外壳源码、断言那条**行为串**还在。
  ⚠️ 读的是**剥掉注释之后**的源码：第一版读原文，被一句行尾块注释当场骗过（变异实验）。

⚠️ **外壳不 import 本契约** —— 它是**读侧**的。曾经想让「外壳 import 它 + 穷尽分派 ⇒ 漂移是编译错误」，
量下来立不住：外壳对**实体种类**的穷尽性**已经**由 `scene.ts` 的 switch 对 `EntityKind` 自动取得，
而 `capabilities` / `mechanics` 是**不可分派的字符串** —— import 进来也无处可 switch。

## 两个数组**今天恰好等于词表全集**

`platformer/v1` 的 `mechanics` ⟺ `MECHANICS`、`capabilities` ⟺ `CAPABILITIES`
⇒ `game-design.ts` 那两条差集在**第一阶段恒为空**。

⚠️ 这**不是**「一条写坏了的判据」，是**给第二个成员留的位**：今天真正在拒绝的是**封闭枚举本身**
（想填 `double-jump` 就填不出来，票 10 §3③）—— 免费、且在生图之前。
⚠️ **词表不是外壳的全集**（它是从 `game-config/v1` 反推的，所以是**横版**的）。分工是：
**`vocabulary.ts` 是名字的家**（三份契约的公共依赖，谁也不拥有它），
**`RuntimeProfile` 是「这一代外壳实现了其中哪些」的断言语** —— 第二个成员落地那天，这张断言才开始说话。

⚠️ **本节的 `mechanics` / `capabilities` 必须采纳同一份词表**：`packages/contracts/src/vocabulary.ts`。
**不许在本契约里再立第二张表** —— 否则就是 `derivePackMode` 那种「写入侧与校验侧各写一份必然漂移」。
发现漏了某一项就**改那个文件**。
`double-jump` / `attack` / `health` / `enemy-ai` **不在表里**，而这正是 R12 的拒绝**能在生图之前发生**的原因。

## 它**不落盘**

`run/v<N>/` 的九项清单（§13）里**没有**它 —— 它是**外壳的事实**，不是这一次运行的产物。
`createGame` 的返回里有 `runtimeProfile`（内存对象，见 §25），但**不写文件**；
设计层存的是 `{id, version}` 那条**引用**，那正是引用该有的样子。


# 9. QAReport

文件：

```text
packages/contracts/src/qa.ts
```

```ts
export interface QAReport {
  status: "pass" | "fail";

  visual?: VisualQAResult;

  gameplay?: GameplayQAResult;

  intent?: IntentQAResult;

  failures: QAFailure[];

  repairAttempts: number;
}
```

---

# 10. Visual QA

```ts
interface VisualQAResult {
  styleSimilarity: number;
  paletteSimilarity: number;
  silhouetteSimilarity: number;
  compositionSimilarity: number;
  characterConsistency: number;
  materialConsistency: number;
  animationConsistency: number;
}
```

---

# 11. Intent QA

```ts
interface IntentQAResult {
  coverage: Record<string, boolean>;

  score: number;

  missingRequirements: string[];
}
```

---

# 12. QA Failure

```ts
type QAFailureCode =
  | "STYLE_MISMATCH"
  | "COLOR_MISMATCH"
  | "CAMERA_MISMATCH"
  | "SILHOUETTE_MISMATCH"
  | "CHARACTER_DRIFT"
  | "MATERIAL_MISMATCH"
  | "SCALE_MISMATCH"
  | "TRANSPARENCY_ERROR"
  | "ANIMATION_ERROR"
  | "GAMEPLAY_READABILITY_ERROR"
  | "GAMEPLAY_RUNTIME_ERROR"
  | "INTENT_MISSING";
```

---

# 13. GameCreationState —— ⚠️ **不建立**

⚠️ **[票 03](../../.scratch/game-maker-v2/issues/03-contract-intent-and-design.md) 已判：不建这个契约**（2026-10-02）。`run/v<N>/` **目录本身就是那个容器**。

理由：它是被删过的 `CreationProject` 的复活，而且**比 `GameSpec` 还空** —— `GameSpec` 至少是
**一份数据**，它是一份**装数据的容器**：九个字段**没有一个装的是新事实**，全是别处已落盘产物的指针。
它唯一的假想读者是**编排者自己**，而编排者是**进程内变量**，不是一个文件。
再多一份内嵌九个产物的 `state.json`，等于给同一批字节**两个事实源** ——
与票 02 花 25 条裁决防的「同一个值有两个来源」是同一种病。

⇒ 于是**目录清单就是它**（票 02 已钉第一项，其余是本票定的）：

```text
run/v<N>/intent.md            ← 原始需求文本，**原样字节**（复现一次运行必须留得下输入）
run/v<N>/visual-world.json    ← 票 02
run/v<N>/game-intent.json
run/v<N>/game-design.json
run/v<N>/character-dna.json   ← R14
run/v<N>/asset-recipe.json    ← R10：策略住清单里。⚠️ **唯一的人工编辑点**
run/v<N>/game-config.json
run/v<N>/qa-report.json
run/v<N>/ledger.json          ← 票 28 的 sidecar

pack/v<N>/  ·  site/v<N>/     ← R8（禁止覆盖）
```

⚠️ **`RuntimeProfile` 不在上面的清单里，是有意的**（票 05 Q5）：它是**外壳的事实**，
不是这一次运行的产物 —— 写进 `run/` 会让它长得像运行的产物，而「禁止覆盖的 `v<N>`」
对它的语义也不成立（外壳换个版本，历史 `run` 里那份不该跟着变）。
⚠️ 票 15 的**草稿**目录树里曾列过 `runtime-profile.json` —— 那是本文定稿（九项）之前的写法。

⚠️ 除 `asset-recipe.json`（R9 的检查点、R10 的策略都落在那里）外，
`run/v<N>/` 里的文件**一律机器产出、不许手改** —— 否则「禁止覆盖」的 `v<N>` 会被手工编辑悄悄毁掉。

---

# 14. 模块边界

## Vision

输入：

```text
StyleReference
```

输出：

```text
VisualWorldSpec
```

不得生成 AssetPack。

---

## Intent Analyzer

输入：

```text
Natural Language Intent
```

输出：

```text
GameIntentSpec
```

不得直接生成 GameConfig。

---

## Game Design Compiler

输入：

```text
VisualWorldSpec
GameIntentSpec
```

输出：

```text
GameDesignSpec
```

---

## Asset Planner

输入：

```text
VisualWorldSpec
GameDesignSpec
```

输出：

```text
AssetRecipe
```

---

## Asset Compiler

输入：

```text
AssetRecipe
VisualWorldSpec
```

输出：

```text
AssetPack
```

---

## Runtime Compiler

输入：

```text
GameDesignSpec
RuntimeProfile
AssetPack
```

输出：

```text
GameConfig
```

---

## QA

输入：

```text
Playable Game
VisualWorldSpec
GameIntentSpec
GameDesignSpec
```

输出：

```text
QAReport
```

---

# 15. 禁止跨层

禁止：

```text
Vision → GameConfig

Intent Analyzer → AssetPack

Asset Generator → Runtime Code

Runtime → LLM
```

所有跨层调用必须通过 Contract。
