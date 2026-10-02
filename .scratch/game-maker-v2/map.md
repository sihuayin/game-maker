# V2：把「理解层」建起来，并把闭环请回来 —— 但不要分数

Labels: wayfinder:map
Tracker: local-markdown
Effort: game-maker-v2

> **本图 2026-10-01 开。**它不是从零画的：`docs/v2/01-contracts.md` 与 `docs/v2/03-claude-code.md`
> 是同一天落进来的规格，而**其中两份是空的**（`00-overview.md` · `02-implementation-plan.md`，
> 均 0 字节），`03` 开头的「必须先阅读」恰恰列的这两份 ⇒ 路线只能从 `01` + `03` 反推。
>
> ⚠️ **本图不是翻案**。`game-creation-v1` 的 `map.md:1024` 写着「两者都需要，但**先立产物再立闭环**」，
> `:126` 那条 Q6 标着「⚠️ 随 R2 出局（**对将来的闭环地图仍有效**）」，而 `CONTEXT.md:458` 的
> 「已出局」一节自陈「词汇保留**供将来的闭环地图**使用」—— 前三张图**预告过**这张图要来。
> ⇒ 闭环回来是**按计划**，不是反悔。但它顺手改掉的产品形状有六处，见 R 表的注。
>
> ⚠️ 本图**把执行带进来**（R5）：票解出来的决定**当场实现**，与前三张图的实际做法一致。
> ⚠️ **2026-10-01（晚）—— `docs/v2/00-overview.md` 与 `02-implementation-plan.md` 已由人补写**（本图的票 01 因此关掉）。⚠️ 但**它们不是从本图的 R 表推出来的**：**5 处与 R 正面冲突 · 2 处 doc 自己先站了队 · 3 条本图完全没有**。完整的对账表在 [票 01 的 Answer](issues/01-write-v2-docs.md) —— **动手前先读它**。
> ⇒ ✅ **当日裁定（Q18）：R 表是决策记录，`docs/v2` 是它的表达层 —— 冲突时改 doc，改 R 表必须重新开票**（见 R17）。`00` / `02` 已按此改完（13 处），`03` 加了头部指引（正文留作史料）。
>
> ⚠️ **2026-10-01（晚）：票 27 与票 28 已接连关掉。** 票 27 按 R17 改写了 **R16**（七发探针量出 `tool_choice` 首发 80%），
> 派生的票 28 当场施工完 —— 于是 **08/09/10 的阻塞从 `27` 换成了 `28`，而 `28` 也关了**：那三张票现在只等彼此的依赖。
>
> ⚠️ **2026-10-01（晚）：票 02 已关** —— 理解层的**第一份契约**落地（`packages/contracts/src/visual-world.ts`，25 条裁决）。
> **前沿现在是 03 / 04 / 05 / 06 四张**（02 关掉后它们彼此不阻塞，按号取就是 03）。
> ⚠️ 它派生了两张新票：**29**（`stylespec.json` 从没被 schema 验过）与 **30**（生图提示词漏了 `constraints`）——
> 两张都**不被任何票阻塞**，可以随时起。
> ⚠️ **包内要不要带一份 `VisualWorldSpec` 已甩给票 15**，别再往 `pack.ts` 里补。
>
> ⚠️ **2026-10-02：票 03 已关** —— 理解层**两份契约落地**（`game-intent.ts` / `game-design.ts`，
> 18 条裁决），第三份（`GameCreationState`）**判死不建**（`run/v<N>/` 目录即容器）。
> 顺带立了 **`vocabulary.ts`**：机制/能力的**封闭词表**，**三份契约的公共依赖** —— 票 05 必须采纳同一份。
> ⚠️ **它一次解冻三张票**：`09`（意图分析）· `11`（配方扩展）当场不阻塞；
> 而 **`08` 其实**早就**不阻塞了**（它的五个前置 02/07/24/25/28 全部 resolved）。
> ⚠️ **本图此前漏报了 08**：写「前沿是 03/04/05/06 四张」时把 08 漏在外面（29/30 另起一段提到了）。
> ⇒ **前沿以扫描为准，不以本节的叙述为准。**
> ✅ **前沿现在是 04 / 05 / 06 / 08 / 09 / 11 / 29 / 30 八张**（按号取就是 04）。
>
> ⚠️ **2026-10-02（第二 session）：票 04 已关** —— `CharacterDNA` 落地
> （`packages/contracts/src/character-dna.ts`，v4），并顺手把**「母版」立成配方里的一等公民**
> （`AssetRecipe.authoring[]` —— **结构性**地不进交付包：`pack` 只迭代 `assets`，够不着它）。
> ⚠️ **它反转了 `03 §16` 的箭头**：`Master → DNA → Animations` 改读成 **`DNA → 母版 → 动画`**。
> 原顺序要么让 DNA **反推**母版（权威倒挂），要么**鸡生蛋** ——
> 画母版需要一段描述这个角色的提示词，而那正是 DNA 要产出的东西。
> ⚠️ **代价是票 13 的半个票面当场作废**（它的标题就是 `母版 → DNA → 动画`，§2 问「第一环谁产」）——
> 已重写，并把 DNA 那一环拆成**新票 31 `character-dna-gen`**（住 `packages/game-design/`）。
> ⚠️ **另一处返工也是本票自己撞出来的**：R2/R4 两次把 `AssetDependency` **整块**推给票 11，
> 而那块里的 `masterAsset` **正是**「资产 → 母版」的边 ⇒ 推走它，`authoring[]` 会是一张
> **没有任何东西指向它**的表。第 5 轮专为此开了一问，判**只补这一条边**。
> ✅ **前沿现在是 05 / 06 / 08 / 09 / 11 / 29 / 30 / 31 八张**（按号取就是 05）。

