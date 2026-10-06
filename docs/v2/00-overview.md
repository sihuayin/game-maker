# Game Maker V2

## AI Game Creation Compiler

> Version: V2.0
> Status: Implementation Specification
> Scope: 单个游戏项目生命周期
> Target: Style Image + Game Intent → Playable Game

---

# 1. 目标

Game Maker V2 的目标不是单纯生成游戏素材，而是建立一个：

> **AI Game Creation Compiler**

输入：

```text
Style Reference Image(s)
+
Natural Language Game Intent
```

输出：

```text
VisualWorldSpec
+
GameIntentSpec
+
GameDesignSpec
+
AssetPack
+
GameConfig
+
Playable Demo
+
QA Report
```

---

# 2. 当前版本存在的问题

当前系统已经具备：

```text
AssetSpec
↓
AssetRecipe
↓
Asset Generation
↓
AssetPack
↓
GameConfig
↓
Fixed Runtime
↓
Playable Demo
```

这部分继续保留。

但当前存在以下结构性问题。

## 2.1 图片风格没有进入主 Pipeline

当前：

```text
Reference Image
↓
人工 / Agent
↓
StyleSpec
↓
Game Maker
```

目标：

```text
Reference Image
↓
Vision Model
↓
VisualWorldSpec
↓
Game Maker
```

---

## 2.2 缺少 GameIntentSpec

当前：

```text
Requirement
↓
AssetRecipe
```

目标：

```text
User Intent
↓
GameIntentSpec
↓
GameDesignSpec
↓
AssetPlan
```

---

## 2.3 缺少 GameDesignSpec

不能让用户需求直接变成 Runtime Config。

必须区分：

```text
Intent
=
用户想做什么

Design
=
游戏应该如何设计

Runtime Config
=
Runtime 如何执行
```

---

## 2.4 Asset Generation Strategy 不应该人工决定

当前主要是：

```text
AssetRecipe
↓
drawlist
```

V2 必须允许 LLM 决定 —— ⚠️ **但那张六值单子不成立**（[票 11](../../.scratch/game-maker-v2/issues/11-recipe-extensions.md) 逐值裁过）：
**策略就是 `drawlist` / `image` / `import` 三个**（`image` 的「带参考图」「带母版」是它的两种参数化，
`procedural` 是**失败**的意思、已出局）。见 [`01-contracts.md §5`](01-contracts.md)。

```text
drawlist     ← 简单几何 / UI：画出来的
image        ← 复杂角色 / 敌人 / 背景 / 道具：生成出来的（带 reference 或 masterAsset 就是那两种参数化）
import       ← 人给的位图（+ 可选 sheet 网格）
```

---

## 2.5 缺少视觉一致性模型

不能只共享：

```text
StyleSpec
```

需要：

```text
视觉一致性 = 世界语法 + 角色基因，两样各有其契约：

VisualWorldSpec        —— 这个世界的语法（色板 · 形状语言 · 材质 · 光照 · 镜头 · 构图）
                          「世界视觉记忆」就是它，不另有载体
CharacterDNA           —— 一个角色的基因，跨资产存续（契约，落 run/v<N>/）

⚠️ 不设 Material DNA / Environment DNA / Palette DNA / Camera DNA / Lighting DNA
   这些**独立的 DNA**：它们没有消费者。见下方 §10 的「出入」第 3 条。
```

---

## 2.6 缺少自动 Visual QA

当前：

```text
Generate
↓
Review
```

V2：

```text
Generate
↓
Visual QA
↓
Pass / Fail
↓
Repair
↓
Regenerate
```

---

# 3. V2 总体架构

> ⚠️ **2026-10-03（[票 08](../../.scratch/game-maker-v2/issues/08-vision-analyze-reference.md) 的 R1-Q1）：
> 图中 `Game Intent` 那一支**同时**喂给 `Visual Understanding`。**
> 它的输入是 **Style Reference + 一份原始需求文本**，不是只有参考图 —— 理由见 §6。

```text
                         User
                          │
              ┌───────────┴───────────┐
              │                       │
       Style Reference          Game Intent
              │                       │
              ▼                       ▼
     Visual Understanding      Intent Understanding
              │                       │
              ▼                       ▼
      VisualWorldSpec          GameIntentSpec
              │                       │
              └──────────┬────────────┘
                         ▼
                  GameDesignSpec
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
        Asset Planner          Runtime Planner
             │                       │
             ▼                       ▼
        AssetRecipe            RuntimeProfile
             │
             ▼
       Asset Compiler
             │
     ┌───────┼────────┐
     ▼       ▼        ▼
   Image  DrawList  Procedural
     │       │        │
     └───────┼────────┘
             ▼
         AssetPack
             │
             ▼
       Runtime Compiler
             │
             ▼
         GameConfig
             │
             ▼
       Fixed Runtime
             │
             ▼
       Playable Demo
             │
             ▼
      ┌──────┼──────┐
      ▼      ▼      ▼
   Visual Gameplay Intent
      QA       QA      QA
      │        │       │
      └────────┼───────┘
               ▼
          QA Report
               │
          ┌────┴────┐
          ▼         ▼
        PASS       FAIL
          │         │
          ▼         ▼
         Done     Repair
                     │
                     ▼
                 Regenerate
```

