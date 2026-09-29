# 06. 共享的文本调用没有超时

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> Destination 第一句是「**一条命令**」。一条会无限挂起的命令不算跑得完。

## Question

`callText`（`packages/assets/src/ops.ts:140–165`）**一个超时都没有** ——
它没有 `AbortController`、没有 `timeoutMs`，模型卡住就是无限等。
`pack` 那条有（180 秒，`generate.ts`），`compile` 这条没有。

要答的几件：

1. **加多少**？与 `pack` 的 180s 对齐，还是别处另有一个更合适的数？
   ⚠️ 注意 compile 的产物比 drawlist 大得多（一张 32×18 的地图 + 全部塔/敌/波次），
   180s 是不是够，**最好是一条实测而不是猜**（真跑一次，看它花了多久）。
2. **超时算哪种 `CommandError`**？`upstream`（3）最贴切 —— 它是上游的问题，
   而且 CLI 已经把它与 `invalid`（4）分开了。
3. **它会同时改变 `compileGame` 的行为** —— 那是好事（两条 compile 一起受益），
   要不要在 `compile-game.test.ts` 里补一条「上游不响应 → 超时 → `upstream`」的测试？
   （`fetchImpl` 注入那套已经现成。）
4. ⚠️ **顺带确认一件事**：`compileGame` 里那句
   `if (!opts.transport) throw new CommandError("upstream", …)` **在生产里永远不会触发** ——
   两个壳（CLI / MCP）总是传一个**定义了但可能 baseUrl 为空**的对象，
   于是它落到 fetch 上去失败。这句是死代码还是防线？**这一票要顺手定一个说法**，
   免得下一个人以为它兜住了什么。

## Answer

（未决）
