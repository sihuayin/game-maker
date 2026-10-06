# Game Maker V2 — Claude Code Implementation Instructions

你现在负责将当前 `game-maker` 仓库升级到 V2。

必须先阅读：

```text
docs/v2/00-overview.md
docs/v2/01-contracts.md
docs/v2/02-implementation-plan.md
```

然后再开始修改代码。

---

> ## ⚠️ 本文有 10 处字面**不采用** —— 动手前先读这两处
>
> **决策记录**在 [`../../.scratch/game-maker-v2/map.md`](../../.scratch/game-maker-v2/map.md) 的
> **R 表**（R1–R18）。**逐条的出入对照表**在 [`00-overview.md`](00-overview.md) 的 **§10** ——
> 那里列了本文 `§2 / §6 / §7 / §11 / §16 / §18 / §21 / §24 / §25 / §28` 各一处应当**改读成什么**。
>
> **两者的关系是**：R 表是**决策记录**，`docs/v2` 是它的**表达层**。
> 冲突时**默认本文写错** —— 要改 R 表，必须**重新开票**，不能由文档覆盖。

---

---

# 1. 总任务

将当前：

```text
Requirement
↓
StyleSpec
↓
AssetRecipe
↓
AssetPack
↓
GameConfig
↓
Runtime
```

升级为：

```text
Style Reference
+
Game Intent
↓
VisualWorldSpec
+
GameIntentSpec
↓
GameDesignSpec
↓
AssetRecipe
↓
AssetPack
↓
GameConfig
↓
Playable Demo
↓
Visual QA
+
Gameplay QA
+
Intent QA
↓
Repair
```

---

# 2. 第一原则

不要推翻当前架构。

优先复用：

```text
packages/contracts
packages/assets
packages/runtime
packages/site
fixtures
```

只增加必要能力。

---

# 3. 开始前必须检查

先检查：

```text
package.json
pnpm-workspace.yaml
packages/
apps/
docs/
fixtures/
```

识别当前：

```text
contracts
asset generation
recipe
pack
runtime
CLI
site
test
```

然后建立 V2 修改计划。

不要立即大规模修改。

---

# 4. 第一阶段：Contracts

首先实现：

```text
packages/contracts/src/visual-world.ts
packages/contracts/src/game-intent.ts
packages/contracts/src/game-design.ts
packages/contracts/src/character-dna.ts
packages/contracts/src/runtime-profile.ts
packages/contracts/src/qa.ts
```

更新：

```text
packages/contracts/src/index.ts
```

导出所有新 Contract。

---

# 5. Contract 兼容要求

不要破坏：

```text
AssetSpec
AssetRecipe
AssetPack
GameConfig
```

新字段优先使用：

```text
optional
default
version
```

保证旧 fixtures 可以继续解析。

---

# 6. Visual Understanding

创建：

```text
packages/vision/
```

实现：

```text
analyze-reference.ts
```

要求：

```text
Style Reference Image + Requirement Text
↓
Vision LLM
↓
VisualWorldSpec
```

⚠️ **2026-10-03（[票 08](../../.scratch/game-maker-v2/issues/08-vision-analyze-reference.md) 的 R1-Q1）：
输入**不止**参考图，还要一份**原始需求文本**。**
`palette` 是[[绘制词汇]]、**不是画面分布的摘要** —— 它的判据是「画不画得出这个世界里的东西」，
而**要画的东西有一部分压根不在参考图里**（`fixtures/reference/halt-dusk.png` 的 provenance 白纸黑字：
它「故意不包含牛/拖拉机/谷仓」，而 Destination 验收第 2 条要考的正是这个）。
⇒ 喂的是**原始需求文本**、**不是** `GameIntentSpec` 的产物 —— 于是 vision 与 intent 两步**并列**，
`GameIntentSpec` 之后才轮到它。见 `00-overview.md` §3 / §6。

模型输出必须严格符合 Contract。

不得输出自由文本替代 JSON。

---

# 7. Vision Prompt

必须要求模型分析的清单**以落地契约为准**（[票 08](../../.scratch/game-maker-v2/issues/08-vision-analyze-reference.md) 的 R1-Q4）：

```text
styleIdentity · camera · composition · palette · lighting · materials
character · environment · shapeLanguage · constraints · styleReferences
（外加内嵌的 style —— 一份完整的 StyleSpec 形，它同样由模型填）
```

