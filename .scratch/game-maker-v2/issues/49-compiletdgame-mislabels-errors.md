# 49. `compileTdGame` 把代码错误报成「上游不可达」—— 类别与退出码失真、原始栈丢掉

Type: grilling
Status: resolved
Owner: claude (2026-10-12)
Blocked by: —
Map: ../map.md
> 派生自[票 48「判断失败也要报账」](48-error-carries-ledger.md) 的 `## Answer` §0 **Q4 = A**。人类原话：
> 「**本票不修，另开独立票处理。** 该处问题是将普通错误错误地重包成 `upstream`、导致错误类别与退出码失真、
> 并丢失原始栈；**这不是本票的账本及失败现场信息携带问题**。」
> ⇒ 票 48 因此**一行都没碰** `ops.ts:988-993`（它只动了那个函数之外的 `packAssets` 兜底）。
> ⚠️ 本票接的是票 48 那轮**明确划出去**的那半件 —— 它们住在**同一个 catch 的相邻两行**里，
> 病却不同：票 48 治的是「**账带不出来**」，本票治的是「**错的类别报错了**」。
>
> ⚠️ **2026-10-12 追加**（票 48 第 2 轮 **Q3 = B**）：`pack.ts:553` 那个「够不着的判断」
> **并入本票**（人类原话：「该问题属于**错误类别与实际故障原因不匹配**，与票 49 §3 的波及面分析直接相关」）
> ⇒ 它的完整证据写在下面「并入的那半件」一节，**按调用链量的，不按文案推的**。

## Question

**一个纯函数抛的异常，被报成了「上游不可达」。**

`compileTdGame`（`ops.ts:950-993`）的结构是：一个 `try` 包住重采样循环，循环里除了
`onceThroughTool`（**那一步才是真的上游调用**）之外，还有两个**纯函数**：

- `tdResolveConfig(p.value, { fromMap: true })`（`ops.ts:973`）—— 从模型画的地图派生路径；
- `auditOf(...)`（`ops.ts:980`）—— 业务校验（`auditTdConfig` + `auditScreenSpace`，`ops.ts:926-928`）。

而 catch 是这样收口的（`ops.ts:988-993`）：

```ts
} catch (e) {
  if (e instanceof CommandError) throw e;
  throw new CommandError("upstream", (e as Error).message, ledgerCarrying(call.record()));
}
```

⇒ **这两个纯函数里任何一处抛**（`TypeError`、越界、一个写坏的假设），落点都是
`CommandError("upstream")` ⇒ **退出码 3**。而在本仓库的语义里 3 只有一个意思：
**「上游死活」**（`command.ts:26`，2026-09-25 拆掉降级链之后它才变得可达）——
调用方（CLI / MCP / 人）据此**去重试、去查网络、去等一会儿**，
而真正的病因是**我们的代码坏了**，重试一万次都一样。

三处具体的失真：

1. **类别失真** —— 「我们的 bug」被报成「上游的锅」。它是**归因错误**，不是措辞问题：
   它把人支到**错的地方**去找。
2. **退出码失真** —— 应当落在 `EXIT.failure`（1，`Error` 的落点），实际落 3。
3. **原始栈丢掉** —— `new CommandError(...)` 是**另起一个 `Error`** ⇒ 原异常的 `stack`
   没了，而**现场的栈是唯一能说明「哪一行判的」的凭据**（票 48 的 Q2 正是为这一条才
   选了「挂在原异常上、不重包」）。这也是票 48 **同一条理由**的另一面。

⚠️ 而这条 catch **还顺手做了件对的事**：它把这一趟的账带上了（`ledgerCarrying`）——
所以本票**不许**把它改成裸 `throw e` 而**丢掉账**。「不重包」与「要带账」这两件事
在票 48 已经证明**可以同时满足**（挂在原异常上），本票要问的正是**这一处该怎么落**。

### 这一票要答的

