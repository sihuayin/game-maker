# 78. `reviewPack` 的**接线** —— 它今天**零消费者**，而接它要一次独立裁定（调用位置 · 调用成本 · 与 R9 清单检查点的先后）

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 22「视觉观察要喂原图」](22-review-with-reference-image.md)的 **Q2**。人裁（2026-10-14）原话逐字：
> 「本票只裁决方向；**接线另开票**。将 `assemble.ts:133` 的过期理由记入 `Not yet specified`，
> **不在本票顺带改代码或接线**。」
> 票 22 的补充裁定第 3 条原话逐字：
> 「**接线票须独立裁定调用位置、调用成本及与 R9 清单检查点的先后关系。没有实测依据，不预先指定流水线顺序。**」
> 本轮（2026-10-14）**A1 / 补充边界第 4 条**把它点成要开的一张：
> 「五个议题分别立票，保留各自边界，不合并成一张大票」·「分别处理 `reviewPack` 接线……**每张独立裁定**」。
> ⚠️ **立票 ≠ 批准施工**（[票 65](65-layer-coverage-at-config.md) / [票 76](76-cross-stage-sample-conflict.md) 先例逐字沿用）：
> 本票面**只登记现场与落点**；动 CLI / MCP / 流水线一行都要**另一次独立授权**。

## Question

**票 22 已经裁了「方向」（原图该参与），而「接线」这一半一个字都没裁。**

今天的现场（本 session 逐处核过，行号是**当前**的）：

```text
reviewPack        packages/assets/src/review.ts:74        实现（ReviewOptions :53-63 · ReviewResult :65-67）
                  :111  await doFetch(...)                ← ⚠️ **它要花一次视觉调用的钱**
                  :93   { type: "image", source: { … base64 PNG … } }   ← 喂进去的是**联系表**
packContactSheet  packages/assets/src/review.ts:18        拼联系表本身是**纯的**（读 manifest + PNG，零网络）
它的纪律        review.ts:4  「**它不进任何自动门禁**」· :72 「不打分、不判定通过与否、不阻断」

消费者          全仓**只有一个**：packages/assets/tests/review.test.ts（4 处调用，带假 fetchImpl）
                packages/cli/src 与 packages/mcp/src **零出现**（两个 grep 都是零）
```

⇒ ⭐ **一个要花钱、且明写着「不阻断」的函数，今天一次都没被真链调过。**
接它**不是**接一条判据，是决定**谁来付这一发、以及人什么时候看得见它**。

⚠️ **这一票要裁的三件事，票 22 已经逐字列出来了**（上面那段引文）：
**调用位置** · **调用成本** · **与 R9 清单检查点的先后**。三件都要答，缺一件就答不成。

## 已经量到的（别重新量）

- **R9 原文**（`.scratch/game-maker-v2/map.md:1518`）：
  「**R9** | 人工点**只有一个**：**清单处的检查点**，`--yes` 跳过（Q10b）」。
  ⚠️ **不要跟 `game-creation-v1/map.md:119` 那个 R9 搞混** —— 那一张是 monorepo 分包规则，同名不同物。
- **检查点今天落在哪**（逐行核过）：
  `packages/pipeline/src/create-game.ts:143` `/** 检查点（R9）那一刻给调用方看的东西：定稿的 run 目录 + **磁盘上那份清单**。 */`
  · `:144` `export type CheckpointContext = { runDir; recipePath; recipe }` · `:154` `onRecipe?: (ctx) => …`
  · `:520` `input.onRecipe?.({ … })`。
  **CLI 那一头靠「停下进程」实现**（`packages/cli/src/cli.ts:274` `awaitingCheckpoint`，
  调用点 `:471`，入口 `:469` `if (flags.yes !== true)`，返回 `:290` `status: "awaiting"`）；
  **MCP 那头跳过它**（`packages/mcp/src/server.ts:121` 逐字「⚠️ **它不停**（R9 那个检查点只活在 CLI 上）」）。
- **⚠️ 一条顺带量到的**：`onRecipe` **自己也没有生产调用者**（`cli.ts` / `server.ts` 都不传它，
  CLI 是用「停下进程」实现检查点的）⇒ 它今天**只被测试调过**（`packages/pipeline/tests/create-game.test.ts:187`）。
  ⇒ 接线若走 `onRecipe`，等于**同时**给一个今天只有测试用的钩子找第一个真消费者。
- **链上的步骤表**：`create-game.ts:39-40`
  `UNDERSTANDING_STEPS = ["visual-world","intent","design","character-dna","recipe"]` ·
  `BUILD_STEPS = ["pack","config","qa"]`（站点在 `cli.ts` 那一层装配）。
  ⚠️ 而 `pack` 是**唯一花钱**的那一步 ⇒ 「接在检查点前还是后」不是排版问题，是**钱在谁前面**的问题。
- **落点在结构上够得着**：`packages/pipeline/src/create-game.ts:31` 已经 `import … @game-maker/assets`，
  而 `reviewPack` 从 `packages/assets/src/index.ts:22` 导出 ⇒ **接得进去**（不是「做不到」，是「还没裁」）。
- **⚠️ 有一处边界是别人定的、本票不许顺手推翻**：
  `packages/qa/src/assemble.ts:37-39` 逐字「今天合成器**只装配、不采集**：它够不着那两个家
  （`reviewPack` / `inspectPack` 住…）」·「装配**不许**顺手去调 `reviewPack`」（那要花一次视觉调用的钱）」
  · `packages/contracts/src/qa.ts:337` 逐字「⚠️ 特别地：`reviewPack` **要花钱**（一次视觉调用）。
  观察**必须由上游算好传进来**，…」
  ⇒ ⭐ **「谁采集、谁装配」这条分工已经写死在两处注里** —— 本票要裁的是**采集者是谁**，
  **不是**把装配器改成采集器。
