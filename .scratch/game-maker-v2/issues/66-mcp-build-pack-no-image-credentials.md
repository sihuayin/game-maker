# 66. MCP 的 `build_asset_pack` **永远读不到生图凭据** —— 带 `source.kind:"image"` 的清单走它一律退 2，而上游桩一次都没被打到

Type: grilling
Status: resolved
Owner: claude (2026-10-13 · 立案 + 裁定 + 施工；**关票由人裁指令**（「关票 66」）—— ⚠️ **关的是票，不是提交**：工作树仍是那两处改动，本 session 没有提交授权)
Blocked by: —
Map: ../map.md

> 派生自[票 50「两个壳读『异常上带的东西』那几条路，一条端到端测试都没有」](50-shell-reads-carried-ledger.md)
> 的第 1 条（**MCP 那半边**的壳级见证）—— 那一半**今天写不下去**：要撞上「判断失败」得先真发给生图上游一次，
> 而 MCP 这条路**在生图之前就退 2 了**。
>
> ⚠️ **本票不是票 50 的「善后」**：它是票 50 施工时**量出来的**一件**独立缺陷** ——
> 票 50 的边界写着「只加测试 · 不许把任何生产代码牵进来『为了好测』」，所以**修它不是票 50 的事**，
> 而**立票是**。⇒ 票 50 `Blocked by: 66`（那条见证要等这里修完才写得出来）。

## 1 · 立案现场（**读出来的**，不是推出来的）

票 50 起了一个**活着的**上游桩（HTTP 200 · 一张**完全合法**的 16×16 全透明 PNG），
把四样凭据设全，走**真正的** stdio 服务（`packages/mcp/dist/server.mjs`）发一条 `tools/call`：

```
GAME_MAKER_IMAGE_PROTOCOL=openai
GAME_MAKER_IMAGE_BASE_URL=http://127.0.0.1:<桩>/v1
GAME_MAKER_IMAGE_API_KEY=k
GAME_MAKER_IMAGE_MODEL=m
→ tools/call  build_asset_pack { recipePath: <一份 assets:[{source:{kind:"image"}}] 的清单> }
```

回执：

```json
{"jsonrpc":"2.0","id":2,"result":{
  "content":[{"type":"text","text":"✗ 这份清单里有 source.kind=\"image\" 的资源，但**没配生图凭据** —— 写 game-maker.local.json（已 gitignore）或设 GAME_MAKER_IMAGE_* 环境变量。"}],
  "isError":true,
  "_exitCode":2}}
```

`structuredContent` **是 `undefined`**。**三件事一起看**才说明问题：

1. `_exitCode: 2` 是 **usage** 那一档（`EXIT.usage`）—— 不是上游失败（3），也不是判断失败（1）。
2. ⚠️ **桩被打了 0 发** —— 不是「请求失败了」，是**根本没发出去**。
3. ⚠️ 那句 advice **说的正是已经做完的事**：「写 game-maker.local.json…**或设 `GAME_MAKER_IMAGE_*` 环境变量**」
   —— 而环境变量**已经设好了**、桩**就在那儿**。

⇒ 这不是文档没说清，**是这个工具从没把它读到的凭据递下去**。

⚠️ **同一个桩、同一份清单，CLI 那条路走得通**（票 50 的 CLI 半边：退出码 **1** · 账上有那一笔 · 现场在盘上）
⇒ 差别不在凭据、不在清单、不在上游，**只在壳**。

## 2 · 病因（一行，念出来就完了）

`packages/mcp/src/server.ts` 的七条工具调用里，**只有 `create_game` 把它递下去了**：

| 位置 | 工具 | 有没有把生图凭据递下去 |
|---|---|---|
| `server.ts:238-244` | **`build_asset_pack`** | ❌ **没有** —— 只传 `recipePath` / `outRoot` / `transport`（**文字**那一路）/ `onProgress` |
| `server.ts:269-275` | `create_game` | ✅ `...(imageTransportOf() === undefined ? {} : { imageTransport: imageTransportOf()! })` |
| `server.ts:232-236` · `:250-256` | `plan_assets` · `compile_runtime` | ➖ 不需要（这两条**只有文字**调用） |

