# 51. `not-sent` 那一档两头都不准 —— 上游回了非 JSON 被报成「我们没发出去」，而它自己会让账里多出一笔没上路的花费

Type: grilling
Status: resolved
Owner: claude (2026-10-12)
Blocked by: —
Map: ../map.md
> 派生自[票 49「`compileTdGame` 把代码错误报成「上游不可达」」](49-compiletdgame-mislabels-errors.md) 的 `## Answer` §3
> （**Q4 = A** 点名「另开票」，人类原话：）
> 「**本票只改这一处 catch，邻居另开票。** F3 已证实其他同形 catch 的收口工作已经完成。
> **`not-sent` 错误的账本幻影，以及 `callText` 对非 JSON 响应的误分类**，是另外两项共享代码路径问题，
> **应单独开票**，不在本票中修改 `planAssets`、`compileRuntime` 的共同实现。」
> ⇒ 票 49 因此**一行都没碰** `callText` / `onceThrough` / 那三个 `not-sent` 抛点。
> ⚠️ 而票 49 的尺子（**类别按抛点判 · 带账按花费判 · 两把尺子不许合并**）已经立在
> `command.ts` 的 `EXIT` 注与那张票的 `## Answer` §0 —— **本票判的是这一档该落在尺子的哪一边**。

## Question

> ⚠️⚠️ **2026-10-12 · 落地时的加注（Q3 = (B) 的代价，人类明写要求「在票 51 中加注该变化及其
> 退出码、HTTP 往返次数的影响，但不修改原文和 R 表」）**：`onceThroughTool` 在调 `parseToolUse`
> **之前**多了一道「**body 不是对象**（`null` / `[]` / `123` / `false` / `"abc"`）」的前置检查 ⇒
> **`planAssets` 与 `compileRuntime` 在这一条上：退出码 `4` → `3`、HTTP 往返 `3` 趟 → `1` 趟**
> （同一个事实过去两条路判成两档，而代理坏掉回一个 `null`、重试三次只是白花钱）。
> ⚠️ **`{"content":5}` 那种「是对象、只是字段形状不对」不在其中** —— 两条路仍都落 `invalid`(`4`)。
> 同一注也落在 `command.ts` 的 `EXIT` 文档上（照票 49 的先例：**只加注、不改原文、不动 R 表**）。
> ⚠️ **下面这段原文一个字都没改**（改的是代码，不是票面）。

**「我们没把请求发出去」这一档，今天既可能收错东西、又会让账说谎。**

### 这一档是什么（今天写在哪）

`not-sent` 是 `Once<T>` 的第四档，它的**定义**写在两处、说的是同一件事（`ops.ts:349-351`）：

> ⚠️ `"not-sent"` 是**故意**分开的一档：那是**我们这边**没把请求发出去（**没配凭据**），
>   不是上游的错 —— 而账上**也不该有这一笔**（票 46：只记真的发出去的）。

而它**唯一的产出方式**是「`callText` 抛了一个**不是** `UpstreamCallError` 的错」（`ops.ts:379-384`）：

```ts
  } catch (e) {
    const err = e as Error;
    return e instanceof UpstreamCallError
      ? { kind: "upstream", failure: e.failure, error: err }
      : { kind: "not-sent", error: err };          // ⚠️ 「兜底 = 没发出去」这条等价今天不成立
  }
```

⇒ **判据是「抛的是哪个类」，而那个类只有 `callText` 自己在四个地方抛**
（`timeout` 一处 · `http` 两处 · 凭据那一处抛的**不是**它）——
于是**任何别的异常从 `callText` 里冒出来，都会被判成「我们没把请求发出去」**。

### 病一（票 49 的 F8 · `callText` 不设防）：200 + 非 JSON ⇒ 报「没发出去」，而钱已经花了

`callText` 的 `await res.json()`（`ops.ts:324`）**裸着**：

```ts
  if (!res.ok) throw new UpstreamCallError("http", `上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { model?: string; … };      // ⚠️ 200 + body 不是 JSON ⇒ SyntaxError
```

⚠️⚠️ **而同一个仓库的同款路径是设了防的** —— `onceThroughTool`（R16 那条协议，`ops.ts:139-141`）：

```ts
  let body: unknown;
  try { body = await res.json(); }
  catch (e) { return { kind: "upstream", failure: "http", error: new UpstreamCallError("http", `上游回的不是 JSON：${(e as Error).message}`) }; }
