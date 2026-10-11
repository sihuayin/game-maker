# 41. CLI 加一条**只设 image** 的并发路 —— `--concurrency` 表达不出裁定要的「image 2」

Type: task
Status: resolved
Owner: claude (2026-10-11)
Blocked by: —
Map: ../map.md
> 派生自[票 23「E2E fixture + 真跑一次」](23-e2e-fixture-wasteland.md)：第四/五/六跑**每一跑都在偏离一条已裁的规矩**。
> 人类在[第六跑决策轮第 1 轮](../clarifications/23-run6-round-1.md) 的 **Q4** 上裁定：
> 「**增加图片并发参数** —— 能独立控制 image concurrency」。
> ⚠️ **它推翻的是[票 47「并行生成资源」](../../game-creation-v1/issues/47-parallel-generation.md) 在 CLI 那一层的选择** ——
> 见下。引擎那两个信号量的**形状不变**，变的是 CLI 的**入口**。

## Question

**裁定给的数**：票 23 第五跑 Q3 的原话是「**image 2**」。
**而 CLI 上表达不出来**：只有一个 `--concurrency <n>`，落成 `{ text: n, image: n }`
（`cli.ts:179` 与 `:446`，两条路都这么写）⇒ 第四/五/六跑实为 **`text 2 / image 2`**。

⚠️ **引擎那一层是支持的** —— 缺的只是那个 flag：

```
ops.ts:1029   concurrency?: { text?: number; image?: number };   // 分开的
pack.ts:162   export const DEFAULT_CONCURRENCY = { text: 4, image: 3 } as const;
```

⚠️ **而 `cli.ts:438` 的注释今天写着反话**（引票 47）：

> 并发上限（票 47）：**按上游分别定**是本来的形状，但一个数就够人用了 ——
> 给了就两边都用它；**要分开调就用 API**。

⇒ 票 47 的决定是「CLI 只给一个数 · 分开调走 API」。**这条裁定把它推翻了**，所以那句注释要**改**，
并在票里记明这一层是被推翻的（不能只改代码、留一句反话在那儿）。

要定的：

1. **形式**：`--concurrency-image <n>`（与 `--concurrency` 并列），还是让 `--concurrency` 收
   `text:2,image:2` 这种值？（⚠️ 后者要动 `concurrencyOf` 的解析与它那条 usage 报错。）
2. **默认值不动**：票 47 那张表是**实测挑的**（串行 50.1s → 并发 4 是 11.6s 的最优点），
   而 `image` 那条比文本保守（上游限流）。⇒ 本票**只加「覆盖」**，**不许动 `DEFAULT_CONCURRENCY`**。
3. **两条路都要接**：`create --yes`（`cli.ts:404`）与 `build`（`cli.ts:416`）—— 今天两处各写了一遍。
4. **`pack` 那条独立命令**（`cli.ts:440`）要不要也接？（它的 `--concurrency` 只喂 `packAssets`。）
5. **要不要一条测试钉住「只设 image 时 text 仍是默认值」**（否则「分开设」会退化成「又变成一起设」）。

## 量到的

- 第四/五/六跑实为 `text 2 / image 2`（三跑的驱动都有 `--concurrency 2`）。
- 票 47 的实测表（同一份清单 · 真上游）：并发 1 → 50.1s · **4 → 11.6s**（最优）· 6 → 12.2s · 8 → 11.7s
  ⇒ 「再往上没有收益，只有被上游限流的风险」。

## 裁定（2026-10-10 · 人类第 1 轮）

**Q4：增加图片并发参数。** 验收重点：**能独立控制 image concurrency**。

## 轮次

**第 1 轮**：[`clarifications/41-round-1.md`](../clarifications/41-round-1.md) —— 7 问
（flag 形式 · 默认值 · 两条路 · `pack` 那条 · 判据怎么立 · 连带要不要更新 USAGE/README · 完成线）。
⚠️ **本轮量到的五条**（全部在盘上，零上游调用）：
① 「一个数」这个决定**落在四处**，不是一处 —— `cli.ts:184` 是最终落点，`:431` / `:443` 是各写一遍的
`create --yes` 与 `build`（逐字同款），而 `:467-469` 的 `pack` **连 `concurrencyOf` 都没用**，
自己内联了一份解析**外加一份复制来的报错文案**；
② **票面上的行号今天全对不上**（票写 `179/404/416/438/440`，实测是 `184/431/443/460/465-473`）——
本轮按**复量过的**行号立问；
③ ⚠️ **`--help` 里 `create` 那行根本没写 `--concurrency`**，而 `create --yes` **确实收**它
（`cli.ts:431`）—— 一处**先前就有的漏**，与新 flag 要改的是同几行；
④ 那句被推翻的注释（`cli.ts:465-466`「一个数就够人用了 · 要分开调就用 API」）今天**还挂在代码里**；
⑤ `packages/cli/tests/` 里 `concurrency` **零命中**，而 `CliDeps` 只有 `{fetchImpl?, env?, cwd?}`
（**没有并发注入口**）—— 但那条假 `fetch` 是注入的、**drawlist 那一支也走它**
⇒ 「同时在飞的请求峰值」在 CLI 这一层**是看得见的**（Q5 腿② 由此成立）；
而夹具清单 `fixtures/upstream/canned.json` 是 4 个 drawlist 资源（无 image 源）。

