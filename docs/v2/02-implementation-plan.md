# Game Maker V2 Implementation Plan

> 本文是实际编码计划。
>
> Claude Code 应严格按照阶段执行，每个阶段完成后运行测试，再进入下一阶段。

---

# Phase 0：建立 V2 基础目录

新增：

```text
packages/
├── vision/
├── game-design/
├── qa/
└── pipeline/
```

新增：

```text
packages/contracts/src/
├── visual-world.ts
├── game-intent.ts
├── game-design.ts
├── character-dna.ts
├── runtime-profile.ts
└── qa.ts
```

---

# Phase 1：Contracts

首先实现：

```text
visual-world.ts
game-intent.ts
game-design.ts
character-dna.ts
runtime-profile.ts
qa.ts
```

要求：

* 使用项目当前 schema 技术
* 保持现有 Contract 风格
* 所有字段可验证
* 不破坏已有 Contract

增加：

```text
schema version
```

例如：

```text
visual-world/v1
game-intent/v1
game-design/v1
character-dna/v1
qa/v1

⚠️ `runtime-profile` **没有** `format` 判别式（票 05 Q8）：
它**不落盘**，`id` + `version` 本身就是身份。
```

---

# Phase 2：Visual Understanding

新增：

```text
packages/vision/
├── analyze-reference.ts
├── build-visual-world.ts
├── prompts.ts
└── index.ts
```

---

## 2.1 analyze-reference

输入：

```ts
type AnalyzeReferenceInput = {
  /**
   * ⚠️ 契约现在就按**复数**写，每一项带 role —— 未来可以是
   *   image A: palette / image B: character / image C: environment。
   * ⚠️ 但**第一阶段 `maxItems === 1`**（R18）：多图的权重融合与冲突解决
   *   没有任何实测，不许在这一阶段实现。见票 26。
   */
  styleReferences: { path: string; role: string }[];
};
```

输出：

```text
VisualWorldSpec
```

---

## 2.2 Vision Prompt

Prompt 必须要求模型分析：

```text
styleIdentity
camera
composition
palette
lighting
materials
character
environment
shapeLanguage
constraints
styleReferences
```

⚠️ **2026-10-01（票 02）：这张清单已与契约对齐。** 旧稿列的 `rendering` / `animation` / `readability`
已删掉 —— 它们**零消费者**，按 R7 的门不进契约（理由逐条见票 02 的 Answer）。
而 `style`（内嵌的那份完整 `StyleSpec` 形）**同样要模型填**，它与上面这些**在同一次调用里产出**。

禁止：

```text
只输出“像素风、废土、暗色”
```

---

## 2.3 Reference Image

原始图片路径必须保存在：

```text
VisualWorldSpec.styleReferences
```

后续 Image Generation 必须重新读取这些图片。

---

# Phase 3：Game Intent Analyzer

新增：

```text
packages/game-design/
├── analyze-intent.ts
├── compile-design.ts
├── prompts.ts
└── index.ts
```

---

## 3.1 analyze-intent

输入：

```ts
string
```

输出：

```text
GameIntentSpec
```

---

## 3.2 Intent Prompt

LLM 必须提取：

```text
genre
subgenre
camera
experience
core loop
player
world
mechanics
interactions
entities
progression
resources
win conditions
lose conditions
ambiguity
```

如果用户意图不明确：

```text
ambiguity[]
```

不能自行伪造。

但是 MVP 允许根据上下文选择合理默认值，并记录：

```text
confidence
```

---

# Phase 4：Game Design Compiler

输入：

```text
GameIntentSpec
VisualWorldSpec
```

输出：

```text
GameDesignSpec
```

---

## 4.1 Design Prompt

必须生成：

```text
player
enemies
interactables
resources
world
levels
progression
win/lose
asset requirements
visual requirements
runtime requirements
```

---

## 4.2 Runtime Profile Selection

Game Design Compiler 必须选择：

```text
platformer/v1
```

MVP 只允许：

