# 19. Intent QA：覆盖度是**集合差**，不是打分

Type: grilling
Status: resolved
Owner: claude (2026-10-08)
Blocked by: 06, 09, 10
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> 依据 **R3**（Q13）。`03 §23` 要「判断是否实现用户主要意图，**必须输出缺失项**」。

## Question

R3 给了 Intent QA 一个**可精确算**的形式：**集合差** ——
「`GameIntentSpec` 里每个实体/机制**在 `GameDesignSpec` 里有对应项**」。

这一票要把它**做出来**，并回答它最大的难点：**「对应」怎么算**。

### 1. 「有对应项」是字符串相等还是别的

- `GameIntentSpec.entities[].id` 与 `GameDesignSpec` 的 `enemies[]/npcs[]/interactables[]`
  —— 名字**大概率不会一模一样**（一个是用户的说法，一个是编译出来的）。
- **(a) 结构化的对应**：要求 `GameDesignSpec` 的每一项**回指** `GameIntentSpec` 的某一项
  （加一个 `fromIntent: string` 之类的字段）⇒ 集合差是**构造上可判**的。
  ⚠️ 代价：多一个字段，且它必须**过 R7 的门**（谁读它 —— 就是这一票）。
- **(b) 让编译器对齐 id**：`compile-design` 被要求**沿用**意图里的 id。简单，但只对 id 不存在的项有效。
- **(c) 判成观察**：用 LLM 判「覆盖了吗」—— ⚠️ 那就**不是**判据了（R3），退回打分。

要选一个。⚠️ **(a) 是唯一让这条路成为「判据」的**，因为只有它精确可算。

### 2. 缺项的落点

> ⚠️ **2026-10-02（[票 06](06-contract-qa.md) 已关）：`IntentQAResult` 整个不采用。**
> `01 §10` 现在的形状是**一条判据** `intent-coverage`，产出的是
> `QAFinding { target, detail, severity }`（落盘时**投影**带上 `judgement`）。
> ⇒ 这里要答的变成：**`target` 写什么**（`game-intent.json`？还是那一个实体/机制的 id？）
> —— 它与账（`LedgerCall.target`）**同词汇**，因为票 21 拿它派活。
> `coverage` 那个 `Record<string, boolean>`、`missingRequirements`、`score` **都不存在**了。
> ⚠️ 另外：`warning` 这一档**类型允许**（`severity`），但**哪一条判据真去报**是[票 20](20-qa-report-assembly.md) 的事。

### 3. 它和 `ambiguity` 的关系

`GameIntentSpec.ambiguity: string[]`（票 09 §2）记着「需求没说清楚的地方」。
要答：缺项（`missingRequirements`）与歧义（`ambiguity`）**是不是同一件事**？
⚠️ 一个说的是「我们没做」，另一个说的是「你没说」—— 混起来会让报错指向错误的一方（用户 vs 我们）。

### 4. 判据可断言

要能给出一条**先红后绿**的用例：一份故意漏掉某个实体的 `GameDesignSpec` ⇒ 覆盖度**红**，
且 `missingRequirements` 里**正好**是那一个。变异检验：把集合差换成「非空即通过」⇒ 用例必须红。

> ⚠️ **2026-10-02（[票 03](03-contract-intent-and-design.md) 已关）：集合差的形状定了 —— 本票 §1 那个三选一已经有答案。**
> 票 03 Q2(b)/Q3(a) 判：**不加 `fromIntent` 回指**（那是一个只能被复述、不能被校验的字段），
> 靠 **id 延续** —— 设计层四个桶的 `id` 沿用意图层 `entities[].id`；`mechanics` 两侧都带 `id`。
> ⇒ **可减的集合**：`entities` 与 `mechanics` 按 **id**；
>   `coreLoop` / `winConditions` / `loseConditions` / `resources` / `progression` 按**文本相等**。
> ⚠️ **文本相等是脆的**（设计层把「收集三枚硬币」改写成「搜集三枚硬币」就误报）。
>   票 03 **明确拒绝**用 id 去掩盖它（给描述性字段发 id＝发一个只会被复述的字段），
>   而是要求**本票把这条当作判据的已知噪声写下来**。⇒ 这一条是本票 §2 的必答项。
> ⇒ 现成的负例（一份漏掉 `m-double-jump` 的设计）在
>   `packages/contracts/tests/game-design.test.ts` 最后一节。

