# 03. `GameIntentSpec` + `GameDesignSpec` 落地 —— 每个字段都要过「谁读它」的门

Type: grilling
Status: resolved
Owner: amber
Blocked by: —
Map: ../map.md
> 依据 **R7**（Q8a）。这是本图**最容易重演一次 `docs/文档.md`** 的一票。
> ⚠️ **2026-10-01（票 28）：本票造的是 V2 契约 —— 请用 `import { z } from "zod/v4"` 写**（不是 `from "zod"`）。
> 理由与代价见[票 28 的 Answer](28-structured-call-substrate.md)：`toolInputSchema` 只能转 v4 的 schema，而 v3/v4 的 schema **不许互相嵌套**。
> 另：**封口用 `z.strictObject`** —— 普通的 `z.object` 不产出 `additionalProperties: false`。

## Question

`CONTEXT.md:64-69` 记着 `GameSpec` **被删的理由**：

> 它和 [[Game Config]] **不是一件事的粗细两个版本**……它同时是最危险的那种东西 ——
> **一个零消费者的空壳**，会让下一个读代码的人以为它是活的。

V2 现在要加**两层**。R7 定了：三层都保留，但**说不出「谁读它」的字段不进契约**。
这一票就是**逐字段过那扇门**。

### 1. 先答「三层各自回答什么」

- `GameIntentSpec`（`01-contracts.md` §3）：用户**要什么**。
- `GameDesignSpec`（§4）：这个游戏**设计上**是什么。
- `GameConfig`（`CONTEXT.md:217-238`）：**外壳要执行的数据**是什么。

**尖处**：`GameIntentSpec` 的消费者如果**只有** `compile-design`（也就是它只是一个
「一次调用的中间变量」），那它**该不该是契约**、该不该落盘？R8 要它落 `run/v<N>/`，
但落盘**不等于**它有消费者。

### 2. `GameDesignSpec` 会不会重演 `GameSpec` 的结局

看 §4 的字段：`coreLoop: string[]` · `levels[].layout: string` · `progression.description` ·
`difficulty.description` —— **全是自由文本**。这正是被删掉的那个形状。

逐字段过门，**至少**要回答：

| 字段 | 谁读它 | 结论 |
|---|---|---|
| `coreLoop: string[]` | ？ | |
| `levels[].layout: string` | ？ | |
| `enemies[]` / `npcs[]` / `interactables[]` | Asset Planner（要什么资源） | |
| `progression` / `difficulty` | ？ | |
| `assetRequirements` / `visualRequirements` / `runtimeRequirements` | ？ | |
| `interactionModel: string[]` | ？ | |

⚠️ **过不了门的字段就砍**，并把它写进 `## Out of scope`（而不是留一个空壳）。
⚠️ 但**也别砍过头**：`03 §23` 的 Intent QA 要拿 `GameIntentSpec` 与 `GameDesignSpec`
做**集合差**（R3 的「覆盖度」判据）—— 那是**一个真实的消费者**，它决定了哪些字段**必须**结构化：
**能被做集合差的，才配当覆盖度的判据**。

### 3. `GameCreationState`（§13）要不要

它是**顶层容器** —— 也就是被删过的 `CreationProject` 的复活。它在 R8 的落盘方案里
（`run/v<N>/`）有没有位置？还是 `run/` 目录本身就是那个容器、不需要再多一份 JSON？

## Answer

**结论：三层里**两层**落地成契约（`game-intent.ts` / `game-design.ts`，v4），第三层（`GameCreationState`）**判死不建**。
判据三条全绿：**40 条新测试**（其中三条变异验过会红）· 套件 **627/627**（此前 587）· `tsc -b` 干净 ·
`check:deps` / `check:links` 绿。**

### 0. 裁决表（三轮共 18 条）

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | R1-Q1 | 门 = **具名消费者**：① 提示词按名插值 ② 判据 ③ 映射进下游契约；`JSON.stringify(spec)` 兜底**不算读** | 两份契约的文件头 |
| 2 | R1-Q2 | 两层 13 处重名**是故意的** —— 它是 Intent QA 集合差**存在的前提** | 文件头 |
| 3 | R1-Q3 | `GameCreationState` **不建**；`run/v<N>/` 目录即容器 | `doc §13` |
| 4 | R2-Q1 | 设计层**加** `mechanics[]`（封闭枚举），一次拿两个 ② 判据 | `vocabulary.ts` |
| 5 | R2-Q2 | **不加** `fromIntent` 回指；靠 **id 延续** | 两份契约 |
| 6 | R2-Q3 | 砍 `assetRequirements` / `visualRequirements`；`runtimeRequirements` **改封闭能力集** | `game-design.ts` |
| 7 | R2-Q4 | 删 `confidence`；两处都改 `format: z.literal(...)` | 两份契约 |
| 8 | R2-Q5 | `runtimeProfile` → `{id, version}`；① 档字段进欠条 | `game-design.ts` |
| 9 | R3-Q1 | §3 漏审六格：砍 `interactions`；`title` **意图层可空 / 设计层必填** | `game-intent.ts` |
| 10 | R3-Q2 | `ambiguity` 留，消费者 = **R9 的清单检查点** | `game-intent.ts` |
| 11 | R3-Q3 | 只有**会被造出来**的项带 id（`entities` + `mechanics`），其余按文本相等 | `game-intent.ts` |
| 12 | R3-Q4 | `entities[].type` **封闭枚举**，与设计层四桶一一对应 | `vocabulary.ts` |
| 13 | R3-Q5 | 词表住 **`vocabulary.ts`**，三份契约的公共依赖 | `vocabulary.ts` |
| 14 | R3-Q6 | `runtimeRequirements` 封闭能力集 | 同上 |
| 15 | R3-Q7 | `run/v<N>/` 九项清单；`recipe` 是**唯一人工编辑点** | `doc §13` |
| 16 | Q3(a) | `mechanics[].name` **意图层自由文本**（否则 R12 没有东西可拒） | `game-intent.ts` |
| 17 | — | 砍 `interactionModel`（与 `player.abilities` + `interactables[].behavior` 重合） | `game-design.ts` |
| 18 | — | `GameDesignSpec` 补 `format`（此前两份契约里只有它是**匿名**的） | 同上 |