> ⚠️ **2026-10-02（第三 session）：票 05 已关** —— `RuntimeProfile` 落地
> （`packages/contracts/src/runtime-profile.ts`，v4），**只有四个字段**
> （`id` · `version` · `mechanics[]` · `capabilities[]`），外加一张族注册表与一个解析函数。
> ⚠️ **它砍掉了 `01 §8` 里的六个字段**：`inputModel` / `entityTypes[]` / `winConditions[]` /
> `loseConditions[]` **零消费者**；`cameraModel` / `genre` 是**可派生的副本**（Q7 反悔了 Q4）。
> ⇒ `01 §8` 已按 R17 重写。
> ⚠️ **它当场收回了自己 Q1 的一半**：「让外壳 import 它 ⇒ 漂移是编译错误」**量下来立不住** ——
> 外壳对 `EntityKind` 的穷尽性**早就**由 `scene.ts` 的 switch 自动取得，而 `capabilities`/`mechanics`
> 是**不可分派的字符串**。⇒ 事实性改由**见证判据**保证（读**剥掉注释之后**的源码里的**行为串**）。
> ⚠️ **一处由 Q8 内部张力逼出的决定**：`version: "1"` 与渲染形式 `platformer/v1` 纯拼接对不上
> ⇒ 按「渲染时补 `v`」收口（**对外名字一个字没动**）。要走另一条（正名为 `platformer/1`）
> **必须重开 R4** —— 票 05 §4 记着这笔。
> ✅ **前沿现在是 06 / 08 / 09 / 11 / 29 / 30 / 31 七张**（按号取就是 06）。
> ⚠️ **本图此前又漏报过一次 08** —— **前沿以扫描为准，不以本节的叙述为准。**

> ⚠️ **2026-10-02（第四 session）：票 06 已关** —— **`qa-report/v1` 落地**
> （`packages/contracts/src/qa.ts`，v4 · `strictObject`），**只有三个字段**
> （`format` · `checked` · `failures` · `observations`）。
> ⚠️ **`status` 不是一个字段** —— 它是 `qaVerdict()` 派生的**三值**（`pass` / `fail` / `incomplete`）。
> 理由是仓库现成的规矩：**可派生的副本不进契约**（票 04 砍 `bodyProportions`、票 05 砍 `cameraModel` 的同一条）。
> ⇒ **R3 那条底线（观察不许影响通过与否）的落点，是这个函数根本不看 `observations`** ——
> 不是一句注释。三态变异验过：把观察换成再难听的话，裁决一个字母不动。
> ⚠️ **十二个码 → 六条判据**，且**一个枚举两用**（`QA_JUDGEMENTS` 既当 `checked[]` 的取值、
> 又当 `QAFailure.judgement` 的取值）⇒「码的条数 = 判据的条数」**在类型上只有一份**。
> **尺寸那条判据劈成两半**：config 侧（砖 == `arena.cell`）归**引用族**、asset 侧自身归**构造性约束**
> ⇒ 每条判据**恰好住一侧**，票 21 的映射每一行都指得到一个确切落点。
> ⚠️ **`JudgementResult` 只有二态**（`{ran:true,findings}` / `{ran:false,reason}`）：
> 「成功/失败」是**读出来的**（`findings` 空不空），**不许**再放一个 `ok`（可派生的副本）。
> ⚠️ **`QAFinding.target` 复用 `LedgerCall.target` 的词汇** ⇒ 「哪条判据在谁身上失败」与
> 「哪次调用作用在谁身上」是**同一种说法**，票 21 的修复循环能拿它对上账。
> ⚠️ **删 `repairAttempts`**（它描述的是**循环**，不是**这一次 QA** —— 落点归票 21）· **不要 `createdAt`**（目录答了）。
> ⚠️ **判据**：31 条新测试 · 套件 **713/713**（此前 682）· `tsc -b` 干净 · `check:deps`/`check:links` 绿 ·
> **七发变异全部验过会红**。⚠️ 第一版变异脚本有一发没匹配上就跑了 —— **重写成逐发确认「真的改了」再跑**（票 03 吃过同一个亏）。
> ⚠️ **R17 回填**：`01 §9-12` 整段重写（§9 删 `status`、§10 六条判据表、§11 观察、§12 失败 + 十二码去留表），
> 两处交叉引用就地更正；`02` 的 Phase 14/15 按 R3 重写（十项单子与 `IntentQAResult` 都不采用）。
> ⚠️ **三处当场偏离了轮次里的字面**（都记在票 06 的 Answer §四）：① 观察改成了**按 `outcome` 判别的二态联合**
> —— 扁平形状逼着 `unavailable` 带一个无意义的 `lines: []`，而那正是 `ledger.ts` 明令禁止的
> 「**不许填 0 冒充「测到了 0」**」；② 枚举值用 kebab-case（同款闭集 `CALL_FAILURES`/`LedgerStep` 的惯例）；
> ③ 装配键直接用枚举值，不另立驼峰名。
> ⚠️ **一处信息在落盘时被丢掉**（票 06 Answer §五，**请复核**）：`ran:false` 的 `reason` **不落盘**
> —— 落盘形式是「不在 `checked` 里」，而**为什么**不在今天**只可能是静态的**，所以写在契约自白里。
> 若票 18 把「可达性判不了」变成要逐次记的事，要么加字段、要么拆自白。
> ✅ **前沿现在是 08 / 09 / 11 / 22 / 29 / 30 / 31 七张**（按号取就是 08）。
> ⚠️ 票 06 关掉当场**解冻了 22**（它只等 02 与 06）；而 17/18/19 仍等票 15，20 等 17/18/19，19 还等票 10。

## Destination

仓库升级到 **V2**：一条命令