## Answer

**结论：`auditIntentCoverage()` 落地（`contracts`）+ 意图族落地（`packages/qa/src/intent.ts`）——
而这一票最要紧的那一件事是**量出来的**：票 03 定的「描述性文本按**文本相等**相减」**恒错**，
**当场砍掉**（不是降成 warning）。** 13 条裁决 · **22 条新测试** · 套件 **1119/1119**（此前 1097）·
`tsc -b --force` / `pnpm typecheck` 干净 · 两个守卫绿（146 份文档 · 800 条链接）·
**5 发变异全部验过会红**（且每一发记了**被哪一套杀死**）。

### 0. 裁决表（三轮 13 问）

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | 1-Q1 | **砍掉文本相等那一半**，把「100% 非命中」这个**测量**写进契约与文档（**不**降成 warning） | `intent-coverage.ts` · 四处文档 · 两处契约注释 |
| 2 | 1-Q2 | 抽 `auditIntentCoverage(intent, design)` 进 `contracts`，两个调用方共用一处实现 | `contracts/intent-coverage.ts`（新） |
| 3 | 1-Q3 | `target = game-design`；**一条** finding，缺项并入 `detail` | `qa/src/intent.ts` |
| 4 | 1-Q4 | `QaContext` **显式**增加 Intent / Design 产物路径；**QA 不猜路径** | `contracts/qa.ts` · `pipeline` · 3 处构造点 |
| 5 | 1-Q5 | `ambiguity` **不进 QA**（消费者是 R9 检查点，票 16 已兑现） | 族文件头四 · 文档 |
| 6 | 1-Q6 | 改掉 `game-intent.ts` 那句 genre 欠债；语义映射进 **Not yet specified** | `game-intent.ts` · 地图 |
| 7 | 1-Q7 | 反向差集**不是判据、也不强行变 observation**；就地修正票 10 的措辞 | 地图雾 · 票 10 票面 |
| 8 | 2-Q8 | `layer-coverage` 留在六条全集；`checked` **恒 5/6**、`incomplete` 是**事实** | `qa.ts` 四① · 票 20 票面 |
| 9 | 2-Q9 | 返回**二态联合** `MissingIntentItem`（含 `foundIn`）；contracts 不返回 QA / `Rejection` 形状；取名 **`saidAs`** | `contracts/intent-coverage.ts` |
| 10 | 2-Q10 | canned 真对当正例；三条负例；5 发变异；**第 ⑤ 发必须被杀** | 两个测试文件 · 变异脚本 |
| 11 | 2-Q11 | `QaContext` 再收 `recipePath` —— `visual.ts` 不再自己拼 `asset-recipe.json` | `visual.ts` · 它那个 `stage()` |
| 12 | 3-Q12 | **`foundIn` 两个读者**：串桶时 `build-design.ts` 也把「放错桶」说出来 | `build-design.ts` · `build-design.test.ts` |
| 13 | 3-Q13 | 变异**按包记「被谁杀死」**；本包看不见的场景**补一条**（实跑后：无需补，见 §6） | 变异脚本 |

### 1. ⚠️ 文本那一半：**量死的**，不是嫌它脆（Q1）

拿票 10 探针留下的 **4 发真输出**（`.scratch/game-maker-v2/experiments/design-first-shot/raw/*.json`，
两份 `ok` + 两份 `hostile`）逐字段对了一遍：

| 意图层 | 设计层的对家 | 文本相等命中 |
|---|---|---|
| `coreLoop` | `coreLoop` | **0/3 · 0/3 · 0/3 · 0/3** |
| `winConditions` / `loseConditions` / `player.goals` | 同名 | 各 0/1 ×4 |
| `player.role` / `world.theme` / `world.setting` | 同名 | ≠ ×4 |
| `title` → `game.title` | — | = ×4（提示词里那行 hint 注入的） |
| `genre` → `game.genre` | — | = ×4（装配注入 `profile.id`，恒等） |

意图 3 条 `coreLoop` → 设计 4 条，每条更长更具体
（「在废土平台上跳跃移动」→「在废土平台上左右移动，跨过断裂的台阶与地缝。」）。
⇒ **设计层不复述意图层，它放大意图层** —— 那不是模型不听话，那是 `game-design.ts` 要的东西。
⇒ 接成 `error` 的话 `qaVerdict` 会在**每一个**游戏上 `fail`（包括那两发 R12 一条都挑不出来的）——
那不是「脆」，是**恒错**：门槛是「**错了一定不是设计**」，而它错的时候设计恰恰是对的。
⇒ **砍掉，且不降成 warning**（一条永远响的警告不带信息，还会推翻票 06 那句「今天一条都不报」）。