而 `imageTransport` 是**必需品**不是优化项：`packAssets` 遇到清单里任何 `source.kind:"image"`
就直接 `CommandError("usage", …没配生图凭据…)`（`ops.ts:1375-1378`，判据逐字是
`needsImage && !opts.imageTransport`）—— **在发出第一发之前**。

⇒ **`build_asset_pack` 对「真生图」这一类清单是**彻底不可用**的**，而真生图正是你会去调它的原因
（`plan_assets` 产出的清单里 `source.kind:"image"` 是常规项）。

## 3 · 它为什么活到今天（两件，各自独立）

1. **没有任何东西在它上面跑过**：`packages/mcp/tests/server.test.ts` 的「工具调用」那一组
   （`:93-118`，共 3 条）只驱动 `inspect_asset_pack`（×2）与 `verify_asset_pack` 的 **usage/2** 一档；
   `build_asset_pack` 在**测试里只被当字符串读过**（`:69` 工具名清单 · `:77-79` description 断言）
   ⇒ 它**从没被调用过**，而真生图的清单**必须**有凭据才跑得动 ⇒ 一个自证的死循环。
2. ⚠️ **就算今天补一条测试，也不许把现状写成「预期」**：一条断言「它退 2」的测试是把 bug 钉成规矩
   ⇒ 修与测要一起来（见 §4 的 Q1 / Q3）。

## 4 · 要裁的三件（本票出口）

> ⚠️ **第一轮的完整提问（自包含 · 含每条推荐的取舍）住
> [clarifications/66-round-1.md](../clarifications/66-round-1.md)** —— **只有那一份**，这里只列题目，措辞不重述。
> 那张末尾的裁定表填完，本票的 `## Answer` 就能落。

- **Q1 · 修法**：照 `create_game` 那一行补 `imageTransport`？还是把「解析生图凭据」收成 MCP 侧的**一个**入口
  （今天 `imageTransportOf()` 在 `:64-67`，只被 `create_game` 用；补上之后**两个**工具共用）
  —— 还是别的做法？
- **Q2 · 那句 message**：`ops.ts:1376` 那条 `CommandError("usage", …没配生图凭据…)` 对**今天这一档**
  （凭据配了、壳没递）是**误导**（把人指向已经做完的事）—— ⚠️ 而它的判据明明是
  `!opts.imageTransport`（**这一次调用没被递到**），文案却写成「**你没配**」。
  ⇒ 要不要区分「**凭据没有**」与「**凭据没递到**」？⚠️ 这牵到「壳有没有如实转述 core 的判断」这条线
  —— 与票 50 盯的那件事（壳怎么读异常上带的东西）是**同一族**，但**不同一格**。
- **Q3 · MCP 的壳级见证怎么写**（⚠️ **这一问挡着票 50**）：CLI 有 `deps.env` / `deps.fetchImpl`
  （票 16 开的那道口子），而 MCP 的 `handle(msg, emit)` **一条注入口都没有** —— 只读
  `process.env` / `process.cwd()`（`:64-67` · 各 `case` 里的 `process.env.ANTHROPIC_*`）
  ⇒ MCP 的判据只能**改进程全局**（测试里 save/restore），或者**给 MCP 开一道与 CLI 同形的口子**。
  ⚠️ 后者是**改生产代码的形状**，所以要先裁，不能在票 50 里顺手做。

## 5 · 边界（本票**不做**什么）

- ⚠️ **本票只出决定** —— 修与测随本票的裁定**另起施工**，**不许**在读这张票的 session 里顺手修
  （与票 65 同款纪律：**立票 ≠ 批准施工**）。
- 零付费：§1 那份证据是**本地桩**，一笔上游调用都没有。
- 不动提示词 · 不动契约 · 不动 R 表 · 不动 `packages/qa` · `game-maker.local.json` 一个字不动。
- 不借本票扩大票 50 的范围（票 50 = **只加测试**；它的 CLI 半边已完成）。

## Comments

- **2026-10-13 · 立案（票 50 施工 session）**：证据脚本一次性、自包含、可重跑
  （起桩 + 走 stdio 真服务 + 打印回执与**桩的命中数**）。⚠️ 这条口径值得沿用：
  **「桩被打了 0 发」比「回了一条错」有力得多** —— 它把「请求失败」与「根本没发」分开
  （票 55 / 票 60 那两处立案用的也是这个读法）。
  ⚠️ **该脚本没有入库**（住那次 session 的临时目录）—— 若施工时要复用，**重写比找回便宜**
  （它的全部内容就是 §1 那四行环境变量 + 一条 `tools/call`）。

