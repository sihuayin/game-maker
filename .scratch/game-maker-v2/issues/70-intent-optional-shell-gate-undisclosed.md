# 70. 意图层 gate ④（`progression` / `challenge` **出现了但两个字段都空**）散文一个字没说 —— 而契约文件头正声称「这条规矩由 `prompts.ts` 补」

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 56「理解层四步的散文与契约 gate 系统性一致性审计」](56-prose-vs-gate-audit.md) 对照表的 **H 行**。
> ⚠️ **它是那一次扫描里唯一一条落在 `analyze-intent` 上的发现** ——
> 而扫描前对这一步的**预期**是「零发现」（五组 gate 规矩逐条都在散文里活着）。
> ⚠️ **立票 ≠ 批准施工**：本票面**只写清楚要裁什么**。

## 1 · 立案现场

**gate** —— `packages/contracts/src/game-intent.ts:221-226`（顶层 `superRefine` 第 ④ 组）：

```ts
// ④ 可选对象**若出现**，不得是空壳（整个省掉合法，`{}` 不合法）
for (const label of ["progression", "challenge"] as const) {
  const o = v[label];
  if (o !== undefined && blank(o.type) && blank(o.description))
    issue([label], `\`${label}\` 出现了但 \`type\` 与 \`description\` 都是空的 ——
      要么**整个省掉**、要么给一句；空壳是第三种东西，没人分得出它是哪一种`);
}
```

⚠️ **注意 `progression` / `challenge` 两个字段在 schema 里都是 `optional`**
（`:163-169`：`z.strictObject({ type: z.string().optional(), description: z.string().optional() }).optional()`）
⇒ **`{}` 过 Zod、被 gate 拒** —— 这条规矩**只住在 `superRefine` 里**，而
`toJSONSchema` 会**静默丢掉**它（票 08 探针实测）⇒ **模型看不见它**。

**散文 —— 没有任何一句说这条。** 意图层那两份散文里，与它最接近的两句是：

- `packages/game-design/src/prompts.ts:154-155`（`FIELD_HINTS`）：
  > `progression`: "`{ type, description }`：进阶。需求提了才填，给一句就够；**推不出就整个省掉**"
  > `challenge`: "`{ type, description }`：难度来源。同上"
- `:89-90`（`TOOL_DESCRIPTION` 第 5 条）：
  > **不许有空串**：必填的字符串字段都得有内容，数组里也不许留空串占位。…

⚠️ 两处**都不覆盖**这条 gate：`progression.type` / `description` **不是「必填的字符串字段」**
（它们在 schema 里是 `optional`），而「给一句就够」是一句**建议**，**不是**「出现了就不能两个都空、
违反了判失败」。⇒ 按票 56 §3 的分类，这是**第四种形状**：「**gate 判的东西散文一个字没说**」。

## 2 · ⚠️ 更要紧的一处：契约**自己声称**这条规矩由散文补

`packages/contracts/src/game-intent.ts:119-121` 逐字写着：

> ⚠️ **这条 check 模型看不见**：`toJSONSchema` 会静默丢掉 `superRefine`（票 08 探针实测）。
> 这正是它该有的样子（它是 gate，不是提示）—— 而「让模型知道有这条规矩」那件事，
> **由 `game-design/src/prompts.ts` 在工具 `description` 里补**（票 08 的 R2-Q5 那个杠杆）。

⚠️ **这句话对 ① ② ③ ⑤ ⑤b ⑤c 六组成立，对 ④ 不成立** ——
⇒ 这不是「散文漏了一句话」，是**契约里写着的一句话对其中一组是不成立的**
（而它是**给下一个读代码的人看的**：那个人会照着它相信覆盖已经做到了）。
⚠️ 与[票 68](68-dna-palette-hex-consequence-stated-wrong.md) 那处**同款**：
都是「文书写下的一句**关于文书自己的**断言，今天已经不成立」。

## 3 · 它今天够不够得着

**够，但很窄**：要撞上它，模型必须**在 `progression` / `challenge` 上各写出一个空壳**
（`{}`、`{type:""}`、或 `{description:"  "}`）—— 即「决定了有这个系统、却没说出它是什么」。

## 4 · 有没有真跑证据

⚠️ **没有（n=0，而且是阴性读数）**。盘上 **13 份**真意图里：

- **12 份** `progression` 与 `challenge` **整个缺席**（**合法**的那条路 —— 也是散文推荐的）；
- **1 份**（`run-out/wasteland-scavenger-run/run/v1/game-intent.json`）两份都**填满了**
  （`{"type":"未知","description":"需求只提到有最终目标…"}` / `{"type":"敌人与危险","description":"…"}`）；
- **空壳：0 份**。

⇒ 模型实测的行为是「**要么全给、要么全省**」—— 正是 gate ④ 想要的那个二选一。
⚠️ 但**这不构成不立票的理由**：判据今天**只在真跑撞见时才会被发现**（本票的立案方式正是「读」），
而票 52 的先例（零尸体也立票）在这里同样适用。

## 5 · 要裁什么（本票的问题）

- **Q1 · 处置**：(a) **散文补一句**（在 `FIELD_HINTS.progression` / `.challenge` 那两行或第 5 条里
  写明「**出现了就得给一句**；两个都空 = 第三种东西，判失败、当场重来」）·
  (b) **只改契约那句注释**（把 `:119-121` 那句「由 `prompts.ts` 补」改成「除 ④ 之外的各组由 `prompts.ts` 补，
  ④ 今天**没有**模型面向的对应句」）—— **不改散文、只让注释说实话** ·
  (c) 两者都做 · (d) 都不动。
- **Q2 · 若要 (a)：那句话住哪** —— 工具说明第 5 条那一组（它已经在管「空串 / 至少一条 / 可以是空数组」），
  还是 `FIELD_HINTS.progression` 里那两行？⚠️ 前者是**模型读得到的规矩清单**，
  后者是**台账**（票 54 量到的教训：**真正把模型推上错路的是台账**）。
- **Q3 · 顺带量到的一处小不对称**：gate 的 `blank()` 是 `trim()` 之后的判断，
  而意图层散文说「**不许有空串**」、**没有**像 DNA 那一层（`prompts.ts:344-346`）
  那样把「`"  "` 与 `""` 一样不许」**明写出来**。要不要一并对齐？（⚠️ 同一个 `blank()` 也管着 ① ② 两组。）

## 6 · 边界

- **不动 R 表** · **不改任何契约的语义**（`blank()` 一个字不碰）· **不加/不改判据** · **不改 gate ④ 的射程**。
- **不加重试 / 修复循环 / 自动重生成**（R13）。
- `packages/qa` 一行不碰 · `game-maker.local.json` 一个字不动 · **不执行任何付费真跑**。