```bash
game-maker create --style <风格参考图> --intent <需求文本 | 需求.md>
```

跑完整条链 ——

```text
Style Image + Game Intent
  → VisualWorldSpec + GameIntentSpec
  → GameDesignSpec
  → AssetRecipe → 生图 → AssetPack
  → GameConfig → Playable Demo
  → Visual QA + Gameplay QA + Intent QA
```

且**不需要人工修改中间 JSON** —— 唯一的人工点是**清单处的检查点**（R9，`--yes` 可跳过）。

⚠️ 「三个 QA」在本图的含义**已钉死**：**不带分数**。能精确算、且「错了一定不是设计」的 → **判据**，
在构建期**阻断**；其余 → **观察**，只报给人看、不打分、不阻断（R3）。

⚠️ **到达的判据**：链要能跑完，**并且**在 `fixtures/e2e/wasteland-platformer/` 上**真跑通一次**，
产物落在 `out/<gameId>/` 的 `run/v<N>/` · `pack/v<N>/` · `site/v<N>/`。

⚠️ **不含**「生图模型哪个更好」「关卡好不好玩」「像不像同一个视觉世界」—— 前者是**观察**，
后两者**只有人眼**。把它们写进终点，这张图就永远走不完（与前三张图同一条理由）。

## Notes

术语以 [`CONTEXT.md`](../../CONTEXT.md) 为准。每个 session 默认带上 `grilling` + `domain-modeling`。

### 已经锁死的（本图的起点，别重新问）

三轮问答（2026-10-01）的结果，逐条带出处：`Qn` 是那一轮的题号。

| # | 裁决 |
|---|---|
| **R1** | **终点 = 整条 `03 §33` 的链**（Q1a）。QA/修复排在最后 —— 它的形状取决于前面每一份契约，那是**被挡住**而不是被砍掉 |
| **R2** | 两份空文档**要补写**（Q2b）：`00-overview` = **入口**（是什么 / 目标 / 明确不做 / 与 V1 的关系），`02-implementation-plan` = **路线**（阶段与顺序 + 指向票的指针），**地图是唯一的决策存放处**（Q6a） |
| **R3** | 三个 QA **不带分数**（Q3b/Q13）。**判据只收三类**：集合差 · 构造性约束 · 引用族（都是「精确可算 + 错了一定不是设计」）。`03 §10/§11` 那些 `similarity` 数值**全是观察** |
| **R4** | `RuntimeProfile` 抽象成**族**（Q4b）；第一阶段只实现 `platformer/v1`；**塔防不进新链、但不许被新链弄坏**（`03 §30` 本来就要求现有 fixtures 仍能 verify/pack/site） |
| **R5** | **本图把执行带进来**（Q5）—— 票解出来的决定当场实现 |
| **R6** | `VisualWorldSpec` 是**新契约**，`StyleSpec` **原样保留**、降格成它的一小块；**六桶不进取值域** —— `palette:N` 仍指向那份**有序数组**，两者是**同源的两个视图**（Q7b） |
| **R7** | 三层（`GameIntentSpec` / `GameDesignSpec` / `GameConfig`）**都保留**，但加一条可检验的门：**说不出「谁读它」的字段不进契约**（Q8a） |
| **R8** | 落盘 `run/v<N>/` + `pack/v<N>/` + `site/v<N>/`，**禁止覆盖**（Q9a） |
| **R9** | 人工点**只有一个**：**清单处的检查点**，`--yes` 跳过（Q10b） |
| **R10** | 策略**住清单里**；LLM 出初稿、**人可改**（Q11c） |
| **R11** | 新包 **4 个**（`vision`/`game-design`/`qa`/`pipeline`）+ 既有 5 个 = **9 个**，**不建 `visual-memory`**（Q12/Q16②）；新包**彼此不依赖、只依赖 `contracts`** ⇒「禁止跨层」（`03 §15`）变成**结构性**的。⚠️ **2026-10-01 就地更正**：原写「7 个（3 新 + 5 既有）」是**我算错了**；而所有者答的「7 包结构」也对不上 ⇒ **票 07 落地前必须先定这个数** |
| **R12** | `RuntimeProfile` = **外壳能力的事实投影**（与 `shell.js` 同源同算），构建期拿它**拒绝**不支持的 `GameDesignSpec`（Q14a）—— `03 §11` 的「记录 `unsupportedRequirements`」**不采用** |
| **R13** | 修复**由判据驱动**，第一阶段**只做资源级重生成**；全链重跑**不做**（Q15a） |
| **R14** | `CharacterDNA` **落盘成契约**（进 `run/v<N>/`）；**`Material DNA` 等真有消费者再说**（Q16①） |
| **R15** | 原图进 `VisualWorldSpec.references.styleImages`，**只存引用**（路径），二进制不进 JSON；那份 `provenance.json` **并进去**（Q16③）。⚠️ **2026-10-01（票 02）：字段名已摊平为 `VisualWorldSpec.styleReferences`**（`references` 那层及其余两项零消费者，出局）——**决策本身不变** |
| **R16** | ⚠️ **2026-10-01 改写（票 27，R17：那就是那张重开票）**。V2 **新**调用（票 08/09/10 + QA 三张）走 **`tool_choice: {type:"tool", name}` 强制工具调用**，**入参必须过 Zod 才算成功** —— `stop_reason === "tool_use"` **不是**成功信号（票 27 第 1 发：工具被调、`input={}`、1135 token 打水漂）。原三件套里**只有「固定次数重采样」保留**，次数定 **3**（1 首 + 2 重）⚠️ **是地板不是调优结果**；「纯文本」被工具调用取代；**「剥围栏」作废**（工具路径 7 发里一次都没出现过围栏）。⚠️ **`strict: true` 与 `output_config.format` 都不可依赖** —— 代理**收下并静默忽略**不认识的参数（票 27 第 7 发实证：HTTP 200、回来一段散文）⇒ 形状**只由我们自己的 Zod 保证**。⚠️ **旧路径不动**（`assets` 的 drawlist / derive / compile-* 沿用纯文本 + 剥围栏 + 重采样），文件头标「旧协议」。**那张 prototype 票 = 票 25，已跑完**。|
| **R17** | **元规则**（Q18）：**R 表是决策记录，`docs/v2` 是它的表达层。冲突时默认 doc 写错**；要改 R 表**必须重新开票**，不能由文档覆盖。⚠️ 否则 wayfinder 的意义消失 |
| **R18** | **多参考图**（Q19）：**契约层进**（`styleReferences: {path, role}[]` ——「一图一角色」是合理方向），但**第一阶段 `maxItems === 1`**；N 图的权重融合与冲突解决**没有任何实测**，实现延后并开票（见票 26） |