## Answer

### 裁定（人裁 2026-10-13 · **原话逐字**）

| 题                  | 裁定                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Q1：修法              | (a) 只在 `build_asset_pack` 这一处补传现成的 `imageTransportOf()`，与 `create_game:272` 保持同形。不抽取 MCP 共用助手，不把凭据解析移进 core。 |
| Q2：错误 message 是否改口 | (a) 不动。 修复后，现有判据 `needsImage && !opts.imageTransport` 对应的就是本次调用确实没有收到生图凭据的情况。本票不额外增加壳级自检，也不改 `ops.ts` 的文案。   |
| Q3：MCP 壳级测试如何注入    | (a) 测试自行保存并恢复 `process.env`，不改变 MCP 生产代码的接口形状。环境变量应在调用 `handle(msg, emit)` 前设置，并在 `finally` 中恢复，避免污染其他测试。    |

### 补充裁定与边界（人裁原话，逐字）

> 1. 修复与回归测试必须一起施工。 不能只验证工具名、description 或 usage 错误；必须通过真实 MCP stdio 服务调用 `build_asset_pack`，证明合法的 image recipe 能通过凭据检查，并到达本地 HTTP 桩。
> 2. 测试需要证明实际发生了请求。 使用本地桩返回合法的 16×16 全透明 PNG，断言桩收到请求，并验证调用不再因缺少 `imageTransport` 而返回 usage/2。不能把「没有出现原来的错误文案」单独当作通过。
> 3. 测试隔离必须可靠。 保存并恢复测试涉及的 `GAME_MAKER_IMAGE_*` 变量及相关上游配置；即使断言失败，也必须恢复环境。使用本地桩，不产生付费上游调用。
> 4. 不扩大票 66 的范围。 不改 MCP 接口、不抽取共用助手、不调整 core 凭据解析、不改提示词、契约、R 表或 `packages/qa`；`game-maker.local.json` 保持不动。
> 5. 当前仅为设计裁定。 修复与测试仍需另行施工授权。完成后应报告实际请求次数、MCP 返回结果、测试和相关闸门结果；不得仅凭测试通过就自动提交或关闭票据。

**核心判断**： 这是 MCP 壳漏传已有依赖的问题，不是凭据配置问题。修复最小的传递断点，并用本地桩证明整条 MCP 调用路径确实发出了请求。

### 状态与下一步（**施工未授权** —— ⚠️ 已被下面那节《施工》取代，留在这里只为记「当时预告了什么」）

⚠️ **本票只落了决定**（边界 5 逐字：**修复与测试仍需另行施工授权**）⇒ 这一轮**没有碰
`packages/mcp/src/server.ts` 一个字节**、**没有新增/改动任何判据**、**没提交**、**票不关**
（边界 5 末句逐字：「不得仅凭测试通过就自动提交或关闭票据」）。
⇒ [票 50](50-shell-reads-carried-ledger.md) 的 `Blocked by: 66` **照旧有效**（它要的是修完之后那条见证）。

⚠️ **拿授权时要一并交出去的两处口径**（施工时才有答案，**不是**新问题、**不重开裁定**）：

1. **边界 1 的「真实 MCP stdio 服务」是本仓今天没有的那种判据**：既有 MCP 判据全是**进程内**驱动
   `handle(msg, emit)`（`server.test.ts` 的 `drive()`），而立案取证那次是
   `spawn node packages/mcp/dist/server.mjs` 走真 stdio。⚠️ 按字面落 ⇒ 这是**第一条从外部驱动 built 服务**的判据
   ⇒ 它**依赖 `dist`**（本仓那个老陷阱：消费方读 built 产物，判据前必须 `pnpm build`）。
2. **边界 2 的「证明实际发生了请求」正好排掉了那种假牙**：「原来那句文案不见了」**不算过** ——
   要断言的是**桩收到了请求**（我立案取证用的就是这个读数：**桩被打了 0 发**才是那一档的病）。
   ⚠️ 与票 50 那条见证的口径一致：**桩的命中数**比「回了一条什么」有力得多。

