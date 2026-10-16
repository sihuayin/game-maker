# 票 92 · 第一轮问答 —— 「`auditAssetSpec` 从不读 `anchor`：补判据，还是把承诺改对」

- **票**：[92. `auditAssetSpec` **从不读 `anchor`** —— 而它文件头点名承诺会读](../issues/92-asset-spec-anchor-not-reconciled.md)
- **类型**：`grilling`（HITL）· 本图（`game-maker-v2`）的一轮裁定
- **本轮射程**：**只出问答与读数**。批的是「这个缺口以什么形状收口」，**不是「去改」** —— 施工要**另一次独立授权**。
- **本轮零改动 · 零付费 · 零网络 · 未提交**：`packages/**` 与 `fixtures/**` **一个字节没动**；
  `game-maker.local.json` 一个字不动；R 表一个字没动。**没写探针**（六条读数全是 `grep` / `sed` /
  `python3` 读 JSON，没跑任何构建、没起任何进程）。
  `git status --short` 里**由本轮产生的**只有两处：本文件（新）与票头那两行。
  ⚠️ **另有一处不是本轮的**：`?? .scratch/game-maker-v2/experiments/72-two-shell-size/`（票 72 留下的）—— 本轮**没碰**。

---

## 0 · 本轮**新量到的**（票面 §1–§3 之外的东西）

### A ⭐⭐ `anchor` 的**两侧不是两个来源**：它们是同一个 schema 常量、同一个值

票面 §2 已经把值那一侧量清了（`pack.ts` 逐字节复制）。**本轮把类型那一侧也读了**：

| 侧 | 逐字 | 住哪 |
| --- | --- | --- |
| 清单侧 | `asset-spec.ts:12` `import { Anchor, Layer } from "./assetpack.js";` ⇒ `:21` `anchor: Anchor,` | `AssetSpec` |
| 交付侧 | `assetpack.ts:175` `anchor: Anchor,` | `AssetPackEntry` |

⇒ ⭐ 两侧**引用的是同一个 `Anchor` 常量**（`assetpack.ts:73`），而那个常量的定义是：
`z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).strict()`。

⇒ ⭐⭐ **「比 `spec.anchor` 与 `entry.anchor`」= 把一个字段与它自己比。**
不是「两个来源对账」，是**同一个来源的两份抄本**：
`pack.ts:1089` `anchor: b.spec.anchor,`（交付清单那份）与 `pack.ts:1032` 图集侧那份，**同一行循环、同一个 `spec`**。

### B ⭐⭐ 契约**自己**给这条判据写的定义是**范围**判据 —— 而那个范围**在解析期就已经守住了**

`packages/contracts/src/qa.ts:114` 逐字：

> **三条构造性约束**：`size` 与帧 bounds 一致 · `anchor` 落在 [0,1] · 九宫格只能在面板上读。
> 住 `pack.ts` / 校验处。

`packages/contracts/src/qa.ts:385` 逐字：`"constructive-constraint": "构造性约束（尺寸 / 锚点 / 九宫格）"`

⚠️ 所以票面 §3.2 问「若补，比什么」时，**契约已经写过一个答案了** —— 而那个答案（**范围**）
与 `audit.ts:39` 承诺的（**对账**）**不是同一件事**。两者的下场**逐条查过**：

| `qa.ts:114` 点名的三项 | `auditAssetSpec` 里查不查 | 今天由谁守 | 那一条在 audit 能看见的地方**响不响** |
| --- | --- | --- | --- |
| `size` 与帧 bounds 一致 | ✅ `audit.ts:51` | audit 自己 | ⚠️ 见 C 表 —— **票 21 已量到它是恒等** |
| `anchor` **落在 [0,1]** | ❌ **一次都没读** | `assetpack.ts:73` 的 `Anchor`（**解析期**） | ❌ **结构上不可能响** |
| 九宫格**只能在面板上读** | ❌ 一次都没读 | `pack.ts:241` 的 `scale9Of` 那个 **`kind !== "ui"` 闸**（**构造**） | ❌ **结构上不可能响** |

