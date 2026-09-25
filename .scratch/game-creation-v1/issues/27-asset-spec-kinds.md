# 27. AssetSpec 的四类扩展：sprite / animation / background / ui

Type: grilling
Status: resolved
Blocked by: 24, 26
Map: ../map.md

> 🔴 **票 26 已 resolved —— 直接改写你要扩的 `AssetSpec`**（2026-09-24）：
> 「状态」已降格成「单帧动画」，所以 `AssetSpecSchema.states: string[]` 应当换成
> **`animations`**（有序帧 + fps/loop），并遵守同一条规则：**多于一帧的资源必须把每帧都分组**。
> 另外锚点是**逐资源声明**的，`AssetSpec` 需要承载它。

> ✅ **票 24 已 resolved**（2026-09-24）。它给出的四类分岔点是：**每类各一份图集文件**（因为最优打包参数不同）。⚠️ 它把 `bg_sign` 归类为 `ui` 是**判断不是事实**（该资源有 1px 外框 + 嵌套内框，正是九宫格形状），**本票要裁决**。

> R4 定了四类资源一等公民。现有 `AssetSpecSchema` 只有一类通用形状
> （`visual: z.record(z.unknown())` + `geometry: z.record(z.unknown())` 两个逃生舱），
> 装不下背景与 UI 的真实差异。本票把它扩成四类，并**把票 12 出局时搬过来的
> 确定性校验规则**在这里落地。

## Question

1. **四类的 spec 各自要什么**。逐类列出「生成它必须知道的信息」：
   - **sprite**：外观、状态、尺寸、朝向
   - **animation**：帧数、动作名、pivot、循环方式（依赖[票 26](26-animation-representation.md)）
   - **background**：分辨率、**是否分层/视差**、是否可平铺、与镜头的关系
   - **ui**：屏幕空间尺寸、是否九宫格可拉伸、与分辨率缩放策略的关系
   四者的**公共部分**抽出来当基类，还是各写各的？
2. **两类逃生舱怎么办**。现有的 `visual` / `geometry` 两个 `z.record(z.unknown())`
   是 schema 上的漏洞 —— R2 之后确定性校验是**唯一**的质量控制，
   留着逃生舱等于把唯一的控制也放走了。**要么把它们结构化，要么明确它们的边界**
   （什么能进、什么不能进、谁校验）。
3. **落进校验规则（来自票 12 的搬家）**：
   - **凸包容差**：drawlist 的包围盒是凸包**上界**（票 05 实测高估 2px），
     所以尺寸校验**只判过大、不判过小**。阈值多少、按类分别定还是统一。
   - **尺寸越界**：`expectedSize` 与实际 bounds 的比对在**哪一步**做 ——
     生成后立刻（票 22 的出口处）还是光栅化时（票 21）？
   - 还有哪些**确定性**检查是值得留下的？（R2 砍的是「打分」和「自动修复」，
     不是「校验」。凡是能在生成路径上静态判定的，都值得留。）
4. **四类资源与 AssetManifest 的关系**（与[票 24](24-asset-pack-contract.md) 对齐）：
   一个 sprite 有 6 个动画，算 1 个资源还是 7 个？

## 产出要求

调用 `grilling` skill。产出**四类的 Zod 草案**，并用现有实验资源
（`experiments/style-transfer-from-test-png/` 的 6 份 + `experiments/animated-player/`
的一套）逐类**填实例验证**，证明草案装得下真实产物。

## Answer

**结论：`AssetSpec` 已扩成四类，两个逃生舱删除；尺寸校验用 `exact` 分两档；
新增的「spec ↔ 产物对账」当场抓到真包里一个 bug。126 条测试全绿，
真包的四类实例全部对账一致。**

### 0. 四问的裁决