```

⚠️ 更要紧的是：**「body 不是 JSON」本来就写在 `http` 那一档的定义里** ——
`UpstreamCallError` 的文档（`ops.ts:281-282`）逐字说：

> ⚠️ 只有两档：`timeout`（我们自己中止的）与 `http`（**上游没给一个可用的应答** ——
>   非 2xx、**body 不是 JSON**、连不上）。闭集里没有第三档，别现编。

⇒ **同一个上游行为，在两份实现里判成了两档**：R16 那条是 `upstream`（说的与文档一致），
旧协议这条是 `not-sent`（**与文档相反、也与事实相反**）—— 请求**发出去了**、钱**也花了**。

**落点**（按三个调用点读出来的，**要量**）：

| 调用点 | 今天 | 该是 |
|---|---|---|
| `planAssets`（`ops.ts:221`）· `compileRuntime`（`709`）· `compileTdGame`（`961`） | `throw new CommandError("upstream", once.error.message)` —— **不带账**、`call.trip({})` | 上游的锅 → **带账**（那一笔真花了） |
| 对外类别 / 退出码 | `upstream` ⇒ **3** | **不变**（也是 3 —— 所以这不是一次「退出码」变更，是**归因与账**的变更） |

⚠️ **另有一个同族的疑点（按代码读像是，**要量**）**：`j.usage` 与 `j.content` 是在**没检查形状**的前提下取的
（`ops.ts:328`）⇒ 200 + 合法 JSON 但**不是对象**（`null` / `[]` / `123`）也会抛 `TypeError`
⇒ **同样落进 `not-sent`**。它比上面那条更隐蔽：连「不是 JSON」都不需要。

### 病二（票 49 的 F7 · 账的幻影）：`trip({})` 让 `record()` 交出一笔**没上路**的花费

`spentCall` 自己那句承诺（`ops.ts:432`）：

> ⚠️ **一次都没发出去就返回 `null`** —— 账不记没上路的往返（票 46）。

而三个 `not-sent` 抛点都调了 **`call.trip({})`**（`ops.ts:957-960` 那条选择子）：

```ts
      call.trip(once.kind === "ok" ? { spent: once.spent }
        : once.kind === "not-sent" ? {}
        : once.kind === "upstream" ? { failure: once.failure }
        : { failure: once.failure, spent: once.spent });
