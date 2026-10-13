# 55. 被拒的设计**一个字都不落盘** —— 于是真跑验不了「模型把 `player.id` 改成了什么」

Type: grilling
Status: resolved
Owner: claude (2026-10-13)
Blocked by: —
Map: ../map.md
> 派生自[票 23「E2E fixture + 真跑一次」](23-e2e-fixture-wasteland.md)的**第八次真跑 · 段 A**
> （人裁 2026-10-13：「开一票」）。
> ⚠️ **本票不挡票 23** —— 它是**诊断能力**，不是链上的拦路石。
> 但它决定**下一跑能不能读到上一跑读不到的那两个读点**。

## 1 · Question

`compile-design` 拒掉一份设计时，**模型那份设计（以及每次重采样的原始输出）该不该落盘？落在哪？**

## 2 · 量到的

**今天什么都不落。** `create-game.ts:276` 只在 `compileDesign` 返回 `ok` 时才
`writeJson(path.join(run.tmpDir, RUN_ARTIFACT.gameDesign), design.spec)`；
被拒 ⇒ 那一步**一个字节都不写** ⇒ 模型那份设计**只活在内存里，随进程消失**。

**第八跑现场快照 `raw/run-out-2026-10-13a/.failed-2026-10-13T02-21-58-177Z/` 里只有四样：**

```text
intent.md · style.png · visual-world.json · game-intent.json     ← 没有 game-design.json
```

⚠️ **上游的两格都已经在现场里了**（`visual-world.json` / `game-intent.json`）⇒
**缺的只有设计那一格** —— 而那恰好是这一跑要读的那一格。

**这一跑的实际代价**（票 23 的 §四.2 明写了两个验收读点，**两个都读不到**）：

| 想读的 | 能不能读出来 |
|---|---|
| 「`npcs[]` 是否仍然含 `"scavenger"`」 | ✅ 能 —— 拒因是 `intent-entity-missing` ⇒ **确实没有** |
| 「模型把 `player.id` 改成了什么」 | ❌ **不能**（那份设计没了） |
| 「第一发撞的是哪一条 `schema`」 | ❌ **不能**（`ledger` 只记 `failure` 的**类**，不记 detail） |

⇒ 归因因此从**铁证**掉到**强相关**：「票 42 那句新话导致模型删了 npc」这条**方向只有一个、
证据却只能是 n=1 的对比**，而不是「直接把那份设计读出来」。

⚠️ **同一形状的问题这个仓库已经解决过一次**：[票 36](36-failure-ledger.md)（「生图那本账
只在成功时落盘 ⇒ 钱花了、账没了」），修法是**写两处**（进 staging 树 ⇒ 跟着失败现场走）。
**本票是同一形状、另一个产物。**
⚠️ 而**账那一侧已经证明了这是可行的**：`failed-<ts>/` 今天已经能装诊断物。

## 3 · 要定的

- **Q1 · 落什么？** 只落**最后一次**（被拒的那份）· 还是**每一次往返**
  （`attempts: 3` ⇒ 三份，能看出模型三次各试了什么）? ⚠️ 第八跑那一格是 `attempts: 3`。
- **Q2 · 落在哪？** 进**失败现场**（`failed-<ts>/`，与票 36 的账同一处，靠现场活下来）·
  还是 `run/v<N>/`（⚠️ 那里今天是**成功**语义，`RunLedger` 是 `.strict()`、没有字段说它没跑完）。
- **Q3 · 形状对不上怎么办？** 被拒的那份**过不了 `GameDesignSpecSchema`**（它正是因此被拒）——
  连 `format` 都可能缺。⇒ 它**不是**一份 `GameDesignSpec`，**不能叫 `game-design.json`**
  （读者会以为它是契约产物）。**用什么名字、什么形状装一份「没能过契约的原始输出」？**
- **Q4 · 会不会把不该落的东西落下来？** 模型原始输出进失败现场 —— 今天有没有任何东西
  因此泄出去（上游报文 / 密钥 / 提示词全文）? ⚠️ 本仓库对「不把未经确认的意图写成事实」
  与「现场只读」都有明确纪律（票 30 / 票 42 的 §5）。