| 问题 | 裁决 |
|---|---|
| ① `sprite` 与 `animation` 只差帧数，怎么定 | **继续由作者声明 `kind`，但加一致性校验**：声明为 `sprite` 就必须单帧无动画，声明为 `animation` 就必须有动画 |
| ② `visual` / `geometry` 两个逃生舱 | **删除**，换成四类各自的结构化字段 |
| ③ 尺寸越界的阈值 | **用 `exact` 分两档**：精确的硬失败、上界的报警告。不要魔法阈值 |
| ④ 四类与 manifest 的关系 | 见 §5（票 24 已经这么落了） |

### 1. 四类怎么分（含一处必须交代的裁决）

`kind` 仍然是**声明**的（R4 不动），但加了一条交叉校验 —— 声明为 `sprite` 的产物若带了动画或多于一帧，对账会报出来。这样既保留了「我想把这个资源当什么处理」的表达力，又不会与现实矛盾。

⚠️ **一处连带裁决：[`bg_sign`](24-asset-pack-contract.md) 从 `ui` 改判为 `sprite`。**
票 24 把它归 `ui` 是**我自己的判断**，当时就标了「待裁决」。R4 把 UI 定义成
「**屏幕空间**、可能九宫格可拉伸」—— 屏幕空间是定义性的那半，而 `bg_sign` 是个**世界空间的招牌道具**
（名字与内容都这么说）。**判据是它活在屏幕空间还是世界空间，不是它长得像不像面板。**

**代价必须说清楚**：改判之后，那个真包里**一个 ui 样本都没有**了 ——
四类里只剩下 animation / sprite / background 三类有真实产物。这是**实验资产的空白，不是契约的空白**：
`UiSpec` 本身用真实尺寸的实例（48×32 的 HUD 面板、4px 内缩）覆盖了测试。
已把「需要一个真实 UI 资源来验」记给[票 31](31-first-demo-game.md)。

### 2. 逃生舱删了，换成什么

`AssetSpec` 现在**只有**这些字段，没有一个能藏东西：

| | 字段 |
|---|---|
| **四类公共** | `id` · `role` · `description` · `styleId` · **`anchor`**（逐资源声明，票 26）· `size` · `dependencies` · `required` |
| `sprite` | （无额外字段 —— 单帧静止资源没什么别的要知道的） |
| `animation` | `animations: [{name, frames, fps?, loop}]` —— ⚠️ `frames` 是**数量**（要几帧），不是「哪几帧」 |
| `background` | `layers: [{parallax}]?` · `tileable: {x,y}?` |
| `ui` | `ninePatch: {left,right,top,bottom}?` · `screenSpace`（默认 true） |

**为什么 `frames` 是数量而不是名字**：规格说「要几帧」，产物说「是哪几帧」（manifest 的
`Animation.frames` 是帧名列表）。这个区分正是 §4 那条对账存在的理由。

**九宫格用四边内缩而不是中央矩形**：写规格的人想的是「四边各有 2px 边框」，而交付格式要的是中央矩形。
转换是单向的（spec → artifact），正是 Spec 与 Artifact 两层该有的样子。

### 3. 尺寸校验：`exact` 分两档，不要阈值

票 20 的 `boundsOfOps()` 已经返回 `{box, exact}`，这一问因此**不需要拍一个数**：

| `exact` | 超出 `expectedSize` 时 |
|---|---|
| `true`（纯数值图元） | `error` —— 包围盒精确，**容差 0** |
| `false`（含 `curve`） | `warning` —— 包围盒是**凸包上界**，只会高估，报的是「**可能**超出」 |

给一个百分比容差反而会**给精确图元白送宽容** —— 而精确图元恰恰是最该严的那一类。
`exact` 这个字段已经把「这个 box 有多可信」说清楚了，再叠一层阈值是冗余。

### 4. 还留了三条确定性校验，集中到一个新模块

`packages/contracts/src/audit.ts` —— R2 留下的、唯一的**质量控制**，现在有一个共同的家。

1. **`checkSize()`** —— 上面那条，只判过大。
2. **`auditAssetSpec(spec, entry, drawlists?)`** —— **spec ↔ 产物对账**。
   这是「需求 vs 产物」**唯一**的对账点：没有它，`AssetSpec` 里的 `size` / `animations` / `anchor`
   就只是写给自己看的注释。它查：kind 一致、尺寸一致、动画名集合一致、每个动画的帧数一致、
   每份 drawlist 的 `viewBox` 与声明尺寸一致（不一致时**锚点的分母就错了**，而错误会静默传到装配）。