```

⇒ `trip` 只认「带没带 `failure` / `spent`」，**不带的时候就只是把 `trips` 加 1**
⇒ `record()` 回到上面那句承诺的**反面**：它交出一格
`{ step, target, upstream: "messages", ms, attempts: 1 }`（**有 `ms`、有 `attempts`，而一个请求都没上路**）。

⚠️ **今天它还没害人**，因为三个抛点都**没**把 `ledgerCarrying(...)` 接上去（所以那一格没人读）——
它是一条**陷阱**：谁照着 `compileTdGame` 那两行（`961-962` 的 `upstream` 档）**照抄**去补 `not-sent` 的账，
谁就当场报出一笔**假账**。⇒ 这与病一**方向相反、病根同一个**：
**病一让「发了」被记成「没发」，病二让「没发」也能有账。**

### 这一票要答的

1. **判别**：`not-sent` 该不该**只**留给「请求没上路」（凭据没配）那一档？
   ⇒ 200 + 非 JSON（以及上面那个「200 + JSON 但不是对象」）应当落 `upstream`/`http`（与 `onceThroughTool`、
     与 `UpstreamCallError` 的文档一致）—— 还是它另有身份（**代理坏了**？那是**我们这边的错**，而不是上游的）？
   ⚠️ 三条路各自说清代价：**(a) 在 `callText` 里设防**（抛 `UpstreamCallError("http", …)`，与 R16 那条逐字对齐；
   代价：`callText` 是**三个命令共用**的那一段，改它要量「谁钉着它的现有分类」）·
   **(b) 在 `onceThrough` 里按内容分**（`callText` 不动；代价：把「上游回的不是 JSON」这一个事实
   掐死在中间层，`callText` 的调用方看不到）· **(c) 另加一档**（比如 `proxy`；代价：动 `Once<T>` 与
   三个抛点的共同形状 —— 而票 49 的裁定刚说过「不扩大到共同实现」，本票正是为它开的）。
2. **账**：`not-sent` 不带账**今天是对的**吗？（票 46 的尺子：**花费** —— 没上路就没有花费 ⇒ 对。）
   那 `trip({})` 让 `record()` 说谎**是不是 bug**？两条修法各自说清代价：
   **(a) `not-sent` 不 `trip`**（最小；代价：账上「试过 1 次、没上路」这个**事实**没了 ——
   而它也许正是 `attempts` 想记的东西）· **(b) 让 `spentCall` 自己保证**（把「发了」与「试过」拆成两个动作，
   代价：动 `spentCall` 的形状 = 动票 46 的地基）。
   ⚠️ 若选 (a)，要答一句：`attempts` 的语义是「**上路了几趟**」还是「**试了几次**」——
   今天这两件事**恰好相等**（因为 `trip` 只在一次真往返之后调），偏偏 `not-sent` 把它们**分开**了。
3. **波及面**：`callText` / `onceThrough` 是**全文本链共用**的（`derive` · `compile-game` · `compile-td-game`
   三处），本票的改动会不会改**别的命令**的对外类别或退出码？⚠️ **先量再问**：谁钉着现行分类
   （已知：`compile-td-game.test.ts:254` 那条**空凭据 ⇒ `upstream`** 钉的是**真 `not-sent`** 的对外落点）、
   以及三个抛点各自带不带账。这一条**由 agent 量**，不占人类的时间。
4. **手续**：这是变更票吗（要不要顶掉 `Once<T>` / `UpstreamCallError` 文档里的某一句已写的字）？
   若是，照先例**另开一张变更票**（票 33 / 43 / 48 的做法）。

### 边界

- ⚠️ **只做 `not-sent` 这一档的「类别 · 归因 · 账」这三件事**：**不许**顺手加重试 / 修复循环 /
  自动重生成（[票 33](33-r13-amendment.md) 裁定第一阶段不建）。
- ⚠️ **不许**动[票 48](48-error-carries-ledger.md) 刚落地的 `carryOnError` / `ledgerOfError` / `failureDirOfError`
  的**形状**；若发现它们是错的，那是**回去改票 48**。
- ⚠️ **不许**借机细分**图像链**的错误类别（`GenerationError` 那一侧）—— 那是**另一件事**，
  票 49 的 Q5 = ① 把它留在图上的雾里。也**不许**动 `packages/qa` 与 `game-maker.local.json`。
- ⚠️ 不许改**任何**既有测试来适配新行为；若某条既有测试**必须**改，先把它量出来、说清它钉的是哪一句。

### 先量再问（交给认领本票的那一轮，**测量不用人类的钱**：全部走 `fetchImpl` 桩）

1. **200 + 非 JSON**（`text/plain` 说一句人话）走三个命令各一次 ⇒ 落点、`kind`、退出码、账上有没有那一笔。
2. **200 + 合法 JSON 但不是对象**（`null` / `[]` / `123` / `{"error":{"message":"…"}}`）⇒ 是不是同样落 `not-sent`
   （按代码读像是；⚠️ 最后那种形状**上游真会回**，比如代理把上游的 500 转成 200 带 error body）。
3. `call.trip({})` 之后 `record()` 的**逐字段读数**（确认那一格长什么样、有没有 `ms`）。
4. `onceThroughTool` 那条同款路径（R16 协议）在同样输入下的落点 —— 确认「两份实现在同一输入上判成两档」。
5. 谁钉着现行分类：`ops.test.ts` 那三条（上游失败 ⇒ 3）· `compile-td-game.test.ts:254`（空凭据 ⇒ `upstream`）
   · 以及三处 `not-sent` 抛点有没有一条测试。

## 第 1 轮已量到的（2026-10-12 · claude 认领后，**先量再问**；读数全部是跑出来的，零真调用、零花费）

**手段**：`fetchImpl` 桩，逐字节固定的回应体，走**真链路**（真 `callText` / 真 `onceThrough` / 真 `spentCall` /
真三个命令的循环与 catch）。探针脚本跑完即删、不进任何一次提交。另有两份**逐字复制的 `ops.ts` 副本**
（只加了一句 `export` 或**改一行**，标明处）用于量 3 与「修法预演」。

### M1 · 这一档的**可达集合**比票面写的小得多：`not-sent` 只从**一条命令**里出来

| 问题 | 票面写的 | 量出来的 |
|---|---|---|
| 谁产 `not-sent` | 「三个抛点」（`planAssets` / `compileRuntime` / `compileTdGame`） | **只有一处生产**：`onceThrough` 的 catch（`ops.ts:379-384`），而 `onceThrough` **只有一个调用方** —— `compileTdGame`（`ops.ts:952`） |
| 另两处 | 同款抛点 | **够不着**：`planAssets:221` / `compileRuntime:709` 读的是 `onceThroughTool` 的返回值，而那条路（R16）**从不产出 `not-sent`**（它的出口只有 `upstream` / `bad` / `ok` 三种）⇒ 那两行只为**类型收窄**而存在 |
| 同族第四份实现 | 「三处共用」 | `packages/game-design/src/analyze-intent.ts:147-196` 有**自己的一份** `onceThrough`（文件头自陈不复用 assets 那份），它**设了防**（`res.json()` 包在 try 里 ⇒ 抛 `upstream`/`http`）且**没有 `not-sent` 这一档** ⇒ 它是「对的那一份」的**第二份先例**，不只是 `onceThroughTool` 一份 |

⇒ **结论**：本票的病**只发生在旧文本链那一条路上**，而那条路**只有 `compileTdGame` 走**。
⚠️ 两个壳（CLI / MCP）读账的那两处（`cli.ts:598` · `server.ts:333`）因此**只会在这一个命令上受影响**。

### M2 · `not-sent` 的**三张脸**（逐条都是跑出来的）

| # | 抛点 | 请求上路了吗 | 钱花了吗 |
|---|---|---|---|
| a | `callText:300-305` 的凭据守卫（`new Error("文本上游没配…")`） | **没有** | 没有 |
| b | `callText:324` 的**裸** `await res.json()` ⇒ `SyntaxError` | 上路了 | **花了**（200 已经回来了） |
| c | `callText:328` 的**形状不设防**：`j.usage`（body 是 `null`）· `(j.content ?? []).filter`（`content` 不是数组）⇒ `TypeError` | 上路了 | **花了** |

⚠️ 票面猜「200 + 合法 JSON 但**不是对象**（`null` / `[]` / `123`）都会落 `not-sent`」——**只对 `null` 成立**。
`[]` / `123` / `false` / `"abc"` / `{}` / `{"content":[{"type":"text"}]}`（text 缺）**都不抛**：它们一路走到
「文本是空串 ⇒ `JSON.parse("")` ⇒ `invalid-json`」⇒ 落 `bad`、重试 3 趟、最终 `invalid`/4（**量 6 逐条验过**）。

### M3 · 同一份回应体，两条路判成什么（**这是票面那句「两份实现判成两档」的逐条读数**）

| 输入（HTTP 200） | `planAssets` / `compileRuntime`（R16 工具链） | `compileTdGame`（旧文本链） |
|---|---|---|
| `text/plain` 说人话 | `upstream` / **3** · 账 `{attempts:1, failures:["http"]}` · 「上游回的不是 JSON：…」 | `upstream` / **3** · ⚠️**账缺席** · 原始 `SyntaxError` 文案 |
| JSON `null` | **`invalid` / 4**（重试 **3** 趟 · `no-tool-use`）· 「响应不是一个对象（拿到 null）」 | ⚠️ **`upstream` / 3** · **账缺席** · 「Cannot read properties of null (reading 'usage')」 |
| JSON `{"content":5}` | `invalid` / 4（3 趟 · `no-tool-use`） | ⚠️ **`upstream` / 3** · **账缺席** · 「(j.content ?? []).filter is not a function」 |
| JSON `[]` · `123` · `false` · `"abc"` · `{}` | `invalid` / 4 | `invalid` / 4（3 趟 · `invalid-json`） |
| `{"error":{"message":…}}`（代理把 500 转成 200） | `invalid` / 4 | `invalid` / 4（3 趟 · `invalid-json`） |
| **空凭据**（请求没上路） | `upstream` / 3 · 账缺席 —— ⚠️ 但它走的是**前置守卫**（`ops.ts:176-181` / `626`），**不在 `not-sent` 那一档** | `upstream` / 3 · 账缺席 —— **这才是真 `not-sent`**（经 `onceThrough` 兜底） |

⇒ 三条读数与票面预判的**出入**：
1. **对外退出码今天没变**（`not-sent` 被三个抛点显式重包成 `upstream` ⇒ 3）—— 票面这句**成立**；
   变的不是退出码，是**账**（b / c 两档明明花了钱，账却整个缺席）与**文案**（原始 JS 错误直出）。
2. `null` 是**真分歧**：工具链说 4（可重试），文本链说 3。
3. `{"content":5}` 同族，同样分歧（票面没列这一条，是量的过程中撞出来的）。

### M4 · 病二的**幻影**（`trip({})`）—— 逐字段读数 + 一次端到端演练

`spentCall.trip({})` 之后 `record()` 交出的那一格（真 `spentCall`，副本只加了 `export`）：

```json
{ "step": "compile-td-game", "target": "td-config", "upstream": "messages", "ms": 0, "attempts": 1 }
```

⚠️ 对照：一次都没 `trip` 时 `record()` 是 **`null`**（`spentCall` 自己那句承诺成立）；一次**真往返**的那一格
多出 `model` 与 `usage`。⇒ 幻影那一格**有 `ms`、有 `attempts: 1`、没有 `failures`、没有 `spent`**。

**演练**（副本里把 `compileTdGame` 的 `not-sent` 那一行**照抄**成 `upstream` 档的样子，只改这一行）：
空凭据 ⇒ 错误上真的挂出了 `[{step:"compile-td-game", target:"td-config", upstream:"messages", ms:1, attempts:1}]`
—— 一笔**一个请求都没上路**的花费。⇒ 票面说的「陷阱」**成立且可复现**。

⚠️ 而且这一格**违反了 `CONTEXT.md` 的词汇表**：`attempts` 的定义是「这一次调用里**往返**了几次」，
`往返` 的定义是「一次 **HTTP**」（`CONTEXT.md:427-429`）—— 没上路的那一档**一次 HTTP 都没有**。

### M5 · 谁钉着现行分类（票面第 5 问）

| 测试 | 钉的是什么 | 与本票的关系 |
|---|---|---|
| `compile-td-game.test.ts:254`（空凭据 ⇒ `kind: "upstream"` + 文案含 `ANTHROPIC_BASE_URL`） | **唯一**钉着真 `not-sent` 对外落点的测试 | ⚠️ 它**没钉账**（`not-sent` 那一格今天没人读）⇒ 只加账**不会**让它变红 |
| `text-op-ledger.test.ts:172` · `compile-runtime.test.ts:168` | 「没配凭据 ⇒ `upstream` + 账**缺席**」 | ⚠️ 这两个走的是**前置守卫**，**不是** `not-sent` 那一档 —— 与本票的改动**无关**（改不到它们） |
| `ops.test.ts:37` | `packAssets` 撞死端口 ⇒ `upstream`/3 | 那是**图像链**（`GenerationError`），与 `callText` 无关 |
| 三处 `not-sent` 抛点 | **没有一条测试** | ⇒ 本票的新行为**没有旧测试挡路** |
| `trip({})` 的幻影 | **没有一条测试** | 同上 |

### M6 · 修法 (a) 的**预演**（副本里只给 `callText` 的 `res.json()` 加 try/catch，逐字对齐 R16 那条）

| 输入 | 改完落点 |
|---|---|
| `text/plain` | `upstream` / 3 · 账 `{attempts:1, failures:["http"]}` ⇒ **账回来了、退出码没变** |
| `null` | ⚠️ **仍然**是 `upstream`/3，但这次**接上了账**、而那一格**没有 `failures`**（因为抛在别处、`trip({})` 没记原因） |
| `[]` / `{"error":…}` | 不变（`invalid`/4 · 3 趟） |

⇒ 只做 (a) **修不掉** `null` / `{"content":5}` 那两张脸（它们抛在**另一个**地方），而且**留着陷阱**
（`null` 那一路一旦接上账，交出的正是 M4 那一格没有原因的空账）。

### 第 1 轮问出去的六问（2026-10-12）

> 六问连同上面的读数已经交给人类（有一份自带裁定表的副本复制到剪贴板）。裁定回来看 `## Answer`。