- **Q5 · 判据？** **阳性**：拒一次 ⇒ 现场里有那份设计、且**能读回来**（有测试盯着）·
  **阴性**：**成功路径的产物一个字节不变**（票 36 的 Q2/A 立过同款钉子）。

## 4 · 完成线（照票 36 / 38 / 40 / 41 / 42）

- 代码 + 免费测试 + `typecheck` / `build` / `check:deps` / `check:links` 四关全绿。
- ⚠️ **不执行任何付费真跑** —— 本票的效果要在**票 23** 的下一次真跑上验
  （届时 §四.2 那两个读点应当**读得出来**）。
- **不动 R 表**（要动按 R17 另开票）· **不加重试 / 修复循环 / 自动重生成**（R13）·
  `packages/qa` 一行不碰 · **`game-maker.local.json` 一个字不动** ·
  **`.scratch/**/experiments/` 的现场只读**（那是量出来的证据）。

## 5 · 它不挡票 23 —— 但它决定下一跑**能读到什么**

链上的拦路石是[票 53](53-npc-clause-vs-coverage.md)与[票 54](54-mechanic-omitted-vs-coverage.md)。
本票不修也能跑；修了，下一次死的时候**归因是读出来的，不是推出来的**。
⚠️ 而第八跑恰好演示了**不修它有多贵**：这一票自己的正题**读不到答案**。

## Answer

**被拒的那一份落盘了 —— 而且不止那一份：这一圈里每一次往返的原始模型入参，全部落进失败现场。**
判据**不是「抛的是哪个类」**，是**这一圈有没有拿到过模型入参**；写入点是 `create-game.ts` 那个
**唯一的、不按类分流的 catch**，写它发生在 `abandonRun` **之前** ⇒ **成功路径结构性碰不到它**
（那一条阴性判据不是「靠测试守出来的」，是「不抛就没有那个写入点」）。

### 量到的两件事（本票全部裁定的地基）

1. **⚠️ 票面 Q3 的前提被实测推翻一半。** `build-design.ts` 里 `kind:"rejected"` **只在
   `GameDesignSpecSchema.safeParse` 成功之后**才可能返回 ⇒ **R12 拒掉的那份，本身是一份完全合法的
   `GameDesignSpec`** —— 契约连 gate 都过了，是 `intentCoverage` / `cameraSupported` 这种**结论**否掉了它。
   票面写的「它过不了 schema、连 `format` 都可能缺」，**只对 schema 那一档成立**。
   ⇒ 一个名字要同时装这两种：容器**是非契约容器**，而 R12 那份合法设计的正位仍是
   `run/v<N>/game-design.json` —— 本票**没有**改它今天「只在成功时写」这件事（Q3 = (a)）。
2. **全仓 `grep 'redact|sanitize|脱敏|打码'` 零命中** —— 今天没有任何脱敏纪律，密钥只出现在请求头
   ⇒ **事实上不泄，但没有任何东西看着它**。而本票正是**往现场新塞一类内容** ⇒ 补钉子的正确时机（Q6）。

### 三轮裁定（人裁 2026-10-13 · 原话逐字）

**第一轮**