⚠️ **这更正了票 03 的一条决定**，四处文档 + 两处契约注释就地改过：
`contracts/intent-coverage.ts` 头一 · `contracts/qa.ts` 的 `intent-coverage` 注释 ·
`game-intent.ts` 的文件头 · `game-design.ts` 的 `coreLoop` 注释 ·
`docs/v2/01-contracts.md` §3/§10 · `docs/v2/02-implementation-plan.md` Phase 15 · `docs/v2/03-claude-code.md` §23。
⚠️ 另两笔也一并写下：`progression` 两边**连字段名都不一样**（`type`/`description` 可选 vs `model`/`description` 必填），
「文本相等」在它身上**没有定义**；而票 10 播来的那笔残余噪声（模型挑个近似的：`m-double-jump` → `jump`）
**没有机械的落点** —— 探针里它甚至漏进了散文（`progression.description` 写着「越来越依赖二段跳」）。

### 2. 集合差本身住 `contracts`（Q2 / Q9）

```ts
auditIntentCoverage(intent, design): MissingIntentItem[]   // 空数组 = 覆盖成立
MissingIntentItem =
  | { kind: "entity";   id; saidAs; type; bucket; foundIn? }
  | { kind: "mechanic"; id; saidAs }
```

- ⚠️ **它只返回中性的「缺了哪几项」** —— contracts **既不认识 `Rejection`（票 10 的话）也不认识
  `QAFinding`（QA 的话）**，两句话各自留在各自那一侧（与 `auditReferences` 返回 `ConfigIssue[]`、
  由 QA 合成一条 finding 同款）。
- ⚠️ **`foundIn` 只在串桶时存在**（同 id 躺在别的桶里）；真缺失时那个键**根本不存在**（不写 `foundIn: undefined`）。
- ⚠️ **`saidAs`** 是「用户当时怎么说的」（实体的 `role` / 机制的 `name`）—— 刻意不叫 `label`：那是设计层展示名会用的词。
- ⚠️ 遍历次序 **`entities` 先、`mechanics` 后**是**接口的一部分**（两个调用方都按它渲染）。
- ⚠️ **抽取的验收眼**：`build-design.ts` 的报错文案**一个字没动**，票 10 那四条断言原样绿。
  而 Q12 让 `build-design.ts` **也读 `foundIn`**：串桶时那句话多一句「⚠️ 但它**其实落在 `npcs` 里** ——
  这是**串桶**，不是没做」（那句话是**给人改需求看的**，说混了人会去空桶里找一个就在隔壁的东西）。

### 3. 意图族（Q3 / Q5 / Q6）

- `packages/qa/src/intent.ts` —— **只声明 `intent-coverage` 一条**，其余五格缺席 = 不归我；
  `observations: []`（**不许**拿 `unavailable` 表示「不归我」）。
- **一条** finding：`target: "game-design"`（账的词汇，也是 `compile-design` 那次调用的 target）、
  `severity: "error"`、缺项**逐行**进 `detail`（契约的 `superRefine` ② 不许同一 `(judgement,target)` 重复）。
- 两份文书读不回来 / 不过契约 ⇒ **抛**（「该跑却跑不了」是硬失败，不是一条判据的失败）。
  ⚠️ 用 `safeParse` + `formatIssues`、**不用** `parseWith`：后者签名锚在 **zod v3** 上，而这两份是 **v4** 契约。
- ⇒ **它在链上恒绿**（`compile-design` 先拒、链走不到 QA）——照票 18 的体裁写成**自白**（族文件头三），
  并用**故意改坏的设计**证明它真会响。
- `ambiguity` **一个字的歧义都不读**；反向差集**一个字都不报**。

### 4. ⚠️ 顺带治的两处结构病（Q4 / Q8 / Q11）

