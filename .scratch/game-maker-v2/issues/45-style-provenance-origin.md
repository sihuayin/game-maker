# 45. `provenance.style.origin` 硬编码 `"human-in-session"` —— 而契约枚举里没有「模型生成」这一档

Type: grilling
Status: resolved
Owner: claude (2026-10-13)
Blocked by: —
Map: ../map.md
> 派生自[票 29](29-stylespec-parse-gate.md)。人类在那一票 **Q4 的边界**里明确处置，原话：
> 「`provenance.style.origin` 的错误声明**记录为独立问题，本票不修改**。」

## Question

`pack.ts:1004` 写包时把风格出处**硬编码**成 `"human-in-session"`：

```ts
style: { origin: "human-in-session", ref: "authoring/stylespec.json", stylespecId: style.id, checksum: sha256(Buffer.from(styleDoc)) },
```

而 `assetpack.ts:225` 那份契约把 `origin` 收成**两值枚举**：

```ts
origin: z.enum(["human-in-session", "fixture"])
```

⚠️ V2 链上的 `stylespec.json` 是**模型生成的** —— 既不是人在会话里给的，也不是 fixture。
⇒ **它在撒谎**。而这不是「忘了改一个字」，是**结构性**的：枚举里**根本没有第三个可用的值**。

⚠️ 票 29 顺带量到的两件事，让这个洞比票面看上去更具体：

1. **全仓只有一个写点**（`pack.ts:1004`），且它**永远**吐第一个值
   ⇒ `origin` 今天是个**常量**，不是一份记录。它不携带任何信息。
2. **第二个值 `"fixture"` 零生产者** —— 全仓没有任何地方产出 `"fixture"`。
   （实测两份签入的 fixture 包 `counter-siege/v4` 与 `last-train/v2` **都**写着 `"human-in-session"`。）
   ⇒ 那个枚举**实际只有一档**。

要裁决的：

1. **加不加第三档**（`model-generated`？）—— 加了，`origin` 才**第一次有可能说得对**。
2. **`fixture` 那一档怎么办？** 它零生产者，且签入的 fixture 包都没用它 ——
   是「还没轮到」，还是「本来就该由 `mode` 承担、这一档是多余的」？（`PackMode` 里已经有 `"fixture"` 了。）
3. ⚠️ **枚举是 `.strict()` 的**，加值要动契约（`assetpack.ts`）**与**它的两个消费者。
   R6 管的是 `StyleSpec`、**不管 `AssetPackManifest`** ⇒ 这里**不是**撞 R6；
   且加值是**扩大**不是替换，旧包的 `"human-in-session"` 仍然合法 ⇒ 要判的是「**要不要回填**既有包与 8 份 fixture」。
4. **该由谁决定这个值？** 票 29 的 Q4 已经定了 `stylespec.json` 是**产物** ——
   那么「产物自报出处」这个判据的落点在哪（写包时按调用方给的？还是从链路上游传下来？）需要一并定。

## Answer

### 裁定（人类，2026-10-13）—— 原话逐字

| 问题 | 你的裁定 | 依据与边界 |
|---|---|---|
| **Q1**：`provenance.style` 怎么处置 | **(a) 删整块，升级 `assetpack/v2 → v3`。** | 采纳推荐方案。四个字段没有提供别处不可获得的信息，其中 `origin` 还是不真实的声明；入口传参只能把假常量换成真常量，无法解决字段没有读者、无法被独立验证的问题。契约不应保留整块冗余信息来回避版本升级。 |
| **Q2**：资源级死的 `fixture` 算不算本票的活 | **(C) 只更正 `CONTEXT.md:268` 的过期定义，资源级枚举与 `derivePackMode` 另开票。** | 资源级 `AssetOrigin.fixture` 与 `provenance.style.origin` 不是同一种问题。前者有明确的潜在生产场景，不能仅凭当前零生产者就删除；但将其解释为「仓库内置降级件」已与降级机制退出的事实冲突。本票只修正文档定义，不改变资源级枚举、派生逻辑或既有包行为。 |

**补充裁定（原话逐字）**：