| 题 | 我的裁定 | 理由 |
|---|---|---|
| Q1 落什么（粒度） | (b) 每一次往返的原始模型入参 | 最多保留 3 发，才能直接比较模型每次具体改了什么，区分系统性问题与偶发输出。只留最后一发会丢掉关键归因证据。 |
| Q2 落在哪 / 怎么活过失败 | (a) 挂在 error 上，由 catch 在 abandonRun 前写入 run.tmpDir | 失败证据随既有目录 rename 进入失败现场；成功路径不触及写入点，从结构上保证成功产物不变。 |
| Q3 名字与形状 | (a) 只写非契约容器，不另写 game-design.json | 同一容器能承载 schema 不合格的原始输出和通过 schema、但被 R12 拒绝的输出。避免把未通过完整设计验收的内容伪装成正式契约产物，也避免同一事实重复落盘。 |
| Q4 范围 | (a) 只改 compile-design | 本票要补的是 compile-design 的实测证据缺口。其他理解步骤没有同等缺口的证据，不扩张范围；容器形状保持可供未来复用。 |
| Q5 拒因要不要一起落 | (b) 原始入参 + 每发的 failure 类与 detail | detail 已在循环内生成，保存成本低。保留当次实际拒因，避免未来契约或判定逻辑变化后，重放得到不同结论。 |
| Q6 泄密纪律 | (a) 只落模型入参，并增加密钥钉子测试 | 不落请求体、响应体或 headers。新增测试确保保存的证据不包含密钥，不能只依赖密钥当前恰好只存在于请求头的实现细节。 |
| Q7 记账动不动 | (a) 不改 ledger | 本票需要的逐次诊断信息由失败容器承载，不需要扩展 .strict() 的 ledger 契约，也不需要再次支付版本升级成本。 |

**第二轮**

| 题 | 我的裁定 | 理由 |
|---|---|---|
| Q1 容器的文件名 | (a) design-attempts.json | 准确表达容器保存的是逐次尝试，而不预设任何一发已经构成合格设计。与现有诊断产物的平铺命名一致。 |
| Q2 要不要 schema / 住哪 | (a) 要；放在 packages/contracts，采用三件套 | 定义 format 常量、文件名常量、严格 Zod schema 与 parseXxx。失败现场的诊断者是明确读者，解析能力也是阳性验收条件，因此符合 R7，不属于无读者的契约扩张。 |
| Q3 封套断面 | 采用提案形状；raw 允许缺省 | no-tool-use 可能没有可恢复的模型入参，不能伪造 raw: {} 来冒充真实输出。其余字段记录尝试序号、结果类别和当次诊断信息；尝试按序号升序排列。 |
| Q4 R12 的 rejections | (a) 进入容器 | 保存当次真实拒绝结论，不依赖未来重放。应复用 DesignRejectedError 中的同一份 rejections 数组，避免两份事实产生偏差。 |
| Q5 什么情况下写 | (a) 本次 compile-design 执行中是否至少拿到过一次模型入参 | 不能按错误类型分流。即使第 2 发遇到 HTTP 或 timeout，第 1 发的原始入参仍是有效诊断证据。一次入参都没拿到时，不写空容器。 |
| Q6 写盘失败怎么办 | (a) best-effort，原始错误原样抛出 | 诊断文件不能覆盖真正导致运行失败的异常。写盘失败应被吞掉，但不得吞掉或替换原异常。 |
| Q7 error 怎么带 | (a) 扩展 Carried，增加一个键及 reader；两个 error 类不动 | 复用 command.ts 已有的携带机制和边界约束，避免在两个错误类中重复实现相同逻辑。遵循只追加、不覆盖已有同名键的原则。 |
| Q8 判据落在哪 | (a) packages/pipeline/tests/create-game.test.ts | 与既有失败现场保留测试放在一起。阳性验证失败目录中的文件存在且可由 parseXxx 读回；阴性验证成功运行的文件清单及逐文件字节与基线一致。 |

**第三轮**

| 题 | 我的裁定 | 理由 |
|---|---|---|
| Q1 存模型原话还是过完 Zod 的那份 | (b) 两个分支都返回 raw，容器一律保存 raw | 统一证据口径。今天 schema 没有改写行为，不代表未来永远如此；原始模型入参必须在解析、校验或契约转换之前保留，避免同一个容器混用原话与处理后的值。 |
| Q2 R12 那一发的 detail | (a) 留 | rejections[] 是结构化拒绝事实的权威来源，detail 是方便人阅读的摘要。两者服务不同读法；保留 detail 也避免读者必须按 outcome 分支才能理解每次尝试。 |
| Q3 每发的 token | (a) 不带 | 本容器记录模型输出与当次诊断，不另建逐发花费账。沿用第一轮 Q7 的裁定，不扩展 ledger，也不在容器里重复引入调用级 usage 信息。 |
| Q4 提示里点名文件 | (a) 不点名 | 沿用失败目录作为诊断入口的现有约定。读者从 failureSiteNote 定位现场后即可查看 design-attempts.json，不需要把单个诊断文件路径写进错误消息。 |
| Q5 给外壳开口 | (a) 不开 | 本票保证证据存在且可解析，不新增 inspect 或 MCP 的产品接口。票 23 的诊断读点可以直接读取失败现场中的 JSON；若未来需要结构化查询，再单独立票。 |

