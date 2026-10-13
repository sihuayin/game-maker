# 69. `CharacterDNA.palette` 的 `palette:N` **没有越界判据** —— 而 VWS 的六桶有同款 gate，且 `dnaBrief` 把悬空引用**原样**写进生图提示词

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 56「理解层四步的散文与契约 gate 系统性一致性审计」](56-prose-vs-gate-audit.md) 对照表的 **D 行**。
> ⚠️ **形状是新的**（票 56 §3 那四种都不完全是它）：不是「gate 判的东西散文一个字没说」，
> 是它的**镜像** ——「**散文要求的东西没有任何 gate 在看**」，而**同一个不变量在隔壁契约里被 gate 着**。
> ⚠️ **立票 ≠ 批准施工**：本票面**只写清楚要裁什么**。

## 1 · 立案现场

**散文** —— `packages/game-design/src/prompts.ts:378`（`DNA_FIELD_HINTS.palette`）与 `:358`（工具说明第 4 条）：

> `palette` 只能写 `palette:<下标>`（**从上面那份色板里选**），**不许**写 hex 或颜色名。
> ⚠️ 它的用途是「这个角色身上哪些颜色」，不是「这个世界的色板长什么样」。

**判据 —— 这一侧没有。** `packages/contracts/src/character-dna.ts:111` 只有
`palette: z.array(PaletteRefShape)`，而 `PaletteRefShape` 是 `/^palette:\d+$/` 的**正则**
⇒ `palette:99` **合法通过**（只要色板长度不是 100）。

**隔壁契约有一模一样的 gate** —— `packages/contracts/src/visual-world.ts` 顶层 `superRefine`
对**六桶 + `materials.*.color`** 里的每一个 ref 逐个查 `< v.style.palette.length`，
并在注释里把这件事称作「文书自己跟自己矛盾」。⇒ **同一条不变量（ref 必须在色板长度之内），
`VisualWorldSpec` 判、`CharacterDNA` 不判** —— 而**两份契约引用的是同一份 `style.palette`**。

## 2 · 越界时会发生什么（读出来的，不是推出来的）

`packages/assets/src/prompt.ts:83`（`dnaBrief`）：

```ts
.map((ref) => style.palette[Number(ref.slice("palette:".length))] ?? ref)
```

⇒ 越界时取到 `undefined`，**落回 `?? ref`**，把字面量字符串 `palette:9` **原样拼进生图提示词**。
而 `packages/assets/src/prompt.ts` 的文件头逐字写着「**模型不认 `palette:3` 这个说法**，它认颜色」
（那正是这一行要翻译的理由）⇒ 越界 ref 走到的是**翻译失败**那一档，而**没有任何东西会红**：
`PaletteRefShape` 过、`dnaBrief` 不抛、生成照发。

## 3 · 它今天够不够得着

**够**：DNA 那一发在链上，`palette` 是**必填**字段（`CharacterDNA` 八个键一个都不许省），
而越界与否**完全由模型自己决定**（它看不到色板长度这个数字以外的任何约束；
`characterClassBrief` 只把色板按 `i=#hex` 印出来）。

## 4 · 有没有真跑证据

⚠️ **没有（阴性读数，n=9）**。盘上 **9 份**真 `character-dna.json`
（色板长度 **11 / 12 / 14 / 11 / 11 / 6 / 6 / 12 / 11** · 20 个角色 · **96 个 `palette` 元素**），
越界 ref **0 个** —— 模型实测**没有**越界过。
⇒ 按票 52 的先例（「形状口味被判据化」、**零尸体**也立票），这**不构成不立票的理由**，
但它确实是票 56 对照表里**只靠推理得出**的那一条 ⇒ 处置时请把这一点算进去。

## 5 · 要裁什么（本票的问题）

- **Q1 · 补不补那条 gate**：(a) **补**（在 `CharacterDNAFileSchema` 的 `superRefine` 里加同款
  `ref < vws.style.palette.length` 检查）—— ⚠️ 但 `CharacterDNAFileSchema` 今天**不吃 `vws`**
  （它是文件形状，色板长度不在它手上）⇒ 这会**改契约的输入形状**，要单独判 ·
  (b) **不补，只把「越界了会怎样」写进散文**（即：把它变成票 68 那句话的一部分）·
  (c) **不补判据、也不改散文**，改 `dnaBrief` 的兜底（`?? ref` ⇒ 显式报错 / 取 `palette:0`）·
  (d) 都不动，记为「**故意的松**」（理由今天不成立的话请写出来）。
- **Q2 · 若走 (a)：判在哪儿才对** —— `contracts` 的 schema 级 / `build-character-dna.ts` 的装配级
  （那里**已经**有 `vws`，且已有 `characterSetGate` / `verbatimCopyGuard` 两只手）/
  `assets` 的 `dnaBrief` 级。⚠️ 三个位置的**失败语义不同**（`schema` 会重采样、装配级不重采样）⇒ 这一问有真代价。
- **Q3 · 与票 68 的关系**：那两处**住同一句话**（`DNA_FIELD_HINTS.palette`）。
  票 68 只改「写 hex 的后果」那半；**若本票裁 (b)，那句话再补半句** —— 两票**同一句话**，落地时对一眼。

## 6 · 边界

- **不动 R 表** · **不加/不改判据**（Q1 若要加，是**另一次独立授权**）· **不改任何契约的语义**。
- **不加重试 / 修复循环 / 自动重生成**（R13）。
- `packages/qa` 一行不碰 · `game-maker.local.json` 一个字不动 · **不执行任何付费真跑**。