⚠️ 读法：`auditAssetSpec(spec: AssetSpec, entry: AssetPackEntry, …)` 的**两个入参都已经过了 schema**
（`qa/src/visual.ts:87` 的 `parseAssetPack` · `pack.ts:1161` 的 `parseAssetPack` 自检）——
而 `Anchor` 就在那个 schema 里。⇒ 「anchor 落在 [0,1]」这条判据**在它能被写下的地方，永远没有东西可以报**。

### C ⭐ 「一个字段与它自己比」这件事，**同族的判据里已经裁过一次**，理由是逐字现成的

`packages/qa/src/visual.ts:150-152` 逐字（`palette-binding` 那段）：

> ⚠️ **`palette.size == values.length` 故意不在这里**：那是 **manifest 契约自己的 `superRefine`**
> 已经守住的（而 `parseAssetPack` 先跑）—— 再写一遍就是**一条永远绿的判据**

⚠️ 而图上的[票 17](../issues/17-qa-visual-judgements.md)条目记着这条的来历：「**两处「契约已经挡在前面」的检查**
（写测试时当场撞出来的）」⇒ **本仓库对这种形状有现成的尺子**，且**它是在同一个族里量出来的**。

⚠️ 而 `palette-binding` 之所以留得下来，是因为它**不是**这种形状 —— 那句注释的上一段逐字写着
「包里**两处**都在说……它们是同一件事的两种说法，**对不上就有一个在说谎**」。
⇒ **对账的门槛是「两个各自独立的说法」**。`anchor` 只有一份说法。

### D ⭐ 三个「例外」里，只有 `layers` 今天真的被对过 —— 而三者**全部**是逐字节搬运

票面 §3.2 问「`assetpack.ts:11` 那个『例外』到底豁免了什么」。读清楚之后的答案：
**它豁免的是「不重复图集里已有的内容」这条原则**（因为壳子不该为这三个数去开图集），
**不是「不用对账」**。而三者在今天的待遇是：

| 例外项 | `auditAssetSpec` 查不查 | 交付清单那一份是怎么来的 |
| --- | --- | --- |
| `layers` | ✅ 查（`audit.ts:73-84`：层数 / 名字 / 视差 / 平铺） | `pack.ts:1095` `b.spec.layers.map(toPackLayer)` —— 而 `toPackLayer`（`:151`）是**纯字段搬运**（只剥 `description`） |
| `anchor` | ❌ | `pack.ts:1089` `b.spec.anchor` |
| `scale9Borders` | ❌ | `pack.ts:1102` `...(s9 ? { scale9Borders: s9 } : {})` —— 而 `s9 = scale9Of(b.spec)`（定义 `:241`、调用 `:1083`，图集侧是 `:1031`） |

⚠️ ⭐ **三者唯一的差别不在「例外不例外」**：`scale9Borders` 那一份**是一次真的换算**
（`ninePatch` 的四边内缩 → 中央矩形），另两项是直接搬。⚠️ 但那个换算**也有自己的守卫**：
`left + right ≥ size.w` 会让 `w ≤ 0`，而那条由 `asset-spec.ts:211-214` 的 `superRefine` 在**解析期**拒掉
—— ⚠️ **也不在 audit 的射程里**（同样是「契约已经挡在前面」）。
⇒ **三个例外项在 audit 面前全是恒等**；把 `anchor` 单独拎出来补，不会比另两项多出任何东西。

### E ⭐ 唯一一处「真的能响」的组合，**在盘上**；但没有任何测试把它凑到一起

`auditAssetSpec` 的牙**只在「spec 与 entry 来自不同来源」时**长出来。本轮把盘上**四对**真配对逐条比过
（`python3` 读 JSON，不跑任何东西）——**同一把尺子**：`spec.anchor` 与 `manifest.assets[].anchor` 是否逐字节相等。

| 清单 | 包 | 件数 | 锚点不符 | 清单里有、包里没有 |
| --- | --- | --- | --- | --- |
| `fixtures/recipes/last-train.json` | `fixtures/packs/last-train/v2` | 9 | **0** | 0 |
| `fixtures/recipes/last-train-image.json` | `fixtures/packs/last-train/v2` | 9 | **0** | 0 |
| `fixtures/recipes/counter-siege.json` | `fixtures/packs/counter-siege/v4` | 21 | **0** | 0 |
| `fixtures/recipes/counter-siege-derived.json` | `fixtures/packs/counter-siege/v4` | 21 | ⚠️ **1** | ⚠️ **15** |

