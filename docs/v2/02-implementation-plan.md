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
   * ⚠️ **由调用方注入**（R1-Q2）：模型面向的 schema 把它 `omit` 掉了 ——
   *   那个路径是**相对于 `visual-world.json`** 的，模型答不出来。
   */
  styleReferences: { path: string; role: string }[];
  /**
   * ⚠️ **原始需求文本，必填**（R1-Q1）—— 人肉基线（`docs/stylespec-extraction.md`）说「一定要给」：
   *   `palette` 的判据是「画不画得出这个世界里的东西」，而**要画的东西有一部分压根不在参考图里**。
   *   ⚠️ 喂的是文本、**不是** `GameIntentSpec` 的产物 ⇒ vision 与 intent 两步**并列**。
   */
  requirementText: string;
  /** 风格身份（R2-Q2）：参考图 basename 的 slug，由 CLI 生成。提示词递给模型照抄，装配时**强制覆盖**。 */
  styleId: string;
  transport: { baseUrl: string; apiKey: string };
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};
```

⚠️ **2026-10-03（票 08）：这一段已按落地形状改过。** 返回值是
`{ spec: VisualWorldSpec; ledger?: LedgerCall[] }`，失败抛 `AnalyzeReferenceError`
（自带 `failure: CallFailure` 与 `ledger` —— **三发全败也要把账带出来**）。

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

⚠️ **2026-10-03（票 08 的 R2-Q5）：还有三件事连 schema 都表达不出来，它们写在**工具声明**里。**
`toJSONSchema` 会**静默丢掉** `superRefine`，也会把开放对象摊成**没有 `properties` 的空对象**。
八发真跑实测：两发失败**全部**出在内嵌的 `style` 子树 ——
一发把 `style.camera` / `composition` / `lighting` 填成了**字符串数组**（schema 里它们看着像"随便填"），
一发**自造了一个键** `environmentStyle`（键集是封的，但 schema 没说得清有哪 12 个）。
⇒ 那三件事的原文在 `packages/vision/src/prompts.ts` 的 `TOOL_DESCRIPTION`。

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

✅ **2026-10-04 落地**（[票 10](../../.scratch/game-maker-v2/issues/10-design-compiler.md)），落点
`packages/game-design/`（`compile-design.ts` + `build-design.ts` + `prompts.ts`）。

输入（⚠️ **第三样是票 10 加的**，理由：R12 的拒绝要落在**生图之前**，而票 14 看不见意图与 VWS）：

```text
GameIntentSpec
VisualWorldSpec
RuntimeProfile
```

输出：

```text
GameDesignSpec
```

---

## 4.1 Design Prompt

必须生成（⚠️ **`asset requirements` / `visual requirements` 已在票 03 被砍** ——
Asset Planner 的输入是结构化的四个桶，视觉语法已经住在 `VisualWorldSpec`；
`runtime requirements` **留下但改成封闭能力集**。见 [`01-contracts.md §4`](01-contracts.md)）：

```text
player
enemies
interactables
resources
world
levels
progression
win/lose
runtime requirements（封闭能力集）
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

✅ **2026-10-05 落地**（[票 12](../../.scratch/game-maker-v2/issues/12-asset-planner.md)），落点就是本节写的那两处
（`ops.ts` 的 `deriveRecipe` **被改写成** `planAssets` · `prompt.ts` 加规划提示词）。

当前 → 修改为：

```text
Requirement + StyleSpec → AssetRecipe          （旧 deriveRecipe；这一条**没有了**）
GameDesignSpec + VisualWorldSpec → AssetRecipe （同一个 op，新的输入；同一份 asset-recipe/v1）
```

⚠️ **不是并存**（票 12 的 Q1：(a) 合并）：两者产同一种文件，而旧那一道**拒绝决定策略**，
与 §6 的要求正面冲突。⇒ CLI `derive` → `plan`、MCP `derive_recipe` → `plan_assets`；
⚠️「清单可以**人手写**」那条性质不变。
⚠️ 调用协议是 **R16**（强制工具调用 + 过 Zod + 3 次），配一份 **v4 镜像**（`contracts/src/recipe-tool.ts`）。

---

# Phase 6：Generation Strategy

✅ **2026-10-05 落地**（[票 11](../../.scratch/game-maker-v2/issues/11-recipe-extensions.md)）。

⚠️ 「加入六个策略」**不成立** —— 策略**早就在清单里**（`AssetSource.kind` 的判别式），
而六值里另外三个分别是**别名**与**脏词**。⇒ **本阶段改的是文档，不是契约**：

```text
drawlist / image / import          ← 就这三个（image 的两种参数化由 reference / masterAsset 表达）
✗ image-edit / character-reference ← 别名
✗ procedural                       ← 失败的意思（降级链遗物）
```

---

## 6.1 Planner 规则

复杂角色：

