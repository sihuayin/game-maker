# 10. `compile-design.ts`：`GameIntentSpec` + `VisualWorldSpec` → `GameDesignSpec`

Type: grilling
Status: open
Owner: —
Blocked by: 03, 07, 09, 28
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> `docs/v2/03-claude-code.md` §10。「不要让 `GameIntentSpec` 直接转换为 `GameConfig`。」

## Question

这是理解层的**最后一道** —— 它的产出（`GameDesignSpec`）是 Asset Planner 与 Runtime Compiler
**共同**的输入，所以它的字段**每一个都会被下游读到或读不到**（票 03 的门在这里兑现）。

### 1. 视觉与设计**交汇**在哪

输入同时有 `GameIntentSpec`（要什么）与 `VisualWorldSpec`（这个世界长什么样）。
今天最近的前例是 `compile-game`（`ops.ts` 的横版编译，输入是**需求 + 资源包**）。

要答：**`VisualWorldSpec` 到底影响 `GameDesignSpec` 的哪些字段**？
- 若只影响 `visualRequirements` 一类，那它在这道编译里几乎是**装饰**，值得问一句为什么在这里喂。
- 若影响实体/关卡（例如「这个世界是黄昏的铁路小站」⇒ 敌人是什么），要**指出具体字段**。
⚠️ 说不出来的话，就按 R7 的门：**别留那个字段**。

### 2. 与 `compile-game` / `compile-td-game` 的关系

今天有两个编译器，都是 `需求 + 资源包 → 关卡配置`，**没有** `RuntimeProfile` 输入。
§19 要 `GameDesignSpec + RuntimeProfile + AssetPack → GameConfig`（票 14）。

要答：`compile-design` 是**新的一道**（在资源之前），还是把旧的两道**劈开**？
⚠️ 塔防那条链**不许被弄坏**（R4）。若旧的两道要动，得说清塔防怎么办
（它没有 `GameIntentSpec` / `GameDesignSpec`，它的输入仍是「需求 + 资源包」）。

### 3. `unsupportedRequirements`（§11）

R12 明确**不采用**那条「运行时再说」的路。要答：`GameDesignSpec` 里若出现
`RuntimeProfile` 不支持的能力，**在哪一刻**被拒绝？
- 若在 `compile-design`：那时还没读 `RuntimeProfile`（它是票 14 的输入）⇒ 得**提前**。
- 若在 `compile-runtime`（票 14）：拒绝时已经花掉了 `AssetRecipe` 与**生图的钱**。

⚠️ **这就是 R12 带来的真实代价，要在这一票上说清**：拒绝得越晚，越贵。

> ⚠️ **2026-10-02（[票 03](03-contract-intent-and-design.md) 已关）：两条硬约束落到本票头上了。**
> ① **① 档字段的欠条**：`game-design.ts` 与 `game-intent.ts` 的文件头各列了一批
>    「靠提示词**具名插值**活着」的字段。本票写模板时**每一个都必须具名出现一次**
>    （`spec.world.atmosphere`，**不是** `JSON.stringify(spec)` 整份兜底 —— 整包 JSON 消费不算读）。
>    **没露脸的字段当场出局**：到那时回契约里删掉它，别留着。
> ② **id 延续**：设计层四个桶的 `id` **沿用**意图层 `entities[].id`；`mechanics[].id` 同理。
>    ⚠️ 改名的后果不是「难看」，是 Intent QA（票 19）**误报覆盖度**。
> ③ **§3 那个「拒绝在哪一刻」的问题，本票一填就撞上了**：`mechanics[].mechanic` 是**封闭枚举**
>    （`vocabulary.ts`）—— 想填 `double-jump` 会**填不出来**。那就是 R12 的拒绝，
>    而且是**免费**的（不用另写判据），比票 14 早得多也便宜得多（生图的钱还没花）。

> ⚠️ **2026-10-02（[票 05](05-contract-runtime-profile.md) 已关）：`game.camera` / `game.genre` 的取值从哪来。**
> 票 05 砍掉了 `RuntimeProfile.cameraModel` / `.genre`（它们是**可派生的副本**），
> 所以本票填这两个自由字符串时，**从 profile 的 `id` 与 `capabilities[]` 现取**
> （`capabilities.filter(c => c.startsWith("camera:"))` 就是那个取值域）——
> **别再往 profile 里补字段**，也别在提示词里让模型自由发挥这两个值。

## Answer

（待解）