### 施工（2026-10-13 · claude · 人裁「就是施工授权，开工」）

⚠️ **改了两处，没有第三处**：

| 位置 | 改动 |
| --- | --- |
| `packages/mcp/src/server.ts:248` | `case "build_asset_pack"` 里补一行 `...(imageTransportOf() === undefined ? {} : { imageTransport: imageTransportOf()! }),` —— 与 `:279`（`create_game`）**逐字同形**（Q1 = (a) 原话：「不抽取 MCP 共用助手，不把凭据解析移进 core」）。同处 6 行注释写明**为什么**：它是必需品不是优化项 |
| `packages/mcp/tests/build-pack-stdio.test.ts` | **新文件** · **1 条判据**：走**真 stdio 服务**（边界 1）⚠️ 文件后来改名过一次（`build-pack-credentials` → `build-pack-stdio`）：[票 50](50-shell-reads-carried-ledger.md) 那半边的判据**与这一条共用同一个失败现场**、并了进来 —— 见 [票 50](50-shell-reads-carried-ledger.md) §⑨ |

⚠️ `packages/assets`（core）**一行未动** ⇒ 那句 message 一个字没改（Q2 = (a)）· MCP 的接口形状**一个字节没动**
（`handle(msg, emit)` 签名照旧、没加 deps 口子 · Q3 = (a)）。

#### 实测读数（边界 2 与边界 5 点名要报的那三样）

修好之后跑一次真 stdio 调用，桩收到的东西**逐字**：

```
POST /v1/images/generations
authorization: Bearer k
body: {"model":"m","prompt":"…这个物体是：一个木箱。（箱子）…"}

回执  isError: true · _exitCode: 1（**判断失败** —— 不是 usage 2、不是上游 3）
      content: "✗ 资源 \"crate\" 生出来的图**一个不透明像素都没有**（16×16 全透明）…"
      ⚠️ **桩被打了 1 发**（立案时是 **0** 发）
```

⇒ 「凭据被一路递到了上游」**不再是一条推断**：三处独立读数各说一遍 —— 请求真的落到了桩上 ·
请求里带着**我们注入的那把钥匙**（`Bearer k`）与**我们这份配方**（`一个木箱`）· 调用从 usage 那一档挪到了判断失败那一档。

⚠️ 判据钉的是「命中数**恰好 1**」而不是「≥1」：第二层意思是**这条链上没有藏着重试**（R13）——
真加了的话，「打了个透明图就重发」会当场把这一条打红。

#### 两发变异（各自红在**同一处** —— 桩的命中数；逐发**逐字节**还原并 `cmp` 过，随后复核 **1/1 绿 ×3**）

| 发 | 变异 | 读数 |
| --- | --- | --- |
| **M1** | 把那行**整段摘掉**（回到立案时的样子） | 红 1：`桩被打的**命中数**: expected +0 to be 1` —— **正是票面那个 0 发** |
| **M2** | 传了 —— 但传的是**另一份**凭据（`baseUrl` 指向死端口） | 红 1：同样 `+0 to be 1` ⚠️ **「有个 truthy 的东西被传下去」蒙不过去** —— 判据钉的是「请求真的落到了**那个**桩上」，不是「有个对象」。这一发是**为这一条判据加的**（人裁只要求证明请求发生；它是量给「判据够不够硬」看的） |

#### 两处口径决定（**施工时才有的答案** —— 不是新问题、不重开裁定）

1. ⚠️ **边界 1 的「真实 MCP stdio 服务」，我落成「测试里现 bundle 当前 `src` 再 spawn」，而不是 spawn `dist/server.mjs`。**
   理由是一处**实测**：根 `package.json` 的 `test` 是 `vitest run`（**不 build**）⇒ 直接跑 `dist/server.mjs`
   是在**赌**那份 dist 是新的 —— 而本仓那个陷阱记过三次（票 09 / 55 / 61）：**改完 `src` 不重建，
   判据读的就不是你改的那份代码**，而且它还会**绿**。现 bundle 当前 `src` ⇒ 判据**在结构上**钉在这次改的那行上。
   ⚠️ 三项配套：旗子与 `packages/mcp/package.json` 那条 `bundle` 脚本**逐字同形** · 落点**必须**叫 `server.mjs`
   （入口守卫 `server.ts:364` 按文件名认，名字不对就一声不响）· esbuild 从**仓根** require 解
   （它是根的 devDependency，从 `packages/mcp` 里 `import` 解析不到 —— `bundle` 脚本同样只因为 hoist 才跑得动）。
   ⚠️ 它**刻意不写成 `skipIf(解不到 esbuild)`**：那会把唯一一条见证变成一条永远不跑的**绿** —— 正是本票 §3 记的那种病。
