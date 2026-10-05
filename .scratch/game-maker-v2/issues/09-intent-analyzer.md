# 09. `analyze-intent.ts`：自然语言 → `GameIntentSpec`

Type: grilling
Status: resolved
Owner: claude (2026-10-03)
Blocked by: 03, 07, 28
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

⚠️ **2026-10-01 就地更正**：原写「沿用 R16 的三件套（纯文本 + 剥围栏 + 固定次数重采样）」——
**R16 已被[票 27](27-json-via-tool-choice.md) 改写**（R17：那就是那张重开票）。

**现在的协议是 R16（新）**：走 `tool_choice: {type:"tool", name}` **强制工具调用**，
且**入参必须过 Zod 才算成功** —— `stop_reason === "tool_use"` **不是**成功信号
（票 27 第 1 发实测：工具被调、`input={}`、1135 token 打水漂）。
**重采样 3 次**（1 首 + 2 重），**「剥围栏」作废**。失败行为（退出码 4）本票仍然写死。

⚠️ **底座在[票 28](28-structured-call-substrate.md)**（`contracts` 里的 tool schema/解析器 +
账的 `failure` 闭集）—— 本票**只写调用方**，别再实现一遍。

> ⚠️ **2026-10-02（[票 03](03-contract-intent-and-design.md) 已关）：`GameIntentSpec` 的形状落定了**
> （`packages/contracts/src/game-intent.ts`，含文件头的一张「① 档欠条」）。三条会影响本票：
> ① **`mechanics[].name` 是自由文本，故意的** —— 用户要二段跳就**照实记**，哪怕外壳做不了。
>    **别「顺手」按外壳能力过滤**：记下来，拒绝是 `compile-design`（票 10）的事。
>    过滤掉的话，`03 §11` 要防的「偷偷丢掉」就发生了。
> ② `entities[].type` 是**封闭枚举** `enemy | npc | interactable | resource`，与设计层四个桶一一对应。
> ③ `title` **可空**（用户真可能不起名）—— 别为了填满而编一个。
> ⚠️ 另：`run/v<N>/intent.md` 要存**原样字节**（票 03 Q5）；裸文本 vs 文件两种给法仍归本票 §3 答。

## Answer

**结论：`analyze-intent` 落地**（`packages/game-design/`，两个源文件）**，顶层 `resources` 从契约里出局，
契约加一条「结构性空值」gate。** 17 条裁决 · **40 条新测试** · 套件 **801/801**（此前 761）·
`tsc -b --force` 干净 · 两个守卫绿（145 份文档 · 731 条链接）· **17 发变异全部验过会红**。

### 0. 裁决表（两轮 + 一道补裁）

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | 1-Q1 | **`derive` 保留，本票一个字不碰**；它的存废/合并归**票 12**（票面已自称接班人） | 无（本票没动它） |
| 2 | 1-Q2 | 缺席分**三种**，不是票面那一问；**契约立 gate**，只判结构性空值 | `game-intent.ts` |
| 3 | 补裁 | **`mechanics ≥ 1` 进 gate · `entities ≥ 1` 出局**（障碍跑式关卡 `entities: []` 是对的） | `game-intent.ts` |
| 4 | 1-Q3 | 传输层失败**进** `failures[]`（照**代码**）；票 08 票面那句标为过时 | `analyze-intent.ts` · 票 08 |
| 5 | 1-Q4 | **存在路径读文件、否则当裸文本**；疑似路径不存在 ⇒ usage 错（不许静默降级） | **票 16** 实现 |
| 6 | 1-Q5 | **删顶层 `resources[]`**，唯一来源 `entities[].type === "resource"` | `game-intent.ts` · 三处文档 |
| 7 | 1-Q6 | 落地形状全表（见 §2） | 两源文件 + `ledger.ts` |
| 8 | 1-Q7 | 真探针授权 **n=4**「小探针，不能据此改大结构」 | `experiments/intent-first-shot/` |
| 9 | 2-R2-Q1 | gate 的**射程表**（进/不进各列开，见 §1） | `game-intent.ts` |
| 10 | 2-R2-Q2 | `ambiguity` 必须**指得出字段名**，但**不进 gate**（格式正则会把重采样烧在措辞上） | `prompts.ts` |
| 11 | 2-R2-Q3 | 只对 ① 档那两个可选字段（`subgenre` · `camera`）要求「尽力填」 | `prompts.ts` |
| 12 | 2-R2-Q4 | 提示词**永远**把需求文本嵌进固定骨架（(c)：架构 + 记账） | `prompts.ts` |
| 13 | 1-Q6 | 账：`LedgerStep += "analyze-intent"` · `target = "game-intent"`（**产物名**，不是 id） | `ledger.ts` |
| 14 | 1-Q6 | **没有装配步** —— `GameIntentSpec` 没有一个字段是「调用方才知道的」 | 文件划分 |
| 15 | 1-Q6 | 退出码映射写死在票里：`schema`/`no-tool-use`/`empty-input`/`truncated` → `EXIT.invalid`(4)；`http`/`timeout` → `EXIT.upstream`(3) | **票 16** 实现 |
| 16 | 1-Q6 | `max_tokens = 16_000` · 工具名 `emit_game_intent` · 无 `.omit()`、无注入 | 两源文件 |
| 17 | 1-Q4 | `analyze-intent` **不做 CLI 入口**（照票 08 的裁决 14） | 无 |