⚠️ **本节旧稿列过 `Rendering` / `Animation` / `Readability`，它们已被删掉**：
按 R7 的门（**说不出「谁读它」的字段不进契约**）那三项**零消费者** ——
`rendering` 里唯一拟人化的那部分由 `prompt.ts` 一句硬编码承担，而像素风真正的约束是
`shapeLanguage` / `materials.texture` / `lighting` 这些**有家**的字段。
理由逐条见[票 02 的 Answer](../../.scratch/game-maker-v2/issues/02-contract-visual-world.md)。

⚠️ 「特别注意」那八项**不是消失了，是各有各的家**：
`object scale → composition.objectScale` · `texture density → environment.textureDensity` ·
`character proportions → character.proportions` · `camera angle → camera.angle` ·
`outline → style.shapeLanguage` · `shading → lighting / materials.appearance` ·
`dithering → materials.texture`。**`pixel density` 没有家**，所以不问（别把它硬塞进某处的自由文本）。

⚠️ 而**三件 schema 表达不出来的事**写在**工具声明**里（票 08 的 R2-Q5）——
`toJSONSchema` 会静默丢掉 `superRefine`，也会把开放对象摊成没有 `properties` 的空对象。
具体是那三件，见 `packages/vision/src/prompts.ts` 的 `TOOL_DESCRIPTION`。

---

# 8. 原始图片必须保留

不能只保存：

```text
StyleSpec
```

必须：

```text
VisualWorldSpec.styleReferences
```

保存原始图片引用。

---

# 9. Game Intent

> ⚠️ **2026-10-03 已落地**（[票 09](../../.scratch/game-maker-v2/issues/09-intent-analyzer.md)）。
> **以 `packages/contracts/src/game-intent.ts` 为准**，它 16 个键。与本文的出入有三处：
> ① 下面那张「至少识别」清单里的 **`resources` 已出局** —— 它降成 `entities[].type = "resource"`
> （票 09 的 Q5：两个家指向设计层同一个桶）；
> ② `confidence` 不存在（票 03 已砍），所以「缺项」只能写进 `ambiguity[]`；
> ③ 契约带一条**顶层 gate**：空串 / 空数组（`coreLoop`·`player.goals`·`mechanics`）/ id 重复
> ⇒ 这一发算 `schema` 失败、重采样（票 09 的 R2-Q1）。
>
> ⚠️ 落点在 `packages/game-design/src/analyze-intent.ts`（**不在** `vision` —— 两个新包彼此不依赖），
> 而**没有装配步**：没有任何「调用方才知道」的字段要注回去。

实现：

```text
packages/game-design/analyze-intent.ts
```

输入：

```text
自然语言
```

输出：

```text
GameIntentSpec
```

至少识别：

```text
genre
camera
core loop
player
world
mechanics
entities
progression
resources
win
lose
```

---

# 10. Game Design

> ⚠️ **2026-10-04 已落地**（[票 10](../../.scratch/game-maker-v2/issues/10-design-compiler.md)）。与本文的出入有一条**要紧**的：
> **输入多了第三样 —— `RuntimeProfile`**（票 10 的 Q3a）。理由：R12 要「**在生图之前、且免费**」地拒绝，
> 而**票 14 的输入里既没有意图也没有 `VisualWorldSpec`**（见 §19）⇒「用户要的东西做丢了」与
> 「参考图的视角外壳承载不了」这两件事，**除了 `compile-design` 没人管得了**。
> ⇒ 于是 R12 的拒绝**落在这一步**，且它**不是失败**：那一发上游调用是**成功的**（账照记、`failures[]` 不留痕），
> 只是这份设计**做不出来**（不重采样）。⚠️ 票 06 删 `CAMERA_MISMATCH` 时把这条兑现押在了本票上。
> ⚠️ 另：本层的 gate、两个注入值、以及「**意图覆盖 + 需求补全，不是意图镜像**」那条方向规则，
> 见 [`01-contracts.md §4`](01-contracts.md)。

实现：

```text
packages/game-design/compile-design.ts
```

输入：

```text
GameIntentSpec
VisualWorldSpec
```

输出：

```text
GameDesignSpec
```

不要让 GameIntentSpec 直接转换为 GameConfig。

---

# 11. Runtime Profile

MVP 只支持：

```text
platformer/v1
```

如果用户要求当前 Runtime 不支持的能力：

不要偷偷实现。

记录：

```text
runtimeRequirements
```

以及：

```text
unsupportedRequirements
```

---

# 12. Asset Planner

✅ **2026-10-05 落地**（[票 12](../../.scratch/game-maker-v2/issues/12-asset-planner.md)）。落点就是本节说的
「**修改当前 Asset derive 流程**」：`packages/assets/src/{ops.ts, prompt.ts}` —— 旧的 `deriveRecipe`
**被改写成 `planAssets`**，而不是与它并存。

新：

