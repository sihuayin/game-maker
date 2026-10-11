# 票 41 · CLI 加一条**只设 image** 的并发路（第 1 轮）

> **自包含副本**：把它整个拷走就能答，不需要任何上下文。
> 票：`.scratch/game-maker-v2/issues/41-image-concurrency-flag.md`（类型 task · 不挡任何票）
> 地图：`.scratch/game-maker-v2/map.md`（effort `game-maker-v2`）
> **怎么答**：每问下面直接写你的裁定；拿不准就写「先按你推荐的来」。

---

## 0 · 已经定过的事（本轮不重开，只是免得你翻）

- **本票的来历**：票 23 第五跑的裁定给的数是「**image 2**」，而 CLI 上表达不出来 ——
  只有一个 `--concurrency <n>`，落成 `{ text: n, image: n }` ⇒ **第四/五/六跑实为 `text 2 / image 2`**，
  **每一跑都在偏离一条已裁的规矩**。
- **第六跑决策轮第 1 轮 Q4 的裁定**（原文）：「**增加图片并发参数**」——
  验收重点**逐字**是「**能独立控制 image concurrency**」。
- **它要推翻的东西**：票 47（`game-creation-v1`）在 CLI 那一层的选择 ——
  「一个数就够人用了；要分开调就用 API」。⚠️ **引擎那两个信号量的形状不变**，变的只是 CLI 的入口。
- **R5**：本图**把执行带进来** —— 票解出来的决定**当场实现**。
- **R13 / 票 33**：**不建修复循环**、**不偷偷重试**、**不自动重生成**。改要按 **R17** 另开票。
- **付费跑规矩**（你定的）：**报告 + 明确同意**才开跑。**本票不开任何付费跑**。
- 票 37 / 38 / 39 / 40 已关。**`game-maker.local.json` 一个字不动**。

## 0.1 · 病根一句话

**引擎早就支持「分开设」，而 CLI 只有一个数 —— 缺的只是那个 flag。**

```ts
// 引擎那一层（今天就是分开的）
ops.ts:1029        concurrency?: { text?: number; image?: number };
pack.ts:162        export const DEFAULT_CONCURRENCY = { text: 4, image: 3 } as const;
pack.ts:345-346    const textGate  = semaphore(opts.concurrency?.text  ?? DEFAULT_CONCURRENCY.text,  stop);
                   const imageGate = semaphore(opts.concurrency?.image ?? DEFAULT_CONCURRENCY.image, stop);

// 而 CLI 把它压成一个数
cli.ts:184         ...(o.concurrency === undefined ? {} : { concurrency: { text: o.concurrency, image: o.concurrency } })
```

⇒ **`--concurrency 2` 的意思是「两边都是 2」**，而「text 默认 4 · image 2」今天**写不出来**。

## 0.2 · 本轮量到的（全部在盘上，**零上游调用**）

⚠️ **票面上的行号是旧的**（票写 `cli.ts:179/404/416/438/440`）—— 下面全部按**今天**的行号复量过。

### 读数 A —— 那个「一个数」一共有**四处**，而其中三处是同一句话的重复

| # | 在哪 | 写的是什么 |
|---|---|---|
| ① | `cli.ts:184`（`buildAndSite` 内部） | `{ text: o.concurrency, image: o.concurrency }` —— **最终落点** |
| ② | `cli.ts:431`（`create --yes`） | `concurrencyOf(flags.concurrency)`（一个 `number`） |
| ③ | `cli.ts:443`（`build`） | 与 ② **逐字同款**（两处各写了一遍） |
| ④ | `cli.ts:467-469`（`pack`） | ⚠️ **它连 `concurrencyOf` 都没用** —— 自己内联了一份解析 + **复制了一遍报错文案**，然后 `:473` 也落成 `{ text: n, image: n }` |

⇒ 「一个数」这个决定落在**四处**；要改的是**一处语义 + 四个调用点**，不是一处。

### 读数 B —— 那句被推翻的注释今天还挂在代码里（票面已点名要改）

`cli.ts:465-466`（`pack` 那一支）：

```ts
// 并发上限（票 47）：**按上游分别定**是本来的形状，但一个数就够人用了 ——
// 给了就两边都用它；要分开调就用 API。
```