⚠️ **由第一轮 Q2 推出来、写在明处的一条取舍**（**有意的**，不是漏掉的边）：
**一次「重采样之后成功」的编译，第 1 发那份入参留不下来** —— 只有抛出来才有写入点，
而阴性判据要求成功路径一个字节不变。成功的那一跑，链本来就走过去了。

### 落地 · 五处

**① `packages/contracts/src/design-attempts.ts`（新）—— 非契约容器，三件套照 `master-ratio.ts` 同款**

`DESIGN_ATTEMPTS_FORMAT = "run-design-attempts/v1"` · `DESIGN_ATTEMPTS_FILE = "design-attempts.json"` ·
`.strict()` 的 `DesignAttempts` · `parseDesignAttempts`。
⚠️ 用 **v3 的 `zod`**（不是 `zod/v4`）：「新契约用 v4」那条规矩的正题是**要转成 tool 的 `input_schema`**，
而这一份**不喂 `toolInputSchema`**（与 `RuntimeProfile` 是同一类例外）。
⚠️ `attempts` 是 `.min(1)` ⇒ **「一个空容器」在形状上就不可表示** —— 它与 Q5(r2)「一次入参都没拿到就不写」
是同一条边的两处各守一遍（**结构上**不表示 + **写入侧**不写）。
`outcome` 是**闭集五值**：`truncated` / `no-tool-use` / `empty-input` / `schema` / `rejected`
（前四个与 `ToolUseFailure` 同名 —— 于是「这一发是什么下场」不需要一次转型；第五个是 R12 那一档）。
⚠️ 它**不进任何资源包** ⇒ 一个 `run-*` 的 format 标签**不牵动 `assetpack` 升版**
（与 `run-ledger/v1` 同类，而不是与上周那次 `assetpack/v2 → v3` 同类）。
⚠️ 头部注释逐条写明：为什么叫这个名、为什么**不**写成 `game-design.json`、为什么形状住 `contracts`
而填充住 `game-design`、读者是谁、为什么 v3。

**② `packages/contracts/src/structured-call.ts` —— 两个分支都回 `raw`（Q1(r3) = (b)）**

`ok: true` 那一支今天 `value === raw`（`GameDesignSpecSchema` 里 `.default(` / `.transform(` / `.catch(` / `.pipe(`
的命中数 = **0**）—— **但那不是契约**：将来谁加一个 `.default()`，只回 `value` 就会让同一份容器里
**两种口径**（被拒那一发存原话、成功那一发存改写过的值）**且看不出来** ⇒ 一条规矩：
**要留证据的调用方，存的永远是模型写下的那几个字节。**
⚠️ 一处小心：`fail()` 用 `...(raw === undefined ? {} : { raw })` 展开 ⇒ **`no-tool-use` 那一档键根本不出现**
（连 `tool_use` 块都不在、`input` 就是 `undefined`），**不是 `raw: null`、更不是 `raw: {}`**。

**③ `packages/contracts/src/command.ts` —— 第三个键 + 第三个 reader**

`Carried` 加 `designAttempts?`、加 `designAttemptsOfError`（照 `ledgerOfError` / `failureDirOfError` 同款，
判据是**身上有没有**、不是 `instanceof`）。
⚠️ 这个 reader **只做类型闸、不重新校验 schema**：重校验会把「形状漂了」从**一条红判据**变成**一次静默丢弃**
（注释里写明）。
⚠️ `CommandError` 的构造参数**故意没扩**：今天**没有写入者**走那条路（写入者是 `carryOnError`），
加一个没人填的参数正是 R7 的犯规。