**Q1 判别 · `not-sent` 只该留给「请求没上路」吗，判据怎么写？**
今天判据是**兜底**（「抛的不是 `UpstreamCallError` 这个类 ⇒ 没发出去」），而 M2 量出它收了三张脸。
四选一：**(a)** 只在 `callText` 里给 `res.json()` 设防（逐字对齐 R16）· **(b)** 在 `onceThrough` 里按内容分
（`callText` 不动）· **(c)** 另加一档（比如 `proxy`）· **(d)** **把判据翻过来**：凭据那一处**点名**成
`not-sent`，其余（含将来任何没设防的抛点）**默认落 `upstream`/`http`**，并把 `null` / `content` 那族形状也一并设防。
➡️ 推荐 **(d)（含 (a) 的设防）**：兜底方向是错的 —— 今天「下一个没设防的抛点」默认被报成「我们没发出去」
（记账撒谎），翻过来默认是「上游没给可用的应答」（记账保守，且与 `UpstreamCallError` 文档逐字一致）。
M6 已证明**只做 (a) 修不掉另外两张脸**。

**Q2 账 · `trip({})` 让 `record()` 说谎是不是 bug？修哪一条？**
M4：是（它顶掉 `spentCall` 自己那句承诺，也顶掉 `CONTEXT.md` 对 `attempts` 的定义）。
修法 **(a)** `not-sent` **不** `trip`（最小；且**结构性**消掉陷阱：`trips` 恒 0 ⇒ `record()` 恒 `null` ⇒
将来谁接上 `ledgerCarrying` 也是 no-op）· **(b)** 让 `spentCall` 自己把「发了」与「试过」拆成两个动作。
➡️ 推荐 **(a)**。附带答一问：`attempts` 的语义是「**上路了几趟**」（词汇表已定，是 HTTP 趟数）——
「试过 1 次、没上路」这个事实**没有家**、也**不该**借 `attempts` 表达；将来真要记，那是另开一格或另一个字段的事。

