# 票 45 · `provenance.style.origin` 硬编码 `"human-in-session"`（第 1 轮）

> **自包含副本**：把它整个拷走就能答，不需要任何上下文。
> 票：`.scratch/game-maker-v2/issues/45-style-provenance-origin.md`（**grilling（HITL）** · **不挡任何票** · 不阻塞 V2 终点）
> 地图：`.scratch/game-maker-v2/map.md`（effort `game-maker-v2`）· 来历：**票 29 的 Q4 边界**
> **怎么答**：每题下面直接写你的裁定；拿不准就写「先按你推荐的来」。末尾有空白裁定表。
> ⚠️ **本票是 HITL**：执行者**不得替你回答**。

---

## 0 · 已经定过的事（本轮不重开）

- **R17（元规则）**：**R 表是决策记录，`docs/v2` 是它的表达层；要改 R 表必须重新开票**。
- **R5**：本图**把执行带进来** —— 票**解出来**的决定当场实现。
- **R7**（门）：**说不出「谁读它」的字段不进契约。**
- **R16**：**旧路径不动**（`assets` 的 drawlist / derive / `pack` 那条手写清单的路照旧）。
- **票 29 的 Q4 边界，原话逐字**：
  > 「按产物处理。V2 链由程序生成该文件，校验失败就拒绝，不将它作为可自动容错的手写输入。
  > `provenance.style.origin` 的错误声明**记录为独立问题，本票不修改**。」
- **不是 R6 的问题**：R6 钉的是 `StyleSpecSchema`，`AssetPackManifest` **不在它管辖内**（票面已判，我复核同意）。
- **边界（沿用本图历次）**：**不动 R 表**（要动按 R17 另开票）· **不开任何付费跑、一张图不买** ·
  **不动 `game-maker.local.json`** · **不碰 `packages/qa`** · **不加重试 / 修复循环 / 自动重生成**（R13 不动）。

⚠️ **我掂过「要不要干脆把它判出终点、关掉不办」** —— 没这么建议，理由是：**它是一个「假话」，不是一条「够不着的好意」**。
终点不管出处，但本仓库对「包里有一句假话」是有立场的（`mode` 那一整套就是为它建的）。
⇒ 它是**范围内**的，只是**说不清该怎么修**。

---

## 0.1 · 病根一句话

`pack.ts:1061` 写包时把风格出处**硬编码**成一个常量：

```ts
style: { origin: "human-in-session", ref: "authoring/stylespec.json", stylespecId: style.id, checksum: sha256(Buffer.from(styleDoc)) },
```

而 `assetpack.ts:225` 那份契约把它收成**两值枚举**：`z.enum(["human-in-session", "fixture"])`。

**V2 链上那份 `stylespec.json` 是模型写的**（`ops.ts:255` —— `planAssets` 把 `world.style` 落盘，
而那份 `style` 来自 `analyze-reference`）⇒ **它说自己在撒谎**。这不是「忘了改一个字」，是**枚举里根本没有第三个值**。

---

## 0.2 · 我量到的（票面没写、或与票面对不上的）

票面的三条前提**全部复核为真**（唯一写点 · `fixture` 零生产者 · 枚举是 `.strict()`）。⚠️ **但下面是票面没有的**：

**① `provenance.style` 全仓零读者 —— 四个键没有一格携带别处拿不到的信息。**

| 键 | 它实际是什么 | 别处拿得到吗 |
|---|---|---|
| `origin` | 常量 `"human-in-session"`（唯一写点 `pack.ts:1061`） | — 它是**假话** |
| `ref` | 常量 `"authoring/stylespec.json"` —— **就是写它自己那一行的路径** | 包里只有一份 stylespec |
| `stylespecId` | `style.id` | ✅ **实测**：`fixtures/packs/counter-siege/v4/authoring/stylespec.json` 里白纸黑字 `"id": "style-ref"`，与 manifest 的 `stylespecId` **逐字相同** |
| `checksum` | `sha256(styleDoc)` | ✅ **实测**：与 `files[]` 里 `authoring/stylespec.json` 那条 **`checksum` 完全相等**（`SAME CHECKSUM: True`）—— `files[]` 是 `walk(packDir)` 穷举，那份文件**本来就在里面** |

