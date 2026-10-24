# 02. 管线接缝与版本落位（旁轨）

Type: research
Status: resolved
Owner: research subagent · 2026-10-24
Blocked by: —
Map: ../map.md

## Question

钉死 VDS 在现有流水线里的**接缝**与**版本落位**，作为「旁轨（不闸）」的集成方案事实基础：

1. **产出点**：VDS 应在 `design`（`compileDesign`）之后、`recipe`（`planAssets`）之前产出。
   读 `create-game.ts` 的 `runUnderstanding` / `runBuild`，确认这一侧接缝的准确位置：它读什么（`game-design.json`？
   还是 `visual-world.json` 也要？）、写什么。
2. **落位形态**：现有理解层产物都是 `run/vN/<name>.json`（`RUN_ARTIFACT`，`artifacts.ts:14-26`）。
   VDS 进 `run/vN/visual-design.json` + `run/vN/visual-design/{svg,preview}/` 是否与 `commitRun` / `openRun`
   （`run.ts:60/75`）的原子规则相容？「失败不占号」怎么自动成立？
3. **§9.2「不得修改」清单逐条核对**：`resolveRoute`（`assets/src/route.ts`）真、`source.kind`（`contracts/recipe.ts`）真、
   `GameCreationState` **不存在**（死词）。还有哪些 PRD 提到的边界（`pack` 语义、`GameConfig` 契约、原子提交规则）
   是 VDS 必须**不碰**的？列一张「不许动」清单。
4. **关联（P0）**：「设计稿与 GameDesignSpec 关联」怎么落？VDS 对象带 `sourceIntent`/`sourceDesignId` 指向
   GameDesignSpec 的实体/机制 id，是否与现有 `意图覆盖`/`串桶` 的 id 约定（`contracts/intent-coverage.ts`）一致？

交付：产出接缝位置（哪一步、读/写什么）+ 落位形态 + 「不许动」清单 + 关联字段的 id 约定，附 file:line。

## Answer

### 1. 接缝位置（读/写什么）

- 顺序是 `visual-world → intent → design → character-dna → recipe`（`create-game.ts:40` `UNDERSTANDING_STEPS`）。「design 之后、recipe 之前」是一个**跨 character-dna 的区间**：`design` 在 `create-game.ts:342-353`（`compileDesign` → `writeJson(RUN_ARTIFACT.gameDesign)`），`recipe` 在 `create-game.ts:365-388`（`planAssets`）。`character-dna`（`create-game.ts:355-363`）夹在中间。
- **准确的插入点 = `say("recipe")`（`create-game.ts:365`）之前**，即 character-dna 之后。那时暂存目录 `run.tmpDir`（`openRun`，`run.ts:60-65`）里已经有：`visual-world.json`（`create-game.ts:324`）、`game-intent.json`（`:340`）、`game-design.json`（`:353`）、`character-dna.json`（`:363`）。
- **读什么**：`game-design.json`（必读，VDS 的语义来源）+ `visual-world.json`（要，风格/色板/相机是它给的）。这与 `planAssets` 自己的输入完全同构 —— 它读 `designPath` + `visualWorldPath`（`create-game.ts:369-370`），VDS 照抄这两个路径即可；`character-dna.json` 是可选加分项（给构图正确的头身比）。
- **写什么**：把 `visual-design.json` 和 `visual-design/{svg,preview}/` 写进 `run.tmpDir`（**不是** `run/vN/`），随 `commitRun` 的那一次 rename 一起进 run。⚠️ VDS 是**文件进出**的一步（和 `planAssets`/`compileRuntime` 同款，见 `create-game.ts:366` 的注释），不是 `compileDesign`/`analyzeIntent` 那种「有人返回、没人落盘」的步。
- 一句话：**接缝 = `runUnderstanding` 里 `say("recipe")` 之前；读 `game-design.json`+`visual-world.json`，写 staging 里的 `visual-design.json` + `visual-design/{svg,preview}/`。**

### 2. 落位形态（与原子规则相容性）

- `RUN_ARTIFACT`（`artifacts.ts:14-26`）是那九项**扁平文件名**的家。`run/vN/visual-design.json` 只需给 `RUN_ARTIFACT` 加一个键；`visual-design/{svg,preview}/` 是**目录树**，不进这个扁平清单 —— 但它本来就是 staging 树的一部分，不需要登记。
- **相容**：`commitRun` 只做**一次** `fs.renameSync(run.tmpDir, dir)`（`run.ts:83`），把整棵 staging 树原子搬成 `run/vN/`。任何在 `commitRun` 之前写进 `run.tmpDir` 的文件/子目录都自动、原子地落在 `run/vN/` 下，子目录不破这条规则（目标目录那时还不存在，非空 rename 才会 `ENOTEMPTY`，`run.ts:85-86`）。
- **「失败不占号」的来源**：版本号 N **只在 `commitRun` 内部那次 rename 时才分配**（`run.ts:79-91` `nextRunVersion` + `renameSync`）；走到它之前挂掉，catch 调 `abandonRun`（`create-game.ts:434`）把 tmpDir 改名成 `failed-<ts>`（`run.ts:108-117`），**那个 N 从没被用过**（注释逐字：`run.ts:73`「失败不消耗版本号」）。⇒ VDS 只要写 `run.tmpDir` 而不是直接写 `run/vN/`，这条规则**自动成立，零额外代码**。
- 一句话：**`visual-design.json` + 子目录写进 staging 即可，单次 rename 原子进 `run/vN/`；失败不占号是「N 只在 rename 那一刻分配」的结构性结果。**

