# 06. 共享的文本调用没有超时

Type: task
Status: resolved
Owner: amber（2026-09-29 认领）
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

## Answer

**✅ 2026-09-29 已决议。** 四条决定都落下来了，而这一票**真的量出了东西** ——
包括一条与票面想象的不一样的发现。

### 实测（这一票的活干在这）

`callText` 家族的真实耗时 —— 而这些数**是刚现量的**，因为：

> ⚠️ **`compile` 与 `derive` 的账从来没落过盘。** 仓库里 330 笔 `ledger.json` 记录
> **全是 `drawlist`**（那条路走 `createDrawListGenerator`）。`derive` 把账放进 `data.ledger`
> 但**不写文件**，`compileGame` **连放都不放**（见下 Q4）。

| 调用 | 耗时 | 备注 |
|---|---|---|
| `derive`（产出最大的一份：21 个资源的整份清单） | **10.8s** | `--json` 里读 `data.ledger` |
| `compile-game`（横版那份 game-config） | **4.5s** | 时钟量的（它不落账） |
| 塔防那份提示词（含 18 行地图的 td-config） | **6.2s / 6.7s** | 票 05 的原型 |
| 同一上游的 `drawlist`：330 笔 | **最长 23.0s · 中位 3.0s** | 包里的 `ledger.json` |

### 四条决议

| # | 决定 | 依据 |
|---|---|---|
| Q1 | **180s，与 `pack` 对齐**，并从 `generate.ts` 里的字面量提成一个**命名常量** | 观测最大值 23s ⇒ 180s 是它的 **~8 倍**。⚠️ 超时**宁可松不可紧** —— 过紧会把一次**本来会成功**的调用变成 `upstream` 错误，比没有超时更糟。它是**每次尝试**的超时（compile/derive 各试 2 次）⇒ 最坏 6 分钟，有界 |
| Q2 | 超时值**做成参数**（`callText({…, timeoutMs?})`，默认那个常量） | 要测「上游不响应 → 超时」，180s 的默认值在测试里就是跑 180 秒。**不这么做，「超时」这条路径测不了**，而测不了的东西下次会被改坏 |
| Q3 | 在 **`callText` 里补一条真检查**（`baseUrl` 为空 → 抛出那句好话），既有的 `!opts.transport` 留着 | 见下 |
| Q4 | **新的 `compileTdGame` 要落账**（像 `derive` 那样进 `data.ledger`）；**`compileGame` 那条不动** | 与 Out of scope 里「不顺手重构横版那条」同一条理由 |

### ⚠️ 票面第 4 问的答案：那句**不是防线，是一句摸不到的好话**

`compileGame` 里写着：

```
if (!opts.transport) throw new CommandError("upstream", "编译需要文本上游；它现在不可达（配置是文件，人可以直接写一份）")
```

**它的内容是好的** —— 它点出了出路。但它是**死代码**：

- 两个壳（CLI 一处 + `mcp/server.ts` **三处**）永远传一个**定义了、但 `baseUrl` 可能是空串**的对象
  （`process.env.ANTHROPIC_BASE_URL ?? ""`）；
- 于是 `opts.transport` 恒为真，**这句从来不会触发**；
- fetch 先失败，用户看到的是一个**原始 fetch 报错**。

⇒ **需要这句话的那条路，摸不到这句话。** 所以不是「删掉还是留着」的问题，
是**防线站错了地方**：它防的是「库调用方不传」，而真正会发生的失败是「传了但配错了」。
补在 `callText` 上之后，**所有调用方一起受益**（`derive` 也一样）。

⚠️ 而这也解释了为什么票 01 那次 `derive` 跑得那么顺 —— 环境配好了，谁也不会走到这一支。

### 产物

没有文件产物 —— 这一票产出的是**实测与决定**。实现（给 `callText` 加超时与那条检查）
落在图走完之后，与 `compileTdGame` 一起。