- ⭐ **前两行正是 QA 真会读的那一对**：`packages/qa/tests/visual.test.ts:14-15` 用的就是
  `fixtures/recipes/last-train.json` + `fixtures/packs/last-train/v2` ⇒ **在两对真配对上新判据今天不会响**。
- ⚠️ **第四行是唯一一处不符**：`ui-icon-scrap` 在清单里是 `{x:0.5,y:0.5}`、在包里是 `{x:0,y:0}`；
  而 21 件里有 **15 件**的 id 在那份包里**根本不存在**（那是**旧命名时代**的清单：
  `tile-walkway` / `trap-nailgun` / `projectile-nail` … vs 包里的 `tile-walk` / `tower-nailgun` / `proj-nail`）。
  ⚠️ **没有任何测试把这一对凑到一起** —— 它唯一的读者是
  `packages/assets/tests/recipes-sweep.test.ts:120`，而那里是拿它**从零重新构建**（⇒ 恒等，见 A）。
- ⇒ **票面 §3.3 那一问的答案**：在**两对真配对**上是「**不会误伤**」；在那一对上「**会，但今天没人把那一对凑起来**」。

### F ⚠️ 票面 §3.3 的一句更正：分野不是「导入 vs 生成」，是「同一次构建 vs 不同来源」

票面逐字：「`fixtures/packs/**` 那些**导入**的包（`imported/` 目录）走的是另一条路」。
⚠️ 复核下来这句**不成立**：`pack.ts:1089` 那句 `anchor: b.spec.anchor,` 住在 `built.map(...)` 里，
对**所有** `origin` 都成立 —— **生成与导入共用同一行**，`entry.anchor` 对两者**都是** `spec.anchor`。
⇒ 真正的分野在**两头是不是同一次构建产出**；「导入」只是同一个 `built` 数组里的另一种 `origin`。

### G ⚠️ 同一个「承诺了却没做」的形状，**在这一小片里还有两处**（都另立门户，见 Q2 / Q3）

1. `packages/assets/src/ops.ts:1563` 逐字：`/** 校验一个包：schema + **逐文件 checksum** + spec↔产物对账。 */`
   —— 而 `verifyPack`（`:1564`）的函数体**一次都没调 `auditAssetSpec`**
   （`grep -n audit packages/assets/src/ops.ts` ⇒ 命中的是 `auditGameConfig` / `auditTdConfig` /
   `auditScreenSpace` / `auditLayerCoverage` / `auditReachability`，**没有 `auditAssetSpec`**），
   而 `VerifyOptions = { packDir: string; outRoot?: string }`（`:1561`）**手里没有清单** ⇒ 它**结构上做不了**。
2. `qa.ts:114` 那条判据描述里点名的三项，**有两项不由它执行**（见 B 表）。

### H ⭐ `auditAssetSpec` 的牙长在哪：两个**生产**调用点，今天都同源；唯一的牙是 R9 那条**人可改**的路

`auditAssetSpec` 全仓**只有两处**生产调用（`grep -n auditAssetSpec`）：

| 调用点 | 清单从哪来 | 包从哪来 | 同源？ |
| --- | --- | --- | --- |
| `assets/src/pack.ts:1170`（构建末尾） | 这次构建的 `recipe` 对象 | 这次构建刚写下的 manifest | ✅ 同一次构建 |
| `qa/src/visual.ts:119`（QA 视觉族） | `ctx.recipePath`（`create-game.ts:470` 的 `run/v<N>/asset-recipe.json`） | `ctx.packDir`（`create-game.ts:425`，同一次运行刚建出来的） | ✅ 同一次运行 |

⇒ ⭐ **自动链上没有一处能让两侧不同源。** 而 `runBuild` 的文件头逐字写着
「⚠️ **只吃 `runDir`**：清单、风格、参考图、基因**一概从磁盘读回** —— **R10「人可改」要的就是这个**」，
且它头一件事就是「照跑 `parseRecipe`（**清单可能被人改过**）」。
⇒ **这条判据真正的牙，长在 R9 那个检查点上（人改过清单之后再跑）** ——
而那正是 E 表第四行量出来的形状（一份清单配一份**不是它建出来的**包）。