⚠️ **R1–R5 之外的每一条都在改 `docs/v2` 的字面。** R4/R6/R8/R9/R10/R11/R12/R13/R14/R15 各对应
`03 §11` · `§2/§8` · `§28` · `§33` · `§13/§14` · `§18` · `§11` · `§24` · `§7/§18` · `§8` 的一处。
**读 doc 03 的人请注意：以本表为准。**

### 已经量到的（别重新量）

- ⚠️ **代理会收下并静默忽略它不认识的参数**（票 27 第 7 发）：`output_config: {format:{type:"json_schema"}}`
  换回 **HTTP 200 + 一整段散文**；`strict: true` 也是 200 + 工具被调。
  ⇒ **「HTTP 200 被接受」不构成任何参数被实现的证据。** 这条对 V2 全链有效。
- ⚠️ **`stop_reason === "tool_use"` 不是成功信号**（票 27 第 1 发）：七发里有一发
  `blocks=[tool_use]`、`stop=tool_use`、烧掉 **1135 输出 token**，而 **`input = {}`** ——
  代理把工具入参丢了。**唯一的成功判据是入参过 Zod。**
- **强制 `tool_choice` 的真实首发成功率 = 80%（4/5）**，输入 1463 token / 输出 1135~1660 token，
  单发 6~9s；14 键的 `VisualWorldSpec` **一次吐得完**（票 27 第 1~5 发）。
  ⚠️ 这是**当时那个代理**的数，票 25 记的「代理一直在变」对它同样成立。

- ⚠️ **V2 的新契约必须用 `zod/v4` 写**（票 28 落地时量出来的约束）：`toolInputSchema` 只能转
  **v4** 的 schema —— `zod/v4` 的 `toJSONSchema` 对 v3 的 `ZodObject` 直接崩
  （它连 `_zod` 都没有）。**旧契约（`StyleSpec` / drawlist / assetpack / …）继续用 `zod`**，
  两边**不许互相嵌套**。⇒ 已播给票 02/03/04/05/06。另：**封口用 `z.strictObject`**
  （`io: "input"` 下普通 `z.object` 不产出 `additionalProperties: false`）。
- ⚠️ **`LedgerStep` 里的值就是「一次上游调用有没有地方记」**（票 28）：`compile-game` 一直是「不交账」的
  —— 根因不是谁忘了写一行，是**枚举里根本没有那个值**。加值的代价是零（`byStep` 是 `z.record`）。
- ⚠️ **账的一格 = 一次调用，不是一次往返**（`CONTEXT.md` 的「调用 / 往返」）——
  `attempts` 记往返次数，`failures[]` 记**每一次**没成的原因。⚠️ 票 28 的第一版把格子改成按往返记，
  被 code review 判成硬违规（文档化的 `attempts > calls` 探测器当场失效），已改回。
- ⚠️ `03 §2/§6/§25` 让复用 `packages/runtime` 与 `packages/site` —— **这两个包不存在**。
  实际是 `contracts / assets / demo / cli / mcp`（`03 §2` 那段「优先复用」的清单有一半是空的）。
- **原图已经参与生图**（`03 §15` 要求的这件事**已经做完**）：`packages/assets/src/pack.ts:328-329`
  把原图内联进**每一次**生图调用；`03 §13` 的 `image` / `drawlist` / `import` **三种策略也已存在**。
- 文本上游**不是 Anthropic**：手写 `fetch` 打到 `${ANTHROPIC_BASE_URL}/v1/messages`，
  模型 id 写死 **`deepseek-v4-pro`**、`thinking: disabled`（`ops.ts:174`）。
- `packages/assets/src/generate.ts:11`：「票 01 实测**强制 JSON 只有 1/3 通过**」——
  但那条注释记的是**当时的端点**（`/v1/chat/completions`），而它自己写着「代理的上游配置**一直在变**」
  ⇒ **这个数今天是否还成立，没人知道**（见票 25）。
- **「观察」已经在代码里跑**：`packages/assets/src/review.ts:6` 的注释就是那条纪律 ——
  「***它只说差异，不说好坏***……不要求打分」。而它喂给视觉模型的是**包里图集拼的 contact sheet**，
  **不是原参考图**（`review.ts:93`）⇒ `styleSimilarity` 今天**没有东西可比**（见票 22）。
- **母版机制已经在跑**（不是从零）：`fixtures/recipes/shift-change-image-anim.json` 已经在用
  `ImageSource.reference` 指一张 `player-master.png`；多帧是**一次调用画一行、按墨迹间隙切**
  （`pack.ts:340-342,377` + `sheet.ts`）。缺的是**契约**：`masterAsset`/`derivedFrom`/`CharacterDNA`
  在整个 `packages/` 里**零命中**。
