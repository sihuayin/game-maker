# 42. 补齐两条卡在半路的属性：背景层视差与九宫格

Type: task
Status: open
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