**Q3 那一族「200 但 body 用不了」落哪一档、要不要重试？两条路要不要对齐？**
M3：`null` / `{"content":5}` 今天**文本链 3、工具链 4 且重试 3 趟**。**(A)** 只修文本链（Q1(d)），
R16 不动 ⇒ 留一处已知不一致 · **(B)** 两边都落 `upstream`/`http`**不重试**（在 `onceThroughTool` 调
`parseToolUse` **之前**加一道「body 不是对象」的前置检查，`parseToolUse` 与它的单元测试**一个字不动**）·
**(C)** 两边都按 R16 现状走（把「body 不是对象」当可重试的线形状失败）。
➡️ 推荐 **(B)**：同一个事实两档正是本票标题那一句；`null` 是代理坏掉的一种，重试三次只是白花钱。
⚠️ 代价要写进裁定：`planAssets`/`compileRuntime` 在「200 + body 不是对象」这一条上，退出码 **4 → 3**、
往返 **3 → 1 次**。⚠️ 同族的第三份实现（`analyze-intent` 自带那一份）**今天已经是对的** ⇒ 只当先例用，
**不合并不重构**那三份实现。

**Q4 两处够不着的 `not-sent` 抛点怎么办？**
M1：`planAssets:221` / `compileRuntime:709` 只为类型收窄而存在（`onceThroughTool` 从不产这一档）。
**(a)** 留着，并把 `planAssets` 已有的那句注补到 `compileRuntime` · **(b)** 删掉两行、给工具链**单开一个
三档的返回类型**（让类型说出事实）· **(c)** 留着 + 加一条见证测试。
➡️ 推荐 **(a)**：本票的边界就是「只做 `not-sent` 这一档」，而删两行换一个共用类型别名，收益（够不着的分支消失）
小于它带来的波及面。

**Q5 手续 · 本票是变更票吗？**
➡️ 推荐：**不是**（若 Q1 落 (a)/(d)）—— 本票是把**代码**改成 `Once<T>` 与 `UpstreamCallError` 的文档
**已经写着的样子**（那两句一个字都不用改），`spentCall` 那句承诺同理。⚠️ **只有 Q1 选 (c)** 时才必须另开变更票
（它顶掉「闭集里没有第三档，别现编」那句）；Q3 选 (B) 若被采纳，**加注即可**（照票 49 的先例：只加注、不改原文、不动 R 表）。

**Q6 见证 · 钉哪几条、变异发几发？**
➡️ 推荐 **4 条新测试**（新文件，既有测试一条不改）+ **3 发变异**：
① `compileTdGame` + 200 非 JSON ⇒ `upstream`/3 **且账里 1 笔 `failures:["http"]`**；② 同上，body 是 `null`；
③ 空凭据 ⇒ **账必须缺席**（变异：把 `ledgerCarrying` 接回 `not-sent`，必须红 —— 这一条钉的是病二修好之后的地基）；
④ 两条路对齐（Q3 选 (B) 才成立）。变异：撤掉 `callText` 的设防 / 把 `trip({})` 加回去 / 判据退回「兜底 = `not-sent`」。