1. **判别**：这一处能不能照票 48 那条尺子（**按能力/时点，不按类**）落地？
   `compileTdGame` 里「真的上游失败」与「代码坏了」在**抛点上是分开的**
   （`once.kind === "upstream"` 那两行 `ops.ts:961-962` **就是**上游失败；
   循环体里其余抛出来的**都不是**）—— 那么判据是**抛点**、是**错误类**、
   还是票 48 那把「**有没有已经花掉的钱**」（§4：连代码错误也可能发生在花钱之后）？
   ⚠️ 三条路各自说清代价。
2. **带不带账**：非上游那些抛点要不要也带账？票 48 的裁定是「**看有没有已经发生的花费**」——
   而这里的账是 `call.record()`（**只有当前这一趟**），与 `packAssets` 那条路
   （整个生图段的数组）**不是一回事**。要不要对齐，还是**这一处本就只需要这一趟**？
3. **波及面**：`ops.ts` 里**同形**的 catch 还有几处（`217 / 237` 与 `707 / 722` 是同一形状：
   「`instanceof CommandError` 放行、其余重包成 `upstream`」）。本票是**只修 `compileTdGame`**
   （Q4 的字面），还是**一并收口**？⚠️ **先量再问**：它们各自 `try` 里包着的是**纯函数**还是
   **上游调用**，决定它们是同一个病还是三回事 —— 这一条**由 agent 量**，不占人类的时间。
   ⚠️ 而**同族的病已经量到第二处** —— `pack.ts:553` 那条帧数判断。
   人类第 2 轮裁 **Q3 = B**：**并进本票**。它的证据在下面单独一节。
4. **留不留 `cause`**：`CommandError` 今天**没有** `cause` 字段（`command.ts:47-67`）。
   要不重包、要保住栈的另一条路是 `new CommandError(..., { cause: e })` —— 但那是**加字段**，
   按 **R17** 的规矩可能得另开变更票。⇒ 问清楚：本票走「挂原异常」还是「加 `cause`」，
   还是**只改类别、不动机制**。

### 并入的那半件：`pack.ts:553` 那条判断**够不着**（第 2 轮 Q3 = B）

**病**：`pack.ts:551-553`

```ts
const plan = framePlan(spec);
const drawlists = await textGate(async () => generate(spec, style));
if (drawlists.length !== plan.length)
  throw new Error(`资源 "${spec.id}"：清单说要有 ${plan.length} 帧，生成器给了 ${drawlists.length} 帧`);
```

这条一抛就是个**判断**（错报成什么由本票的裁定决定）。而它**在生产路径上打不到** —— 因为
**同一件事在下一层已经判过**，而下一层的那种抛法会一路兜成 `upstream`（⇒ **3**）：

```ts
// generate.ts:108 + :171 —— 住在真生成器的 `once()` 里面
const plan = framePlan(spec);
…
if (frames.length !== plan.length) throw new GenerationError(spec.id, `清单要 ${plan.length} 帧，模型给了 ${frames.length} 帧`);
```

⚠️⚠️ **这两处的 `plan` 是同一个纯函数的同一次调用**（`prompt.ts:146` 的 `framePlan`，
两处都拿**同一个 `spec`** 调）⇒ **两个比较完全等价**，而 `generate.ts` 那个**先跑**
（它在 `await generate(...)` 里面，包在返回之前）；外层还有 `attempts` 次重试，最后把它重抛成
`GenerationError(spec.id, "N 次都没成功；最后一次：…")`。

#### 证据（⚠️ **按调用链量的，不按文案推的** —— 第 2 轮的约束 4 点名要求）

**两条判断的措辞不一样，所以光看报错文案会认错是哪一条真响**：

| | 文案 | 例子 |
|---|---|---|
| `generate.ts:171` | 「清单**要** N 帧，**模型**给了 M 帧」 | 清单要 1 帧，**模型**给了 2 帧 |
| `pack.ts:553` | 「清单**说要有** N 帧，**生成器**给了 M 帧」 | 清单说要有 1 帧，**生成器**给了 2 帧 |

两次实测（都喂**帧数不符**的回应）：