```text
GameDesignSpec
+
VisualWorldSpec
```

输出（**同一份 `asset-recipe/v1`**，所以下游 `pack` 一行不用改）：

```text
AssetRecipe
```

⚠️ **三条与本节字面的出入**：
① **旧入口不再存在**（票 12 的 Q1：(a) 合并）—— CLI 的 `derive` 与 MCP 的 `derive_recipe` 随之变成
   `plan` / `plan_assets`。理由：两者产**同一种文件**，而旧的 `derive` 提示词**明确拒绝决定策略**
   （「所有资源的 source 都写 drawlist……那一项由人后续自己填」），而 §13/§14 要求 LLM 决定它。
   ⇒ 于是**写入侧只有一处**（`derivePackMode` 那条教训）。⚠️ 但「清单可以**人手写**」那条性质不变。
② 调用走 **R16**（强制工具调用 + 入参过 Zod + 3 次重采样）—— 不是旧 `derive` 那条「纯文本 +
   剥围栏 + 2 次」的路。⚠️ 它需要一份 **v4 镜像**（`contracts/src/recipe-tool.ts`）：
   `toolInputSchema` 只吃 `zod/v4`，而 `asset-recipe/v1` 是 v3（票 28 的边界；先例是票 02 给 `StyleSpec` 立的那份）。
③ 风格**从 VWS 里抽**：`vws.style` 落成配方旁边的 `stylespec.json`（`styleRef` 就是它的文件名），
   世界的风格参考图也**拷进配方目录**（`referenceImage`）—— `03 §15` 要的「原图参与」由此接上。
   ⚠️ 而 `VisualWorldSpec` 的**新视图**（六桶 / materials / 构图）**今天一个消费者都没有** ⇒ 见
   [票 32](../../.scratch/game-maker-v2/issues/32-vws-in-generation-prompt.md)。

---

# 13. Generation Strategy

> ⚠️ **2026-10-05 更正（[票 11](../../.scratch/game-maker-v2/issues/11-recipe-extensions.md)）**：下面那张六值单子**不成立** ——
> **策略就是 `drawlist` / `image` / `import`**（它们早就是 `AssetSource` 的判别式，R10「策略住清单里」因此**今天已经满足**）。
> `image-edit` 与 `character-reference` 是 `image` 的**两种参数化**（`reference` / `masterAsset` 两个可选字段）；
> `procedural` 是**失败**的意思（降级链的遗物），**出局**。详见 [`01-contracts.md §5`](01-contracts.md)。

AssetRecipe 允许（**落地形状**）：

```text
drawlist
image        （带 reference = 配方外的参考图；带 masterAsset = 配方内的母版）
import
```

⚠️ **现在是 LLM 选**（票 12 的 Asset Planner 写清单），而**人可改**（R10）。

~~下面这段是更正前的字面，留作史料：~~

```text
image / character-reference / image-edit / drawlist / procedural / import
```

---

# 14. 生成策略规则

优先：

### 角色

```text
image + masterAsset      ← ⚠️ 2026-10-05 更正（票 11 的 Q1）：`character-reference` 不是策略值，
                           它是 `image` 的**一种参数化**（母版当参考图）
```

### 敌人

```text
image
```

### 背景

```text
image
```

### 复杂道具

```text
image
```

### UI

```text
drawlist
```

### 简单几何

```text
drawlist
```

### 碰撞体

⚠️ **2026-10-05（[票 11](../../.scratch/game-maker-v2/issues/11-recipe-extensions.md) 的 Q2）：碰撞体不建资产。**
它是 [[地形]]（`GameConfig` 里只有碰撞、没有画面的那部分），而 [[地形]] 的定义就是
「**它不引用任何资源**」。一份「不引用资源的资产」是自相矛盾的说法，而且画出来也没人看。
⇒ 一律走 `terrain`，**清单里没有它**。⚠️ 可见的碰撞体（行李堆、台阶）按定义是 [[实体]]，
走上面已有的 `image` / `drawlist`。

~~原文：`procedural`~~

---

# 15. Style Reference 必须参与 Image Generation

修改：

```text
packages/assets/src/image-gen.ts
```

生成 Prompt 必须结合：

```text
Original Reference Image
VisualWorldSpec
AssetSpec
CharacterDNA
Generation Strategy
```

不要只把 VisualWorldSpec 转成文本 Prompt。

---

# 16. Character Master