3. **UI 九宫格中央区不能空** —— 内缩之和 ≥ 尺寸就拒。中央区为空的话，拉伸时要么算出负宽高、
   要么把边框本身拉长。

没做的一条：**可平铺背景的接缝一致性**（需要渲染后扫像素，不是纯静态）。`tileable` 目前只是**声明**，
文档里写明了这一点，没有假装它被校验了。

### 5. 实物验证（票面的产出要求）

用真包里**实际做出来的**六份产物当产物侧、手写的四类规格当需求侧，逐类对账：

```
✅ player         animation   规格↔产物对账一致
✅ platform       sprite      规格↔产物对账一致
✅ pickup         sprite      规格↔产物对账一致
✅ hazard         sprite      规格↔产物对账一致
✅ bg_sign        sprite      规格↔产物对账一致
✅ shop_interior  background  规格↔产物对账一致
四类覆盖：animation×1 · sprite×4 · background×1 · 对账问题 0 个
```

反证（把需求改错，审计必须抓到）：

```
✅ 声明 walk 要 6 帧（实际 4）  → 资源 "player"：动画 "walk" 要 6 帧，实际 4 帧
✅ 声明要一个没做的动画 run      → 资源 "player"：动画 "run" 没有做出来
✅ 声明尺寸 32×48（实际 24×32） → 资源 "player"：尺寸对不上
```

### 6. 🔴 这条对账当场抓到了两个真问题

**① 真包的 `build.mjs` 有个 bug。** `shop_interior` 的 `size` 是 `null` ——
那句 `a.spec.size ? {...} : null` 对**导入资源永远为假**（导入资源的尺寸来自图片，recipe 里没写）。
已修。

**② 契约本身太松。** 这个 bug 能存在，是因为票 24 把 `size` 定成了 `.nullable()`。
但**每个资源都有帧，每个帧都有尺寸** —— 留成可空只会让「没人能依赖它」。
**`size` 已收紧为必填**，并补了一条反例测试。

这就是这条对账的价值：它不是「再写一遍 schema 里的规则」，它是**两个独立来源的交叉核对**，
所以能发现单看任何一边都看不出的洞。

### 7. 落地清单

| 文件 | 动作 |
|---|---|
| `packages/contracts/src/asset-spec.ts` | **新增** —— 四类 `AssetSpec`（删掉两个逃生舱） |
| `packages/contracts/src/audit.ts` | **新增** —— `checkSize()` / `auditAssetSpec()` |
| `packages/contracts/src/index.ts` | 旧的单形状 `AssetSpec` 搬走；导出新模块 |
| `packages/contracts/src/assetpack.ts` | `size` 由 nullable 收紧为必填（§6 ②） |
| `packages/contracts/tests/asset-spec.test.ts` | **新增** 28 条 |
| `experiments/asset-pack-draft/recipe.json` | `bg_sign` → `sprite`；`build.mjs` 的 size bug 修复 |

| # | 检查 | 结果 |
|---|---|---|
| ① | 全部测试 | ✅ **126 passed** |
| ② | 真包端到端 + 四类对账 | ✅ 6 resources / 3 atlases，对账 0 问题 |
| ③ | 反证（改错需求） | ✅ 3/3 抓到 |
| ④ | `pnpm check` / `typecheck` | ✅ |

### 8. 留给下游

- **[票 28](28-recipe-compilation.md)（资源清单编译）**：已加注 —— 清单就是「一组 `AssetSpec`」，
  §2 那张字段表直接可用；`anchor` 与 `animations` 现在都有正式形状了。
- **需要一个真实 UI 资源**（§1 的空白）→ 记给[票 31](31-first-demo-game.md)。
- **`tileable` 的接缝检查**没做，需要时它是一个「渲染后扫像素」的活，不属于静态校验。
