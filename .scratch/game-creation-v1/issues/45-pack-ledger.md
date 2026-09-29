# 45. 把「花掉的」记下来 —— 三类调用记账，写成包内的 ledger.json

Type: task
Status: resolved
Blocked by: —
Map: ../map.md
> ✅ **2026-09-29 已决议** —— 见文末 Answer。**账落地了**，而且**真跑了一次**：
> 9 次调用 · **10 次往返**（有一次重试）· 墙钟 43.7s，逐个资源的 ms 与 token 都在包内 `ledger.json` 里。
> ⚠️ 真跑的账**当场抓到两件事**：`bg-dusk-halt` 重试了一次（没有 `attempts` 就会把 10.9s
> 误读成「难画」）；以及**每次的 `model` 都是 `deepseek-flash`**，而请求的是 `deepseek-v4-pro`
> —— 票 01 那条「代理会换模型」当场复现。
> ⚠️ 契约**一个字没改**：sidecar 放包根 ⇒ 靠 `files[]` 的穷举**白拿** checksum 覆盖。
> **票 46 由此解锁。**


> 由[票 19](19-latency-budget.md) 毕业。**不是决策票** —— 形状全部来自那票的 Answer，本票不重开任何一条。

## Question

让「一次资源生成**花掉了什么**」留在产物上。

### 要产出的东西

1. **账的类型**（`packages/contracts/src/ledger.ts`，与 `assetpack.ts` 并列）
   - `LedgerSchema`：`format: "assetpack-ledger/v1"` · `packId` · `packVersion` · `createdAt` ·
     `run`（`wallClockMs` + 各类调用/往返次数）· `calls[]`。
   - **`step` 是封闭判别联合**：`derive` / `drawlist` / `image`。
   - ⚠️ **per-call `ms` 与 run 级 `wallClockMs` 是两个「不可相加」的量**。
     今天串行时它们恰好一致，[票 47](47-parallel-generation.md) 一落地就不再一致 ——
     **类型里必须分开两个字段**，不许用一个数糊过去。
   - **`attempts` 沿用 `ImageGenCall` 今天的语义**：一次**调用**（一个逻辑请求）里有几次
     **往返**（HTTP）。别在这里再造一套「调用/重试」的说法。
   - **没有钱**（票 19 Q7）。`usage` 记**上游给的** token 数；**缺了就整个键缺席** ——
     ⚠️ **不许填 0 冒充「测到了 0」**，那是把一个不知道的事说成知道的。

2. **三类调用都开始记**
   - `generate.ts`：今天读响应时只取 `content` 与 `finish_reason`，**`usage` 被丢掉**。
     补记 `model` / `endpoint` / `ms` / `attempts` / `usage`。
   - `ops.ts` 的 `derive`：同款记录，**但只进 `CommandResult`，不落盘** ——
     票 19 §4：**账跟着「包」走，而「清单」不是包**（R7 两条路都开，清单可以是人直接写的，
     那时根本没有 `derive` 调用）。
   - `image-gen.ts`：四个协议都补 `model`（⚠️ `dashscope-mcp` **没有 model 参数**，
     模型由服务端定 —— 记缺席，别编一个）与响应里的 `usage`（`gpt-image` 系自带）。
     今天 `requestId` / `sourceHost` 只有部分协议填。
   - ⚠️ **`ImageGenCall` 已经在做一半** —— 让它成为 `calls[]` 的一个成员形状，
     **不要另起一套并存的记录**（票 24 / 票 37 的老教训：两个真相来源必然漂移）。

3. **落盘**：`pack.ts` 在 `files[]` 被 walk **之前**（`pack.ts:386`）写 `<包根>/ledger.json`。
   - ⚠️ **位置就是全部**：`files[]` 是 `walk(packDir)` **穷举**，所以 sidecar 会自动进 `files[]`、
     自动被 `verify` 校验 checksum。**不要动 `manifest.json`**、**不要把 `assetpack/v2` 升版**
     （票 19 Q5：升版会让磁盘上所有 v2 包解析不过，而这里等于白拿）。
   - 写进**临时包目录**（`finalDir` 搬迁之前），否则它不跟着搬。顺序上它是最后写的 ——
     账里的每一笔都已经发生。

4. **`verify` 认得它**：`ledger.json` 在就过 schema；**不在不算错** ——
   磁盘上已有的包（`fixtures/packs/last-train/v2/`）没有它，必须照常通过。

5. **两个壳渲染**：`CommandResult.summary` 加一行（调用次数 / 往返次数 / 墙钟），
   `data` 带整份账。CLI 与 MCP 渲染**同一份**（R5）。

6. **测试**：`usage` 缺席时**键缺席**（不是 0）· `ledger.json` 进 `files[]` 且 `verify` 通过 ·
   **无账的老包仍通过** · `attempts > 1` 时账里看得见重试。

### 完成条件

- `pnpm check` 与全部测试绿；`fixtures/recipes/last-train.json` 再 `pack` 一次，
  包里出现 `ledger.json` 且 `verify` 全绿。

### 不归本票

- ⚠️ **光栅化不记**（票 19 Q4）—— 一定会有人想「顺手把 raster 耗时也记上吧」。
  **不记**：本机纯函数，无上游、无钱、无抖动，记它噪声比信息多。
- **失败路径的账** —— 归[票 46](46-failure-ledger.md)。
- **并行** —— 归[票 47](47-parallel-generation.md)。

---

## Answer