## Answer

**六项全部采纳推荐方案，并落地。** 人离线填的裁定表逐字如下（`## 第 1 轮问出去的六问` 那一轮的答复）：

### 0. 逐字裁定

| 问题 | 我的推荐 | **人的裁定** |
|---|---|---|
| Q1 判别 · `not-sent` 只留「没上路」，判据翻转？ | (d)（含 (a) 的设防） | **(d)**：「凭据守卫**显式标记** `not-sent`；其他未设防异常**默认归** `upstream`/`http`，同时给 `res.json()` 和响应形状设防」 |
| Q2 账 · `trip({})` 的幻影怎么修？ | (a) `not-sent` 不 `trip` | **(a)**：「`not-sent` 不调用 `trip`；`attempts` 表示**实际 HTTP 往返次数**」 |
| Q3 「200 但 body 用不了」落哪一档？ | (B) 两边都 `http`/不重试 | **(B)**：「文本链与工具链**都归** `upstream`/`http`，**不重试** …… 接受明确代价：工具链这类情况**退出码 4 → 3**、**HTTP 往返 3 → 1**。**不合并三份实现**，不改 `parseToolUse` 及其既有测试」 |
| Q4 两处够不着的抛点？ | (a) 留着 + 补注 | **(a)**：「保留 `planAssets` 和 `compileRuntime` 的类型收窄分支，**给后者补注**」 |
| Q5 要不要另开变更票？ | 不要 | **不要** |
| Q6 见证：4 条新测试 + 变异？ | 照推荐表 | 「接受：**新增独立测试文件**中的 4 条测试，并执行对应 **3 发变异**」 |

**附加实施约束（逐字，人类同日给的）**：

1. 错误类别、账目、请求是否上路是**三个独立事实**。不能因为发生了异常就推断没发请求，也不能因为请求发出就把所有异常归成同一类。
2. `callText` 的非 JSON 响应应转为**带 `failures: ["http"]` 的 `UpstreamCallError`**；响应 JSON 解析成功但形状不可用时，也要在访问 `usage`、调用 `.filter` 等操作**前**完成形状校验，避免原始 `SyntaxError`、`TypeError` 泄漏到错误分类兜底。
3. 空凭据**仍然是 `not-sent`：不产生账目**。不能为了记录「尝试过」而**伪造一次 HTTP 往返**。
4. Q6 的变异必须真正验证测试能抓住回归：撤掉非 JSON 设防，①应失败；撤掉形状设防，或恢复错误的兜底判据，②应失败；让 `not-sent` 再次调用 `trip`／生成账目，③应失败；撤掉工具链形状前置检查，④应失败。
5. **不修改任何既有测试**，不添加重试或修复循环，不改票 48 的错误携带接口，也不合并 `analyze-intent.ts` 的独立实现。

> 最终裁定：「六项全部采纳推荐方案。Q3 是本轮唯一**明确改变工具链既有运行行为**的决定；
> 实施时应在票 51 中**加注**该变化及其退出码、HTTP 往返次数的影响，但**不修改原文和 R 表**。」
> ⇒ 加注落在票面 `## Question` 之上、`command.ts` 的 `EXIT` 文档上（见 §1）；**票面原文与 R 表一个字没动**。

### 1. 落了哪些改动

| 文件 | 改了什么 | 对应 |
|---|---|---|
| `packages/assets/src/ops.ts` | 新增**模块私有**的 `NotSentError`（`318`）—— 把「没配凭据、请求真的没上路」从**兜底**变成**点名** | Q1(d) |
| 同上 | `callText` 的凭据守卫改抛 `NotSentError`（`343`）—— **文案一字未改**（既有测试 `compile-td-game.test.ts:254` 匹配 `/ANTHROPIC_BASE_URL/`） | Q1(d) |
| 同上 | `callText` 的 `res.json()` 包 `try`（`373-374`）⇒ `UpstreamCallError("http", 上游回的不是 JSON：…)`，**与 `onceThroughTool` / `analyze-intent` 那两份逐字对齐** | Q1(d) 的设防 · 约束 2 |
| 同上 | `callText` 新增**形状设防**（`381-382`）⇒ 不是对象（`null`/`[]`/`123`/`false`/`"abc"`）落 `UpstreamCallError("http", …不是一个 messages 应答…)`；`content` 归一化 `Array.isArray(j.content) ? j.content : []`（与 `parseToolUse` 同一条归一化 ⇒ 两条路**同判**） | 约束 2 · Q3 |
| 同上 | `onceThrough` 的 catch **翻过来**（`448-450`）：`NotSentError ⇒ not-sent`，**其余默认 `upstream`**（`failure` 取不到时落 `"http"`） | Q1(d) |
| 同上 | `onceThroughTool` 在 `parseToolUse` **之前**加一道「body 不是对象」的前置检查（`144-152`）⇒ `upstream`/`http`、**不重采样**；⚠️ `parseToolUse` 与它的单元测试**一个字没动** | Q3(B) · 约束 5 |
| 同上 | `compileTdGame` 的选择子：`not-sent` **不 `trip`**（`1038-1041`，把 `? {}` 那一臂整个拿掉）；抛点那句**原样保留**（`1042`） | Q2(a) |
| 同上 | `compileRuntime` 的 `not-sent` 那一行**补上 `planAssets` 已有的那句注**（`773-782`） | Q4(a) |
| `packages/contracts/src/command.ts` | `EXIT` 文档加**带日期的注**：这一族退出码 4 → 3、往返 3 → 1，理由与边界（`{"content":5}` 不在其中） | 加注要求 |
| `packages/assets/tests/not-sent-bucket.test.ts` | **新文件**（既有测试**一条没改**） | Q6 |