## Answer

**一句话**：CLI 多了 `--concurrency-image <n>` —— **只设生图那一半**（`--concurrency <n>` 原义一字未动）；
而这一票真正最要紧的一行是**「没给的那一半不进返回值」**：`--concurrency-image 2` 给的是 `{ image: 2 }`，
**里面没有 `text` 键** ⇒ 文本走引擎的 `DEFAULT_CONCURRENCY.text`（4）。落地了代码、文档与免费测试，
**没有开任何付费真跑**。

### 病根：不是「少一个 flag」，是**那个数在四处各写了一遍**

票面写的是「两条路各写一遍」（`cli.ts:179` 与 `:446`）。量下来是**四处**：

| # | 在哪 | 写的是什么 |
|---|---|---|
| ① | `buildAndSite` 内部 | `{ text: o.concurrency, image: o.concurrency }` —— **最终落点** |
| ② | `create --yes` | `concurrencyOf(flags.concurrency)`（一个 `number`） |
| ③ | `build` | 与 ② **逐字同款** |
| ④ | `pack` | ⚠️ **连 `concurrencyOf` 都没用** —— 自己内联了一份解析 + **复制了一遍报错文案** |

⇒ 只要「一个数」这个形状还在任何一处，`image 2` 就表达不出来。所以本票改的是
**一处语义 + 四个调用点**，不是「加一个 flag」。

### 落地（可点的）

- **`concurrencyFromFlags(flags)`**（`cli.ts`，**纯函数**）—— 唯一的那个解析：
  `--concurrency n` ⇒ `{ text: n, image: n }`（原义不变）· `--concurrency-image n` ⇒ **`{ image: n }`**
  （**没有 `text` 键**）· 两个都给 ⇒ `{ text: <--concurrency>, image: <--concurrency-image> }`（具体的那个赢）·
  都没给 ⇒ `undefined`（**不给覆盖**，不是给一个空对象）。
  ⚠️ `concurrencyOf(v, flag)` 多收一个 flag 名 —— **报错点给的那个 flag 的名字**，不再一律说 `--concurrency`。
- **`concurrencyArg(flags)`** —— 上面那三个调用点**共用的那一行**；`pack` 那支的**第三份解析与复制来的报错文案删了**。
- **`buildAndSite`** 的入参从 `concurrency?: number` 改成 `{ text?: number; image?: number }`（**原样转发**）。
- **`takesValue`** 加 `concurrency-image`。
- **那句被推翻的注释删了**（票 47 的「一个数就够人用了 · 要分开调就用 API」）——
  它今天与行为**相反**，留着就是本仓库反复栽过的那种「文档与代码说两件事」。
- **USAGE**：三条命令（`create` / `build` / `pack`）都写上这两个 flag，并补了一段解释。
  ⚠️ 顺带补上**读数 C 那个先前就有的漏**：`create` 那一行**从来没写 `--concurrency`**，而它**一直收**。
- **两份 README**（`README.md` · `README_zh.md`）：同两条 flag + 「并发不影响产物」那句。

### 判据：两层，各钉一头（Q5=A）

| 层 | 在哪 | 钉什么 | 期望值从哪来 |
|---|---|---|---|
| 形状 | `cli.test.ts`（**6 条**） | `concurrencyFromFlags({ "concurrency-image": "2" })` 的返回值里 **`Object.keys` 只有 `["image"]`**；`--concurrency 2` ⇒ 两边都是 2；两个都给 ⇒ 具体的赢；都没给 ⇒ `undefined`；报错点对 flag 名；`parseArgs` 认得这个 flag | **手工写死**（不由被测函数推） |
| 观测 | `cli-create.test.ts`（**7 条**） | **同时在飞的请求峰值**（假 `fetch` 自己数） | ✅ **独立** —— 峰值来自那条假上游，与「谁算的」无关 |