- **票 22 已经裁掉的两半**（不要重开）：Q1 = (a) 是缺口，**但只补足观察的信息来源**，
  不判分、不阻断、**`similarity` 不得成为契约指标**；Q3 = (b) **暂不在 `CONTEXT.md` 立词**，
  「等**接线票有明确消费者时**，再在那里定义规范名」。
  ⇒ ⚠️ **Q3 把「立词」挂在本票的结果上**：本票若裁「不接」，那一格就仍然没有消费者。

## 要裁决的（留给下一轮 grill，此处只列边界）

1. **接在哪一层？** 至少三条（⚠️ 本票**不预先指定**，票 22 也明说「没有实测依据，不预先指定流水线顺序」）：
   - **(a) CLI 命令**（`cli.ts:22-30` 的 `USAGE` 表 + `:457-578` 那个 `switch`，今天**没有** `review` 这一支）；
   - **(b) MCP 工具**（`server.ts:70` 的 `TOOLS`，今天**没有** review 那一项）；
   - **(c) 链上一步**（接进 `create-game.ts`，很可能经 `onRecipe` 那个今天没有真消费者的钩子）。
   ⚠️ 三条路的**代价不同**：(a)(b) 是「人主动调一次、花一次钱」，(c) 是「**链上每一步都自动花**」——
   而 R9 说人工点**只有一个**，这直接撞上第 3 问。
2. **调用成本怎么摆到人眼前？** 它是**一次视觉调用**（`review.ts:111`）。
   今天全仓**没有任何调用预算机制/成本账**（账是**事后**记的：`ledger.json`）⇒
   「这一发什么时候发、发了算谁的」今天**只能靠人裁**，没有闸可依。
3. **与 R9 清单检查点的先后？** 这是票 22 点名要裁的那一条，也是最要紧的一条：
   - 检查点**前**：人在**还没买图**的时候就能看到一次视觉观察 —— ⚠️ 但那时的「包」还不存在，
     而 `reviewPack` 读的是**包**（`packDir`）⇒ 结构上可能**不成立**（要当场核）。
   - 检查点**后**：观察是「这批图跟原图差在哪」，⚠️ 而钱**已经花了**（`pack` 在前）。
   ⚠️ 两种都不是免费的；本票要的是**选一个并说清代价**。
4. **`assemble.ts:133` 那句理由怎么收尾？** 它今天写死 `unavailable`，理由逐字是
   「这次创建链没有跑 `reviewPack`（它要花一次视觉调用的钱，而**它今天比的是联系表、不是参考图**）」。
   ⚠️ **后半个理由随票 22 的裁定过期了**（Q1 已裁「是缺口、要补足观察的信息来源」）——
   而**前半个理由（要花钱）**仍然成立。本票裁定之后，那句话该改成什么、由谁改，**要在这里说清**。
5. **补了原图之后，观察与「联系表」的关系**：票 22 的 Q1 只裁了「补足信息来源」，
   而 `packContactSheet`（`:18`，纯函数）**今天拼的还是联系表** ⇒
   「喂原图」是**换掉**联系表、还是**两张都喂**，⚠️ 票 22 **没裁**（它明说 §2/§4 那三个子问题一个字都没裁）。

## 边界（人裁原话 + 本图既有约定）

- 「本票只裁决方向；**接线另开票**……**不在本票顺带改代码或接线**。」（票 22 Q2 逐字）
- 「接线票须**独立裁定**调用位置、调用成本及与 R9 清单检查点的先后关系。
  **没有实测依据，不预先指定流水线顺序**。」（票 22 补充裁定第 3 条逐字）
- 「分别处理 `reviewPack` 接线……**每张独立裁定**」·「保留各自边界，**不合并成一张大票**」（本轮 A1 逐字）
- **本票只作裁定**：不改 `review.ts` / `cli.ts` / `server.ts` / `create-game.ts` / `assemble.ts` 一行。
- **不动 R 表**（R9 是**被引用**的，不是被改的 —— R17：改 R 表要另一张票）· `packages/qa` 一行不碰 ·
  `game-maker.local.json` 一个字不动 · **不执行任何付费真跑**。
- ⚠️ **与[票 79](79-duplicate-animation-names.md) / [票 80](80-hud-panel-world-ruler-removal.md) /
  [票 81](81-world-ruler-semantics-differences.md) / [票 82](82-hud-anchor-convention-ownership.md) 分开**：
  五张同批开，**各裁各的**（本轮 A1 原话）。

## 验收（今天写得出来的部分）

- **免费证得了的**：接线的**三条路各自的落点**（CLI 表 / MCP 表 / `onRecipe`）**都是盘上的字**，
  可以逐处读出「今天有没有这一支」「接上会经过谁」；以及「检查点前有没有包」这一条
  **可以只读地核**（读 `create-game.ts` 的步骤顺序即可判）。
- ⚠️ **免费证不了的**：**接了之后人会不会真的用它、以及那一发值不值** ——
  那要真跑（**票 23**，另出报告 + 逐次明确同意）。
- ⚠️ **本票不改任何断言**：今天与 `reviewPack` 有关的判据只有
  `packages/assets/tests/review.test.ts`（4 处，全部带假 `fetchImpl`）——
  它们是**函数级**的，不随接线变动而红。