- `scripts/check-deps.mjs:16-22` 的 `ALLOWED` 图里**没有的包名直接报错** ⇒ 新包**必须先改那张图**
  才装得上（票 07）。

## Decisions so far

<!-- 索引：一行一张已关的票，够判断相关性即可，细节 zoom 进票 -->

- [`VisualWorldSpec` 落地](issues/02-contract-visual-world.md)：**两层叠在一份文档里，不是两个版本** —— 新视图（`styleIdentity` / `camera` / 六桶 / `styleReferences`…）给**代码**读、**是权威**；内嵌的完整 `style: StyleSpec` 子树给**提示词与旧链**读、**不是第二事实源**，两者不一致**不设判据**（同一次调用填出，措辞差异）。⚠️ **25 条裁决**，其中三处改写了 doc 的字面：`schemaVersion`→`format: z.literal`（自由字符串**判别式写不出来**）· `references.styleImages`→摊平的 `styleReferences`（另两项**零消费者**，出局）· 删 `confidence`（**长得像分数**，与 Destination 的「不带分数」正面冲突）与 `rendering`（消费者是「将来会有」）。⚠️ **R6 与 R7 的一次正面冲突当场判了**：**R7 的门只管新字段，不管原样搬运的旧子树** —— `StyleSpec` 里 6 个字段**全仓库零读取**（`camera` 还被 `prompt.ts:217` 写下「故意不读」），但它们在**旧链里也是零读取**，砍掉会当场破坏 §5 兼容。⚠️ **落地时量到五条事实**：① `StyleSpecSchema` **从没解析过任何真实文件**（`ops.ts` 两处裸 cast，`parseWith` **零调用者**）⇒ 派生[票 29](issues/29-stylespec-parse-gate.md)；② `composition.layout` 与 `lighting.ambience` 在 VWS 里**没有家** ⇒ 这条**判了代码投影的死刑**，内嵌只能由模型一次吐全；③ `prompt.ts:217` 的注释与它旁边的代码**从第一天就不一致** —— `constraints` 在生图路上**被静默丢掉** ⇒ 派生[票 30](issues/30-constraints-not-in-image-prompt.md)；④ `zod/v4` 与 v3 **不许嵌套**（`toolInputSchema` 会抛）⇒ 四处 **v4 镜像** + 一条**漂移测试**（比对用**行为**，封口性写成**明示例外**）；⑤ 六桶装 `PaletteRef` 让「同源的两个视图」成为**结构事实**。判据：**587/587** · `tsc -b` 干净 · **包内要不要带 VWS 已甩给[票 15](issues/15-pipeline-create-game.md)**。

- [V2 结构化调用的底座](issues/28-structured-call-substrate.md)：`contracts` 里落了 **`parseToolUse`**（**过 Zod 才是成功**；截断只解释失败、不许推翻成功）· **`toolInputSchema`**（只吃 `zod/v4` 的 schema）· **`forcedTool`**；账加了 **`failures: CallFailure[]`**（7 个值的闭集）。⚠️ **两处当场更正**：**`compileGame` 不交账的根因是 `LedgerStep` 里没有 `compile-game` 这个值**；票面那条「`zod/v4` 子路径就能转」**对 v3 的 schema 不成立** ⇒ **V2 新契约一律用 `zod/v4` 写**（零新依赖，已播给票 02–06）。⚠️ 第一版把 `LedgerCall` 从「一次调用」改成了「一次往返」，与 `CONTEXT.md` 的术语表冲突（`attempts > calls` 探测器失效），被 review 判硬违规后改回：**一格 = 一次调用**，`attempts` 累加 + `failures` 留原因。

- [严格 JSON 改用 `tool_choice` 吗 —— R16 要不要改](issues/27-json-via-tool-choice.md)：**改**。七发探针量出 **首发 80%（4/5）**，且失败长什么样：**`stop_reason=tool_use` + `input={}`** —— 代理**静默丢入参**，不是模型不听话，也不是坏 JSON ⇒ **`tool_use` 不是成功信号，入参必须过 Zod**。代理还会**收下并静默忽略**不认识的参数（`output_config.format` 换回一段散文）⇒ **`strict` / 结构化输出都不可依赖，「HTTP 200」什么都不证明**。⇒ **R16 改写**：V2 新调用走强制 `tool_choice` + Zod 判据 + **3 次重采样**（地板值），**「剥围栏」作废**（7 发里一次都没用上）；**旧路径不动**，文件头标「旧协议」（Q2）。**底座**（`contracts` 的 schema/解析器 + 账的 `failure` 闭集）派生[票 28](issues/28-structured-call-substrate.md)，08/09/10 已改挂它。
- [代理到底支不支持结构化输出 / 视觉输入？](issues/25-prototype-structured-output.md)：**三发全 200** —— ① 合成图判别**通过**（真值自造：3 个圆、左红中绿右蓝**全对** ⇒ 模型**真看见**，排除了「收得下图块、看不见图」那个已知失败模式）② 真参考图 + 11 块 JSON：**一次吐完 · 2129 字符 · `JSON.parse` 通过 · 无围栏 · `stop=end_turn`**，且描述具体到了「公告板」③ `tools`+`tool_choice` **支持**（`stop_reason=tool_use`）。⚠️ **每项 n=1** —— 验的是「能不能」不是「成功率」；票 01 的「1/3」是**另一个端点**上的率，本探针既没复现也没推翻。⚠️ `servedModel=deepseek-flash`≠请求的 `deepseek-v4-pro`（代理换模型**又发生一次**）。⇒ 派生[票 27](issues/27-json-via-tool-choice.md)（R16 要改吗）。
- [依赖守卫要先表态：`ALLOWED` 图加新包](issues/07-deps-allowlist.md)：包集定为 **9 个**（既有 5 + `vision`/`game-design`/`qa`/`pipeline`），**一次建完 4 个骨架 + 一次接线**。⚠️ 那个守卫是**双向**的（图里没有的包报错 · 图里有而目录没有**也**报错）⇒ 图与 `packages/` 必须时刻同步。三条变异验过它**会红**。⚠️ 一并更正：「根 `references` 漏包会静默」**实测不成立**（`tsc -b` 传递构建兜住了）。
- [补写 `docs/v2/00-overview.md` 与 `docs/v2/02-implementation-plan.md`](issues/01-write-v2-docs.md)：文档**由人补写完成**，但它们**不是从 R 表推出来的** —— 对账出 **5 处与 R 正面冲突 · 2 处 doc 先站了队 · 3 条本图完全没有 · 4 条笔误级**。**Q18 裁定：R 表赢，docs 改**（`00`/`02` 改 13 处，`03` 加头部指引）。⚠️ 顺带更正了 R11 的包数（**我算错了**：是 9 个不是 7 个）—— 而所有者答的「7 包结构」也对不上，**票 07 落地前必须先定**。
- [这个仓库今天有哪些模型能看图？](issues/24-vision-model-availability.md)：**有 —— 就是既有的文本上游**（`/v1/messages` + base64 图块），而 `review.ts` 的 `reviewPack` **已经在这么发**（库里有、CLI/MCP 里零命中，得先给入口）。⚠️ 四个生图协议**没有一个是视觉**（票面那三条线索方向全反了）；⚠️ 最新实测停在 **2026-09-25**，今天是否还成立本地判不了 ⇒ 票 25 成为票 08 的硬前置。