### 1. gate 的射程表（第 2 轮 R2-Q1 + 补裁，**这就是「结构性 / 语义性」那条分界线**）

**进 gate**（⇒ 这一发算 `schema` 失败、重采样）：

- 必填字符串非空（trim 后）：`genre` · `targetExperience` · `player.role` · `world.theme` · `world.setting` · `world.atmosphere`
- 数组**元素**非空：`coreLoop[]` · `player.goals[]` · `winConditions[]` · `loseConditions[]` · `ambiguity[]` · `entities[].role`
- 数组**本身 ≥1**：`coreLoop` · `player.goals` · **`mechanics`**
- 可选对象**若出现**则不得是空壳：`progression` / `challenge` 的 `type` 与 `description` 至少一个非空
- id 不得重复：`entities[].id` · `mechanics[].id`（跨阶段的 id 延续靠它 —— 与 08 的「色板不得重色」同形）

**不进 gate**（⚠️ **逐条写在契约注释里，免得下一个人往里加**）：

- `winConditions: []` / `loseConditions: []` —— 「不会死 / 没有终点」是真设计（仓库里就有原话：「没有血量条，也不会死」）
- `ambiguity: []` —— 需求说得够全时它就该是空的
- **`entities: []`** —— 障碍跑式关卡（只有平台，没有敌人/拾取物/交互物）是**对的**；横版外壳里地形与终点不算实体。
  这一格是**人类专门从 gate 里划出去的**（与 `mechanics ≥ 1` 二选一）
- `title` / `subgenre` / `camera` 缺席 · `progression` / `challenge` 整个缺席

⚠️ **这条 gate 只管「有没有做决定」，不管「决定对不对」** —— 后者是票 19 的 Intent QA。

### 2. 落地形状（第 1 轮 Q6 全表）

- 落点 **`packages/game-design/`**（**不在** `vision` —— 两个新包彼此不依赖，`check-deps.mjs` 是双向的）：
  `src/analyze-intent.ts`（调用方）+ `src/prompts.ts`（`TOOL_NAME` / `TOOL_DESCRIPTION` / `intentPrompt`）+ `index.ts`。
- **没有装配步**（对照 08 的 `build-visual-world.ts`）：没有任何「提示词里给不出正确值」的字段要注回去，
  ⇒ 过完 Zod 的产物**就是**成品，`parseToolUse` 直接吃整份契约。
- **`.omit()` 一个键都没用** ⇒ gate 一直跟着模型面向的 schema 走；但模型**仍看不见它**（`toJSONSchema` 丢 `superRefine`）
  ⇒ 规矩写在 `TOOL_DESCRIPTION` 里（1080 字符，R2-Q5 那个杠杆）。
- **不写任何文件**：只返回值。`run/v<N>/game-intent.json` 归票 15；`intent.md` 存**调用方手里那段原文的字节**（本函数连原文都不回传）。
- 提示词的骨架**逐字段点名 16 个键**（① 档欠条要的「逐个点名」），并有一条测试盯着它与契约的键集**逐字对齐**。

### 3. 探针（`experiments/intent-first-shot/`，n=4）

⚠️ **它量的是「原始契约 + 最小说明」，不是出货的那一份**（照 08 的纪律：本发刻意不加提示词补丁）。

- 模型面向的 schema = 契约本身：**16 键 / 1735 B**，无注入、无 `.omit()`。
- **verbose**（`03 §27` 的 intent 正文，104 字）×2：**2/2 过 Zod**，输出 991 / 1159 token。
- **terse**（「做一个废土横版寻宝游戏」）×2：**0/2**，两发都是 `empty-input` ——
  `blockTypes=['tool_use']`、`stop=tool_use`、`input={}`、**白烧 1074 / 1082 输出 token**，与票 27 第 1 发**逐字同形**。
- 合计首发 **2/4（50%）**；3 次地板下 ≈87.5%（按独立重抽算）。
- ⚠️ 两发成功的 verbose 里，**射程表上一处都没踩中** ⇒ 那张表在正常输入上很安静，**安静是预期的**。
- `entities[].type = "resource"` **两发都有** ⇒ Q5 的验收眼过了。
- ⚠️ `ambiguity` 各 4 / **8** 条，**全部是自由句子、一条都没点字段名**，且多条**描述的根本不是本契约的字段**
  （「关卡数量与地图是否分段」—— `levels` 在设计层；「资源的具体用途（回血/升级/开门）」；「敌人是否可被击杀还是只能躲避」）
  ⇒ 这是 R2-Q2 判「必须指得出字段名」的**直接证据**。