**④ `packages/game-design/src/compile-design.ts` —— 逐发累积 + 单一抛点**

`attempts: DesignAttempt[]` 在这一圈里累积：`bad` 推一条（`...(once.raw === undefined ? {} : { raw })`）、
`rejected` 推一条（带 `rejections: once.rejections` —— **与 `DesignRejectedError` 里那份是同一个数组**，Q4(r2)）、
`upstream` **什么都不推**（它发生在取到 body 之前、压根没有模型入参 —— 它在**账**的 `failures[]` 里）。
三处抛出**全部**走同一个 `raise()`：`carryOnError(e, carriedAttempts(attempts))` 然后**原样**抛。
⚠️ `carriedAttempts` 的判据写在注释里：**不是「抛的是哪个类」**，而是**这一圈有没有拿到过入参**，
而且**按字节**算 —— 模型真写了一个 `{}` **也算拿到过**（那正是票 27 实测的形状，最值钱的一条证据）；
真正「一个都没有」的只有 `no-tool-use`。拿不到过 ⇒ `{}`（`carryOnError` 的空场合 ⇒ 连键都不加）。

**⑤ `packages/pipeline/src/create-game.ts` —— 写盘那一处（唯一写入点）**

唯一那个 catch 里、**在 `abandonRun` 之前**：

```ts
const designAttempts = designAttemptsOfError(e);
if (designAttempts !== undefined) {
  try { writeJson(path.join(run.tmpDir, DESIGN_ATTEMPTS_FILE), designAttempts); } catch { /* 写不下就算了 */ }
}
```

best-effort（Q6(r2)）：**诊断产物不许把诊断对象弄丢** —— 写盘失败吞掉、原异常**原样**抛。
写在 `run.tmpDir` **根**（与 `intent.md` / `visual-world.json` 并列），靠那次 rename 进失败现场；
**不进** `run/v<N>/`（那里是成功语义）。

### 判据 · 阳性 + 阴性（Q8(r2) = (a)）

| 层 | 文件 | 钉住什么 |
|---|---|---|
| 容器契约 | `packages/contracts/tests/design-attempts.test.ts`（**新 · 15 条**） | 三件套与文件名 · 五值闭集 · 两发读得回来 · **`raw` 缺席与 `raw: {}` 是两件不同的事**（`"raw" in a === false` vs `toEqual({})`）· 非对象 `raw` 也收 · **`attempts: []` 拒** · `attempt` 必须 ≥1 整数 · `rejections: []` 拒 · 六种 `.strict()` / format 漂移 |
| 携带与读取 | `packages/contracts/tests/carried-error.test.ts`（**+3**） | 挂得上去、读得回来、**与另两项各自独立**（只有它时不发明账、也不发明现场）· **按能力不按类**（裸 `Error` 与 `CommandError` 都读得动）· 类型闸：垃圾当作「没读到」 |
| 取数那一层 | `packages/contracts/tests/structured-call.test.ts`（**+3**） | 成功分支同时回 `value` 与 `raw` · 失败分支也回 `raw` · **`empty-input` 保住模型的 `{}`，而 `no-tool-use` 的键缺席** |
| 失败现场 | `packages/pipeline/tests/create-game.test.ts`（**+6**） | ① **阳性 · schema 档**：三发 `[1,2,3]` 全在、读得回来，且错误消息**不点名**这个文件 · ② **阳性 · R12 档**：恰好**一发**、`raw` 在、`rejections` 与抛出去那份**逐字相同** · ③ **上游死在第 2 发 ⇒ 第 1 发的入参不跟着丢**（判据不是「抛的是哪个类」）· ④ **阴性 · 一个入参都没拿到 ⇒ 连空容器都不写** · ⑤ **密钥钉子**（`sk-ant-…` 那个字符串**必须不在**落下来的东西里）· ⑥ **阴性 · 成功路径逐文件比字节** —— 含「这一跑**重采样过**、内存里真有过一份原始入参」那一档 |