> ⚠️ **图上那根 `Runtime Planner → RuntimeProfile` 的箭头，读作「选择 / 引用」，不读作「派生」**
> （R12；澄清由[票 01](../../.scratch/game-maker-v2/issues/01-write-v2-docs.md) 的对账表第 7 条点名，
> [票 05](../../.scratch/game-maker-v2/issues/05-contract-runtime-profile.md) 落地时补上）。
> `RuntimeProfile` 是**外壳的事实**，不是设计的产物 —— 设计层存的是 `{id, version}` **引用**
> （`GameDesignSpec.game.runtimeProfile`）。它**不落盘**（`01-contracts.md §13` 的九项里没有它）。

---

# 4. 架构原则

## Principle 1

```text
Intent != Design
```

## Principle 2

```text
Design != Runtime Config
```

## Principle 3

```text
StyleSpec != VisualWorldSpec
```

## Principle 4

原始 Style Reference 必须进入素材生成 Pipeline。

## Principle 5

素材不能完全独立生成。

必须支持：

```text
VisualWorldSpec（世界语法）
Character DNA（角色基因）
```

## Principle 6

```text
Generate != Done
```

必须经过 QA。

## Principle 7

```text
Playable != Intent Correct
```

必须存在 Intent QA。

## Principle 8

AI 不直接生成 Runtime 代码。

```text
AI → Data
Runtime → Code
```

---

# 5. 第一阶段范围

第一阶段只实现：

```text
Style Image
+
Game Intent
↓
Playable Platformer Demo
```

Runtime Profile：

```text
platformer/v1
```

Demo：

> 废土横版探索/寻宝。

---

# 6. 第一阶段完整 Pipeline

```text
Style Image + Game Intent          ← ⚠️ 两个**并列**的输入（票 08 的 R1-Q1）
↓
VisualWorldSpec  +  GameIntentSpec ← ⚠️ 两步**并列**：都吃上面那两样，vision 不等 intent
↓
GameDesignSpec + VisualWorldSpec   ← ⚠️ 规划清单要**两样**（票 12 的 Q2）：视觉语法**不进**设计层
↓
AssetRecipe
↓
Asset Generation
↓
AssetPack
↓
GameConfig
↓
Platformer Runtime
↓
Playable Demo
↓
Visual QA
↓
Gameplay QA
↓
Intent QA
```

---

# 7. 非目标

V2 第一阶段不做：

* LLM 生成游戏源代码
* 多游戏知识共享
* 跨项目资产迁移
* Unity Runtime
* Godot Runtime
* 多人游戏
* 复杂 NPC AI
* 复杂经济系统
* 无限关卡生成
* 完整商业级游戏

---

# 8. 成功标准

给定：

```text
废土风格参考图

“制作一个横版废土寻宝游戏，
玩家控制拾荒者探索废弃城市，
寻找资源和宝箱，并躲避敌人。”
```

系统应该自动产生：

```text
player
enemy
background（分层：foreground / midground / background 是同一个资源的三层）
treasure
crate
barrel
resource
UI
animations
```

并产生：

```text
Playable Demo
```

玩家至少能够：

```text
移动
跳跃
碰撞
收集
遇到危险
达到目标
完成核心循环
```

---

# 9. V2 完成定义

V2 第一阶段完成必须满足：

* 不需要人工创建 StyleSpec
* 不需要人工修改 AssetRecipe source.kind
* 不需要人工修改 GameConfig
* Style Reference 自动参与素材生成
* Game Intent 自动转换为 GameDesign
* AssetRecipe 自动生成
* AssetPack 自动生成
* Demo 自动生成
* Demo 可以启动
* Visual QA 自动运行
* Gameplay QA 自动运行
* Intent QA 自动运行
* QA 失败可以自动触发有限次数修复

---

# 10. ⚠️ 与实现决策记录（R 表）的出入

本文是**目标与范围**的陈述；**已落定的实现决策**在
[`.scratch/game-maker-v2/map.md`](../../.scratch/game-maker-v2/map.md) 的 **R 表**（R1–R18）。

> **两者的关系是**：R 表是**决策记录**，本文是它的**表达层**。
> 冲突时**默认本文写错** —— 要改 R 表，必须**重新开票**，不能由文档覆盖。