⚠️ 这是**票 47 的决定**，而 Q4 的裁定**把它推翻了**。⇒ 只改代码、留这句反话在这里，
下一个人会读到一个与行为相反的说明（本仓库反复栽过的那种「文档与代码说两件事」）。

### 读数 C —— ⚠️ `--help` 里 `create` 那行**根本没写 `--concurrency`**，而它其实收

```
cli.ts:22   game-maker create --style <…> --intent <…> [--yes] [--style-id <slug>] [--out <目录>] [--json]
cli.ts:23   game-maker build  <run 目录> [--out <目录>] [--concurrency <n>] [--json]
cli.ts:25   game-maker pack   --recipe <清单.json> [ … ] [--concurrency <n>] [--json]
```

而 `create --yes` 那条路**确实**把它读进去（`cli.ts:431`）。⇒ 一处**先前就有的漏**，
与本票相邻（新 flag 要写进这几行，顺手补上它最省事）。

### 读数 D —— `DEFAULT_CONCURRENCY` 与「谁被覆盖」的现状

```
DEFAULT_CONCURRENCY = { text: 4, image: 3 }
```
- **文本 4** 是**实测挑的**（票 47 那张表：同一份 last-train 清单 · 真上游 ——
  并发 1 → 50.1s · **4 → 11.6s**（最优）· 6 → 12.2s · 8 → 11.7s ⇒ 「再往上没有收益，只有被上游限流的风险」）。
- **生图 3** 是**判断不是实测**（票 47 自己标明的：千问那条实测 RPS 5 / 并发 5，而 **OpenAI 那一支没实测过**）。

⇒ **本票只加「覆盖」**，`DEFAULT_CONCURRENCY` **一个字不动**（票面已定）。

### 读数 E —— 今天**没有任何测试**碰过 CLI 的并发

`packages/cli/tests/` 里 `concurrency` **零命中**。而 `CliDeps` 只有
`{ fetchImpl?, env?, cwd? }`（`cli.ts:381-385`）—— **没有并发参数的注入口**，
且 `cli-create.test.ts` 的夹具清单（`fixtures/upstream/canned.json`）**全是 drawlist**（4 个资源、无 image 源）
⇒ 「`create --yes` 只要清单里有 image 源就跑不起来」（票 40 的诚实记里已经写过这一条）。

⚠️ **但那不等于没法观测** —— 见 Q5：那条假 `fetch` 是**注入**进去的
（`cli-create.test.ts` 的 `fakeUpstream`，`deps.fetchImpl`），**drawlist 那一支也走它** ⇒
「同时在飞的请求数」在 CLI 这一层**是看得见的**。

## 0.3 · 落点的形状（我打算怎么改，供你判断）

`cli.ts` 里加一个**纯函数**，四个调用点**都用它**：

```ts
/** 从前面的 flags 算出并发覆盖 —— ⚠️ **没有给的那一半就不出现在返回值里**（引擎自己取默认）。 */
function concurrencyFromFlags(flags: Record<string, string | boolean>): { text?: number; image?: number }
```

- `buildAndSite` 的入参从 `concurrency?: number` 改成 `{ text?: number; image?: number }`（原样转发）。
- `create --yes` 与 `build` 各调一次 `concurrencyFromFlags(flags)`（**同一个函数**，不再是两处各写一遍）。
- `pack` 那一支同理（连带把 `:467-469` 那份**第三份解析**收掉）。
- `takesValue`（`cli.ts:68`）加上新 flag 的名字。

---

❓ **Q1** - **flag 的形式？**

- **A. 并列新开一个 `--concurrency-image <n>`**：`--concurrency <n>` **保持原义**（两边都设）；
  两者同时给时 **具体的那个赢**（image 被覆盖，text 仍走 `--concurrency`）。
  ⇒ 改动最小、语义**只增不改**、README 里那句 `--concurrency <n>` 照样成立。
- **B. 让 `--concurrency` 收 `text:2,image:2` 这种值**：
  ⇒ ⚠️ 要动 `concurrencyOf` 的解析**与它那条 usage 报错**，还要**兼容裸数字**（`--concurrency 2` 今天是被文档化的）。
  收益是「一个 flag 说完整件事」，代价是一个**已经文档化的 flag 的语法变了**。
- **C. 新开一对 `--concurrency-text` / `--concurrency-image`，`--concurrency` 退休**：
  ⇒ ⚠️ **破坏兼容**（README ×2、`--help` 都写着它），且**没有任何人要求**。