⚠️ **腿② 是怎么量到的**（票面的 Q5 说「`CliDeps` 没有并发注入口，但假 `fetch` 是注入的」）：
给假上游加一个**可选的**人为延迟 + 一个计数器（`makeProbe()`），**只数 `body.tools === undefined` 那一支**
（只有它走 `pack` 的**文本闸门**；理解层那五发是 `tool_choice` 调用，不受并发管）。
夹具那 4 个 drawlist 资源**没有依赖边**、且在 `Promise.allSettled(recipe.assets.map(…))` 里**同步提交**
⇒ 峰值是确定值：

```
create --yes --concurrency-image 2   ⇒ 文本峰值 4   （⚠️ 不是 2 —— 那正是本票之前那四处代码写出来的东西）
create --yes --concurrency 2         ⇒ 峰值 2
create --yes --concurrency 3 --concurrency-image 2 ⇒ 峰值 3   （具体的那个赢）
build <run 目录> --concurrency 2      ⇒ 峰值 2   （⚠️ 第二条路的那个调用点）
pack --recipe … --concurrency-image 2 ⇒ 峰值 4
```

### 变异验证：三发（都只红该红的，改回后零残留）

| # | 改了什么 | 谁红了 | 说明 |
|---|---|---|---|
| ① | `concurrencyFromFlags` 把 `text` 那半边**补上**（退回「一个数两边都用」） | 腿① 1 条 + **腿② 的 `create` 峰值那条** 1 条 | **两层各自都响了** —— 形状与观测不是同一件事的重述 |
| ② | 删掉 `build` 那一处的 `...concurrencyArg(flags)` | **只有 `build` 那条** | 两个调用点各有一条自己的钉子；只测 `create` 的话这个调用点被人删掉不会有人知道 |
| ③ | `pack` 那一支忽略 `--concurrency-image`（退回旧的内联解析） | **只有「参数错点名」那条** | 见下面的诚实记 —— 峰值在 `pack` 上够不着 image 那一半 |

### 验收（全免费，全部跑过）

- `pnpm test` **1211/1211**（71 个文件；此前 1198 —— 本票加 13 条）
- `typecheck` ✅ · `build` ✅ · `check:deps` ✅（9 个包）
- **成品 bundle 也真跑了一下**：`node packages/cli/dist/cli.mjs --help` 看得到两条 flag；
  `pack --recipe x --concurrency-image 0` ⇒ **退出码 2** + `✗ --concurrency-image 必须是 ≥1 的整数（给的是 "0"）`
- ⚠️ `pnpm check:links` **红一条，与本票无关**：票 23 第 658 行指向 `../../experiments/…`，实际该是 `../`
  （票 39 与票 40 已两度报过同一条，**没有动别票的文件**）。

### 诚实记 / 没做到（都不在本票内）

- ⚠️ **`pack` 那条路上量不到 image 那一半** —— 夹具全是 drawlist（无生图资源），
  而 `CliDeps` **没有 `generateImage` 的注入口**（票 40 的诚实记已经写过这一条）。
  ⇒ `pack` 那两条钉的是「**同一个 flag 在同一个壳里到处一个意思**」（报错点它的名、文本那半边照旧），
  **不是**「image 真被限到 2」。那半边今天只有**共用同一个函数**这一条结构保证。
- ⚠️ **`--concurrency-text` 有意不加**（Q1 划的边界）⇒ 「**只设 text**」今天**仍然写不出来**，
  还得走 API。这是**裁定划的**，不是漏；真要它，另开票。
- ⚠️ **不追溯第四/五/六跑**：那三跑的驱动里是 `--concurrency 2`（实为 text 2 / image 2）。
  本票只让「image 2」**从今天起写得出来**；下一次要那个数就得写 `--concurrency-image 2`。
- ⚠️ **MCP 那一侧没有并发口**（Q6=A 有意不开）：`create_game` / `build_asset_pack` 今天一个并发参数都没有
  （`server.ts` 里零命中）。**记在这里**，需要时另开票。
- ⚠️ **票面上的行号是旧的**（票写 `179/404/416/438/440`，实测 `184/431/443/460/465-473`）——
  本票按**复量过的**行号改的，没有去改票面原文（那是立案时的事实）。

### 边界（本票一个字没碰）

**一张图未买 · 没开付费真跑**（本票不授权）· **`game-maker.local.json` 一个字没动** ·
**`DEFAULT_CONCURRENCY` 一个字没动**（`{ text: 4, image: 3 }`）· **引擎那两个信号量的形状没变**
（`pack.ts` 只被读、没被改）· **不加重试 / 不加入重生成 / 不建修复循环**（R13 不动）· **R 表没改** ·
**`packages/qa` 一行没碰** · **MCP 没动**。