```text
image + masterAsset      ← ⚠️ 2026-10-05 更正（票 11 的 Q1）：`character-reference` **不是一个策略值** ——
                           它就是 `image` + `masterAsset`（票 04 的原话：一张被当作参考图喂给生图模型的角色位图）
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

⚠️ **不进清单**（[票 11](../../.scratch/game-maker-v2/issues/11-recipe-extensions.md) 的 Q2）—— 它是 [[地形]]，
「**不引用任何资源**」。可见的碰撞体是 [[实体]]，走上面已有的 `image` / `drawlist`。

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

✅ **2026-10-05 落地**（[票 11](../../.scratch/game-maker-v2/issues/11-recipe-extensions.md) 的 Q3/Q4）。

落点两处：**契约**在 `packages/contracts/src/{asset-spec,recipe}.ts`（字段 + 三条引用族判据，含**环**）·
**排程**在 `packages/assets/src/pack.ts`（promise-DAG）。

```text
dependsOn       资产 → 资产（唯一的新字段）
masterAsset     资产 → 母版（票 04 已落）
✗ derivedFrom ✗ referenceAssets    ← 与上面两条说的是同一件事
```

⚠️ **`pack` 今天连 `authoring[]` 都够不着** ⇒「母版的位图当参考图喂进去」那条管道归
[票 13](../../.scratch/game-maker-v2/issues/13-character-master-gen.md)；本阶段只保证**顺序**。

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

✅ **2026-10-05 落地**（[票 14](../../.scratch/game-maker-v2/issues/14-runtime-compiler.md)）。

⚠️ 同样**不是 `packages/runtime/`**。⇒ **落点定了：`packages/assets/src/ops.ts`**（把 `compileGame`
**改写成** `compileRuntime`，与 `compile-td-game` 并列）—— 本阶段原来给的两个候选
（`game-design` / `pipeline`）是**包还不存在时写的**：它要的东西**全在 `contracts`**
（`GameConfig` + `auditGameConfig` + `auditScreenSpace` + profile），资源包只是个目录
（`parseAssetPack` 也在 contracts）⇒ 不需要任何新依赖边；而与塔防那道同处，才让那句
「同一个口径」有落点。

输入：

```text
GameDesignSpec
AssetPack
RuntimeProfile（只用于**分派**：哪一代 ⇒ 哪一种 config 形状）
```

输出：

```text
GameConfig
```

⚠️ 改名：CLI `compile-game` → `compile-runtime`、MCP `compile_game` → `compile_runtime`（票 14 的 Q1）。
⚠️ **业务校验不过 ⇒ 不落盘、也不重采样**（那是确定性的编译错误，不是模型没生成好）。详见 §19 那四处出入。

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

⚠️ **按 R3，这一族的判据只有两条**（`01 §10`）：

```text
引用族          hud.panel 必须是 ui · 砖的尺寸 == arena.cell · 引用解得到
冒烟可达        boot → spawn → goal
```

⚠️ 上面原来那张十项单子（`input` / `movement` / `collision` / `interaction` / `pickup`
/ `win` / `lose` …）**不采用**：它们要么落在引用族里，要么**要求跑游戏**——
而「跑游戏」正是 `game-creation-v1` 推掉的那一簇（Playwright / 语义测试动作），
R3 那一轮没有把它请回来。
⚠️ **冒烟怎么跑还没定**（[票 18](../../.scratch/game-maker-v2/issues/18-qa-gameplay-judgements.md) §2）：
塔防那边有一个「参考玩家」式的**纯层**，横版有没有**还没量** ——
没有的话这一条就判不了，而 `QAReport.checked` **说得出**这件事。

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
```

输出：**不是一份 `IntentQAResult`，是那条判据的失败**

```text
IntentQAResult   ← ⚠️ 不采用：`score` 与「不带分数」正面冲突，`coverage` 那个
                    Record<string, boolean> 的键也从没定过
```

✅ **2026-10-09 落地**（[票 19](../../.scratch/game-maker-v2/issues/19-qa-intent-coverage.md)），落点就是本节说的 `packages/qa/intent.ts`。
与本文的出入有**三处**：

1. **集合差只按 id**（本文括号里那个「或**文本相等**」**砍掉了**）。票 03 当年把
   `coreLoop` / `winConditions` / `loseConditions` / `progression` 划进文本相减，而票 19 拿
   票 10 探针的 4 发真输出量出它 **0% 命中**（意图 3 条 `coreLoop` → 设计 4 条，措辞全不一样）——
   **设计层做的是放大，不是复述**。⇒ 接成判据会让**每一个**游戏红，包括 R12 一条都没挑出来的那两个。
   ⚠️ 顺带：那笔「文本相等是脆的」噪声**没有**被写下来 —— 它不再是噪声，它是**恒错**，所以整条出局。
2. **输入清单少了第三样**：`Playable Game` 用不上，这条判据只看两份文书。
3. **实现住 `contracts`**（`auditIntentCoverage()`），**不是**住 `qa` —— 它有两个调用方
   （`compile-design` 的 R12 拒绝与意图族），而 `packages/qa` 的白名单只有 `contracts`
   ⇒ 抽上去，两处**只有一处实现**。产出的是 `QAFinding { judgement, target: "game-design", detail, severity: "error" }`
   （**一条** finding，缺项并入 `detail`）。

---

⚠️ **三个 QA 都汇到同一份东西上**（`01 §9`）：`run/v<N>/qa-report.json`，
形状是 `{ format, checked, failures, observations }` —— **没有 `status`**（它是
`qaVerdict()` 派生的三值），判据与观察在类型上分开住。
汇合处是[票 20](../../.scratch/game-maker-v2/issues/20-qa-report-assembly.md)。

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