**零读者的实证**：`verifyPack`（`ops.ts:1402`）只读 `m.provenance.mode`；`inspect`（`ops.ts:1534`）也只印 `mode`；
全仓 `provenance.style` / `stylespecId` 在**可执行代码里没有任何一处读**（只有三处**注释**提到它）。

⚠️ **而 `CONTEXT.md:172` 的 manifest 条自己写着另一半**：manifest **「不重复图集里已有的内容 · 不重复可派生的内容」**。
⇒ `provenance.style` **踩的是这条**，比 R7 那条门还硬一格。

**② 票面漏了另一半：资源级 `AssetOrigin.fixture` 也零生产者。**

`pack.ts:332` 的 `Built.origin` 只有 `generated | imported` ⇒ **`AssetOrigin.fixture` 从来没有被生产过**，
`PackMode.fixture`（`derivePackMode` 的 `allOf("fixture")` 那一支）因此**永远派生不出来**。
⚠️ **于是死值是两个，不是一个** —— 票面只点了 `provenance.style` 那一处。

**③ 「谁写的」在写点结构性不可知 —— 这是本票最要紧的一条。**

`packAssets` 收到的只有 `opts.visualWorld`（一份 `VisualWorldSpec` **对象**，`pack.ts:329`），
它**不知道那份 VWS 是模型投出来的还是人写的**；⚠️ **pipeline 同样不知道** —— 它也只是把收到的 VWS 投成 stylespec（`ops.ts:255`）。
⇒ 要让 `origin` 说真话，这个值**必须从 `create` 入口一路穿下来**（`cli.ts:512` / `server.ts:239` / `create-game.ts:385` 三个调用点），
而**穿下来之后照样没有任何东西校它**（`mode` 是有 `derivePackMode` + superRefine **两头对账**的，这里没有对家）。

**④ ⚠️ 改键名和删键一样贵。** `provenance` 是 `.strict()` ⇒ **改名 = 旧包多一个键 = 解析不过 = 照样要升 v3**。
（票面只说了「加值不用升版」，那是对的；但没点破「改名也躲不掉」。）

**⑤ 「零生产者」在本仓库**不是**判死刑的先例** —— `PaletteBinding.unbound` 同样零生产者，
而它被**故意留着**，理由写在 `assetpack.ts:80-84`：它是「不量化、颜色不受色板约束」的**唯一写法**，
删掉就是让这类包「在结构上无法诚实」。⚠️ 判词因此是：**有没有一个说得出的将来生产者**……

---

## 0.3 · 版本代价的实测清单（供 Q1 掂量）

`format: z.literal(ASSET_PACK_FORMAT)`（`assetpack.ts:215`，常量在 `:30`）⇒ **升 v3 会让磁盘上所有 v2 包解析不过**。

| 动法 | 破什么 |
|---|---|
| **加一个枚举值** | ✅ **零破坏**（旧包的 `"human-in-session"` 仍合法）。票面这条是对的 |
| **删键 / 改名** | ⚠️ **升 `assetpack/v2 → v3`**：① 常量 + 文件头两处注释 ② **入库 2 份 manifest**（`fixtures/packs/counter-siege/v4` · `last-train/v2`）要改 ③ **4 个测试文件**（`contracts/tests/assetpack.test.ts:13,20` · `assets/tests/ledger.test.ts:82,83` · `pipeline/tests/create-game.test.ts:108` · `contracts/tests/recipe.test.ts:164`）④ **三处引用 `stylespecId` 的注释 / `CONTEXT.md:172`** 要改 —— ⚠️ 其中 `visual-world.ts:274` 是**兼容载体 `style` 的三条理由之③**（另两条站着，所以 VWS 本身不受影响，但那条理由会**变成假话**）⑤ **本地 `out/` 75 份包从此 `verify` 不过**（`out/` 在 `.gitignore` 里，是本地垃圾场，不是仓库资产） |

⚠️ **反向的一条实证**：本仓库有**三处**专门为「躲这一刀」建了 sidecar ——
`ledger.ts:6` · `coverage.ts:5` · `master-ratio.ts:10` 都写着「往 `provenance` 里加一格会迫使升版」。
那是本仓库**用行动表达的偏好**：能不加就别加。**这不是判决，是我该摆给你看的砝码。**