| 怎么跑的 | 撞到的是哪一条 | 抛出来的东西 | 落点 |
|---|---|---|---|
| 走**真生成器**（`fetchImpl` 回一份 2 帧的 drawlist） | `generate.ts:171` | `GenerationError` ⇒ 重采样 ⇒ 仍 `GenerationError` | 兜成 `CommandError("upstream")` ⇒ **3** |
| **注入桩**（`generate: async () => 两帧`） | ⚠️ **`pack.ts:553`** | **裸 `Error`**（`at buildOne (pack.ts:553:17)`） | 本票要裁的那条路 |

⇒ **结论**：`pack.ts:553` 不是「死代码」，它**在注入桩上可达**（`buildAssetPack` 的
`generate: DrawListGenerator` 是注入的）—— 而**在生产路径上，真生成器先把它挡掉了**。
⚠️ 仓库自己的 `pack.test.ts` 里那个 `stubDrawLists` 恰好**按同一个 `framePlan` 算出同样的帧数**
⇒ 它一次都没撞到过 553。

#### 本票要为它答的

- **改哪一条**？三条路：① 让 `pack.ts:553` **保持够不着**（它是真生成器的一条**冗余**防线 ——
  防的是「将来有人换了 `generate` 实现、不再自己判帧数」）；② 把两层**合成一条**（`generate.ts` 那层
  改成不判、只判 `pack` 这层），代价是**重采样会少一次**（`generate.ts` 那层判在**重采样循环里**，
  而 `pack.ts` 判在**循环之后** ⇒ 合成后一帧数不符就**不再重采样**，直接失败）；
  ③ 只改**类别**：让 `generate.ts:171` 那条**不**被兜成 `upstream`（那它就不再是「上游的锅」，
  而它本来也确实不是 —— 上游只是照我们的话照办了）。
- ⚠️ 无论选哪条，**这一处的判别问题与 `compileTdGame` 那一处是同一个**：
  「**这个错到底该报成哪一类**」，而两处**都没有**一个可用的判据 —— 见本票 §1。

### 边界（照票 48 那轮的裁定顺延）

- ⚠️ **只做「错的类别与退出码、以及原始栈」这一件事**：**不许**顺手加重试 / 修复循环 /
  自动重生成（[票 33](33-r13-amendment.md) 裁定第一阶段不建 · [票 35](35-multiframe-needs-background.md) §4 同款）。
- ⚠️ **不许**顺手改 `runBuild` 的失败现场策略、**不许**给正式 run 目录改写账
  （[票 36](36-failure-ledger.md) 的 Q4 已把这两件划出射程）。
- ⚠️ **不许**为了本票去动票 48 刚落地的 `carryOnError` / `ledgerOfError` / `failureDirOfError`
  的**形状**；若发现它们是错的，那是**回去改票 48**，不是在这里绕开。
- ⚠️ 若最终选择的落法会**改 `compileTdGame` 的对外退出码**，那是**行为变更** ⇒ 要把
  「谁的退出码变了、哪些既有测试钉着它」**量清楚再说**。

## 第 1 轮已量到的（2026-10-12 · claude 认领后，**先量再问**；读数都是跑出来的）

> ⚠️ 本节是**第 1 轮问出去之前**的测量，不是裁定。裁定落在 `## Answer`（人答完再写）。
> 一次测量手段：把契约的 `tdResolveConfig` 换成一个**会抛的实现**（`vi.mock`），跑真 `compileTdGame`
> —— 那是这条路上**唯一**不需要改源码的注入口，顺手也是 Q6 那条见证的形状。

