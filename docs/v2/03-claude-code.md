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
Style Reference Image
↓
Vision LLM
↓
VisualWorldSpec
```

模型输出必须严格符合 Contract。

不得输出自由文本替代 JSON。

---

# 7. Vision Prompt

必须要求模型分析：

```text
Rendering
Camera
Composition
Palette
Lighting
Materials
Character
Environment
Animation
Readability
```

特别注意：

```text
pixel density
outline
shading
dithering
texture density
character proportions
object scale
camera angle
```

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

修改当前 Asset derive 流程。

旧：

```text
Requirement
+
StyleSpec
```

新：

```text
GameDesignSpec
+
VisualWorldSpec
```

输出：

```text
AssetRecipe
```

---

# 13. Generation Strategy

AssetRecipe 必须允许：

```text
image
character-reference
image-edit
drawlist
procedural
import
```

LLM 必须根据资产复杂度自动选择。

---

# 14. 生成策略规则

优先：

### 角色

```text
character-reference
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

```text
procedural
```

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

扩展 AssetRecipe：

```text
dependsOn
derivedFrom
masterAsset
referenceAssets
```

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

增加：

```text
GameDesignSpec
+
RuntimeProfile
+
AssetPack
↓
GameConfig
```

不要修改 Runtime 核心代码来适应每个游戏。

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