1. 「版本升级是有意接受的代价，不以规避升级为目标。 按票面 §0.3 的清单处理 `assetpack/v3`，包括格式常量、注释、两份入库 manifest、相关测试与文档引用；不要只删 schema 字段而遗漏版本迁移。」
2. 「`provenance.mode` 保持不动。 它有实际读者与派生、校验逻辑，不应与 `provenance.style` 一并删除。」
3. 「`CONTEXT.md:172` 中有关 manifest 重复内容及 StyleSpec 引用的承诺，要随 Q1 一并修正。 删除 `provenance.style` 后，不得继续声称 manifest 通过该字段记录所使用的 StyleSpec。」
4. 「本轮不提前裁定 `origin` 之外三个字段的独立去留。 Q1 已选定删除整块，因此它们随 `provenance.style` 一并移除，不再逐字段增加校验逻辑。」
5. **边界**：「严格遵守既定边界： 不动 R 表；不执行付费真跑；不改 `game-maker.local.json`；不碰 `packages/qa`；不增加重试、修复循环或自动重生成。」

**最终结论（原话逐字）**：「最终结论：Q1 选 (a)，Q2 选 (C)。 票 45 处理冗余的风格来源声明及其版本迁移，同时修正资源级 `fixture` 的过期文字定义；资源级 `fixture` 的机制处置留待独立裁定。」

### 一句话

**票面问的是「`origin` 该填什么才对」，而实测把它问倒了 —— 整块四个键没有一个该留着。**

`origin` 是个**硬编码的假话**（唯一写点永远吐 `"human-in-session"`，而 V2 链上那份 `stylespec.json` 是**模型写的**）；`ref` 指向的路径在 `files[]` 里已经逐个 checksum；`stylespecId` 就是那份文件**自己的 `id`**（实测 `counter-siege/v4`：manifest 写 `"style-ref"`，盘上 `authoring/stylespec.json` 也写 `"style-ref"`，**逐字相同**）；`checksum` 同上、且 `files[]` 兜着。⇒ 四个键**一个也不携带别处拿不到的信息**。
两条路曾经看起来都行得通：**加一个第三档**（把假常量换成真常量）或者**入口传参**（让调用方报出处）。而票 29 定过 `stylespec.json` 是**产物**，`packAssets` **结构上无法知道**那份 stylespec 是谁写的 ⇒ 加档只是把一处假话挪到另一处，**字段仍然没有读者、也无法被独立验证**。裁定 (a)：**整块删掉，升 `assetpack/v3`。**

⚠️ **升版是一次有意付的代价，不是要绕开的坑**（补充裁定 1 明说了）—— 两次升版一个价，2026-09-25 升 v2（删 `degradations`/`transport`）、2026-10-13 升 v3（删 `provenance.style`），**都是同一条 `.strict()` 规矩收的费**。

### 落地了什么（20 个文件）

| 面 | 落点 |
|---|---|
| **契约** | `contracts/src/assetpack.ts` —— `ASSET_PACK_FORMAT` 由 `"assetpack/v2"` 改成 `"assetpack/v3"`，文件头换头 + 新增一段带日期的理由；`provenance` 里**删掉整块 `style`**，**`mode` 一个字没动**（补充裁定 2） |
| **写入侧** | `assets/src/pack.ts` —— 那句硬编码整行删掉，原位留一段说清「为什么这块没了」的注（⚠️ 位置是 **`pack.ts:1061`**，票面写的 `1004` 是**旧行号**，早已漂移）；`:84` 的版本号注一并顺延 |
| **入库包（2 份）** | `fixtures/packs/counter-siege/v4/manifest.json` · `fixtures/packs/last-train/v2/manifest.json` —— `format` 改 v3、删 `style` 块（各 10 行） |
| **测试（6 份）** | `contracts/tests/assetpack.test.ts`（含「这里曾有 `style`」的墓碑注）· `contracts/tests/recipe.test.ts` · `contracts/tests/visual-world.test.ts`（那条判据的**说辞**换过，见下）· `assets/tests/ledger.test.ts`（钉住 `provenance` **只剩 `mode`**）· `pipeline/tests/create-game.test.ts`（同一条钉法）· `cli/tests/cli.test.ts` + `mcp/tests/server.test.ts`（见下，本票**意外**撞出来的） |
| **注释 / 文档** | `contracts/src/visual-world.ts`（兼容载体 `style` 的三条理由 → **两条**）· `vision/src/prompts.ts`（`style.id` 的「照着抄」改锚到那份文件**自己的身份**）· `contracts/src/ledger.ts` · `coverage.ts` · `master-ratio.ts` · `asset-spec.ts`（四处版本叙述不再钉死在**过期的 v2** 上）· `CONTEXT.md`（manifest 词条 · `provenance` 词条 · 账本那节的升版账）· `fixtures/style-spec.provenance.json`（`reproduces` 那句原先指着已删的 `provenance.style.checksum`，改指 `files[]` 里 `authoring/stylespec.json` 那条 checksum —— **同一份事实换了新家**） |