```text
platformer/v1
```

未来扩展：

```text
top-down/v1
tower-defense/v1
```

---

# Phase 5：Asset Planner

修改现有：

```text
packages/assets/src/ops.ts
packages/assets/src/prompt.ts
```

当前：

```text
Requirement
+
StyleSpec
→ AssetRecipe
```

修改为：

```text
GameDesignSpec
+
VisualWorldSpec
→ AssetRecipe
```

---

# Phase 6：Generation Strategy

修改：

```text
packages/contracts/src/recipe.ts      ⚠️ 原写 asset-recipe.ts，该文件不存在
```

加入：

```text
image
character-reference
image-edit
drawlist
procedural
import
```

---

## 6.1 Planner 规则

复杂角色：

```text
character-reference
```

复杂环境：

```text
image
```

复杂道具：

```text
image
```

UI：

```text
drawlist
```

碰撞体：

```text
procedural
```

简单几何对象：

```text
drawlist
```

---

# Phase 7：Visual Memory —— ⚠️ 已取消（R11 / R14）

**不建 `packages/visual-memory/`**，也不建那一族独立的 DNA
（`Material DNA` / `Environment DNA` / `Palette DNA` / `Camera DNA` / `Lighting DNA`）。

理由（本轮 Q16② 的裁决，与票 09 删 `GameSpec` 同一条）：

> **一个没有消费者的包，会让下一个读代码的人以为它是活的。**

这一节要的两件事各有其家，**都在 `contracts` 里，不在别的包里**：

```text
「世界视觉记忆」 = VisualWorldSpec   —— 它本来就是那个世界的语法（色板 · 形状语言 ·
                                        材质 · 光照 · 镜头 · 构图）
「Character DNA」= CharacterDNA 契约 —— 跨资产存续的那一份，落 run/v<N>/
```

`Material DNA` **延后**：今天零消费者。等真有再开票。

---

## 7.2（保留）Character Master → DNA → 动画

流程本身**不变**，见 **Phase 9**：

```text
Character Master
      ↓
Character DNA
      ↓
动画从 Character Master 派生
```

⚠️ 但要记住**这条性质今天已经成立**：多帧是**一次调用画一行、按墨迹间隙切**
（`packages/assets/src/pack.ts:340-342,377` + `sheet.ts`）。本阶段新增的是**契约**，不是机制。

---

# Phase 8：Image Generation

修改：

```text
packages/assets/src/image-gen.ts
```

生成时必须同时传入：

```text
VisualWorldSpec
+
Original Style Reference
+
AssetSpec
+
CharacterDNA
+
Generation Strategy
```

---

# Phase 9：Character Generation

新增：

```text
packages/assets/src/character-gen.ts
```

流程：

```text
Character Design
↓
Character Master
↓
Character DNA
↓
Animation Generation
```

---

## 9.1 动画

同一个角色：

```text
idle
run
jump
attack
```

不能独立重新设计角色。

---

# Phase 10：Asset Dependency Graph

修改：

```text
packages/contracts/src/recipe.ts      ⚠️ 同上
```

支持：

```text
dependsOn
derivedFrom
masterAsset
referenceAssets
```

---

# Phase 11：Runtime Profile

⚠️ **不是 `packages/runtime/`**（该包**不存在**；实际是 `contracts` / `assets` / `demo` / `cli` / `mcp`）。

✅ **2026-10-02 落地**（[票 05](../../.scratch/game-maker-v2/issues/05-contract-runtime-profile.md)）。
⚠️ 按 **R12**，`RuntimeProfile` 是**外壳能力的事实投影**（与 `shell.js` **同源同算**），
**不是**一份可以独立声明的清单 —— 否则它与外壳构成**两份真相**。