---

## 1 · 本轮要裁的四问

## ❓ Q1 · 本票的裁定：这条缺口「补」的是什么？

票面 §3.1 把这一格问成「补它是把构造保证变成判据（好，但今天不会有人受益）
还是加一条永远不响的判据」。本轮读完 A/B/C 三条之后，这一格**多出一个第三态**：

- **(a) 不加判据 · 把承诺改对**：`audit.ts:39-40` 那句里**删掉 `anchor`、补上 `layers`**
  （使文件头与函数体对得上：今天真查的是 `kind` / `size` / 动画名与帧数 / `layers` / drawlist 的 `viewBox`）。
  ⚠️ 含意是：**裁定这个缺口的本体是一句话，不是一个检查** —— 它照[票 91](../issues/91-contract-anchor-prose-false-claim.md)
  同一把尺子收口（「**这句话与代码库重新对上**」）。⇒ 施工**另立措辞票**。
- **(b) 加判据（逐字节复制的那一侧）**：`auditAssetSpec` 里加 `spec.anchor` 与 `entry.anchor` 相等。
- **(c) 加判据（契约自己写的那一侧）**：加 `entry.anchor` 落在 `[0,1]`（`qa.ts:114` 逐字点名的那一条）。
- **(d) 加判据，但加**别的东西**：让**清单侧**在生成前就拒掉「语义上不可能」的锚点
  （例如「角色类资源的锚点必须在底边」）。⚠️ **这一条已被[票 82](../issues/82-hud-anchor-convention-ownership.md)
  的 Q1 = (b) 正面否掉**（逐字：「**不把 HUD 面板必须使用 `{x:0,y:1}` 立为强制规则**」）⇒ 锚点**取值**不是判据。
- **(e) 别的**（例如：不加判据、也不改承诺，只在文件头补一句「`anchor` 是恒等，故不对账」）。

➡️ **推荐 (a)**。三条理由，逐条对读数：

1. **(b) 与 (c) 在**每一个生产调用点**上都是恒等**（读数 A / C / H）——
   (b) 是「把一个字段与它自己比」（两侧**同一个 schema 常量、同一个值**）；
   (c) 的范围**在 `parseAssetPack` 里就已经守住了**，而 `auditAssetSpec` 的入参是**过了 schema 的**值。
2. **(c) 还额外撞上本仓库现成的尺子**（读数 C）：`palette.size == values.length` 被**故意不写**
   进 QA 的理由逐字就是「那是 **manifest 契约自己的 `superRefine`** 已经守住的（而 `parseAssetPack` 先跑）
   —— 再写一遍就是**一条永远绿的判据**」。⇒ 这一族**已经裁过一次**，答案一致。
3. ⚠️ 而**票 81 的教训**（票面 §3.1 自己引的）在这里正对着：**新判据自己零判据 —— 谁把它删掉，什么都不会红**
   ⇒ 加 (b)/(c) 的净效果不是「多一份保证」，是**多一个看起来像保证、实际删掉无感的东西**。
4. **(a) 修的是可证的真缺口，而且它是**两头都错**的一句话**：文件头**点名了 `anchor`**（从不读）、
   **又漏掉了 `layers`**（读了）。⚠️ 这不是「措辞不够好」，是**这句话与代码库对不上** —— 与票 91 同一处病灶。

⚠️ **若选 (a)，有一个必须一起说的边界**（本轮**不单独问**，因为它就是 (a) 的含意）：
(a) 把缺口收在一句话上，**等于裁定「恒等就不该有对账」**。若你要的是相反的裁定
（「哪怕恒等，也要在 audit 里留一条，防将来有人绕过 `pack.ts` 手工造包」），那**选 (b)**，
而代价上面第 1、3 条写着。

---

## ❓ Q2 · `qa.ts:114` 那条**判据描述**里，有两项**不由这条判据执行** —— 归谁？

读数 B 那张表：`constructive-constraint` 的描述点名三项，而其中两项
（`anchor` 落在 `[0,1]` · 九宫格只能在面板上读）**今天分别由 `assetpack.ts:73` 的 schema
与 `pack.ts:241` 的 `scale9Of` 那个 `kind` 闸守着**，`auditAssetSpec` 一次都没读。
⇒ 「这条判据跑过」这句话里，**三分之二的格子是空的**。