1. **`QaContext` 从 4 个字段变成 7 个**：`runDir` · `packDir` · `configPath` · `intentPath` ·
   `designPath` · `recipePath` · `gameId`。理由是 `artifacts.ts` 那句「**只此一处** —— 别在别处再拼一遍」，
   而 `configPath` 本来就是照这条规矩单开的字段。
   ⚠️ 连带 4 处构造点：`pipeline/src/create-game.ts` · `qa/tests/visual.test.ts` · `qa/tests/gameplay.test.ts` ·
   **`pipeline/tests/create-game.test.ts` 里那份手打的 4 字段参数类型** —— 最后这一处因为**逆变**当场**编译不过**，
   正是「漏一个键是编译错误」这条纪律想要的效果（已改用它测**四份路径逐个存在**）。
2. **`qa.ts` 四① 那句自白已经为假**：「六条判据今天 6/6 全跑」从票 17 那天起就不成立
   （`layer-coverage` 故意不住在 QA 里）。⇒ 改准：**判据的全集**（六条）与**这一次跑过的子集**
   （`checked`，五条）是两件事，`incomplete` 是**真话**，**不要**为了让它变成 `pass` 去动 `checked`。
   三值语义因此写清：`fail` = 跑过的里有一条 error · `pass` = QA-owned 的全跑且无 error ·
   `incomplete` = 报告没覆盖判据全集。⚠️ 连带：票 20 的「六条判据**每条恰好被一个族声明一次**」
   **在数学上做不到**（`layer-coverage` 不属于任何族）⇒ 改成「**不重复**」，票面已更新。

### 5. 两笔欠债当场还清（Q6 / Q7）

- **`game-intent.ts` 那句「`genre` 理解错 → 票 19」收回了**：票 19 **也**碰不到它 ——
  `intent.genre` 是**自由文本**、`design.game.genre` 是**装配注入的 `profile.id`**，两边不在一个词表里。
  今天真在守这件事的是 `camera`（两边都是闭集 ⇒ `camera-unsupported`）与 **R9 的检查点**。
  「语义映射」进地图的 Not yet specified，本票**不**为此把 `genre` 封成枚举。
- **票 10 那句「反向差集只能是观察」就地更正**：「观察」在那里是个含糊的词，照字面读会让人去找一个
  **不存在的落点** —— 那件事今天**没有落点**（看得见它的时刻是 R9 的检查点）。
  ⚠️ 同处还改了第三句：`game-design.ts` 里「改名就是误报，这笔噪声见票 19」—— **改名不是误报**，
  改了名的 id 在意图层找不到对家、**当场报缺**，那正是票 03 那条「不许改名」想要的。

### 6. 判据

- `packages/contracts/tests/intent-coverage.test.ts`（**11 条**）与 `packages/qa/tests/intent.test.ts`（**11 条**）：
  正例是**一对真的 intent + design**（`fixtures/upstream/canned.json`，拷出来再改，照票 17/18 的纪律）。
- ⚠️ **两枚「反向钉子」**（本仓库第一次出现这种形状：别的判据怕「不响」，它们怕「**响**」）：
  canned 那一对的 `coreLoop` 两边**完全不等**（意图 2 条 → 设计 1 条），而判据**仍然绿**
  —— 一条按文本相等去减的实现会在这里报两条。测试里把这件事**明写成了断言**
  （「这份绿的设计把 `coreLoop` 整个改写了」），免得下一个人以为那是漏测。
- **5 发变异全部验过会红**，且**逐发记了被哪一套杀死**（Q13）：

| 变异 | A 套（contracts + game-design） | B 套（qa） |
|---|---|---|
| ① 集合差换成「非空即通过」 | ✅ 9 failed | ✅ 4 failed |
| ② 只查 `entities` 不查 `mechanics` | ✅ 4 failed | ✅ 2 failed |
| ③「任意桶里有就算」（串桶不算缺） | ✅ 2 failed | ✅ 1 failed |
| ④ `severity` 降成 `warning` | —（不涉） | ✅ 1 failed |
| ⑤ **把文本那一半加回来** | ✅ 11 failed | ✅ 5 failed |

  ⇒ 涉 `contracts` 的那四发**两边都杀得死** ⇒ **不需要**补「本包看不见」的用例（Q13 的担心不成立，
  但那一条本来就是为「跨包改动、另一边先红」那种情况写的，留在了脚本里）。
