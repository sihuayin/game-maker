# 票 55 · 第二轮问题
## 形状这一层：容器叫什么 · 要不要 schema · error 怎么把它带出来

---

## 〇、第一轮已经定下的（不用重问）

| 题 | 裁定 |
|---|---|
| **Q1** 落什么（粒度） | **(b)** 每一次往返的**原始模型入参**（schema 档最多 3 份；R12 档恒 1 份） |
| **Q2** 落在哪 / 怎么活过失败 | **(a)** 挂在 **error** 上，由 `create-game.ts` 那个 catch 在 `abandonRun` **之前**写进 `run.tmpDir` |
| **Q3** 名字与形状 | **(a)** 只写**非契约容器**，**不**另写 `game-design.json` |
| **Q4** 范围 | **(a)** 只 `compile-design` |
| **Q5** 拒因要不要一起落 | **(b)** 原始入参 + **每发的 `failure` 类与 `detail`** |
| **Q6** 泄密纪律 | **(a)** 只落模型入参，并**加一条密钥钉子测试** |
| **Q7** 记账动不动 | **(a)** **不动 `ledger`** |

**⚠️ 一条由第一轮推出来、但不许静默假设的推论**（写在明处）：

> **一次「重采样之后成功」的编译，第 1 发的原始入参留不下来。**
> 因为 Q2 = (a) —— 只有抛出来才有写入点；而阴性判据是「成功路径一个字节不变」。
> ⇒ 这是**有意的取舍**，不是漏掉的边：成功的那一跑，链本来就走过去了。

**另一条同样明写的边界**：容器写进 `run.tmpDir` **根**（与 `intent.md` / `visual-world.json` 并列），
靠那次 rename 进失败现场；**不进** `run/v<N>/`（那里是成功语义）。

---

## 一、这一轮新量到的两条先例（推荐就锚在它们身上）

**先例 A —— 诊断 sidecar 长什么样：`master-ratios.json`（票 39，`packages/contracts/src/master-ratio.ts`）**

它是**一个不在任何契约里的诊断产物**，而仓库给它的待遇是**三件套齐全**：

```ts
export const MASTER_RATIOS_FORMAT = "assetpack-master-ratios/v1" as const;
export const MASTER_RATIOS_FILE   = "master-ratios.json" as const;
export const MasterRatios = z.object({ format: …, packId: …, packVersion: …, masters: [...] }).strict();
export function parseMasterRatios(input: unknown): { ok: true; value: MasterRatios } | { ok: false; errors: string[] }
```

而它为什么住 `contracts`，注释里逐字写着：

> **形状住在这里、量法住在 `@game-maker/assets`** …… 外壳（CLI / MCP）**只能依赖 contracts**，
> 所以它要读得到这个形状；而量它要 PNG 解码器，那是 `pack` 那一步的事。

**先例 B —— 怎么把东西挂在抛出的 error 上：`Carried`（`packages/contracts/src/command.ts:100`）**

```ts
export type Carried = { ledger?: LedgerCall[]; failureDir?: string };
export const carryOnError = (e, carried) => …      // 三条边界写在它头上
export const ledgerOfError     = (e) => …          // 「空数组算没有」
export const failureDirOfError = (e) => …
```

三条边界**逐字**（`command.ts:79-95`）：**没东西可带就什么都不做** · **只能挂在可扩展的对象上**
（冻过的对象 `Object.assign` 会抛 ⇒ 吞那个 `TypeError`，但**绝不**因此替换或吞掉**原异常**）·
**只加不改**（不覆盖异常上已有的同名键 —— 下层挂的比这层更接近现场）。

---

## 二、这一轮要你裁的

### ❓ Q1 — 容器的**文件名**

- **(a)** `design-attempts.json`
- **(b)** `rejected-design.json`
- **(c)** `design-raw.json`

➡️ **推荐 (a)**。(b) 对「三发全没过 schema」那一档是**半截假话**——那时**没有**「一份被拒的设计」，
只有三份**从没合格过**的原始输出；(c) 没有说清是谁写的、什么时候写的。
(a) 与仓库既有的平铺命名（`visual-world.json` / `game-intent.json` / `ledger.json` / `master-ratios.json`）同款。

---

### ❓ Q2 — 容器**要不要一份 schema**，住哪

- **(a)** **要** —— 住 `packages/contracts`，照 `master-ratio.ts` 逐字同款：
  `format` 标签 + 文件名常量 + Zod + `parseXxx`
- **(b)** **不要** schema，纯 JSON（形状由写它的那一处自己保证）

➡️ **推荐 (a)**。理由就是先例 A 那句原文：**外壳只能依赖 `contracts`**，它要读得到这个形状。
而「读得回来」正是本票的**阳性判据**——有一份 `parseXxx` 才算把「读得回来」钉成可执行的东西。
⚠️ **代价为零**：这个容器**不进任何资源包**，所以给它一个 `run-*` 的 format 标签
**不牵动 `assetpack` 升版**（与 `run-ledger/v1` 同类，而不是与 `assetpack/v3` 同类）。
⚠️ 反方（请一并考虑）：仓库也有一条「说不出谁读它就别加」的纪律（R7）——
但这里读者是**点得出来的**：失败现场的诊断者 + 那一对判据。

---

### ❓ Q3 — 封套的**确切断面**

提案逐字如下：

```json
{
  "format": "run-design-attempts/v1",
  "attempts": [
    { "attempt": 1, "outcome": "schema",   "detail": "工具入参不过契约：…", "raw": { …模型那一发写的整份入参… } },
    { "attempt": 2, "outcome": "rejected", "detail": "…", "rejections": [ { "reason": "…", "detail": "…" } ], "raw": { … } }
  ]
}
```