- 服务端自报 `servedModel=deepseek-flash`（请求的是 `deepseek-v4-pro`）—— 代理又换过模型，与票 25 记的一致。
- ⚠️ **第一次跑的那一版取错了代码块**（拿到 `§27` 的目录树而不是 intent 正文，62 字），
  fix 后**只补跑 verbose 那一臂**，把有效发数维持在授权的 4 发（原 terse 两发本身是对的）。4 份 raw 都留着。
- ⚠️ **提示词骨架到底救不救得了短输入，本票没测**（n=4 已用尽）。
  零成本能说的只有一件：同一句话现在包出来是 **1163 字符**的提示词，不再是「一句话」。

### 4. 落地时量到的（三条，都进了判据）

1. ⚠️ **「变异是空的」第三种**（第 13 发实测）：`game-design` 的测试 import `@game-maker/contracts` ⇒
   **包出口 ⇒ `dist/`** —— 改 `contracts/src/**` 而**不 rebuild**，测试读到的还是旧 dist，
   源码变了、变异却没进到被测的那份代码里。票 08 没吃到这一口，是因为它那条 ledger 变异挑的测试 import 的是 `../src/index.js`。
2. ⚠️ **它的孪生兄弟**：收尾那次 `tsc -b` 在**增量**状态下**可能是 no-op** ⇒ dist 里留着某一发**变异版**的 JS。
   症状：变异全绿了，紧接着 `pnpm test` 红一片（本票实吃）。⇒ 两处 rebuild 一律加 **`--force`**。
3. ⚠️ **枚举值光靠 `tsc` 守着不够**：`spentCall("analyze-intent")` 的字面量对不上 `LedgerStep` 会在编译期报 **TS2345**，
   但**变异判据跑的是 vitest、不是 tsc** ⇒ 「删掉枚举值」那一发会**静默通过**。
   ⇒ 照票 08 在 `structured-call.test.ts:234` 的先例，**补了一条测试**（`expect(LedgerStep.options).toContain("analyze-intent")`）——
   **每加一次调用就加一条**。

### 5. 播下

- **`10`（design-compiler）**：`subgenre` / `camera` 是**可选但 ① 档**（票 03 的欠条原话「连 `title` 那种可空的都算」）
  ⇒ 你的模板里**没得插就别插**，但**别把它们当成不存在**；提示词已按 R2-Q3 要求模型对这两个「尽力填」。
- **`16`（CLI）**：`--intent` 的判别规则**本票定了**（1-Q4）：存在路径读文件、否则裸文本；
  **疑似路径而文件不存在 ⇒ usage 错（退出码 2）**，不许静默降级 —— 那个方向会安静地产出一个关于 `./intent.mdd` 的游戏。
  落盘 `run/v<N>/intent.md` 要**逐字节**（不 trim、不补换行），且要与提示词侧的 `trim()` **分开**。
  退出码映射见 §0 第 15 条。
- **`15`（pipeline）**：`analyze-intent` **不写文件**；`out/<gameId>/` 的 `gameId` 从哪来还没人定（`title` 可空 ⇒ 别指望它）。
- **`19`（Intent QA）**：资源那一桶的集合差键**改了** —— 从顶层 `resources[]` 改成
  **`entities[]` 里 `type === "resource"` 的那些 id**（已同步进 `01-contracts.md` §11）。⚠️ 别再找那个字段。
- **`12`（Asset Planner）**：`derive` 你接不接管、合并还是并存，**由你判**（本票按 1-Q1 一个字没碰它）。
- **`26`（多参考图）**：无涉。

### 6. 连带改动（都记账，不是重开 R 表）

`game-intent.ts`（删 `resources` + 加顶层 gate）· `ledger.ts`（`LedgerStep += "analyze-intent"`）·
`structured-call.test.ts`（补枚举值那条测试）· `docs/v2/01-contracts.md`（字段清单 / 被砍掉的表 / 集合差键 / gate 一句话）·
`docs/v2/03-claude-code.md §9`（头部落地指引）· `docs/v2/00-overview.md §10`（对账表加一行，末句「最后三行」改「最后四行」）·
`CONTEXT.md`（`Requirement` 那条**本来已经说错**：它今天有**三个**消费者；新增「歧义（Ambiguity）」，并注明它与「已出局」里那个 `Checkpoint` 不是一回事）。
⚠️ **票 08 的 Answer §4 第 3 条已就地标为过时**（1-Q3：以代码为准）。