⚠️ **本节的箭头已按[票 04](../../.scratch/game-maker-v2/issues/04-contract-character-dna.md) 反转**（2026-10-02）。
原文写的是 `Character Master → Character DNA → Animations`，**那个顺序是错的** ——
它要么读成数据依赖（则 DNA 得**反推**母版，而票 04 明令**禁止** `Master → DNA`），
要么读成流水线顺序（则**画母版需要一段描述这个角色的提示词，而那正是 DNA 要产出的东西 —— 鸡生蛋**）。
R17：R 表是决策记录，本文件是它的表达层，所以改这里。

正确顺序：

```text
Character DNA
↓
Character Master
↓
Animations
```

**母版是基因的一张渲染图，基因才是权威。**

实现拆成两处（R11：新包彼此不依赖、只依赖 `contracts`）：

```text
packages/game-design/character-dna.ts   ← VWS + GameDesignSpec 实体 → DNA（**理解层**的最后一步）
packages/assets/src/character-gen.ts    ← DNA → 母版 → 动画          （**生成层**）
```

⚠️ **母版可以由人导入，也可以由管线生成**；`AuthoringAsset` 两种都收。
⚠️ 母版的**画布** `size` 与交付资产的 `size` **不同义**（那边是缩放目标），
且**母版的宽高比必须与引用它的资产一致** —— 否则同一个角色会有两套比例。

而不是：

```text
idle
run
jump
```

分别重新设计角色。

---

# 17. Asset Dependency

⚠️ **2026-10-05（[票 11](../../.scratch/game-maker-v2/issues/11-recipe-extensions.md) 的 Q3）：四条边只活了两条。**

```text
dependsOn      资产 → 资产（asset-spec.ts 的 COMMON，与 masterAsset 并排）
masterAsset    资产 → 母版（票 04 已落，指向 authoring[].id）
```

⚠️ `derivedFrom`（与 `masterAsset` 同一件事）· `referenceAssets`（与 `source.reference` 路径重叠）**出局**。
⚠️ **图 = `dependsOn` ∪ `{masterAsset}`**，而人**不写两遍**。
⚠️ **契约判环，`pack` 排序**（promise-DAG；闸门与 `--concurrency` 语义不变）。
详见 [`01-contracts.md §6`](01-contracts.md)。

---

# 18. Visual Memory

实现：

```text
packages/visual-memory/
```

至少支持：

```text
World Visual Memory
Character DNA
Material DNA
```

---

# 19. Runtime Compiler

✅ **2026-10-05 落地**（[票 14](../../.scratch/game-maker-v2/issues/14-runtime-compiler.md)），落点
`packages/assets/src/ops.ts`（**改写** `compileGame`，与 `compile-td-game` 并列 —— 那一道**一个字不动**，R4）。

```text
GameDesignSpec
+
RuntimeProfile
+
AssetPack
↓
GameConfig
```

不要修改 Runtime 核心代码来适应每个游戏。✅ 这条**照旧成立**：本步只产数据，外壳一行没动。

⚠️ **四处与本节字面的出入**：
① **旧入口不再存在**（票 14 的 Q1：(a) 取代）—— CLI 的 `compile-game` 与 MCP 的 `compile_game` 随之变成
   `compile-runtime` / `compile_runtime`。理由：新链的 config 必须**从设计层长出来**
   （`levels[].layout`、每关的 `entities[]`、`world.structure` 都在设计层），而从需求硬猜正是
   塔防那条「需求没说的，它们只能拿示例填」的老路。⚠️「配置可以**人手写**」那条性质不变。
② `RuntimeProfile` **被读，但只用于分派**（`CONFIG_SHAPES`：哪一代 ⇒ 出哪一种 config 形状）——
   **拒绝**早在 `compile-design`（票 10）就发生了，本步**不重复拒**（票 06 的先例：「留码等于把一次拒绝再说一遍」）。
   今天那张表只有一行、**恒等于常数是预期的** —— 它是给第二个成员留的位。
③ ⚠️ **业务校验不过 ⇒ 抛、且不落盘**（**与旧行为相反**）：旧 `compileGame` audit 不过也照落，
   理由是「人过目」—— 而 **R9 把人工点收成了唯一一个、且在清单处**，config 那里**已经没有读者**了
   ⇒ 「坏配置比没配置更坏」（旧代码自己的注释）这一条终于说了算。
   ⚠️ 而**两类失败要分开**：入参/结构不过 = **模型没生成好** ⇒ **重采样**；
   过得了契约、过不了业务校验 = **确定性的编译错误** ⇒ **不重采样、直接抛**。
④ 调用走 **R16**（强制工具调用 + 过 Zod + 3 次），配一份 **v4 镜像**（`contracts/src/config-tool.ts`，
   先例是票 02 / 票 12 那两份）。

---

# 20. Runtime

当前 Runtime 保持稳定。

第一阶段只保证：

```text
platformer/v1
```