⚠️ **`Once<T>` 与 `UpstreamCallError` 的两段文档一个字都没改** —— 这正是 Q5「不是变更票」的那个理由：
**改的是代码，让它变成文档已经写着的样子**（`"not-sent"` = 我们这边没发出去、账上也不该有这一笔；
`http` 档的定义本来就含「body 不是 JSON」）。

⚠️ **一处自主判断（不在六问里，报备）**：`isResponseObject` / `describeShape` 这一对判据我**写在 `ops.ts` 里**
（`327-331`），**没有**从 `contracts/structured-call.ts` 导出那一对同义的私有函数（`isRecord` / `describe`）。
理由：本票的边界只到 `not-sent` 这一档，为一个两行判据去**扩大一个边界外包的公开面**、并碰到那份被钉住的模块，
收益小于波及面（注释里点名了两者是**逐字同义**，防止将来两边悄悄分岔）。⚠️ 代价明写：**这份等价靠注释维持，
不是靠类型**—— 若将来 `structured-call` 那份改了判据，这里**不会**跟着变。

⚠️ **行号漂移**（施工后 `grep` 数出来的）：`ops.ts` **1487 → 1568 行（+81）**，凡 **141 行之后**的引用一律向后漂：
`221→232`（`planAssets` 的 `not-sent`）· `281-282→292-293`（`UpstreamCallError` 文档）· `324→373`（`callText` 的 `res.json`）·
`349-351→409-411`（`Once<T>` 文档）· `379-384→447-452`（`onceThrough` 的 catch）· `432→499`（`spentCall` 的那句承诺）·
`709→782`（`compileRuntime` 的 `not-sent`）· `952→1025`（`onceThrough` 的调用）· `957-960→1038-1041`（选择子）·
`961→1042` · `988→1069`（票 49 那个 catch）· `1005-1006→1086-1087`（票 49 的 `carryOnError` + `throw`）。
⚠️ `139-141`（`onceThroughTool` 的 json 守卫）**不动**。

### 2. 见证与变异

**新文件 `packages/assets/tests/not-sent-bucket.test.ts` · 5 个 `describe` / 11 条**，把三个事实**分开钉**
（约束 1）—— 同一份 200 的非 JSON 体：①说它是**上游的锅**、②说这一笔**真花了**、③说它**只发了一趟**：

| # | 钉的 | 断言（一起查，不是挑一个） |
|---|---|---|
| ① | 200 + 非 JSON（旧文本链） | `kind: upstream` · 退出码 **3** · 账**一格** · `failures: ["http"]` · `attempts` **1** · **桩那一侧也只被调了 1 次** · 文案说得出「上游回的不是 JSON」 |
| ② | 200 + 合法 JSON 但**不是对象**（表驱动 4 例：`null`/`[]`/`123`/`"abc"`） | 同上（文案换成「不是一个 messages 应答」） |
| ②附 | `{"content":5}`（是对象、字段形状不对） | **照旧 `invalid`/4、往返 3 趟** —— 钉的是**设防的边界**不许被顺手放大 |
| ③ | 空凭据（**真 `not-sent`**） | `upstream`/3（对外口径不变）· **账 `undefined`** · **桩一次都没被调**（这才是账缺席的**理由**） |
| ④ | 两条路对齐（Q3 = B） | body `null`：文本链与工具链**同 kind · 同退出码**，工具链**只发 1 趟**；`planAssets`（共用那条实现）同判；反向 `{"content":5}` 两边都 4 |
| ⑤ | **判据本身**那一臂 | 一个**绕过守卫**的抛点（HTTP 头回来了 500、读 body 时才断）也默认落 `upstream`/`http`、**照样带账** |

**变异（6 发，跑法见下面的归档脚本）**：

| # | 变异 | 结果 |
|---|---|---|
| ① | 撤掉 `callText` 的非 JSON 设防 | 🔴 红（1 条） |
| ②a | 撤掉 `callText` 的形状设防 | 🔴 红（4 条） |
| ②b | 判据退回「兜底 = `not-sent`」 | 🔴 红（1 条 —— **只红 ⑤**） |
| ③a | `not-sent` 只加回 `trip`（不动抛点） | ⚪ **没红**（见下） |
| ③b | `not-sent` 加回 `trip` **且**照抄 `upstream` 档挂账 | 🔴 红（1 条） |
| ④ | 撤掉工具链的「body 不是对象」前置检查 | 🔴 红（2 条） |