⚠️ 但**要说句公道话**：那段描述逐字写着「住 `pack.ts` / **校验处**」—— 它作为
「**这条规则住哪**」的说明**是准的**；不准确的只是「读者会以为**这条判据**执行它们」这一层。

- **(a) 归本票的射程**，与 Q1 一起裁措辞（它是「说明点名了 `anchor`，而 `anchor` 没有执行者」的同一处账面）。
- **(b) 另立一票**（它动的是 `contracts/src/qa.ts` 的**判据定义** —— 那个文件自称
  「判据的家（**只此一份**）」，改它比改一句文件头重）。
- **(c) 只登记在 `Not yet specified`**，本轮不立票、不改 —— 理由是上面那句公道话，且**本票的标题**
  指的是 `audit.ts` 的文件头，`qa.ts` 在它的字面射程之外。
- **(d) 别的。**

➡️ **推荐 (c)**。理由：本票的票面**点名的是 `auditAssetSpec` 的文件头**，而 `qa.ts:114` 是**另一处**；
把 (c) 写成「已登记、等人开」不丢信息，而 (a)/(b) 都会**扩大本票的改动面**（Q1 已经够一个改动面了）。
⚠️ 若你认为「判据说的三项与它执行的两项对不上」本身就是一条**该活的**缺陷，那选 **(b)**，与 Q1 分开走。

---

## ❓ Q3 · `ops.ts:1563` —— `verifyPack` 的文件头承诺 **spec↔产物对账**，而它**结构上做不了**

读数 G 第 1 条：`/** 校验一个包：schema + **逐文件 checksum** + spec↔产物对账。 */`
而 `verifyPack` 的函数体**一次都没调 `auditAssetSpec`**，且 `VerifyOptions = { packDir, outRoot? }`
（`:1561`）**手里没有清单** ⇒ 它**做不了**那件事。

⚠️ 和本票**不是同一个文件、不是同一句**，但是**同一种形状**（承诺一件没做、也做不了的事）。
⚠️ 而它里面**藏着一个真的决定**，所以它比 Q1 更像一张票：「要不要**给 `verify` 一个清单入参**，
让 `verify` 真的能对账一个**不是它建的**包？」—— 那正是读数 H 说的那条**唯一有牙**的路。

- **(a) 另立一票**（照 [票 82](../issues/82-hud-anchor-convention-ownership.md) → [90](../issues/90-anchor-convention-to-authoring-side.md)/
  [91](../issues/91-contract-anchor-prose-false-claim.md)/[92](../issues/92-asset-spec-anchor-not-reconciled.md) 的先例）。
- **(b) 归本票**：与 Q1 一起裁。⚠️ 会把改动面从 `contracts/src/audit.ts` 扩到 `packages/assets/src/ops.ts`。
- **(c) 只登记在 `Not yet specified`**，不立票。
- **(d) 别的。**

➡️ **推荐 (a)**。理由：它自带一个**票面级的问题**（`verify` 要不要吃清单），而不是一句措辞；
且它住 `assets`、本票住 `contracts` ⇒ 合并会让两件事各自都说不清。

---

## ❓ Q4 · 读数 E 第四行那一对（`counter-siege-derived.json` ＋ `counter-siege/v4`）怎么办

它是盘上**唯一**一处「清单说 `ui-icon-scrap` 的锚点是 `{0.5,0.5}`、包里是 `{0,0}`」，
而同一份清单里还有 **15/21** 件的 id 在那份包里**根本不存在**（旧命名时代的清单）。

- **(a) 只登记，不动**（`Not yet specified`），不立票 —— 因为**今天没有任何东西把这一对凑起来**
  （唯一的读者 `recipes-sweep.test.ts:120` 是拿它**从零重建**，见读数 A）⇒ **零观测损失**；
  而 `fixtures/**` 动它要**另一次授权**（票 64 的教训）。
- **(b) 另立一票**：入库夹具盘点 —— 哪份清单配哪个包、有没有第二对这样的。
- **(c) 归本票**改掉那一件 `ui-icon-scrap` 的锚点。⚠️ 动 `fixtures/**`，**票面 §4 明写在本票边界之外**。
- **(d) 别的。**

