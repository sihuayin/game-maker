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

每个资产支持：

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

```ts
export interface CharacterDNA {
  id: string;

  identity: string;

  bodyProportions: string;

  silhouette: string;

  face: string;

  clothing: string;

  equipment: string[];

  palette: string[];

  accessories: string[];

  visualConstraints: string[];
}
```

---

# 8. RuntimeProfile

文件：

```text
packages/contracts/src/runtime-profile.ts
```

```ts
export interface RuntimeProfile {
  id: string;

  version: string;

  genre: string;

  capabilities: string[];

  inputModel: string;

  cameraModel: string;

  entityTypes: string[];

  mechanics: string[];

  winConditions: string[];

  loseConditions: string[];
}
```

第一阶段：

```text
platformer/v1
```

⚠️ **本节的 `mechanics` / `capabilities` 必须采纳同一份词表**
（[票 03](../../.scratch/game-maker-v2/issues/03-contract-intent-and-design.md) Q4(b)，2026-10-02）：
`packages/contracts/src/vocabulary.ts` 的 `MECHANICS` / `CAPABILITIES`。
**不许在本契约里再立第二张表** —— 否则就是 `derivePackMode` 那种「写入侧与校验侧各写一份必然漂移」。
发现漏了某一项就**改那个文件**。

⚠️ 两张表的**方向**也要说清：`RuntimeProfile` 是**外壳能力的事实投影**（R12），
不是一张许愿单 —— 它该说的只有**外壳真能做的**（今天的来源是 `game-config/v1` 的四条构造：
`EntityKind` · `Motion` · `PlayerMove` · `Objective`）。
`double-jump` / `attack` / `health` / `enemy-ai` **不在表里**，而这正是 R12 的拒绝**能在生图之前发生**的原因。

---

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