⚠️⚠️ **③a「没红」是本票最该记下来的一条读数，它不是测试写漏了**：只 `trip` 不挂账时，
那一格幻影**从外面观察不到**（`not-sent` 那个 `CommandError` 根本**不带**账）——
这正是票面把它叫「**陷阱**」的原因：它要等**下一个人照着 `upstream` 档照抄**才害人，而 **③b 就是那次照抄**。
⇒ 所以 ③ 钉的是**结果**（账必须缺席），而修法是**结构性**的（不 `trip` ⇒ `trips` 恒 0 ⇒ `record()` 恒 `null`
⇒ 将来谁接上 `ledgerCarrying` 也是 no-op）—— **陷阱是被消掉的，不是被绕开的**。

⚠️ **②b 只红 ⑤，是我加了第 5 条测试之后才成立的**：①②那几张脸都被 `callText` 的守卫**提前**收成了
`UpstreamCallError`，判据那一步**根本轮不到** ⇒ 第一次跑变异时 ②b **没红**，人类那句「恢复错误的兜底判据，②应失败」
在当时的测试上**兑现不了**。⑤ 就是为这一臂补的：它让一个抛点（头回来了、读 body 时才断）**绕过**守卫、
真正走到默认那一臂上 ⇒ Q1(d) 翻转的那一半从此**有条测试钉着**（没有它，那一半**一条见证都没有**）。
⚠️ 这与「4 条测试」的推荐只差一条，**报备**：多出来的第 5 条是**约束 4 逼出来的**，不是顺手加的。

**归档的见证**：`.scratch/game-maker-v2/experiments/not-sent-probe/` —— 第 1 轮的探针（M1–M6 那批读数）
\+ `run-mutations.py`（上面这 6 发的**可复跑**版本，逐发在场断言补丁点、跑完 sha256 校验还原）
\+ `README.md`（含「两发要解释的」那一节）。⚠️ `run-mutations.py` **就地改真源码再还原**，只在**没人并跑**时跑。

### 3. 邻居与派生

- **两处够不着的抛点留着**（Q4 = a）：`planAssets:232` / `compileRuntime:782` 读的是 `onceThroughTool` 的返回值，
  而那条路的出口**只有三档** ⇒ 它们只为类型收窄而存在，⚠️ **不是 `not-sent` 的生产者**
  （`not-sent` 唯一的生产者仍是 `onceThrough` 的 catch，唯一调用方仍是 `compileTdGame`）。给后者补注。
- **`attempts` 的语义定死**（Q2 附带那一问的答复）：「**上路了几趟**」（`CONTEXT.md:427-429`：往返 = 一次 HTTP）。
  「试过 1 次、没上路」这个事实**没有家**，也**不许**借 `attempts` 表达 —— 将来真要记，另开一格或另一个字段。
  ⇒ `CONTEXT.md` **一个字没动**（它本来就写着这个意思，是代码说错了）。
- **三份实现不合并**（约束 5）：`analyze-intent.ts:147-196` 那份**只当先例**用（它今天已经是对的）；
  `onceThroughTool` 与它、与 `callText` 的**结构差异照旧**。⚠️ 那是一个仍然立着的**分岔点**（本票不碰）。
- **票 50 不受影响**：本票只到 `CommandResult` / 异常那一层，**两个壳印出来的字**仍然**没有一条测试**
  （票 50 正是为那件事开的）。⚠️ 本票**加了**一个此前不存在的对外差异面：壳上「空凭据」与「200 + 非 JSON」
  现在**都带账**（前者不带、后者带），而壳怎么印它**没人钉**。
- **没有新票**（Q5：不是变更票）。Q3(B) 的代价按裁定**加注**（本票 §0 之上 + `command.ts` 的 `EXIT`），
  **票面原文与 R 表一个字没动**。

### 4. 闸门

- `pnpm typecheck` 绿 · `pnpm test` **1258/1258（76 文件）**（此前 **1247/75** —— **+11**，即新文件那 11 条）
  · `pnpm check` 绿（依赖图 · 链接 194 份文档/1104 条 · build）。
- ⚠️ **没有一条既有测试需要改**（`git status` 只列出 `ops.ts` · `command.ts` · 本票 · 新测试文件 + 探针目录）
  —— 即既有测试**从没断言过**「200 + 非 JSON ⇒ 不带账」这个旧行为，那条旧行为**本来就没有见证**（M5 已量）。
- ⚠️ **一处顺手修的（报备）**：第 1 轮归档的探针文件原来叫 `probe.test.ts`，而它就在 `.scratch/` 里
  ⇒ **vitest 默认扫 `**/*.test.ts`**，`pnpm test` 把它当一条真测试收走、然后因为找不到 `../src/` **整个套件变红**。
  已改名成 `probe.test.ts.txt` 并同步了 README 的跑法（那份跑法本来就要求拷进 `packages/assets/tests/`）。
- ⚠️ **本票没做**：没有重试 / 修复循环 / 自动重生成（R13 边界不动）· 票 48 的 `carryOnError`/`ledgerOfError`/
  `failureDirOfError` **形状一行没动** · **图像链**（`GenerationError`）**一行没碰** · `packages/qa` 与
  `game-maker.local.json` **一个字没动** · **零次付费运行**（全部走 `fetchImpl` 桩，一张图未买）。
- ✅ **51 关。**

