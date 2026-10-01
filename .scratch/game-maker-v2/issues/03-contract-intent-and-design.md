# 03. `GameIntentSpec` + `GameDesignSpec` 落地 —— 每个字段都要过「谁读它」的门

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 依据 **R7**（Q8a）。这是本图**最容易重演一次 `docs/文档.md`** 的一票。

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

（待解）