- [`GameIntentSpec` + `GameDesignSpec` 落地](issues/03-contract-intent-and-design.md)：**三层里两层落地、第三层判死**。`packages/contracts/src/game-intent.ts` + `game-design.ts`（v4），外加新立的 **`vocabulary.ts`**（机制/能力的封闭词表，**三份契约的公共依赖**，票 05 必须采纳同一份）。⚠️ **18 条裁决**，四条最要紧：① **门 = 具名消费者**（① 提示词按名插值 ② 判据 ③ 映射进下游契约；`JSON.stringify(spec)` 整份兜底**不算读**）；② 两层 **13 处重名是故意的** —— 它是 Intent QA 集合差**存在的前提**，且**意图层的自由文本不许因此被砍**；③ 设计层**加** `mechanics[]`（封闭枚举，一次拿到「覆盖度」与「R12 拒绝」**两个**判据）；④ **不加 `fromIntent` 回指**，靠 **id 延续**（回指是只能被复述、不能被校验的字段）。⚠️ **当场量到的四条事实**：① **`game-config/v1` 的真本事比票面假设的小得多** —— `EntityKind = solid|pickup|hazard|goal|decor`、`Motion{cycle}`、`PlayerMove{speed,jumpVelocity,gravity}`（**单跳**）、`Objective{collect-then-reach}` ⇒ **`double-jump`/`attack`/`health`/`enemy-ai` 外壳全做不了**，而它们正是用户最常要的 —— **R12 的拒绝第一次有真事可拒，且在生图之前、且免费**（封闭枚举填不出来，不用另写判据）；② **`GameIntentSpec` 是契约不由本票裁量**（§14 的 QA 输入明写它，而 `qa` 只依赖 `contracts` ⇒ 结构决定的，不是选择）；③ **`confidence` 被否掉的唯一理由不是「像分数」，是「够不着人」**（R9 只有一个检查点且在**清单处**）—— 同一理由当场决定 `ambiguity` **只能**挂在那个检查点上，否则同样出局；④ **我自己第一轮漏了 §3 的六个字段**（只过了 §4）⇒ 「逐字段过门」本身需要一个判据，否则会静默地只过一半。⚠️ **砍掉的**：`confidence` · `interactions` · `interactionModel` · `assetRequirements` · `visualRequirements` · `schemaVersion`（→ `format: z.literal`）；`runtimeRequirements` **改成封闭能力集**。⚠️ **判据**：**40 条新测试 · 套件 627/627**（此前 587）· `tsc -b` 干净 · `check:deps` / `check:links` 绿；**三条变异验过会红**（拿掉封口 → 4 红 · 把 `double-jump` 塞进词表 → 3 红 · 把 `id` 改成可选 → 1 红）。⚠️ 第一次跑第三条变异时**变异脚本的 sed 没匹配上**（漏了 `z.array(` 外壳）而全绿 —— 那是**脚本**的假阴性，不是判据的。⚠️ **播下六张票**：`05` 采纳词表 · `09` **不许按外壳能力过滤 `mechanics`** · `10` ① 档欠条 + id 延续 + R12 在填 `mechanics` 那一刻撞上 · `15` `run/v<N>/` 九项清单 · **`16` `ambiguity` 的存亡押在它身上** · `19` 集合差的键已定 + 文本相等的噪声要它自己写下来。

