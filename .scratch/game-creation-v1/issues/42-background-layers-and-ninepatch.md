# 42. 补齐两条卡在半路的属性：背景层视差与九宫格

Type: task
Status: resolved
Blocked by: —
Map: ../map.md

> 由[票 09](09-game-config-contract.md) 毕业。它发现有两个属性今天**卡在半路上** ——
> 在配方（`AssetSpec`）里，却**既不在 manifest、也不在交付态图集**，于是产物 B 的壳子**无处可读**。

## Question

两个缺口**正好都被 `last-train` 撞上**（它要三层视差 + 一个 HUD 面板）。
修的是**契约与图集生成器**，与「跑管线产出包」的验收不是一回事。

### 缺口 ①②：`layers` / `parallax` 没进 manifest

`BackgroundSpec.layers[].parallax` 由[票 27](27-asset-spec-kinds.md) 定在 `AssetSpec` 里
（`packages/contracts/src/asset-spec.ts:52`），但 `assetpack.ts` 里**搜不到 `layers` 或 `parallax` 任何一个字** ——
它没进 `AssetPackEntry`，而 **manifest 是产物 B 唯一读的东西**。

票 09 裁决 6 判它**归包**（「天空在墙后面」是画出来的东西的一部分，与 `anchor` 同类），
所以要做的是把它**贯通到 manifest**。

### 缺口 ③：`scale9Borders` 没进交付态图集

[票 25](25-delivery-format-spec.md) 已经定死九宫格的家：**交付态图集的每帧 `scale9Borders`**
（TexturePacker 的字段名，Phaser 的 `add.nineslice()` **零参数自动读**）。
而 `packages/assets/src/atlas.ts` **没写这个字段** —— 至今零 `ui` 资源，那条路从没走过。
`UiSpec.ninePatch` 今天只停在配方里。

### 要产出的东西

1. `AssetPackEntry` 补上背景的层结构（层序 + 每层的 `parallax`），**严格校验**：
   层数必须与交付态图集里的帧对得上，对不上就是**硬失败**（不是警告）。
2. `atlas.ts` 从 `UiSpec.ninePatch` 写出每帧的 `scale9Borders` —— 只写 Phaser 真读的字段
   （票 21 立的规矩：图集里不写没人读的字段）。
3. 两样都补测试。⚠️ **改动会让已有真包的 manifest 形状变化** —— 复跑 `out/` 下那三个真包，
   确认它们**仍然合法**（票 37 最有分量的证据就是「票 24 真跑出来的包原样通过新契约」）。

### 完成条件

- 一个带三层背景、一个带九宫格的试件，能过 `verify`，且 manifest / 图集里**读得到**这两样。
- `out/` 下三个已有真包复跑仍合法。
- 全部测试绿。

### 不归本票

- **产出带这两样的真包** —— 归[票 40](40-last-train-fixture-pack.md)（本票**阻塞它**：
  包里没有这两样，`last-train` 的壳子读不到视差、面板拉不起来）。

## Answer

**结论：票面的三条缺口，实测**两条不成立或比写得更严重**，一条底下压着一个票面没预料到的形状缺口 ——
已连同缺口一起落地。267 条测试全绿，`out/` 下三个真包原样过新契约。**

### 1. 三条缺口的实测

| 票面 | 实测 |
|---|---|
| ③「`scale9Borders` 没进交付态图集」 | ❌ **不成立**。`pack.ts` 从 `UiSpec.ninePatch` 算中央矩形、`atlas.ts` 写进帧 —— 全都在。真正缺的只有**那条连线从没被走过**（零 ui 资源 ⇒ 那个三元表达式一次都没执行） |
| ②（连带发现） | 🔴 **`AssetPackEntry.scale9Borders` 声明了却从没被写入** —— manifest 的映射里没有它，而同样「按资源写一份」的 `anchor` 是写的。声明与事实不符 |
| ①②「`layers`/`parallax` 没进 manifest」 | 🔴 **比写得更严重**：`layers` / `parallax` / `tileable` 在生产代码里**零消费者**（只在 schema、提示词示例、schema 测试里出现）。而两头各堵一道：**`framePlan()` 对非 animation 恒定只给一帧** ⇒ 三层背景根本产不出来；**`auditAssetSpec()` 有一条「非 animation 不该有多帧」** ⇒ 它过不了对账。**当时的三层背景：既产不出来，也过不了对账** |

### 2. 形状裁决（本轮 grilling 产出）