| # | 读数 |
|---|---|
| **F1** | 今天这一处**实测**：`CommandError` · `kind: upstream` · **退出码 3** · **原始栈丢了**（`e.stack` 第二行 = `ops.ts:992`）· **账 1 笔** ⇒「它顺手做了件对的事」成立 |
| **F2** | 那个 catch **今天够不着**：真 fixture 的 td-config 变异 **4000 发**（**822 发**过得了 schema），走同一条链 ⇒ **抛了 0 发**。历史那一次（`entityBox(undefined)`）已由 `td-config.ts:539` 的 `if (coreA && coreAt)` 修掉、`compile-td-game.test.ts:102` 钉住 ⇒ 本票治的是**一条潜伏的路**，不是一次正在发生的误报 |
| **F3** | ⚠️ **票面 §3 的前提是假的**：`instanceof CommandError` 的**闸门**全仓只剩**这一处**（`ops.ts:991`）。票面点名的 `217 / 237`、`707 / 722` 是**抛点**、不是 catch —— `planAssets`（159-292）与 `compileRuntime`（583-871）**压根没有 `try`/`catch`**，裸 `Error` 从它们里出来本来就直接落 1。同形 catch 历史上只有**两处**，另一处（`packAssets`，1224）**票 48 已改完**，其余出现全在注释里 ⇒「一并收口」**已经做完了** |
| **F4** | 循环里的不变量：`onceThrough` **只返回、不抛**（它把 `callText` 的抛在内部收成 `not-sent`/`upstream`）⇒ 落到 catch 的**只可能是** `tdResolveConfig` / `auditOf` 这两个纯函数 |
| **F5** | `ledgerCarrying(call.record())` **已经就是**票 48 那把尺子（`spentCall.record()` 在 `trips === 0` 时给 `null` ⇒ `{}`）；且这条路上一次操作**只有一格账** ⇒「要不要对齐 `packAssets` 那个整段数组」**不成立** |
| **F6** | `pack.ts:553` **在生产路径上没有注入口**：`packAssets`（`buildAssetPack` 唯一的生产调用方，`ops.ts:1203`）**不暴露 `generate`**（`PackOptions` 1027-1043 没有这个键），它自己造真生成器；而真生成器的 `generate.ts:171` 拿**同一个** `framePlan(spec)` 先判 ⇒ 553 只在**直接调 `buildAssetPack`** 的地方可达（测试 / 实验台） |
| **F7** | 邻居一号：`not-sent`（`221` / `709` / **`961`**）抛 `upstream` 而**不带账**；而 `call.trip({})` 会把 `trips` 加 1 ⇒ 谁照抄 `ledgerCarrying(call.record())` 去补它，谁就报出**一笔没发出去过的假账**（`attempts:1`、无 `ms`）—— 与 `spentCall` 自己那句承诺相抵 |
| **F8** | 邻居二号：`callText` 的 `await res.json()` **不设防**（`onceThroughTool` 那条同款路径**设了**防，139-141）⇒ 上游 200 回一份非 JSON 的 body ⇒ SyntaxError ⇒ 被 `onceThrough` 判成 **`not-sent`**（「我们没把请求发出去」——**与事实相反**）⇒ 报 upstream 且**丢账** |
| **F9** | 路线②的隐藏代价（比票面写的更坏）：删掉 `generate.ts:171` 之后，帧数**多**了会在同一函数 174 行的 `plan[i]!.anim` 上炸成 `TypeError`，落进 `catch (e) { last = e }`（195）⇒ **重试把预算烧完**，最后原样抛出 ⇒ 在 `ops.ts:1224` 落成裸 `Error` + 一句 `plan[i] is undefined` |
| **F10** | 谁会红：`compile-td-game.test.ts` **没有一条**钉住这个 catch；`pack.test.ts:103`（553 那句文案）与 `generate.test.ts:70`（171 那句文案）钉的是**文案**不是类别；`ops.test.ts` 那三条钉的是**传输失败**的 3（与「模型答不准」不是同一档） |
| **F11** | 「原始栈丢掉」这条**今天没有读者** —— 全仓 `grep '\.stack'` 在 `packages/*/src` 里只有 `recipe.ts:178` 一处与异常无关的用法。它是票 46/48 选「挂原异常」的**理由**，但今天没有任何一条路会把它印出来 |

### 第 1 轮问出去的六问（2026-10-12）

Q1 判别（抛点 / 错误类 / 票 48 的尺子）· Q2 账与现场（带什么、对不对齐 `packAssets`）·
Q3 机制（重抛原异常 / 加 `cause` / 加字段）· Q4 波及面（F3 的更正 + F7/F8 两个邻居怎么走）·
Q5 并入的 553 三条路 · Q6 见证与手续。