➡️ **推荐 (a)**。理由：它**今天不挡任何东西**（没有人把这一对凑起来），
而它真正的价值是**给 Q1 提供佐证**（「恒等遮住的缺口长什么样」）——
那个价值在**记下来**的那一刻就已经兑现了，不需要改任何文件。

---

## 2 · 边界（本轮与将来那一次施工都不许越的）

- **立票 ≠ 批准施工**：本轮**只出问答**。`packages/**` 与 `fixtures/**` **一个字节不碰**，
  直到**另一次独立点头**。
- **不与[票 90](../issues/90-anchor-convention-to-authoring-side.md) / [票 91](../issues/91-contract-anchor-prose-false-claim.md) 合并**
  （人裁逐字：「**不是 HUD 专属问题**」）：**三张各自独立授权**。
  ⚠️ 票 91 动 `contracts/src/game-config.ts` 的一句散文 · 票 90 动 `assets` 的提示词，
  **本票（若选 Q1 = (a)）动 `contracts/src/audit.ts` 的一句文件头** —— **三处、三票、不合并成一次改动**。
- **不动 R 表**（R17）· `packages/qa` 一行不碰 · `fixtures/**` 不碰 ·
  `game-maker.local.json` 一个字不动 · **不执行任何付费真跑** · **不提交**。
- ⚠️ **本轮连探针都没写**：读数 A–H 全是 `grep` / `sed` / `python3` 读盘上已有的文件。

---

## 3 · 验收（今天写得出来的部分）

- ✅ **免费证得了的**：A（两侧同一个 `Anchor` 常量）· B（`qa.ts:114` 三项两空）·
  C（`palette.size` 那条先例逐字）· D（三个例外项在 audit 前的恒等）·
  E（四对配对的逐条比对）· F（导入与生成共用同一行）· G（`verifyPack` 无 `auditAssetSpec`）·
  H（两个生产调用点同源）—— **全部逐字读到，没有跑任何东西**。
- ⚠️ **免费证不了的**：**这个缺口会不会真的漏掉一个错**。
  读数 H 把它收窄成一句可检验的话：**在自动链上不会**（两侧同源）；
  要证「会」，得**手工**造一份「清单与包不同源」的现场（R9 那条人可改的路）——
  ⚠️ 而**那不是本票要证的东西**，本票问的是「补不补、以什么形状补」。
- ⚠️ **若 Q1 = (a)**：验收就是 **`grep` 得到的「文件头点名的每一项都真的被读了」** ——
  与票 91 同款，**不需要真跑**。

---

## 4 · 裁定表（人答请填第三列；可整列替换为逐字原话）

| # | 题 | 选项 | 人答 |
| --- | --- | --- | --- |
| **Q1** | 本票的裁定：这条缺口「补」的是什么 | (a) 不加判据·把承诺改对 ➡️推荐 / (b) 加 `spec.anchor` vs `entry.anchor` / (c) 加 `anchor ∈ [0,1]` / (d) 加语义约束（⚠️ 已被票 82 Q1=(b) 否掉） / (e) 别的 | |
| **Q2** | `qa.ts:114` 那条判据描述里有两项不由它执行 | (a) 归本票一起裁 / (b) 另立一票 / (c) 只登记在 `Not yet specified` ➡️推荐 / (d) 别的 | |
| **Q3** | `ops.ts:1563` `verifyPack` 承诺 spec↔产物对账却做不了 | (a) 另立一票 ➡️推荐 / (b) 归本票 / (c) 只登记 / (d) 别的 | |
| **Q4** | 读数 E 第四行那一对（`counter-siege-derived` ＋ `counter-siege/v4`） | (a) 只登记·不动 ➡️推荐 / (b) 另立一票 / (c) 归本票改掉那一件的锚点 / (d) 别的 | |

⚠️ **另一句请一并裁**（它决定 Q1 的改动面收在哪）：
**「恒等就不该有对账」这条判读，你认不认？** 认 ⇒ Q1 = (a) 的边界成立；
不认 ⇒ 请说明你要的是 (b) 那一档（哪怕恒等也留一条）。