- [`CharacterDNA` 落盘成契约 —— 它是「跨资产同一份」，不是一次调用的中间量](issues/04-contract-character-dna.md)：**DNA 落地（`character-dna.ts`，v4），并把「母版」立成配方里的一等公民**。⚠️ **主消费者是 R13 的资源级重生成** —— 没有一份一字不变的角色描述，**修复会静默地换掉主角**；而**跨资产一致性不是它的功劳**（那个由原图内联进每一次生图承担，算进来是重复记账）。⚠️ **三层的关系定死成「世界 = 类 · DNA = 个体 · 资产 = 一次渲染」**，且 `VWS.character` 的五个字段**一个都不许机械复制进 DNA**（否则就是票 09 删 `GameSpec` 的那条理由）。⚠️ 20 条裁决里最要紧的四条：① 砍 **`bodyProportions`** —— 它不是零消费者，是**更糟的一种：`headCount(size.h)` 的可派生副本**（票 22 实测：自由文本的比例指令模型**不执行**）；② `palette` → **`PaletteRef[]`**（自由 hex 会**静默失效** —— 下游 `quantize` 把它量化掉）；③ **全部必填、没有 optional** —— 非人形写 `"none"` / `[]`，因为可选字段会让「**确实没有脸**」与「**模型忘了填**」在文件里长得一模一样，而重生成时前者该维持、后者会被自由发挥；④ `equipment` + `accessories` **合并成 `gear`**（两者之间是**假**边界，消费者是同一段提示词）。⚠️ **母版**：`AssetRecipe.authoring[]` 是**独立数组不是判别式** —— 判别式要让 `pack` / `audit` / atlas / coverage **每一个**消费者记得过滤，漏一个就是静默交付；独立数组把它做成**结构性**的。母版**不复用 `AssetSpec`**、**不收 `styleId`**（那个字段**源码零读取**），但带**画布** `size` —— 与资产的**缩放目标** `size` **同名不同义**。⚠️ **量到的**：`AssetSpec.styleId` 全仓库**源码零读取**（`recipe.styleRef` 路径那一半才是活的）⇒ 「照 `styleRef`/`styleId` 的先例」要拆成两半，而 `characterId` **不是**同款仪式字段（多角色时是真信息）；`spec.role` **字面就是身份**（`prompt.ts:360`）⇒ DNA 一进来「角色是谁」会有**三个**来源，所以那一条降格是必须的；`VWS.character` 是**搬运来的**（票 02 合法放过，**不是疏漏**）；`CONTEXT.md` 里**既没有「母版」也没有「DNA」**（已补）。⚠️ **判据**：30 条新测试 · 套件 **657/657**（此前 627）· `tsc -b` / `check:deps` / `check:links` 绿 · **三条变异验过会红** · 另有一条**兼容判据**（`fixtures/recipes/` 一字不改仍合法，四个新键全是 optional）。⚠️ **两处由本票自己的裁决造成的返工**：**票 13 的标题与 §2 一半作废**（箭头反转的直接后果，已重写 + 拆出票 31）；**`authoring[]` 的入边洞**（`AssetDependency` 整块被推走，而 `masterAsset` 正是那条边 —— 第 5 轮专开一问补上）。⚠️ **播下**：`11`（剩三条边 + 拓扑排序）· `12`（三个新键 + **planner 不重复校验**）· `15`（**两条统一校验**）· **新票 `31`**（DNA 的产出）。


- [`qa-report/v1` 落地 —— 判据会阻断，观察只报](issues/06-contract-qa.md)：**一份产物、三个字段、`status` 不是字段**。`packages/contracts/src/qa.ts`（v4 · `strictObject`）：`{ format, checked, failures, observations }`。⚠️ 21 条裁决里最要紧的五条：① **`status` 降成 `qaVerdict()` 的三值**（`pass`/`fail`/`incomplete`）—— **可派生的副本不进契约**（票 04 砍 `bodyProportions`、票 05 砍 `cameraModel` 的同一条），而 R3「观察不许影响通过与否」的**唯一落点**由此变成「那个函数根本不看 `observations`」；② **十二个码 → 六条判据**，且**一个枚举两用**（`QAJudgement` 既当 `checked[]`、又当 `QAFailure.judgement`）⇒「码的条数 = 判据的条数」在类型上只有一份；**尺寸那条判据劈成两半**（config 侧归引用族、asset 侧归构造性约束）⇒ 每条判据恰好住一侧；③ **`JudgementResult` 只有二态** —— 「成功」不是变体，是 `findings` 空着，**不许**再放 `ok`（可派生的副本）；④ **`QAFinding.target` 复用 `LedgerCall.target` 的词汇** ⇒ 失败与账能对齐（票 21 要的正是这个），明确**不用** `ConfigIssue.where` 那种解析不了的人话；⑤ **删 `repairAttempts`**（描述的是循环，不是这一次 QA）· **不要 `createdAt`**（目录答了）。⚠️ **三处当场偏离了轮次里的字面**：观察改成**按 `outcome` 判别的二态联合**（扁平形状逼 `unavailable` 带一个无意义的 `lines: []` —— 那正是 `ledger.ts` 禁止的「不许填 0 冒充测到了 0」）· 枚举值用 kebab-case（`CALL_FAILURES`/`LedgerStep` 的惯例）· 装配键直接用枚举值。⚠️ **一处信息落盘时被丢掉、请复核**：`ran:false` 的 `reason` 不落盘（落盘形式是「不在 `checked` 里」，而**为什么**不在今天只可能是静态的）。⚠️ **判据**：31 条新测试 · 套件 **713/713**（此前 682）· `tsc -b` 干净 · 两条守卫绿 · **七发变异全部验过会红**（变异脚本重写成逐发确认「真的改了」再跑 —— 票 03 吃过同一个亏）。⚠️ **R17 回填**：`01 §9-12` 整段重写 · `02` 的 Phase 14/15 按 R3 重写。⚠️ **播下**：`17`/`18`/`19` 拿到判据函数的返回类型 · `20` 的汇合点（`buildQAReport` 已可用）· `21` 拿 `target` 对账 · `22` 的 `unavailable + reason` 就是「原图没参与」要报成的样子 · 而 **票 18 §2 的「横版有没有纯层」是今天唯一能造出 `incomplete` 的东西**（契约自白里明写着）。