- ⚠️ **变异脚本第一版自己有 bug，当场吃掉**：复原源码之后**没有 rebuild**，于是下一发（不涉 `contracts` 的 ④）
  跑在**上一发的 dist** 上 —— 症状正是「A 套莫名其妙红了（1 failed）」，
  而我把 ④ 判成「被 A 套杀死」那是**假账**。修法：**复原之后也 rebuild**（脚本里写了注释）。
  ⚠️ 这是票 09/10 记过的同一口陷阱，**第二次**吃 —— 第一次吃的是「忘了 build」，这次吃的是「build 早了」。
- ⚠️ **还有一处我自己的破坏，记在这儿**：给新脚本起名时选了 `experiments/intent-mutations/`，
  而那个目录**票 09 早就有了**（它瞄的是 `analyze-intent`，不是这条判据）—— `cat >` 把**它**覆盖了。
  **当场被 `git status` 抓住**（那一栏是 ` M` 而不是 `??`），已 `git checkout` 还原（169 行，一字未失），
  新脚本改住 **`experiments/intent-coverage-mutations/`** 并在文件头写明了两者的区别。
  ⇒ 教训很短：**往 `experiments/` 里加东西之前，先看那个目录里有什么** —— 名字相近不等于空位。

### 7. 改了哪些文件

| 文件 | 改什么 |
|---|---|
| `packages/contracts/src/intent-coverage.ts` | **新**：`auditIntentCoverage()` + `MissingIntentItem` |
| `packages/contracts/src/vocabulary.ts` | **新**：`EntityBucket`（从 `ENTITY_BUCKETS` 派生，不重抄那四个字面量） |
| `packages/contracts/src/index.ts` | 导出 `intent-coverage.js` |
| `packages/contracts/src/qa.ts` | `intent-coverage` 注释收窄 · 四①/③ 自白改准 · `QaContext` + 三个路径 · `QaFamilyResult` 的义务改成「不重复」 |
| `packages/contracts/src/game-intent.ts` | 重名那段补「可减的只有 id 那一半」 · genre 欠债收回 |
| `packages/contracts/src/game-design.ts` | `coreLoop` 注释收回「② 判据」 · 「改名就是误报」收回 · 文件头补一句 |
| `packages/game-design/src/build-design.ts` | 改调 `auditIntentCoverage`；串桶时多说一句（文案其余一字未动） |
| `packages/qa/src/intent.ts` | **新**：`intentQaRunner` + `finding()` + `describe()` |
| `packages/qa/src/visual.ts` · `index.ts` | 清单路径改 `ctx.recipePath` · 导出 `intent.js`（并写清是三个族） |
| `packages/pipeline/src/create-game.ts` | QA 调用点：四份产物路径逐个传 |
| `packages/contracts/tests/intent-coverage.test.ts` · `packages/qa/tests/intent.test.ts` | **新**：11 + 11 条 |
| `packages/game-design/tests/build-design.test.ts` | 串桶那条加断言（真缺失那条加**反向**断言：「不许说串桶」） |
| `packages/qa/tests/visual.test.ts` · `gameplay.test.ts` · `packages/pipeline/tests/create-game.test.ts` | 三处 ctx 构造点 |
| `docs/v2/01-contracts.md` | §3 重名 · §10 表/集合差/自白 · §14 QA 输入 |
| `docs/v2/02-implementation-plan.md` · `docs/v2/03-claude-code.md` | Phase 15 · §23（含输入清单更正） |
| `CONTEXT.md` | 意图覆盖补一句 · **新词「串桶」** · QA 族补「判据全集 ≠ 每条都归某个族」 |
| `.scratch/…/experiments/intent-coverage-mutations/run.mjs` | **新**：5 发变异 + 逐发归属（⚠️ **不是**票 09 的 `intent-mutations/` —— 那份瞄的是 `analyze-intent`） |
| 票 10 / 17 / 20 的票面 | 就地更正 / 追记 / 义务收窄 |

### 8. 播下 / 派生

- **[票 20](20-qa-report-assembly.md)**：三个族到齐，而它要的是「**不重复**」（不是全覆盖）；
  `QaContext` 变 7 个字段、合成器要原样往下传；票 19 那条判据**不要**替它找更早的路。**票面已更新。**
- **地图的 Not yet specified 加了两条雾**：① 「模型把需求读错了」有没有机械的落点
  （`genre` 那条；真要机械化只有「把 `intent.genre` 封成按外壳的枚举」这一条干净的路，那是契约面）；
  ② 「设计补了什么」在报告里没有落点（观察只有 `inspect` / `review` 两个已有家）。
- **本票没有派生新票。**

