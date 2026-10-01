# 09. `analyze-intent.ts`：自然语言 → `GameIntentSpec`

Type: grilling
Status: open
Owner: —
Blocked by: 03, 07, 27
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> `docs/v2/03-claude-code.md` §9。今天的 `derive` **已经在做同一族的事**，别从零造。

## Question

§9 要 `自然语言 → GameIntentSpec`，至少识别：`genre` · `camera` · `core loop` · `player` ·
`world` · `mechanics` · `entities` · `progression` · `resources` · `win` · `lose`。

### 1. 与 `derive` 的关系 —— 这是本票的主问题

`derive`（`ops.ts:61-145`）今天的输入是**需求文本 + StyleSpec**，输出是一份**资源清单**，
提示词里塞了 `styleBrief(style)` + 配方骨架 + `recipeShapeSpec()`（`ops.ts:66-97`）。

V2 把这件事**劈成两半**：先「需求 → `GameIntentSpec`」，再「`GameIntentSpec` + `VisualWorldSpec`
→ `GameDesignSpec`」，最后才到清单。要答：

- **(a)** `analyze-intent` 是**新的一道**，`derive` 保留为「清单推导」的独立入口（R7 两条路都开）；
- **(b)** `derive` 被**拆掉**，清单只能从新链产出。⚠️ 这违反「清单可以人手写」那条锁定性质。

⚠️ 仓库里**已有**一个前例：`compile-td-game` 的教训是「**不是玩法感知的**：需求没说的，
它们只能拿示例填」——需求缺项时的**填法**是这条链上已经咬过一次人的地方
（`README_zh.md` 记着：一份没提「场地是一格格砖」的需求，会安静地产出合法但错的东西）。

### 2. 需求「没说」的那一半怎么办

`GameIntentSpec` 的字段里有 `ambiguity: string[]`。要答：
**缺项是「放进 `ambiguity` 继续」还是「当场拒绝」**？两者在今天的仓库里都有先例
（`derive` 拿示例填；`compile-td-game` 事后才响）。R9 定的检查点在这一步**之前**
（那时还没有清单），所以这一步的失败**没有人工兜底**。

### 3. `--intent` 收文本还是收文件（§26）

§26 两种都要：`--intent "做一个废土横版寻宝游戏"` 与 `--intent ./intent.md`。
要答：裸文本作为 CLI 参数的**转义/引号**问题，以及**落盘时**它算不算一份产物
（R8 的 `run/v<N>/` 要不要存下那段原文 —— 复现一次运行必须留得下输入）。

### 4. 严格 JSON

同票 08 §3、票 25：这一票**沿用** R16 定的三件套（纯文本 + 剥围栏 + 固定次数重采样），
把重采样次数与失败行为（退出码 4）**写死**。

## Answer

（待解）