**结论：账落地了 —— 三类调用都记，写成包根的 sidecar `ledger.json`，而契约一个字没改。**
**真跑了一次**：9 次调用 · **10 次往返**（有一次重试）· 墙钟 43.7s · 逐个资源的 ms 与 token 都在。
全套 **357/357** 绿 · `pnpm check` 绿 · 新增 **7 条**测试。

### 1. 真跑出来的账（`out/last-train/pack/v3/ledger.json`）

```
step       target                     model             ms   往返  usage
drawlist   player-traveler            deepseek-flash  9452    1  in210/out3641
drawlist   bg-dusk-halt               deepseek-flash 10926    2  in234/out1594   ← 重试了一次
drawlist   prop-luggage-pile          deepseek-flash  3063    1  in159/out702
...
run: {"wallClockMs": 43713, "byStep": {"drawlist": {"calls": 9, "attempts": 10}, ...}}
```

⚠️ **这账立刻抓到了两件事**：

- **`bg-dusk-halt` 往返了 2 次**（10.9s，全场最慢）—— 没有 `attempts` 这个字段的话，
  这 10.9s 会被误读成「这个资源难画」，而真相是「它第一次没成、重抽了一次」。
  这正是票 14 §7 那条（重试吸收抖动 ≠ 降级）在账上的样子。
- ⭐ **每一次的 `model` 都是 `deepseek-flash`**，而生成器请求的是 **`deepseek-v4-pro`**。
  这是票 01 那条实测（代理会换模型）**当场复现** —— 也正因如此，账记的是
  **上游自报的那个模型名**，不是我们请求的那个。记请求的那个，账就是错的。

### 2. 三条「不许省」的规矩，都省不掉

| 规矩 | 为什么 |
|---|---|
| **`ms`（每次调用）与 `run.wallClockMs` 是**两个字段** | 串行时它们**恰好相等**（43.4s vs 43.7s，差的是光栅化与落盘），而**一旦并行（票 47）就不再相等**——**差正是并行的收益**。只记一个，这件事就永远答不出来 |
| **`attempts` 单独记** | 重试烧掉的额度必须能单独看见，否则失败的归因是错的（见 §1 那条） |
| **`usage` 上游没给就整个键缺席**，不许填 0 | 填 0 是把「不知道」说成「测到了 0」。真跑的账里 `reasoningTokens` 就是**缺席**的（这个上游只在 `/v1/messages` 里回 in/out） |

⚠️ 另外 `model` 也是同一条规矩的另一面：`dashscope-mcp` 协议**根本没有 model 参数**（票 34），
那时记一个我们猜的名字，就是在账上撒谎。

### 3. sidecar 的位置就是全部 —— **契约零改动**

`pack.ts` 的 `files[]` 是 `walk(packDir)` **穷举**，所以放在**包根**的 `ledger.json`
会**自动进 `files[]`**、自动被 `verify` 校验 checksum。实测：v3 的 `verify` 说
**32 个文件**（v2 是 31），且账就在里面。

⇒ ✅ **`assetpack/v2` 没升版**（升版会让磁盘上所有 v2 包解析不过）、
✅ `provenance` 里**没有**账（manifest 是**自描述**，账是**收据**）。
⚠️ 写它的位置也是关键：必须在 `files[]` 被 walk **之前**写进**临时包目录**
（`finalDir` 搬迁之前），否则它要么漏在 checksum 覆盖之外、要么不跟着包搬走。

### 4. `verify` 顺带学会了一件事，且**没账不算错**

- 有 `ledger.json` ⇒ **过 schema**，且**与 manifest 对得上**（`packId`/`packVersion` 不符就报）
  —— checksum 只证明它**没被改过**，不证明它**是一份合法的账**。
- ⚠️ **没有不算错**：票 40 那份包（比这票早）不带账，`verify` 照常通过，只在 summary 里说一句
  「这个包没有 ledger.json（**不是错**）」。已有测试钉着这条。

### 5. `derive` 的账**不落盘**（票 19 定的），`compile-game` 的**不记**

- `derive` 的账进 `CommandResult.data.ledger` 与 summary 一行，**不写文件** ——
  账跟着「包」走，而**「清单」不是包**（R7 两条路都开，清单可以是人直接写的，那时没有这次调用）。
- ⚠️ **`compile-game` 那次调用不在账里**。`step` 是 `derive | drawlist | image` 的**封闭枚举**，
  而 `compile-game` 是**产物 B** 那条路的调用；包是产物 A 的东西。
  要记它就得开第 4 类 —— **那是另一票的事**，不在这张票的射程里（本票不偷偷扩枚举）。

### 6. 完成条件逐条

| 票面要求 | 状态 |
|---|---|
| `LedgerSchema`（三类 step、run 汇总、不动契约） | ✅ `packages/contracts/src/ledger.ts` |
| 三类调用都开始记 | ✅ `generate.ts` 补 `onCall` + usage/model；`image-gen.ts` 补 model/usage；`derive` 只进回报 |
| `attempts` = 一次调用里的往返次数 | ✅ 且真跑里当场抓到一次重试 |
| `usage` 缺了就键缺席 | ✅ 有测试 |
| 落盘在 `files[]` 被 walk **之前** | ✅ 且写进临时包目录 |
| `verify` 认得它、没它也不算错 | ✅ 两边都有测试 |
| 两个壳渲染 | ✅ CLI summary + `data`（MCP 与 CLI 同源） |
| ⚠️ 光栅化**不记** | ✅ 一个字段都没加 |

### 7. 解锁

**票 46（失败也要报账）由此解锁** —— 而它的地基已经在这儿了：
账本数组在 `packAssets` 里**一开始就存在**，所以中途失败时已经花掉的那几笔还在，
只是现在随异常一起丢（那正是 46 要接的那一段）。