---

# 第 1 轮 · 前沿（两问）

## ❓ Q1 —— 根问题：`provenance.style` 这一块怎么处置？

这是**唯一挡住其余全部**的问题：读者在不在、`origin` 留不留、值谁给，**全都看它**。
下面是四条我不重复列形状的路。⚠️ 我把 `(d)` 也列出来，**不是因为它好**，是因为它**最省事、最容易顺手做掉**，
而不把它摆出来、最后被人当「小修」做掉，比现在争论一场更糟。

**(a) 删整块 `provenance.style`**（升 v3）
依据：`CONTEXT.md:172` 自己的「不重复可派生的内容」+ §0.2 ③ 那条「写点不可知」+ 下面的升版先例。
代价：§0.3 那张表整张。

**(b) 不升版：留着 + 给牙齿**（票面没想到的一条）
契约 `superRefine` 校 **`ref ∈ files[]`** 且 **`checksum` == `files[ref].checksum`**（与 `mode` 的双头对账同款）；
`verifyPack` 再校 **`stylespecId` == 包内 `authoring/stylespec.json` 的 `id`**（与它校 `ledger.json` / `master-ratios.json` 的「与包对不上」**同款同处**）。
⚠️ **但请看清楚它的成色**：写点两个值**同源**（`styleDoc` 与那份文件是同一个字符串）⇒ 这两条闸**只能抓「手改过的包」**，
在正常链路上**永远不会响**。本仓库对「恒等判据」的判词是难听的（票 21 的 `palette-binding` · 票 12 的「判据太弱的又一种形态」）。
⚠️ **而且它根本不解决 `origin`** —— 那块还是那句假话。

**(c) 不升版：把 `origin` 换成一句「可派生的真话」**
写点**免费知道**的唯一一件相关事实是：**这份 stylespec 是不是从一份 `VisualWorldSpec` 投出来的**
（≡ `authoring/visual-world.json` 在不在包里，`pack.ts:329` 那一行写的）。
✅ 可派生、不可撒、`mode` 同款；⚠️ 但它记的是「**怎么进来的**」，不是「**谁写的**」—— 而 `origin` 这个名字装不下第二个意思，
**改名又要升版**（§0.2 ④）⇒ (c) **只有「改值不改名」才成立**，那 `origin` 就成了一个**名不副实**的键。

**(d) 最小改动：只加第三档，值由入口给**（票面 Q1+Q3+Q4 的字面）
`cli.ts:512` / `server.ts:239` / `create-game.ts:385` 各穿一个参数进 `packAssets`。
⚠️ 值**没人校**；⚠️ 而且 **V2 里每一份包都会是同一个值** ⇒ `origin` **还是个常量**，只是这次是个**真**常量 ——
票面 §1 那句「**它不携带任何信息**」**原样保留**。这就是 R7 要拦的形状。

➡️ **推荐 (a)：删整块。** 三条理由，按分量排：

1. **它比 R7 那条门还过头一格。** R7 说「没读者就进不了契约」；而这里是**四个键一个都不携带别处拿不到的信息**
   （三个可派生、一个是假话），踩的是本仓库写在 manifest 定义里的那条更硬的话：**不重复可派生的内容**。
2. **升版的先例是同一个形状，只是这次更彻底。** `assetpack/v1 → v2` 就是为了删掉 `provenance.degradations` /
   `provenance.transport` —— 那两条声明**在降级链拆掉之后不再成立**（`assetpack.ts:23-28`）。这里那条声明
   **从来没有成立过**。（⚠️ 也正因如此，那句「一个不知道自己是 fixture 的包是虚假的包」在 v2 里**还立着** ——
   它靠的是 `mode`，而 `mode` 我们一个字不动。）
3. §0.2 ③：**(d) 那条路不是「以后补个校验」，是「结构上补不上」** —— 值从入口穿下来以后依然没有对家。