**`BackgroundSpec.layers` 从「每层只有视差」改成 `{ name, parallax, tileable? }`**，三项一并定：

| # | 裁决 | 理由 |
|---|---|---|
| 1 | **层有名字**，帧名 = `<资源 id>.<层名>` | 与 animation 的帧命名规则同构；壳子按**名字**取帧，不必靠位置对 —— 「第 i 层配第 i 帧」若只靠位置，就是一条**没写在契约里**的约定，与票 09 否决「动作名硬编码约定」同一条理由 |
| 2 | **`tileable` 从资源级下沉到层** | 资源级的一个布尔表达不了「天空不平铺、墙和地平铺」—— 而三层背景里这是常态 |
| 3 | **所有层共用 `spec.size`**，不引入每层的尺寸 | 与 drawlist 的 `viewBox` 模型一致（内容可以比画布小）。票 31 那句「一张 64 像素宽的长条」是设计草稿；`tileable` 让壳子横向重复，与「资源体积与关卡长度解耦」那条目的**已经达成**，不需要第二套尺寸 |

**`UiSpec.screenSpace` 删除**（原计划归票 41，本票顺手做了 ——
当时正在改同一个文件与同一条 `.strict()` 测试，分开做只会把一个文件的改动切成两半）。
它是**同义反复**：票 27 给的判据就是「它活在屏幕空间还是世界空间」，所以 `kind: "ui"`
与「屏幕空间」本来就同义，而它唯一非默认的取值（一个「世界空间的 ui」）按定义是个 `sprite`。

### 3. 做了什么

- **契约**：`Layer` 定义在 `assetpack.ts`（asset-spec **直接 import 同一份** —— 两边各写一份必然漂移，
  而这个字段一漂移就是「合法的包被判为矛盾」）；`AssetPackEntry` 补 `layers`；
  `BackgroundSpec` 换用 `Layer`、删资源级 `tileable`；`UiSpec` 删 `screenSpace`。
- **manifest 自身的校验**（superRefine）：`layers` 与 `frames` **一一对应**、第 i 层的帧名必须是
  `<id>.<层名>`、层名不得重复、只有 `background` 能有 `layers`。顺带放开「多于一帧必须归组到动画」
  那条 —— 分层背景是**另一条**多帧的理由，它的帧由 `layers` 组织。
- **管线**：`framePlan()` 加一支（一层一帧）；`scale9Of()` 把九宫格的换算收成**一处**，
  图集与 manifest 共用同一个数；manifest 落 `layers`。
- **对账**：`auditAssetSpec()` 加「层数与层名/视差/平铺」一族，并**避开**原来那条多帧规则 ——
  否则一个完全正确的三层背景会被报成问题。
- **提示词**：`ops.ts` 里给 LLM 看的形状同步更新（那是 `derive` 的输入契约，不同步就等于
  教模型写一个会被拒收的形状）。

### 4. 证据

- **267 条测试全绿**（原 257，新增 10 条）。
- **两条端到端连线各有一个试件，且都跑过 `verify`**（不是只过 schema）：
  · 三层背景 → 帧名 `station.sky/wall/ground`、manifest 里 `layers` 三项带各自的视差与平铺、
    天空那层**没有** `tileable`；
  · 九宫格 → `UiSpec.ninePatch(4,4,4,4)` → 图集与 manifest **两处**都是 `{x:4,y:4,w:40,h:24}`。
- **`out/` 下三个真包原样过新契约**（票 37 那条最有分量的证据再看一遍）：
  `shift-change-mixed/v1`（34 文件）· `shift-change-image-anim/v2`（26）· `shift-change-openai/v1`（18）——
  三个 `verify` 全 ✅。

### 5. 交给别的票的输入

1. → [产出 last-train 的 fixture 资源包](40-last-train-fixture-pack.md)（**本票解除它的阻塞**）：
   三层背景现在**可以**声明成 `layers: [{name:"sky",parallax:0}, {name:"wall",parallax:0.5,tileable:{x:true}}, …]`，
   而一层的 `tileable` 让「资源体积与关卡长度解耦」那条设计真的成立。
2. → [固定 runtime 外壳](32-runtime-shell.md)：九宫格的边框在**图集**与**manifest**两处都读得到
   （manifest 那份从没被写入过，本票补上了）；背景的视差与平铺只能从 **manifest** 读 ——
   图集里没有这两个概念。
3. → [把 game-config 契约落进 packages/contracts](41-game-config-landing.md)：`screenSpace` 已删，
   **不要再删一次**（已写进那张票的抬头）。