➡️ **推荐 A**。理由一句话：**裁定要的是「能独立控制 image」，不是「重新设计这一族 flag」**；
A 是唯一一个把已有语义**一字不动**保留、只往上加一条路的方案。
⚠️ **附**：要不要**顺手也加 `--concurrency-text`**（对称、且「只设 text」今天同样写不出来）？
我倾向**加**（一行的事，否则下一次会为同一件事再开一票）；但裁定只要求 image ⇒
若你要**严格控制边界**，就只加 image，我把 text 那条记进票里。

---

❓ **Q2** - **默认值不动**（确认项）

票面已定：**本票只加「覆盖」，`DEFAULT_CONCURRENCY` 一个字不动**
（文本 4 是实测挑的；生图 3 是判断，见读数 D）。
⇒ 于是「只给 `--concurrency-image 2`」的结果是 **text 4（默认）· image 2**，正是裁定要的那个数。

- **A. 确认**（不动默认值）。
- **B. 不确认** ⇒ 请写明要动哪一格、依据是什么（那会推翻票 47 的实测表，按 R17 得另开票）。

➡️ **推荐 A**。

---

❓ **Q3** - **两条路都接**（票面已点：`create --yes` 与 `build`）

读数 A：这两条路今天**各写了一遍**（`cli.ts:431` / `:443`），而它们最终都汇进
`buildAndSite`（`cli.ts:184`）—— 「两条路产物等价」靠的就是那个汇合点。

- **A. 两条路都接，且**共用**一次计算**（`concurrencyFromFlags(flags)`，两处调用点都调它）。
- **B. 只接 `build`**（理由是「人跑 `--yes` 时还没看过清单」）⇒ ⚠️ 但**第四/五/六跑走的正是 `create --yes`**，
  不接它等于裁定要的场景**一次都没覆盖**。

➡️ **推荐 A**。

---

❓ **Q4** - **`pack` 那条独立命令要不要也接？**

- **A. 接**，并把 `cli.ts:467-469` 那份**第三份解析**换成共用的解析（连带消掉那句复制来的报错文案）。
  依据：同一个 flag 在同一个 CLI 上应当**到处一个意思** —— 而 `pack` 是**最容易做并发对照实验**的那条路
  （票 47 那张实测表用的就是它）。
- **B. 不接**（`pack` 是低层命令，并发只对 `create` / `build` 有意义）。
  ⇒ ⚠️ 代价是「`--concurrency-image` 在 `build` 上能用、在 `pack` 上报参数错」这种**同一个壳里的不一致**。

➡️ **推荐 A**。

---

❓ **Q5** - **判据怎么立？**（⚠️ 本票最容易做成**假牙**的地方）

要钉的那句话是「**只设 image 时 text 仍是默认值**」—— 否则「分开设」会**退化成「又变成一起设」**
（那正是今天这四处代码的形状）。三条腿，各自钉不同的东西：

| 腿 | 在哪 | 钉什么 | 是不是独立观测 |
|---|---|---|---|
| **① 形状** | `cli.test.ts`（纯函数单测） | `concurrencyFromFlags({ "concurrency-image": "2" })` 的返回值里**根本没有 `text` 键**（不是 `text: 2`，也不是 `text: 4`） | ⚠️ 与被测函数同源 —— **它是「别写错这一行」，不是「行为对」** |
| **② 观测** | `cli-create.test.ts`（**已有的假上游**） | **同时在飞的请求峰值**：只给 `--concurrency-image 2` ⇒ text 峰值仍是 **4**；而 `--concurrency 2` ⇒ 峰值 **2** | ✅ **是** —— 峰值来自假 `fetch` 自己数的，与「谁算的」无关 |
| **③ 引擎那半**（可选） | `assets/tests/pack.test.ts` | 传 `concurrency: { image: 2 }`（**不给 text**）⇒ image 峰值 ≤2 且 >1、而 **text 峰值 = 4** | ✅ **是**（`pack.test.ts:568` 的 `peakOf` 就是这个形状，现成的） |