⚠️ 我给的推荐（**待人类裁定**）：Q1 类别按**抛点**判、账按 `ledgerCarrying` 判（两把尺子各答一问）·
Q2 账原样、不带 `failureDir` · Q3 **重抛原异常**、不加字段 · Q4 只改这一处、F7/F8 **另开票** ·
Q5 **①**（保持够不着 + 写明它是「注入契约的断言」）· Q6 四断言见证 + 两发变异、`command.ts` 加注不改原文。

## Answer

**这一票只改一处 catch**，它落地的是**一条判据**：**类别与退出码按「抛点」判**（这处的尺子），
**带不带账按「花费」判**（[票 46/48](48-error-carries-ledger.md) 的老尺子）—— **两把尺子各答一问，不许合并**。
⚠️ 而那处 catch 今天**够不着**（F2：4000 发变异、822 发过 schema、**抛了 0 发**）⇒
本条改的是**一条潜伏的路**，不是一次正在发生的误报（历史那一次已由 `td-config.ts:539` 修掉）。

### 0. 逐字裁定

> **人类原话（本票的射程边界，逐字）**：
>
> 「六问全部采纳推荐：Q1–Q6 均为 A（Q5 的 ①）。
> **本票只修 compileTdGame 这一处错误分类，不扩大到 callText / onceThrough 的共同实现，
> 也不借机重构图像生成错误分类体系。**」

| 题 | 裁定 | 裁定理由 / 执行约束（逐字） |
|---|---|---|
| Q1 判别按什么 | **A** | 「按抛点判类别，按花费判是否带账。当前 try 内的 onceThrough 只返回、不抛；上游两档已在 961/962 显式抛出带账的 `CommandError("upstream")`。因此，**这个 catch 捕获的异常归类为本地配置解析或审计阶段的失败，保留原错误类别与退出码 1**。账本仍使用现有 `ledgerCarrying(call.record())`，两种判据**不得合并**。」 |
| Q2 账与现场 | **A** | 「账原样沿用，**不带 `failureDir`**。`ledgerCarrying(call.record())` 已符合票 48 的记账原则，一次操作只涉及一格账，不需要改成整段调用数组。该路径没有生图失败现场，**不新增 `failureDir` 字段，也不伪造现场路径**。」 |
| Q3 机制 | **A** | 「**重抛原异常**。使用票 48 已确立的原异常携带机制，保留原始错误对象、错误类型和栈；不改成 `CommandError`，不额外引入 `cause`，不修改 `CommandError` 的结构。当前 `CommandError` 对 `ledger` 的无条件赋值确实限制了通用补账能力，但**本票不扩展到该契约问题**。」 |
| Q4 波及面 | **A** | 「**本票只改这一处 catch，邻居另开票**。F3 已证实其他同形 catch 的收口工作已经完成。`not-sent` 错误的账本幻影，以及 `callText` 对非 JSON 响应的误分类，是另外两项共享代码路径问题，**应单独开票**，不在本票中修改 `planAssets`、`compileRuntime` 的共同实现。」 |
| Q5 `pack.ts:553` | **①** | 「**保持现状，明确其断言语义**。该判断在生产生成器路径中不可达，但在直接注入替代生成器的测试或实验路径中仍有意义。将其明确记录为**注入契约的断言**：替代生成器违反帧数契约时，作为**本地接线错误**抛出原始错误，退出码为 **1**。**不删除 `generate.ts:171` 的前置校验，不引入重试耗尽风险**；若要细分图像链的错误类别，**另开票**。」 |
| Q6 见证与手续 | **A** | 「增加**四项断言**的测试，变异验证两种回归；**只加注**。通过注入会抛出 `TypeError` 的 `tdResolveConfig` 实现，覆盖**真实 `compileTdGame` 链路**。测试同时断言裸 `TypeError`、`exitCodeOfError === 1`、原始栈保留、账本仍为 1 笔。**两种变异**分别验证重包回归与账本丢失。按照既有先例，在 `command.ts` 的 `EXIT` 说明处**增加带日期的注释，不改原文、不修改 R 表**。」 |