- [`RuntimeProfile` 落地 —— 外壳能力的事实投影](issues/05-contract-runtime-profile.md)：**四个字段、一张注册表、一个解析函数**（`runtime-profile.ts`，v4）。⚠️ 12 条裁决里最要紧的四条：① **「事实」的源只能是源码**，不可能是一份 `shell.js`（`dist/` 不进 git、站点快照有 14 个不同 hash）⇒ 契约住 `contracts`，**外壳不 import 它** —— 让外壳 import 一份它不消费的常量是「零消费者的引用」（`GameSpec` 病）；② **词表是名字的家，profile 是「这一代实现了其中哪些」的断言语** —— 第一阶段两者恰好相等 ⇒ 那两条差集**恒为空是预期的**，契约里自带这句自白，免得下一个人把不响的判据当活的；③ profile 与 `format` **正交**、`version` **自己一根计数器**（`SHELL_VERSION` 是**外壳级**的，两个代级共用它，抄进来注定分叉）；④ **`cameraModel`/`genre` 也砍**（Q7 反悔 Q4）：它们是**可派生的副本**（取值域就是 `capabilities` 的 `camera:*`，而 `genre` 的值就是 `id`）—— 同票 04 砍 `bodyProportions` 的理由。⚠️ **落地时量到的**：`shell/scene.ts` 第 7 行 `import Phaser` ⇒ node 里 import 不动，**八条能力里七条**只能读源码文本才验得了；`03 §20` 那张八项单子**既不全也不准**（漏了外壳真做的 `gravity` 与 `moving-platform`）⇒ 出局；`vocabulary.test.ts` 那条「`Record<EntityKind,…>` 穷尽」的注释**名不副实**（实际是 `Record<string,…>`，编译期不拦，只有测试期拦）。⚠️ **见证判据的第一版被一句行尾块注释骗过**（实现删了、注释留着 ⇒ 照样通过），改成**剥掉注释之后**再找 needle —— **那一发变异是本票最有价值的**。⚠️ 判据：**25 条新测试 · 套件 682/682**（此前 657）· `tsc -b` 干净 · `check:deps`/`check:links` 绿 · **七发变异验过会红**。⚠️ **一处逼出来的决定**（`version: "1"` vs 渲染形式 `platformer/v1`）按「渲染时补 `v`」收口，**对外名字一个字没动**；另一条路**要重开 R4**。⚠️ **播下**：`10`（相机/题材从 profile 现取，别再补字段）· `14`（§4 那问已被答掉，票面已就地更新）· `15`（草稿目录树里的 `runtime-profile.json` 是有意划掉的）。

## Not yet specified

<!-- 通往终点的雾：在范围内，但还说不成一张票。前沿推过去时会毕业 -->

- **多关卡索引**：一次 `create` 出一个关卡；**多个关卡怎么索引**（票 09 的老账）—— 本图不碰，等真有第二关。
- **第二个 `RuntimeProfile` 成员的真形状**：票 05 已经把**容器**立起来了
  （`RUNTIME_PROFILES` 注册表 + `resolveRuntimeProfile`），所以「怎么加一个成员」不再是空白 ——
  空白的是**加了之后会怎样**：词表要不要跟着长（它是**横版**的全集，不是外壳的全集），
  以及那两条**今天恒为空**的差集第一次变活时，谁来执行、在哪一刻执行（票 10 / 票 14 的地盘）。
  塔防是现成的候选，但它**不进新链**，所以等真有人要第二个成员再量。
- **无参考图时视觉观察怎么报**：`review.ts` 今天喂的是 contact sheet（见上），
  原图进来之后两边怎么比、比不过时说什么，都还没量。
- **生图并发与 `run/v<N>/` 的关系**：并发上限（`pack --concurrency`）与「失败时半成品怎么落」
  在新增了理解层之后会不会变，要等链跑起来才知道。
- **提示词自动优化**（改良，不挡终点）。

- **`interactable` 与 `npc` 的边界**：票 04 判「`interactables[]` / `resources[]` **默认**无 DNA」，
  那个「默认」留着一个口子 —— 一台**会说话的**自动售货机到底是哪一类？
  今天没有消费者（第一阶段没有这种实体），所以说不成票；等真有第一个再定。

## Out of scope

<!-- 越过终点的活，本图不毕业 -->

- **塔防进 V2 新链**（R4）—— 塔防那条链**照旧**，新链**不许弄坏它**。要把它并进来，是**重画终点**。
- **打分 / 评分 / 门禁阈值**（R3）—— R2 拆掉的那一簇**不回来**。判据会**阻断**，但**不打分**。
- **全链重跑式修复**（R13）—— 它把 LLM 的随机性引进循环里，那不叫修复，叫**再抽一次奖**。
- **`visual-memory` 包 / `Material DNA`**（R11/R14）—— 今天**零消费者**。一个没有消费者的包，
  会让下一个读代码的人以为它是活的（票 09 删 `GameSpec` 的同一种病）。
- **`unsupportedRequirements` 那条「运行时再说」的路**（R12 否掉，`03 §11` 那一句不采用）。
- **schema 迁移**（Q19 出局）：没有大量旧用户数据要迁；真正的需求是**新旧并存**，
  而 R6 的「并存」已经满足了它真正要的那件事（不破坏旧 contract）。
- **Benchmark / 评测体系**（Q19 出局）：它属于**评测体系**不是**创建系统**，
  而「QA 不评分」已经定了 —— Benchmark 会自然诱导 `score` / `ranking` / `optimization` 重新进场。
  将来真需要，**单独建 `evaluation-lab`**。
- **重写 Runtime** · **删旧 Contract** · **删旧 Fixture** · **删 AssetPack** · **让 LLM 生成游戏代码** ·
  **绕过 Contract** · **硬编码某一个 Demo 的特殊逻辑**（`03 §31`，逐条照单全收）。
- **多引擎导出 / IDE / Web 控制台 / 多人协作 / Benchmark Suite**（沿用前三张图的裁决，未变）。