### 3. 「不许动」清单（§9.2 逐条核对）

| PRD §9.2 项 | 代码真伪 | file:line |
|---|---|---|
| `resolveRoute` | **真** | `packages/assets/src/route.ts:80` `export function resolveRoute`；文件头自称「`source.kind` 的唯一最终写入者」（`route.ts:1`） |
| `source.kind` | **真** | `packages/contracts/src/recipe.ts:143` `AssetSource = z.discriminatedUnion("kind", [DrawlistSource, ImageSource, ImportSource, FramesSource])`；最终写者是 `sourceForDecision`（`route.ts:143-155`） |
| `GameCreationState` | **死词，确认不存在** | 全仓 grep 零符号；文档三处记「不建立」：`docs/v2/01-contracts.md:785`「# 13. GameCreationState —— ⚠️ **不建立**」、`.scratch/game-maker-v2/map.md:30`、`.scratch/game-maker-v2/issues/03-contract-intent-and-design.md:61`「判死不建」 |
| `pack` 语义 | **真，不可碰** | `packages/assets/src/pack.ts`：`buildAssetPack`/`buildInto`（`:307`/`:320`）只迭代 `assets`（母版 `authoring` 不进交付包，`:147-151`）；`files[]` 是 `walk(packDir)` 穷举（`:1270-1275`）⇒ 多加一个文件会动 checksum 覆盖 |
| `GameConfig` 契约 | **真，不可碰** | `packages/contracts/src/game-config.ts`：`GameConfigSchema`（`:209`）`.strict().superRefine`；`EntityKind` 封闭枚举（`:50`） |
| 原子提交规则 | **真，不可碰** | `run.ts:60/75/108`（`openRun`/`commitRun`/`abandonRun`）+ pack 侧 `.building-*`→`renameSync`（`pack.ts:328-334`、`1302-1304`）、`nextPackVersion` 绝不覆盖（`pack.ts:250-255`） |

- §9.2 的**其余四条**也各自有家，一并列进不许动：**绕过 AssetRecipe**（清单是 `runBuild` 的磁盘真相，`create-game.ts:462-475`）；**修改 AssetPack 生成语义**（同上 `pack.ts`）；**引入跨游戏共享视觉知识**（视觉语法住在 `VisualWorldSpec`，`game-design.ts:59-61` 已砍掉 `visualRequirements` 正为此）；**改变版本目录原子提交规则**（同上）。
- 一句话：**`resolveRoute`/`source.kind`/`pack`/`GameConfig`/原子提交规则都是真契约真代码，VDS 一个都不许碰；`GameCreationState` 是确认的死词，别在方案里复活它。**

### 4. 关联字段的 id 约定

- GameDesignSpec 实体的 id = `Id = z.string().min(1)`（`game-design.ts:74`），四桶 `enemies/npcs/interactables/resources` + `player` + `mechanics[]` 都用它（`game-design.ts:156,169-172,194`）。
- **约定 = 「id 沿用意图层、靠 id 延续、不加回指」**（`game-design.ts:164` 逐字：「每一桶的 `id` **沿用意图层**…不加 `fromIntent` 回指，靠 id 延续」）。`auditIntentCoverage` 就是按这个 id 相减：命中 `hasId(design[bucket], e.id)`（`intent-coverage.ts:118`），串桶 = 同一个 id 躺在别的桶 `BUCKETS.find(b => b !== bucket && hasId(design[b], e.id))`（`intent-coverage.ts:120`），机制同款 `hasId(design.mechanics, m.id)`（`:128`）。
- **id 空间的性质：稳定 + 每份设计内唯一，但不是封闭枚举。** 稳定：一条一对一链 `GameDesignSpec.player.id = character-dna[].id = AssetSpec.characterId`（`game-design.ts:295`），id 原样流到 DNA 和清单；唯一：`superRefine` 门在 `player`+四桶上查重（`game-design.ts:296-307`）。**开放**：封闭枚举的是**桶/type**（`INTENT_ENTITY_TYPES`，`vocabulary.ts:162`）和**机制名**（`MECHANICS`，`vocabulary.ts:38-59`），id 本身是自由 `string.min(1)`。
- 一句话：**VDS 的 `sourceIntent`/`sourceDesignId` 就指向 GameDesignSpec 这些实体的 id（原样引用、不许改名不许新造 id 空间）；id 跨阶段稳定、设计内唯一，但值是开放字符串不是封闭枚举。**

## 落点总结

VDS = 在 `runUnderstanding` 的 `say("recipe")` 之前插入的一步：读 `game-design.json`+`visual-world.json`，写 `run.tmpDir` 里的 `visual-design.json` + `visual-design/{svg,preview}/`；随 `commitRun` 单次 rename 原子进 `run/vN/`、失败不占号零成本；不碰 `resolveRoute`/`source.kind`/`pack`/`GameConfig`/原子提交规则；关联字段用 GameDesignSpec 现有的实体 id（`sourceIntent`/`sourceDesignId` 原样引用）。