> **由此确立的对外语义（本票唯一的新规则，落在 `command.ts` 的 `EXIT` 注里）**：
> **3 只留给「上游死活」；「我们的代码坏了」一律落 1。** 判据是**抛点**，**不是错误的类** ——
> 一个 `try` 里若已经把上游失败**显式**抛成了 `CommandError("upstream")`，同一个 `try` 里剩下的抛点
> （纯函数 / 审计 / 派生）**只可能是我们的 bug** ⇒ 原样抛出（**1 + 原始栈**），**不许**被兜底重包成 3。
> ⚠️ 它与「带不带账」是**两把尺子**：那把看**花费**（票 46/48），这把看**抛点**。
> **不许合并** —— 合并之后「钱花了才发现我们代码坏了」会被报成「没花钱」。

### 1. 落了哪些改动

| 文件 | 改了什么 |
|---|---|
| `packages/assets/src/ops.ts`（`compileTdGame` 的 catch，`988-1007`；新那两行在 `1005-1006`） | `throw new CommandError("upstream", (e as Error).message, ledgerCarrying(call.record()))` → `carryOnError(e, ledgerCarrying(call.record())); throw e;`。⚠️ **`if (e instanceof CommandError) throw e;` 留着**（它不是闸门，只是捷径：`CommandError` 的构造器**无条件**赋 `ledger`/`failureDir` ⇒ `'ledger' in e` 恒真 ⇒ `carryOnError` 对它们本来就 no-op）；注释写清**为什么落到这里的只可能是我们的 bug**（上游两档在 `961-962` 显式抛了、`onceThrough` 只返回不抛）与**三处失真**（类别 / 退出码 / 原始栈） |
| `packages/assets/src/pack.ts`（`551` 之上） | Q5 = ①：**判断一字不动**，在它上面写明它是**注入契约的断言**（真生成器在下一层 `generate.ts:171` 拿**同一个** `framePlan(spec)` 先判 ⇒ 生产路径够不着；注入桩上 = 本地接线错误 ⇒ 原始错误 + 退出码 1），并写明**为什么不能与 `generate.ts:171` 合成一条**（会烧掉重试预算，F9） |
| `packages/contracts/src/command.ts`（`EXIT` 的文档注） | **只加注、不改原文、不动 R 表**：新增 2026-10-12 那一段（3 只留给上游死活 · 判据是抛点不是类 · 两把尺子不许合并 · 先例指 `compileTdGame`） |
| `packages/assets/tests/compile-td-game-error-class.test.ts` | **新文件**（1 条）：Q6 那四项断言一起查 + 一条**护栏**（确认响的是注入的那一处） |

⚠️ **既有测试一条都不用改**（F10 的预判成立）：全仓**没有一条**测试钉过这个 catch 的旧行为。

⚠️ **行号更正（施工后的当前值，都是 `grep` 数出来的）**：本票在 `pack.ts:551` **之上**插了那段注（**11 行**）⇒
**该文件 551 之后的行号一律 +11**（票 48 与本票此前引的 `pack.ts:553` 那条判断现在是 **564**；
本图 `## Not yet specified` 里引的 `pack.ts:624` / `905` ⇒ **635 / 916**）。
⚠️ `ops.ts` 那个 catch **仍在 `988`**（注插在它**里面**）：原先是 `991` 放行 + `992` 重包两行，
现在是 `991` 放行 + `1005-1006` 的 `carryOnError` / `throw e` ⇒ **catch 整体 `988-1007`**。⚠️ 而 `ops.ts` **`993` 之后**的行号因此一律 **+14**（本票正文里引的：`PackOptions` `1027-1043` ⇒ **`1041` 起** · `buildAssetPack` 的调用点 `1203` ⇒ **`1217`** · `packAssets` 那条兜底 `1224` ⇒ **`1238`**（票 48 的 Answer 引的是**施工前**的值）。⚠️ `command.ts` 同款：本票在 `EXIT` 文档注里加了 **9 行** ⇒ **该文件 `25` 之后 +9**（本票正文引的 `EXIT` `26` ⇒ **`35`**；`CommandError` 那个类 `47-67` ⇒ **`56-76`**）。

