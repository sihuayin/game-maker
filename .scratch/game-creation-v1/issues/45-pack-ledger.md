# 45. 把「花掉的」记下来 —— 三类调用记账，写成包内的 ledger.json

Type: task
Status: open
Blocked by: —
Map: ../map.md

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