### 变异验证（五发，每发确认红在**该红的**那几条上，之后逐份还原）

| # | 变异 | 红在哪（实测） |
|---|---|---|
| M1 | 抽掉 ⑤ 那个 catch 里的写入段 | pipeline **4 条**：schema 档 · R12 档 · 密钥钉子 · 上游死在第二发 |
| M2 | 把「写不写」的判据换成**按错误类分流**（只有被拒那一档才写） | pipeline **3 条**：schema 档 · 密钥钉子 · **上游死在第二发**（⚠️ 这一条**正是** Q5(r2) 要关掉的那个边） |
| M3 | 成功分支不再回 `raw`（= 只有失败那一支留原话） | `structured-call` **1 条** + pipeline **R12 档 1 条** —— ⚠️ 后者证明「R12 那一发存的也是**模型原话**」这条判据真的钉在 (b) 上 |
| M4 | 去掉 `DesignAttempts.attempts` 的 `.min(1)` | `design-attempts` **1 条**（`attempts: []` 那条） |
| M5 | 第三个 reader 改成**按类读**（只在 `CommandError` 上读得到） | `carried-error` **2 条**（含「按能力不按类」那条） |

⚠️ **本仓老陷阱又踩了一次（记在这里，免得下一个 session 再踩）**：改 `contracts` / `game-design` 的 **src**
之后跑依赖包的测试，**必须先 `pnpm build`** —— 消费方读的是 built `dist`。
而**还原拷贝也会骗过 `tsc -b`**：`cp -p` 保留了原 mtime ⇒ 增量构建认定 dist 比 src 新、**不重建**，
于是「还原之后复核」会显示红的（实测踩到）。修法：还原后 **`touch` 一遍再 build**。

### 闸门（本票 §4 的完成线）

- `npx tsc -b --force` 干净 · `pnpm build` 干净 · `pnpm typecheck` **9 包** · `pnpm test` **1300/1300**（**77** 文件，本票 **+27**）
- `pnpm check:deps` ✅ 9 包 · `pnpm check:links` ✅ **205 份文档 · 1163 条链接**
- **零付费真跑**（本票的效果要在[票 23](23-e2e-fixture-wasteland.md) 的下一次真跑上验）

### 边界（人裁逐字见上表；这里只聚一遍）

**只改 `compile-design`**（Q4(r1)）· **不动 `ledger`**（Q7(r1)）· **不开外壳口**（Q5(r3)）·
**提示里不点名文件**（Q4(r3)）· **一次入参都没拿到就不写**（Q5(r2)）· **写盘 best-effort、原异常照抛**（Q6(r2)）·
**两个 error 类不动**（Q7(r2)）· 容器带 **`rejections`**（Q4(r2)）· **不留逐发 token**（Q3(r3)）·
**两个分支都回 `raw`、容器一律存 `raw`**（Q1(r3)）· **R12 那一发的 `detail` 留**（Q2(r3)）。
外加票面 §4：**不动 R 表** · **`packages/qa` 一行没碰** · **`game-maker.local.json` 一个字没动** ·
**`.scratch/**/experiments/` 的现场只读** · **没有加重试 / 修复循环 / 自动重生成**（R13）。
⚠️ **没有新契约版本、没有升版**：这个容器**不进任何资源包**。

### 现场里现在长这样（第八跑那种局面再来一次的话）

```text
.failed-<ts>/
  intent.md · style.png · visual-world.json · game-intent.json
  design-attempts.json        ← 今天多出来的这一格
    { format: "run-design-attempts/v1",
      attempts: [ { attempt: 1, outcome: "schema", detail: "…", raw: { …模型写下的整份入参… } }, … ] }
```

⇒ 票 23 的 §四.2 那两个读点里，**「模型把 `player.id` 改成了什么」今天读得出来**；
另一个（「第一发撞的是哪一条 `schema`」）由每发的 `detail` 回答。
⚠️ 而**「票 42 那句新话导致模型删了 npc」这条归因，从此是被读出来的、不是推出来的**。