本文与 `03-claude-code.md` 已经对齐 R 表的地方，逐条列在下面，免得读者照着旧字面干活：

| 本文/`03` 的旧字面 | 以 R 表为准的写法 |
|---|---|
| `03 §18` 要建 `packages/visual-memory/` | **不建**（R11/R14）。世界视觉记忆 = `VisualWorldSpec`，角色基因 = `CharacterDNA` 契约 |
| `03 §28` 的 `out/<gameId>/` 扁平文件 + `playable/` | `run/v<N>/` + `pack/v<N>/` + `site/v<N>/`，**禁止覆盖**（R8） |
| `03 §21` 的视觉七项（style/palette/silhouette/composition/character/material/animation） | **全是观察**，不进判据（R3） |
| `03 §24` 的修复含 Config Regen | 第一阶段**只做资源级重生成**（R13） |
| `03 §11` 的「记录 `unsupportedRequirements`」 | **不采用**：`RuntimeProfile` 是外壳能力的**事实投影**，构建期**拒绝**（R12） |
| `03 §7/§16` 的 Material DNA | **延后**，等真有消费者（R14） |
| `03 §2/§6/§25` 让复用 `packages/runtime` 与 `packages/site` | 这两个包**不存在**；实际是 `contracts` / `assets` / `demo` / `cli` / `mcp` |
| `03 §14` 把 Vision 的输入写成「`StyleReference`」单数一样 | 还要一份**原始需求文本** —— vision 与 intent 两步**并列**（[票 08](../../.scratch/game-maker-v2/issues/08-vision-analyze-reference.md) 的 R1-Q1） |
| `03 §7` 那张十项清单 | **以落地契约为准**；`Rendering` / `Animation` / `Readability` 零消费者、**不问**（票 08 的 R1-Q4） |
| `03 §6` / `02 §2.1` 的 Vision 输入与 `AnalyzeReferenceInput` | 已按落地形状重写；另有**三件事 schema 表达不出来**，写在工具声明里（票 08 的 R2-Q5） |
| `03 §9` 那张「至少识别」清单里的 `resources` | **出局**：降成 `entities[].type = "resource"`（[票 09](../../.scratch/game-maker-v2/issues/09-intent-analyzer.md) 的 Q5）；契约另加一条**结构性空值 gate**（该票的 R2-Q1） |
| `03 §10` / `§19` 的编译器输入表 | `compile-design` **多一个 `RuntimeProfile` 输入** —— R12 的拒绝必须发生在**生图之前**，而票 14 看不见意图与 VWS（[票 10](../../.scratch/game-maker-v2/issues/10-design-compiler.md) 的 Q3a） |
| `03 §13` / `§14` / `§17` · `02 Phase 6` / `§6.1` / `Phase 10` 的策略与依赖清单 | **六值策略单子不成立**（只有 `drawlist`/`image`/`import`；`procedural` 是**失败**的意思）· 依赖边只剩 `dependsOn` + `masterAsset` · **碰撞体是 [[地形]]、不进清单**（[票 11](../../.scratch/game-maker-v2/issues/11-recipe-extensions.md) 的 Q1/Q2/Q3） |
| `03 §12` 的「**修改**当前 Asset derive 流程」 | 照做了，而且是**合并**不是并存：`deriveRecipe` 被改写成 `planAssets`，CLI `derive` → `plan`、MCP `derive_recipe` → `plan_assets`（[票 12](../../.scratch/game-maker-v2/issues/12-asset-planner.md) 的 Q1） |
| `03 §19` 的编译器输入表 + 旧行为「**audit 不过照样落盘**」 | `compile-game` → **`compile-runtime`**（吃「设计 + 这一代外壳 + 包」）；`RuntimeProfile` **只用于分派**（拒绝早在 `compile-design`）；⚠️ **业务校验不过 ⇒ 抛且不落盘**（R9 之后 config 那里没有读者了）——[票 14](../../.scratch/game-maker-v2/issues/14-runtime-compiler.md) 的 Q1/Q2/Q5 |

> ⚠️ 上表最后八行**不是 R 表改的，是票解出来的决定**（三行来自[票 08](../../.scratch/game-maker-v2/issues/08-vision-analyze-reference.md)、一行来自[票 09](../../.scratch/game-maker-v2/issues/09-intent-analyzer.md)、一行来自[票 10](../../.scratch/game-maker-v2/issues/10-design-compiler.md)、三行来自[票 11](../../.scratch/game-maker-v2/issues/11-recipe-extensions.md) / [票 12](../../.scratch/game-maker-v2/issues/12-asset-planner.md) / [票 14](../../.scratch/game-maker-v2/issues/14-runtime-compiler.md)）。
> 本文件的规矩同样适用：**票的决定是决策记录，`docs/` 是它的表达层** —— 冲突时改文档。