⚠️ **2026-10-02 更正（票 05）**：下面那张「能够支持」的八项单子**已出局** ——
它既**不全**（漏了外壳真做的 `gravity` 与 `moving-platform`），又是**另一套措辞**
（`movement`/`pickup`/`goal` 都不是词表里的名字），所以它是一份**独立声明**，
与外壳构成两份真相（本文件头部已声明本文是**表达层**）。

支持什么**以契约为准**：

```text
packages/contracts/src/vocabulary.ts   ← 名字的家（MECHANICS / CAPABILITIES）
packages/contracts/src/runtime-profile.ts ← 「这一代实现了其中哪些」的断言语
```

⚠️ `runtime-profile.ts` **不落盘**，也不被外壳 import —— 见 `01-contracts.md §8`。

---

# 21. Visual QA

新增：

```text
packages/qa/visual.ts
```

检查：

```text
style similarity
palette similarity
silhouette
composition
character consistency
material consistency
animation consistency
```

输出：

```text
VisualQAResult
```

---

# 22. Gameplay QA

新增：

```text
packages/qa/gameplay.ts
```

检查：

```text
boot
spawn
input
movement
collision
interaction
pickup
goal
win
lose
```

---

# 23. Intent QA

新增：

```text
packages/qa/intent.ts
```

根据：

```text
GameIntentSpec
GameDesignSpec
Playable Game
```

判断：

```text
是否实现用户主要意图
```

必须输出缺失项。

---

# 24. Repair Loop

实现：

```text
packages/qa/diagnose.ts
packages/qa/repair.ts
```

流程：

```text
QA
↓
Failure
↓
Diagnosis
↓
Repair Instruction
↓
Regenerate
↓
QA
```

最多：

```text
3 attempts
```

超过后：

```text
status = failed
```

不得无限循环。

---

# 25. E2E Pipeline

实现：

```text
packages/pipeline/create-game.ts
```

API：

```ts
createGame({
  styleReferences,
  gameIntent
})
```

返回：

```ts
{
  visualWorld,
  gameIntent,
  gameDesign,
  assetRecipe,
  assetPack,
  runtimeProfile,
  gameConfig,
  qa
}
```

---

# 26. CLI

增加：

```bash
game-maker create \
  --style ./style.png \
  --intent "做一个废土横版寻宝游戏"
```

也支持：

```bash
game-maker create \
  --style ./style.png \
  --intent ./intent.md
```

---

# 27. E2E Fixture

新增：

```text
fixtures/e2e/wasteland-platformer/
├── style.png
└── intent.md
```

intent：

```text
制作一个横版废土寻宝游戏。

玩家控制一名拾荒者，
在废弃城市中探索，
寻找资源和宝箱，
同时躲避危险和敌人。

游戏需要有：
- 横版移动
- 跳跃
- 宝箱
- 资源
- 敌人
- 废土背景
- 最终目标
```

---

# 28. E2E 输出

执行：

```bash
game-maker create \
  --style fixtures/e2e/wasteland-platformer/style.png \
  --intent fixtures/e2e/wasteland-platformer/intent.md
```

应该生成：

```text
out/<gameId>/
├── visual-world.json
├── game-intent.json
├── game-design.json
├── asset-recipe.json
├── asset-pack.json
│   （⚠️ **没有** runtime-profile.json —— 票 05：它不落盘）
├── game-config.json
├── qa-report.json
└── playable/
```

---

# 29. 测试要求

每阶段完成必须运行：

```bash
pnpm typecheck
pnpm test
```

最终必须：

```bash
pnpm build
```

如果仓库已有 lint：

```bash
pnpm lint
```

---

# 30. 回归测试

必须验证现有：

```text
fixtures/packs/*
```

仍可以：

```text
verify
pack
site
```

---

# 31. 不允许

禁止：

```text
重写 Runtime
删除旧 Contract
删除旧 Fixture
删除 AssetPack
让 LLM 生成游戏代码
绕过 Contract
硬编码某一个 Demo 的特殊逻辑
```

---

# 32. 每完成一个阶段

必须报告：

```text
Implemented
Changed Files
Tests
Remaining
```

然后再进入下一阶段。

---

# 33. 最终验收

必须能够完成：

```text
Style Image
+
Game Intent
↓
VisualWorldSpec
↓
GameIntentSpec
↓
GameDesignSpec
↓
AssetRecipe
↓
Asset Generation
↓
AssetPack
↓
GameConfig
↓
Playable Demo
↓
Visual QA
↓
Gameplay QA
↓
Intent QA
```

并且：

```text
不需要人工修改中间 JSON
```

才算 V2 第一阶段完成。