- **`outcome` 的取值**：`truncated` / `no-tool-use` / `empty-input` / `schema` / `rejected`
  —— 前四个与循环里 `CallFailure` 同名，第五个是 R12 那一档
- **`raw` 可以缺**：`no-tool-use` 那一档**根本拿不到入参**（代理把 `input` 丢了）
- **`attempts` 按 `attempt` 升序**，不按回来先后

➡️ **推荐就这个形状**。⚠️ **请特别裁 `raw` 可缺这一条**——它是整个断面里**唯一一处「字段可以不在」**，
而它恰好是票 27 量到的那个真实故障（`blocks=[tool_use]`、`stop_reason=tool_use`、**`input={}`**）。

---

### ❓ Q4 — R12 那一发的 `rejections` **进不进容器**

- **(a)** 进（`[{reason, detail}]`，与 `DesignRejectedError` 里那份**同一个数组**）
- **(b)** 不进 —— 拒因看报错就够了

➡️ **推荐 (a)**。第一轮 Q5 你已经裁过「**保留当次实际拒因**，避免将来重放得到不同结论」——
而 R12 那一档的「当次实际拒因」**就是这个 `rejections[]`**。
不放它，那一档的拒因仍旧只能从报错文字里读（而那正是第八跑今天在做的事）。

---

### ❓ Q5 — **什么情况下**写容器（判据不是「抛的是哪个类」）

- **(a)** 判据是 **`compile-design` 这一圈里有没有拿到过模型入参**：拿到过就写，一个都没拿到就不写
- **(b)** 只在 R12 拒绝那一档写
- **(c)** 理解段**任何**抛出都写（含 `http` / `timeout`，哪怕一片入参都没有）

➡️ **推荐 (a)**。⚠️ 它关掉一个**票面完全没提的边**：`http` / `timeout` 抛在**第 2 发**时，
**第 1 发那份入参就在作用域里**——按「抛的类」分流会把它一起丢掉。
(a) 让这条边自然落地，还顺手排除了 (c) 那种「写一个什么都没有的容器」的空场合。

---

### ❓ Q6 — 容器**写盘失败**怎么办

- **(a)** **best-effort**：写失败吞掉，**原始错误原样抛出**（绝不替换、绝不吞）
- **(b)** 写失败就抛写盘那个错

➡️ **推荐 (a)**。先例 B 的注释里逐字写着：冻过的对象挂不上时「吞掉那个 `TypeError`，
但**绝不**因此替换或吞掉**原异常**（那是本末倒置）」。同一条道理：诊断产物**不许**把诊断对象弄丢。

---

### ❓ Q7 — error **怎么**把那一摞入参带出来

- **(a)** 扩 `Carried`（`command.ts:100`）加一个键 + 一个 reader（照 `ledgerOfError` / `failureDirOfError`），
  **两个 error 类不动**
- **(b)** `DesignRejectedError` / `CompileDesignError` **各加**一个构造参数与字段

➡️ **推荐 (a)**。同一个文件里那套三件套（`Carried` / `carryOnError` / 两个 reader）已经立好，
三条边界（**没东西可带就不做** · **只挂可扩展对象** · **只加不改**）也已经写好——
(b) 等于在另一个文件里**重新发明一遍**同样的边界，还要两个类各维护一份。

---

### ❓ Q8 — 判据落在哪个测试文件

- **(a)** `packages/pipeline/tests/create-game.test.ts`（那里已经有 `§invariant 5 · 失败现场保留` 那一节）
  - **阳性**：造一次拒绝 ⇒ `.failed-<ts>/design-attempts.json` **在**、且 `parseXxx` **读得回来**
  - **阴性**：那一跑**成功**时，`run/v<N>/` 的**文件清单**与**逐字节**都不变
- **(b)** 另起一个文件

➡️ **推荐 (a)**。⚠️ 阴性判据要有牙齿：只比「文件清单」不够——建议**逐文件比对字节**
（成功路径本来就没有这个写入点，所以这条判据是**结构性**成立的，测试只是把它钉住）。

---

## 三、我预判的第三轮（现在还不必答）

- `raw` 缺省时的**读法**（reader 回什么：`undefined` 那份 / 一个说「没有入参」的值）
- 容器要不要在**账**那一侧留一句（还是完全不动账 —— 第一轮 Q7 已倾向「不动」）
- `parseXxx` 失败时**谁**报错、报给谁（阳性判据要求「读得回来」，那读不回来时呢）

---

## 裁定表（填这一张）

| 题 | 我的推荐 | 你的裁定 |
|---|---|---|
| **Q1** 容器的文件名 | (a) `design-attempts.json` | |
| **Q2** 要不要 schema / 住哪 | (a) 要；`contracts`，照 `master-ratio.ts` 三件套 | |
| **Q3** 封套断面（含 `raw` 可缺） | 就提案那个形状；`raw` 可缺 | |
| **Q4** R12 的 `rejections` 进不进 | (a) 进 | |
| **Q5** 什么情况下写 | (a) 判据 = 这一圈有没有拿到过入参 | |
| **Q6** 写盘失败怎么办 | (a) best-effort，原错误照抛 | |
| **Q7** error 怎么带 | (a) 扩 `Carried` + 加一个 reader；两个 error 类不动 | |
| **Q8** 判据落在哪 | (a) `create-game.test.ts` · 阳性 + 阴性（逐字节） | |

（若某题的裁定是**选项之外**的第三条路，直接写在第 3 列；有**补充裁定**或**边界**，
另起一段写在表下面 —— 我会把你的原话逐字抄进票 55 的 `## Answer`。）