⇒ 落地成 **`packages/contracts/src/runtime-profile.ts`**：**四个字段**
（`id` · `version` · `mechanics[]` · `capabilities[]`），两条表引 `vocabulary.ts`。
「事实性」由**见证判据**保证（`packages/demo/tests/shell-capability-witness.test.ts`
逐条读外壳源码、断言那条行为串还在），**不由类型保证** —— 外壳**不 import** 它。
它的形状、砍掉的六个字段、以及「两个数组今天恰好等于词表全集」的**自白**，
全部见 [`01-contracts.md §8`](01-contracts.md)。

---

# Phase 12：Runtime Compiler

⚠️ 同样**不是 `packages/runtime/`**。⇒ **落点由
[票 14](../../.scratch/game-maker-v2/issues/14-runtime-compiler.md) 定**
（候选：`game-design` 或 `pipeline`）。

输入：

```text
GameDesignSpec
AssetPack
RuntimeProfile
```

输出：

```text
GameConfig
```

---

# Phase 13：Visual QA

新增：

```text
packages/qa/visual.ts
```

⚠️ **按 R3，这七项里一项都不是判据 —— 它们全是观察。**
判据只收三类：**集合差 · 构造性约束 · 引用族**（都是「精确可算 **+ 错了一定不是设计**」）。
把这七个数写成 `> 0.8 pass` 会**重新引入「代理指标 → 分数 → 优化循环」** —— 那正是 R2 拆掉的。

| 项 | 判定 |
|---|---|
| `style` / `palette` / `silhouette` / `composition` / `character` / `material` / `animation` | **观察**：只报给人看，不打分、不阻断 |

**判据那一侧**（进 `packages/qa/visual.ts`）：

```text
色板绑定四值自洽（exact / composited / quantized / unbound）
尺寸 · 锚点 · 九宫格 三条构造性约束
层覆盖（不平铺的层必须 ≥ 视口）
```

⚠️ 这三条**今天大概率已经在跑**（散在 `pack.ts` 与校验处）⇒ 本阶段的活是**接进 QAReport**，
不是重写。重写 = 第二份真相。详见
[票 17](../../.scratch/game-maker-v2/issues/17-qa-visual-judgements.md)。

---

# Phase 14：Gameplay QA

新增：

```text
packages/qa/gameplay.ts
```

检查：

```text
boot
player spawn
input
movement
collision
interaction
pickup
win
lose
```

---

# Phase 15：Intent QA

新增：

```text
packages/qa/intent.ts
```

输入：

```text
GameIntentSpec
GameDesignSpec
Playable Game
```

输出：

```text
IntentQAResult
```

---

# Phase 16：Repair Loop

新增：

```text
packages/qa/diagnose.ts
packages/qa/repair.ts
```

⚠️ **按 R13，第一阶段只做「资源级重生成」。** 去掉 `Config Regen`：

```text
判据 Failure
↓
Diagnosis（判据 → 阶段的映射，是个封闭枚举）
↓
Repair Instruction
↓
Asset Regen（只重生成那一个资源）
↓
QA（同一条判据）
```

**不做**：`Config Regen` · 全链重跑。理由：全链重跑会把 LLM 的随机性引进循环里 ——
那不叫修复，叫**再抽一次奖**。⇒ 第一阶段的修复**很可能只覆盖视觉判据**，
「引用族」与「意图覆盖」两类失败**就是失败**。

详见[票 21](../../.scratch/game-maker-v2/issues/21-repair-loop.md)。

最多：

```text
3 attempts
```

---

# Phase 17：E2E Pipeline

新增：

```text
packages/pipeline/
├── understand.ts
├── design.ts
├── assets.ts
├── runtime.ts
├── qa.ts
└── create-game.ts
```

最终：

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

# Phase 18：CLI

增加：

```bash
game-maker create \
  --style ./style.png \
  --intent ./intent.md
```

或者：

```bash
game-maker create \
  --style ./style.png \
  --intent "做一个废土横版寻宝游戏"
```

---

# Phase 19：输出目录

⚠️ **不是扁平文件**（R8）：扁平违反仓库既有的**版本不可变 · 可复现 · 可回滚**三条，
且**逐文件 checksum** 与「重跑写下一版」都挂在目录形状上。