⚠️ **腿② 为什么做得成**：`stage()` 把 `fakeUpstream` 注进 `deps.fetchImpl`
（`cli-create.test.ts:107`），而 **drawlist 那一支也走它** —— 假上游今天**没数过峰值**，
加一个人为延迟 + 一个计数器就是「观测」（`pack.test.ts:568-577` 的 `peakOf` 是同款做法）。
⚠️ 夹具那 4 个 drawlist 资源展开后**不止 4 个文本单元**（`framePlan`：动画按**帧**、一帧一份）
⇒ 峰值够得着 4 这个默认值。
⚠️ **代价要你知道**：假上游加延迟会**拖慢那一组已经存在的测试**（只在需要峰值的那一条里开延迟即可）。

- **A. 腿① + 腿②**（推荐）：形状钉住 flag 的语义，观测钉住**它真的没变成 2**。
- **B. 只做腿①**（便宜）⇒ ⚠️ 没有人证明那个对象**真的走到了 `runBuild`** —— 那正是今天漏的那一环。
- **C. 腿① + 腿② + 腿③**（最全，多一份 `assets` 侧的回归）。

➡️ **推荐 A**；若你觉得腿③ 值（它守住「引擎不许把 text 从 image 补上」这一半），就选 C。

---

❓ **Q6** - **连带要改的地方（边界）**

1. **那句被推翻的注释**（读数 B，`cli.ts:465-466`）—— 票面**已点名必须改**，我不另问，直接改。
2. **`--help` 的 USAGE**（`cli.ts:22-25`）：新 flag 写进去吗？⚠️ 顺带**读数 C 那个漏**
   —— `create` 那行今天**没写 `--concurrency`**，要不要一并补上？
3. **两份 README**（`README.md:168` · `README_zh.md:182` 的 `--concurrency <n>` 那一条）：要不要一并更新？
4. **MCP**：`create_game` / `build_asset_pack` 今天**一个并发参数都没有**（`server.ts` 里零命中）。
   要不要顺手也开这个口？

- **A（推荐）**：USAGE 与 README **一并更新**（含补上 `create` 那行漏掉的 `--concurrency`）；
  **MCP 不动**，把「MCP 那一侧没有并发口」记在票里。
  依据：R6 的终点是 **CLI 那条命令**，MCP 不在终点的判据里；而 USAGE/README 是**同一个 flag 的说明书**，
  改了行为不更新它们就是读数 B 那种「文档与代码说两件事」。
- **B.** 只改代码（USAGE / README / 注释之外的散文一律不动）⇒ ⚠️ 但票面**已要求改那句注释**，所以至少那一处要动。
- **C.** 连 MCP 一起开（三个口子同步）⇒ 那是**扩大边界**，且 MCP 今天连一个测试眼都没有
  （地图的 `Not yet specified` 里记着这件事）。

➡️ **推荐 A**。

---

❓ **Q7** - **完成线**（照票 38 / 40 的 Q6）

- **代码 + 免费测试**（含 `typecheck` / `build` / `check:deps` / `check:links`）。
- **不执行任何付费真跑**（那是票 23 的事，要**另出报告 + 你明确同意**）。
- **不动 `game-maker.local.json`** · **不动 R 表** · **不加重试 / 重生成 / 修复循环**（R13 不动）。

➡️ **推荐**：照此执行。请确认。

---

## 本轮**没有**问的（说明一下，免得看着像漏了）

- **母版漂了能不能重出 / 自动重生成** —— 按 R13（票 33）属**未决**，要动得另开票走 R17。本轮不碰。
- **票 42**（`player` 不参与「id 跨桶唯一」）—— 是**独立的一条**，与本票并行、互不挡。
- **下一次付费真跑的预算 / 停止条件** —— 归票 23，本票不碰。

---

# 裁定（请在这里逐条作答）

| | 我的推荐 | 你的裁定 |
|---|---|---|
| **Q1** flag 形式 | A（`--concurrency-image <n>`；`--concurrency` 原义不动，具体那个赢）· 附问：要不要**顺手也加 `--concurrency-text`** | |
| **Q2** 默认值 | A（`DEFAULT_CONCURRENCY` 一个字不动） | |
| **Q3** 两条路 | A（`create --yes` 与 `build` 都接，共用一次计算） | |
| **Q4** `pack` 那条 | A（接，并收掉那份第三份解析） | |
| **Q5** 判据 | A（腿① 形状 + 腿② 观测）· 要更全就 C | |
| **Q6** 连带 | A（USAGE + README 一并更新，含补 `create` 那行；MCP 不动） | |
| **Q7** 完成线 | 代码 + 免费测试，**不授权任何付费真跑** | |