⚠️ **但我要把反面明说，免得你被我带着走**：(a) 是**四条里唯一要升版的**，而升版在本仓库是**被三处 sidecar 明确躲过**的一刀，
而 `unbound` 那条先例又说明「零生产者」本身不是罪。
**如果你更看重「不加版本号」，那 (b)+(c) 是有话可说的组合**（`origin` 改成派生 + 其余加校）；**我只反对 (d)**。
⚠️ 另外：**`origin` 是留是删，(a) 与 (b)/(c) 的分野就在这一句上**，所以**不要**在 Q1 里调和它 —— 它会自己成为 Q2。

---

## ❓ Q2 —— 范围：资源级那个死的 `fixture`（`AssetOrigin.fixture` / `PackMode.fixture`）算不算本票的活？

§0.2 ② 量到：**死值是两个**。票面只点了 `provenance.style` 那一处，而资源级 `AssetOrigin.fixture` **同样零生产者**。
⚠️ **但它不是同一种病**，这正是我不直接并进来的原因：

- `provenance.style.origin` 的 `fixture` 值 —— 连它**想说什么**都说不清（是「stylespec 来自 fixture」？那 `ref` 已经在说了）。
- `AssetOrigin.fixture` 的 `fixture` 值 —— **有一个说得出的将来生产者**（拿仓库内置资产直接组一个「不碰生图」的包），
  形状与 `unbound` 那条**逃生舱先例**一致。
  ⚠️ **而它的问题在别处**：`CONTEXT.md:268` 把 `fixture` 定义成「**仓库内置降级件**」——
  **降级（Degradation）整个已出局**（`CONTEXT.md:559-563`）⇒ **那个定义引用着一个已经不存在的机制**。
  （实测佐证：两份入库包的资产**全是 `generated`**、`mode` 也是 `generated` —— 尽管它们住在 `fixtures/` 下。）

三条路：
**(A) 只办 `provenance.style`，资源级另开一票**（本票 = 票面范围，最干净）。
**(B) 并进来**（同一类死值的两处现身，一次裁完省一次往返；代价是本票面积翻倍、要动资源级那个枚举与 `derivePackMode` 的边）。
**(C) 只顺手更正 `CONTEXT.md:268` 那句 stale 定义**（值本身**不动** —— 零生产者不是罪，`unbound` 是判例），资源级另开票。

➡️ **推荐 (C)。** 理由：**(B) 混了两个不同的判决** —— 一个是「删掉一句假话」，一个是「一个逃生舱的说明书过期了」，
把后者按前者的判词办掉会误伤；而**(A) 走掉的话那句错定义会一直躺着**（它是 `CONTEXT.md` 里**唯一**解释 `fixture` 的地方）。
⚠️ 但请注意 (C) **要改 `CONTEXT.md`** —— 如果你希望本票一个字都不碰仓库文档，那就退回 **(A)**，我**没有**强偏好。

---

## 本轮**没有**问的（免得看着像漏了）

- **`provenance.style` 里 `origin` 之外的三个键**（`ref` / `stylespecId` / `checksum`）各自留不留、怎么校 ——
  **它们的形状取决于 Q1**（(a) 之下全没；否则要逐个判「派生 vs 声明」）。⇒ 第 2 轮。
- **`human-in-session` 这个值本身**（它在 V2 里连「人给了参考图」都描述不准）—— 取决于 Q1/Q2 的去向。⇒ 第 2 轮。
- **`CONTEXT.md:172` 那句「用的是哪份 StyleSpec」**（manifest 的承诺）—— 现成的一份**具名读者承诺**，
  是 (b)/(c) 的弹药、(a) 要一起改掉的东西。⇒ 随 Q1 的裁定一起处理，本轮不单独问。
- **既有两份入库包要不要回填** —— 只在选中要升版的那条路时才是问题。⇒ 随 Q1。
- **付不付钱跑** —— 本票**全免费**（一跑都不用），这是**边界不是问题**。

---

# 裁定（2026-10-13 · 待你作答）

| | 问题 | 你的裁定 | 依据与边界（可写原话） |
|---|---|---|---|
| **Q1** | `provenance.style` 怎么处置（(a) 删整块 · (b) 留+加校 · (c) 换成派生说法 · (d) 只加第三档） | | |
| **Q2** | 资源级死的 `fixture` 算不算本票的活（(A) 另开票 · (B) 并进来 · (C) 只更正 `CONTEXT.md:268`） | | |