### 2. 见证与两发变异（Q6）

**手段**：把契约模块的 `tdResolveConfig` 换成一个**必抛 `TypeError`** 的注入（`vi.mock("@game-maker/contracts", …)`），
**源码一个字不改**，跑**真** `compileTdGame` 链路（真重采样循环、真 `spentCall`、真那个 catch）——
上游照常回一份**本来能编译成功**的关卡，于是唯一失败的那一步就是被注入的那个纯函数。
⚠️ **单独一个文件**：`vi.mock` 是**文件级**的，放进 `compile-td-game.test.ts` 会把那个文件里所有成功用例一起打红。

| 断言 | 本票要求它成立的那件事 |
|---|---|
| ① `err` 是裸 `TypeError`、**不是** `CommandError`（`name === "TypeError"`） | 类别不失真 |
| ② `exitCodeOfError(err) === EXIT.failure`（**1**）且 `!== EXIT.upstream`（3） | 退出码不失真 |
| ③ `err.stack` 的**栈顶那一帧**还是原抛点（测试文件里的 `mockPureFunctionBug`），且 `mockPureFunctionBug` 那一帧**整条链还在** | **原始栈没丢**（重包之后栈顶会是 catch 那一行 `ops.ts:99x`） |
| ④ `ledgerOfError(err)` 有 **1** 笔：`step: compile-td-game` · `target: td-config` · `attempts: 1` · `ms` 是数 | **账照带**，且是**真的那一笔**（不是一个占位的空壳） |

| 变异（都验过**真的会红**） | 结果 |
|---|---|
| **A**：把那两行退回成交付前的 `throw new CommandError("upstream", …)`（**重包回归**） | **红** —— `expected CommandError … to be an instance of TypeError`（①） |
| **B**：`carryOnError(e, {})`（**账本丢失**） | **红** —— `钱花了、账必须有人报回来: expected undefined to be defined`（④） |

⚠️ 一处**现场更正**（写见证时量的，留着免得下一个人再撞）：我原本还想断言「栈里**不该**出现
`ops.ts:9xx`」—— **错了**。`at compileTdGame (ops.ts:973)`（**调**那个纯函数的那一行）是**原栈的一部分**，
它留着恰恰是「栈是原栈」的证据；重包之后消失的是**栈顶**那一帧与 `mockPureFunctionBug` 那条链。
⇒ 判据改成 ③ 那两条（栈顶 + 原抛点函数名），两者都能把重包抓红。

### 3. 邻居与派生（Q4 / Q5 点名「另开票」的两处，本票一行没碰）

- **已开**：`not-sent` 那一档的两件事 —— ① F7 的**账本幻影**（`call.trip({})` 会让 `record()` 交出一笔
  **没发出去过**的花费，与 `spentCall` 自己那句承诺相抵）；② F8 `callText` 的 `await res.json()` **不设防**
  ⇒ 上游 200 回一份非 JSON 的 body 被报成 **`not-sent`**（「我们没把请求发出去」——**与事实相反**、
  而钱其实花了）⇒ 见[票 51「`not-sent` 那一档两头都不准」](51-not-sent-lies-both-ways.md)。
  ⚠️ 两处都在 `onceThrough` / `callText` 的**共同实现**里 ⇒ 按 Q4 的字面，**不在本票**。
- **没开、记进雾里**：**细分图像链的错误类别**（`GenerationError` 今天把传输与形状一起兜成 `upstream` ⇒ 3）。
  Q5 = ① 只说「**若要**细分，另开票」——**不是**一张被要求开的票 ⇒ 写进 map 的 `## Not yet specified`
  （带本票的读数指针），**等有人开**。

### 4. 闸门

`pnpm typecheck` 绿 · `pnpm test` **1247/1247（75 文件）**（此前 1246/74，本票 **+1**，**没有一条既有测试需要改**）·
`pnpm check` 绿（依赖图合法（9 包）· 相对链接零断裂（192 份文档 · 1092 条链接）· build 干净）。
⚠️ **没有开任何一次付费运行**（本票的见证走注入桩，零调用）。