2. ⚠️ **边界 3 的「保存并恢复 `process.env`」，我落成「父进程一个字节都不动」**：凭据注入在**子进程的 env** 上
   （`spawn(..., { cwd, env })`）⇒「即使断言失败也必须恢复环境」**在结构上**成立（没有可恢复的东西），
   也不会污染同一次 `vitest run` 里的别的文件。⚠️ 这比 save/restore **更强**，不是偏离：Q3 = (a) 的原话
   （「保存并恢复 `process.env`…在 `finally` 中恢复」）说的是**进程内 `handle(msg, emit)`** 那条路，
   而边界 1 把这条路推到了**真 stdio** ⇒ 注入口就是子进程的环境。
   ⚠️ 另加两手：`cwd` 指到**临时目录** ⇒ 仓根那份 `game-maker.local.json`（若存在）**不可见**，
   判据只认注入的那几样、不吃本机状态；文字上游指**死端口** ⇒ 这条链若偷发一次文字调用会以 **3** 而不是 1 红
   （那一红正是要看见的）。

#### 闸门（六道 · 全绿）

`npx tsc -b --force` 干净 · `pnpm build` 干净 · `pnpm typecheck` **9 包** · `pnpm test` **1391/1391（83 文件）** ·
`check:deps` ✅ 9 包 · `check:links` ✅（235 份文档 · 1274 条链接）· **零付费**（喂的全是**本地桩**，一笔上游调用都没有；
文字上游是死端口 —— 不是「省着没跑」，是压根没有可花的钱）。

#### 边界清点（照人裁 1–5 逐条）

**不改 MCP 接口** ✅ · **不抽取共用助手** ✅ · **不调整 core 凭据解析** ✅ · **不改提示词 / 契约 / R 表 /
`packages/qa`** ✅ · `game-maker.local.json` **一个字没动** ✅ · `.scratch/**/experiments/` 现场**只读** ✅ ·
**未提交** ✅ · **票不关** ✅（边界 5 末句逐字）。

#### ⚠️ 这一票修完之后解开的一处（**记给票 50，不是本票的判据**）

同一次 stdio 调用里**顺带读到**：`structuredContent.ledger` 有那一笔
（`step: "image" · target: "crate" · attempts: 1 · upstream: "openai"`）、`failureDir` 指到一个**真在盘上**的目录
—— 也就是说[票 50「两个壳读『异常上带的东西』那几条路」](50-shell-reads-carried-ledger.md)的 **MCP 那半边，今天写得出**了。
⚠️ **但我没有写它**：那是**票 50 的工作**（它自己的边界「只加测试」· 两种面 · 逐条变异），
写在这里就是**扩大票 66 的范围**（边界 4）。⇒ 这一处**只**作为给票 50 的读数记在这里；
本票的判据**只**钉边界 1–2 要的那三样。⚠️ 而票 50 的 `Blocked by: 66` **照旧有效** ——
它等的是本票**关票**，而关票权在人手里（边界 5）。

### 关票（2026-10-13 · 人裁指令「关票 66」）

⚠️ **关的是票，不是提交** —— 这两件事本票一直分开：边界 5 那句「不得仅凭测试通过就**自动**提交或关闭票据」
管的是**自动**；这一票的关票是**人给的指令**，而**提交照旧没有**（工作树仍是那两处：
`M packages/mcp/src/server.ts` · `?? packages/mcp/tests/build-pack-stdio.test.ts`，一个 commit 都没落）。
⚠️ 本 session **始终没有提交授权**。

⇒ 这一票关掉之后：[票 50](50-shell-reads-carried-ledger.md) 的 `Blocked by: 66` **解冻**，
而人裁同一句指令里跟着的就是「**开票 50 的 MCP 那半边**」。