```text
out/<gameId>/
├── run/v<N>/                   ← 理解层与验证层的产物，各自一份
│   ├── visual-world.json
│   ├── game-intent.json
│   ├── game-design.json
│   ├── character-dna.json
│   │   （⚠️ **没有** runtime-profile.json —— 票 05 Q5：它不落盘）
│   └── qa-report.json
├── recipes/v<N>.json           ← ⚠️ 清单的落点**沿用今天的路径**；要不要挪进 run/ 由票 15 定
├── pack/v<N>/                  ← 交付态目录，永不 zip；自己的计数器
└── site/v<N>/                  ← 站点；自己的计数器
```

⚠️ **三种产物各有自己的计数器**，都**绝不覆盖**。

---

# Phase 20：E2E Demo

准备：

```text
fixtures/e2e/wasteland-platformer/
├── style.png
└── intent.md
```

执行：

```bash
game-maker create \
  --style fixtures/e2e/wasteland-platformer/style.png \
  --intent fixtures/e2e/wasteland-platformer/intent.md
```

最终：

```text
out/wasteland-platformer/
```

必须包含完整结果。

---

# Phase 21：测试

每个新模块必须拥有：

```text
unit test
contract test
integration test
```

Pipeline 必须有：

```text
E2E test
```

---

# Phase 22：Backward Compatibility

已有：

```text
fixtures/packs/*
```

必须继续工作。

现有：

```text
asset generation
pack
site
verify
```

不得因为 V2 Contract 导致现有 Demo 全部失效。

⚠️ **不做 schema 迁移**（Q19 裁决：**出局**）。真正的需求不是
`v1 schema → migration → v2 schema` —— 没有大量旧用户数据要迁；真正的需求是
**新旧并存**：

```text
旧： game-config/v1 · td-config/v1        ← 原样保留，继续用
新： GameDesignSpec → RuntimeProfile → game-config/v1   ← 新的产出口
     ⚠️ `→ RuntimeProfile` 读作「**选择**」不读作「派生」—— profile 是外壳的事实（R12），
       设计层只是 `{id, version}` 引用它。见 `01-contracts.md §8`。
```

⇒ R6 选的「**并存**」已经满足了本节真正要的那件事（**不破坏旧 contract**）。
**不得直接删除** 这条仍然成立。

---

# Phase 23：实施顺序

严格：

```text
1 Contracts
2 Vision
3 Intent
4 Design
5 Asset Planner
6 Generation Strategy
7 Visual Memory
8 Image Generation
9 Character Generation
10 Runtime Profile
11 Runtime Compiler
12 Visual QA
13 Gameplay QA
14 Intent QA
15 Repair
16 E2E Pipeline
17 CLI
```

每完成一个阶段：

```bash
pnpm test
pnpm typecheck
```

必须通过后进入下一阶段。

---

# Phase 24：禁止事项

Claude Code 不得：

1. 重写整个 Runtime
2. 删除现有 AssetPack
3. 删除现有 AssetSpec
4. 删除现有 GameConfig
5. 让 LLM 生成 Runtime 源代码
6. 为了 V2 删除 V1 fixtures
7. 把所有素材强制改成 image generation
8. 把所有素材强制改成 drawlist
9. 把 Style Reference 转换成纯文字后丢弃原图
10. 绕过 Contract 直接传递内部对象

---

# Phase 25：完成条件

必须最终实现：

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
AssetPack
↓
GameConfig
↓
Playable Demo
↓
QA
```

并且整个流程不需要人工编辑中间 JSON。

> ⚠️ **`Benchmark` 已删（Q19 裁决：出局）。** 它属于**评测体系**，不是**创建系统**；
> 而「**QA 不评分**」已经定了 —— Benchmark 会自然诱导 `score` / `ranking` / `optimization`
> 重新进场。将来真需要，**单独建一个 `evaluation-lab`**，不要污染 `game-maker`。