⚠️ **`docs/counter-siege.md:120` 一个字没动** —— 它只是**引用**那份 provenance fixture，没有对 `provenance.style` 作任何声明，扫过确认**不假**。

### ⚠️⚠️ 票面没预料到的一件事：本机 `out/` 那两份测试

票面 §0.3 的代价清单第 ⑤ 条写的是「本地 `out/` 那 75 份包从此 `verify` 不过」，并判它**可以接受**（`out/` 在 `.gitignore:10` 里，是**本机垃圾场、不是仓库资产**）。
⚠️ **这句判断对了一半，漏了一半**：`out/` 确实不入库，但**有两个测试文件在读它** —— `packages/cli/tests/cli.test.ts` 与 `packages/mcp/tests/server.test.ts` 各自发现 `out/shift-change-assets/pack` 下**最新那一版**，拿它当「一份真包」来跑 `inspect`/`verify`。

**于是升版当天本机实测 3 条判据变红**（`inspect`/`verify` 在那份包上按契约拒 → 退 4；`isError` 为真；progress 一条不发）。✅ **那不是回归** —— 盘上那份是 **`assetpack/v1`**（比票面猜的 v2 还老），拒它**正是**新契约该做的事；坏的是**门槛**。

**门槛的原话是「有没有包」（`skipIf(!hasPack)`，只判 `manifest.json` 读不读得到），而这一组的主题是「CLI/MCP 在一份**当前契约**的包上怎么表现」。** 两者在契约不升版时恰好同真，一升版就分家。修法两条一起：
1. **门槛收成「有一份当前契约的真包」**（读 `format` 与 `ASSET_PACK_FORMAT` 比）；
2. **本机那份过期之后回落到入库的 fixture 包**（`fixtures/packs/counter-siege/v4`，本票已迁到 v3）—— 因为本机那份**不会自己变新**（重建要真跑管线 = **花钱**），只判存在的话这一组会在本机**永久 skip**，而本仓的尺子是「**一条从没被执行过的规矩等于没有**」。

⚠️ 顺带把 `mcp` 那条判据里写死的 `"shift-change-assets"` 改成**从被选中那份包自己的 manifest 读 id** —— 那句话的原意是「**MCP 把包的 id 原样带出来**」，不是「那个包叫什么」；写死只是当年那份本机包的名字。
✅ 收口后这两组**从「有本机包才跑」变成每次都跑**（清检出上也跑）—— 覆盖**不减反增**。

### 判据

- `pnpm build` 干净（⚠️ 改契约**必须先 build**，consumers 读的是 built `dist` —— 本仓记过这个坑）
- `tsc -b --force` 干净 · `pnpm typecheck` 9 包全过
- `pnpm test` **1273/1273**（76 文件）
- `pnpm check:deps` ✅ 9 包 · `pnpm check:links` ✅ 201 份文档 / 1156 条链接
- **零付费跑**（R 表边界 + 补充裁定 5）

### 边界（原话见上）

**R 表没动** · 没付费真跑 · `game-maker.local.json` 一个字没动 · `packages/qa` 一行没碰 · 没加重试 / 修复循环 / 自动重生成 · **`provenance.mode` 没动** · **`derivePackMode` 与资源级枚举没动**。

### 另开票

按 Q2 = (C)：「**资源级 `AssetOrigin.fixture` 的机制处置留待独立裁定**」—— 那条枚举值与 `derivePackMode` 本票**一个字没动**，只更正了 `CONTEXT.md` 里那句与降级机制一起过期的话。另见 [票 57](57-asset-origin-fixture.md)。
