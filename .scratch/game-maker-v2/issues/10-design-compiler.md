# 10. `compile-design.ts`：`GameIntentSpec` + `VisualWorldSpec` → `GameDesignSpec`

Type: grilling
Status: open
Owner: —
Blocked by: 03, 07, 09, 27
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

## Answer

（待解）