### 1. 落地物

```text
packages/contracts/src/vocabulary.ts     ← 新。「取值的家」，不是契约
packages/contracts/src/game-intent.ts    ← 新
packages/contracts/src/game-design.ts    ← 新
packages/contracts/src/index.ts          ← 三行导出
packages/contracts/tests/{vocabulary,game-intent,game-design}.test.ts
docs/v2/01-contracts.md                  ← §3 / §4 / §8 / §13 按 R17 改
```

### 2. 判据（三条变异验过会红）

| 变异 | 结果 |
|---|---|
| `z.strictObject` → `z.object`（拿掉封口） | **4 条红**，含 `additionalProperties === false` 那条 |
| 把 `double-jump` 塞进 `MECHANICS` | **3 条红**（负判据 + 封闭性 + R12 结构性） |
| 把设计层敌人的 `id` 改成可选 | **1 条红**（引用族都要 id） |

⚠️ 第一次跑变异 C 时**我的 sed 没匹配上**（漏了 `z.array(` 外壳），全绿 —— 那是**变异脚本**的
假阴性，不是判据的。改用正确模式后当场红。

### 3. 落地时**量到的**（别重新量）

- ⚠️ **`game-config/v1` 的真本事比票面假设的小得多**，它决定了词表的上限：
  `EntityKind = solid|pickup|hazard|goal|decor`（`game-config.ts:40`）·
  `Motion = {kind:"cycle", axis, distance, periodMs}`（:49）·
  `PlayerMove = {speed, jumpVelocity, gravity}`（:105，**单跳**）· `Objective = {kind:"collect-then-reach"}`（:154）。
  ⇒ **`double-jump` / `attack` / `health` / `enemy-ai` / `dialogue` 外壳全做不了** ——
    而它们正是用户最常要的。**这就是 R12 的拒绝第一次有真事可拒**，
    也是票 10 / 票 14 追问的「拒绝在哪一刻、代价多大」的答案：**在填 `mechanics` 的那一刻，
    比生图早得多，而且免费**（封闭枚举填不出来，不用另写判据）。
- ⚠️ **我自己上一轮漏了 §3 的六个字段**：第一轮只把 §4 逐字段过了门，
  `interactions` / `targetExperience` / `subgenre` / `world.atmosphere` / `ambiguity` / `title` 全没进表。
  ⇒ **「逐字段过门」这句话本身要有个判据**（数一遍字段总数），否则它会静默地只过一半。
- ⚠️ **`GameIntentSpec` 是契约这件事不由本票裁量**：§14 的 QA 输入明写它，
  而 `check-deps.mjs` 里 `@game-maker/qa` **只依赖 `contracts`** ⇒ 只要 Intent QA 读它，它就必须是契约。
  票面把它当成一个「该不该」的问题，其实它是一个**已经由结构决定**的事实。
- ⚠️ **`confidence` 的留法有一个**看起来**说得通的版本**（当阈值驱动「低置信度就反问」），
  它被否掉的**唯一**理由不是「像分数」，是**够不着人**：R9 只有一个检查点且在**清单处**。
  ⇒ 同一个理由当场决定了 `ambiguity` 的生死：它**只能**挂在那个检查点上，否则同样出局。

### 4. 播下（六张票）

`05` 采纳同一份词表（不许开第二张）· `09` `mechanics` **不许按外壳能力过滤** ·
`10` ① 档欠条 + id 延续 + R12 拒绝在此撞上 · `15` `run/v<N>/` 九项清单 + 票 02 甩来的包内 VWS 问题 ·
`16` **`ambiguity` 的存亡押在这里** · `19` 集合差的键已定 + **文本相等的噪声要它自己写下来**。

### 5. 明确的未决（留给下游，不是遗漏）

- 机制/能力**词表的内容**是第一版草案 —— **票 05 是它的共同拥有者**，
  发现漏项就改 `vocabulary.ts`（已在 `doc §8` 与票 05 上写明）。
- **多关卡索引**、**第二个 `RuntimeProfile` 成员**、**无参考图时的视觉观察** —— 仍在雾里，未动。
