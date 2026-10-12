# 51. `not-sent` 那一档两头都不准 —— 上游回了非 JSON 被报成「我们没发出去」，而它自己会让账里多出一笔没上路的花费

Type: grilling
Status: open
Owner: —
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
