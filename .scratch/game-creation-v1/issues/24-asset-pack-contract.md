# 24. 资源包的结构与 manifest 契约

Type: grilling
Status: resolved
Blocked by: —
Map: ../map.md

> ✅ **两个输入已确定**（2026-09-24）。
>
> 1. **交付格式的事实查清了**（[票 25](25-delivery-format-spec.md)）：
>    没有跨引擎标准；事实上的通用层是 **TexturePacker JSON Hash / JSON Array**，
>    Aseprite 对应导出格式字段名逐字相同，**Phaser 3 原生读**。
>    本票在**这两者之间选**（而不是从零设计），并定 `anchor` / `scale9Borders` 怎么进包。
> 2. **包的结构要容纳第三类输入**（[票 35](35-bitmap-provenance.md) 决策一）：
>    除了交付态与创作态，还有**人工导入的位图素材**（`inputs/`）。
>    它必须能进 manifest，且要能标注来源。⚠️ **它的颜色不受色板约束** ——
>    R2 留下的「颜色 ∈ 色板」构造恒真性质对它**不成立**，
>    包契约必须显式处理这条（强制量化？单独标注？）——
>    与[票 23](23-bitmap-asset-pipeline.md) 对齐。

> 本票是重画后的**第一块地基**：产物 A 的交付物长什么样。
> R3（交付态=位图）、R4（四类资源）、R6（A 与 B 之间只有一个可序列化文件）
> 三条决策都指向它，且[票 09](09-game-config-contract.md)、[票 18](18-artifact-ref-consistency.md)、
> [票 20](20-drawlist-contract.md)、[票 21](21-drawlist-renderer.md) 全在等它。

## Question

产物 A 的输出 = **一个资源包**。要定的是这个包的**物理结构与自描述文件**。

必须回答：

1. **目录结构**。资源包里有四类东西：交付态（PNG + 图集元数据）、创作态
   （drawlist JSON、位图源文件）、风格（StyleSpec）、自描述（manifest）。
   它们怎么分目录？按**资源种类**分（`sprites/` `animations/` `backgrounds/` `ui/`）
   还是按**表达层次**分（`delivery/` `authoring/`）？R3 让这两种切法产生了冲突 ——
   「动画」在交付态是一张 sheet + 元数据，在创作态是 N 份 drawlist 或 N 张源图，
   两者该放在一起还是分开？

2. **manifest 的 schema**。这是包的**唯一入口**：B 只读它，agent 只读它，
   人也只读它。它必须自描述到「拿到包就能用」的程度。至少要能回答：
   包里有哪些资源、各自什么种类、有哪些状态/动画、文件在哪、checksum 多少、
   生成时用的是哪份 StyleSpec、哪些是 fixture 降级来的。
   与现有 `AssetManifestSchema`（`docs/文档.md` 第 20 节）的关系是什么 ——
   取代、扩展、还是另起？

3. **StyleSpec 是否入包**（R6 要求包可独立交付 —— 不入包的话，
   「照着这个风格再生成几个」就无从谈起）。若入包，它的**色板形状**
   （`palette: z.array(z.string())` 还是带槽位名的结构）在此定 ——
   这正是票 12 出局时**搬家**过来的那个决策，
   [票 20](20-drawlist-contract.md) 的 Zod 正则等着它。

4. **引用的粒度与失败语义**：B 引用一个资源时用 `assetId` 还是 `assetId + state`
   （或 `+ animation`）？引用了一个包里不存在的东西时，**谁在什么时候报错**？
   这条与[票 09](09-game-config-contract.md) 是同一个接口的两侧，两票必须给出**同一个答案**。

5. **包的粒度**：一个包 = 一个游戏的全部资源？还是一个包可被多个游戏复用？
   若前者，包里要不要带 game-config；若后者，包的边界由什么划定。

6. **降级标注写在哪**（与[票 14](14-degradation-chain.md) 对齐）：
   一个不知道自己是 fixture 的包是虚假的包。

## 产出要求

调用 `grilling` skill。产出**结构草案 + manifest schema 草案**，
并至少用现有实验里那 6 份真实资源（`experiments/style-transfer-from-test-png/`）
把草案**填一遍**，证明它装得下真实产物 —— 纸上推演不算。

## Answer

**结论：产物 A 的交付物是一个目录，入口是 `manifest.json`（`format: "assetpack/v1"`）。
包按「表达层次」分两层 —— `delivery/` 是引擎直接吃的位图 + TexturePacker JSON（按 kind 分成四份图集），
`authoring/` 是本项目的源文件（drawlist / 导入原图 / StyleSpec）；两层靠 manifest 的 `assetId` 联结。
manifest 里每个资源必带 `origin` 与 `paletteBinding` 两个诚实字段，包级 `provenance.mode` 由它们**唯一派生** ——
所以「一个不知道自己是 fixture 的包」在 schema 层面**解析不通过**，而不是靠约定。
契约草案已用仓库里 12 份真实 drawlist + 1 张真实位图**真的生成了一个包**（逐字节可复现），
并用 Zod 校验通过 + 9 条反例全部被拒。实物在
[`../experiments/asset-pack-draft/`](../experiments/asset-pack-draft/)。**

---

### 0. 先说清楚：这个包**不是** `docs/文档.md` §20 的 `AssetManifest`

| | 现有 `AssetManifestSchema`（§20 / `contracts/index.ts:69`） | 本票的 `AssetPackManifest` |
|---|---|---|
| 它回答 | 「**要做**哪些资源，做出来几个」 | 「**做出了什么**，拿到它怎么用」 |
| 字段 | `{id, assets: AssetSpec[], generated, missing, broken, unused}` | 见 §2 |
| `generated/missing/broken/unused` | 是**过程统计**，服务旧闭环的 gate/repair | **没有对应物** —— R2 之后没有消费者 |
| 归属 | 输入侧，归[票 28](28-recipe-compilation.md)的**资源清单** | 输出侧，归本票 |

两者**不共用类型、不互相扩展**。票 20 已定「Spec 与 Artifact 是两层」，这里是那条结论在包契约上的落点。

⚠️ **命名撞车要修**：`CONTEXT.md` 现在把 `Asset Recipe` 和 `AssetManifest` **都**叫「资源清单」。
建议改为 —— **Recipe = 资源清单（要什么）**，**Manifest = 资源包自描述（做出了什么）**。
本票按这个改法更新了 `CONTEXT.md`。

---

### 1. 包的物理结构（对应票面问题 1）

```
<包根>/
  manifest.json                     ← 唯一入口。B 只读它，agent 只读它，人也只读它
  delivery/                         ← 交付态：引擎直接吃，不需要本项目 runtime
    atlas.sprites.json  .png        ← TexturePacker JSON Hash（票 25 的事实形状）
    atlas.animations.json .png        每帧带 anchor；ui 的每帧带 scale9Borders
    atlas.backgrounds.json .png
    atlas.ui.json .png
  authoring/                        ← 创作态：本项目读，可 diff、可静态校验、可重生成
    stylespec.json
    drawlist/<frameName>.json       ← 一个 (asset, state) 一份（Q20 原样保留）
    imported/<assetId>.<ext>        ← 人工导入通道的原图，**未量化**的那份
```

**顶层按表达层次分（`delivery/` / `authoring/`），而不是按资源种类分。** 理由：
按 kind 分的话，「动画在交付态是一张 sheet 的几帧、在创作态是 N 份 drawlist」这个冲突会在**每个 kind 目录里重演**；
按层次分之后冲突消失 —— delivery 侧只按「帧」说话，authoring 侧只按「源」说话，两者唯一的联结是 manifest。
而且两层**可以各自缺失**：人工导入的资源可以没有 authoring（或者它的 authoring 是一张别人给的 sheet）。

**但交付态内部按 kind 分图集文件**（这是一处刻意的折中）。理由来自 R4 本身：
四类**不是同一种东西的不同尺寸**，所以它们的最优打包参数不同 ——
`ui` 每帧要 `scale9Borders`、`background` 是单张可平铺的大图、`animation` 多帧逐帧带 `anchor`。
塞进一张大图集就得共用一套参数。代价是 B 要发 N 次 `load.atlas`（N=4），这条记进[票 33](33-runtime-assembly.md)。

**图集数量与分组是打包器的实现细节，manifest 只登记结果**（`atlases[]`）。
所以将来「一个 kind 拆两张」「背景一资源一图集」都不改契约。

**版本化**：`<...>/<packId>/v<N>/`，**一个包目录 = 一个版本**，旧版本永久保留。
⚠️ 这**改了 `docs/文档.md` §21 的粒度**：§21 写的是 per-asset 的 `cow/v1, cow/v2`。
改动理由 CONTEXT.md 已经写过 —— 对象从「run 内的中间产物」变成了「交付出去的资源包」。
**包内的物理存放路径（`<...>` 那一段）不归本票**，归[票 29](29-monorepo-layout.md)/
[票 07](07-project-workspace.md)。本票只定包**内部**的形状与包的标识（`id` + `version`）。

---

### 2. manifest schema（对应票面问题 2）

```jsonc
{
  "format": "assetpack/v1",          // 与 drawlist 的 "drawlist+curve/v1" 同构，版本钉死
  "id": "dystopian-shop",
  "version": 1,                      // 绝不覆盖：v1 与 v2 是两个并存的目录
  "createdAt": "2026-09-24T00:00:00.000Z",
  "generator": { "name": "game-maker", "version": "0.0.0-draft" },

  "provenance": {                    // ← Q6，见 §6
    "mode": "mixed",                 // generated | fixture | mixed（由 assets[].origin 唯一派生）
    "style": { "origin": "human-in-session", "ref": "authoring/stylespec.json",
               "stylespecId": "style-ref", "checksum": "sha256:…" },
    "degradations": [ { "stage": "backgrounds", "assetId": "shop_interior",
                        "reason": "…", "fellBackTo": "imported" } ]
  },

  "palette": {                       // ← Q3
    "ref": "authoring/stylespec.json#/palette",
    "size": 9, "values": ["#7c968e", "…"],
    "coverage": { "exact": 5, "quantized": 1, "unbound": 0 }   // 这个包有多同源，一眼看见
  },

  "atlases": [                       // 引擎侧入口：meta 就是能吃的那份 TexturePacker JSON
    { "id": "sprites", "kind": "sprite",
      "meta": "delivery/atlas.sprites.json", "image": "delivery/atlas.sprites.png",
      "size": { "w": 128, "h": 16 }, "frames": 3,
      "assets": ["hazard", "pickup", "platform"], "checksum": "sha256:…" }
  ],

  "assets": [
    { "id": "player", "kind": "animation", "role": "protagonist",
      "origin": "generated",         // generated | imported | fixture
      "paletteBinding": "exact",     // exact | quantized | unbound
      "required": true,
      "size": { "w": 24, "h": 32 },
      "anchor": { "x": 0.5, "y": 0.92 },
      "atlasId": "animations",
      "frames": [ { "name": "player.idle", "state": "idle" }, { "name": "player.walk1", "state": "walk1" }, "…" ],
      "animations": [ { "name": "walk", "fps": 8, "loop": true,
                        "frames": ["player.walk1", "player.walk2", "player.walk3", "player.walk4"] } ],
      "authoring": [ { "kind": "drawlist", "ref": "authoring/drawlist/player.idle.json" }, "…" ]
    }
  ],

  "files": [ { "path": "delivery/atlas.sprites.png", "bytes": 308, "checksum": "sha256:…" }, "…" ]
}
```

**三条设计原则，都是为了「不漂移」：**

1. **manifest 不重复图集里已有的内容。** 帧的 `x/y/w/h`、`anchor`、`scale9Borders`、`sourceSize`
   全在 `delivery/atlas.*.json` 里；manifest 只做索引（帧名 → 属于哪个 atlas）。
   两处可写必然漂移。
2. **manifest 不重复可派生的内容。** 所以**没有 `states[]` 字段** ——
   「这个资源有哪些状态」= `frames[].state` 的去重集合，这条派生规则写进契约注释。
   同理 `atlases[].frames` / `assets[]` 是给人看的冗余，但它们是**计数**不是**内容**，不会漂移出语义差。
   `frames[].name` 是**显式字段，消费者不许解析它** —— 命名约定（`<assetId>[.<state>]`）只是给图集里的人眼看。
3. **所有路径都是相对包根的 POSIX 路径，schema 直接拒绝绝对路径与 `../`。**
   包必须能整体搬走（票 03 的 `base: './'` 结论）；`/etc/passwd` 这种反例已被测试拒掉。

**引用完整性由 schema 强制**（R2 说确定性校验是唯一留下的质量控制，这里就是它的落点）：
`assets[].atlasId` 必须存在于 `atlases[]`；`atlases[].assets` 必须都存在于 `assets[]`；
`animations[].frames` 必须都存在于该资源的 `frames[]`；帧名不得重复；
`atlases[].meta/image` 与 `assets[].authoring[].ref` **都必须在 `files[]` 里**（checksum 覆盖完整）。

---

### 3. StyleSpec 入包 + 色板形状（对应票面问题 3）

**StyleSpec 入包**（`authoring/stylespec.json`）：R6 要求包可独立交付 —— 不入包的话，
「照着这个风格再生成几个」就无从谈起。

**色板形状：保持 `palette: #rrggbb 的有序数组`，drawlist 用 `palette:N` 数字索引引用。**
这是票 12 出局时搬过来的那个决策，落点在此。选索引而非槽位名的**唯一理由**是
`CONTEXT.md` 已经写下的那条性质：

> 推论：换掉整个 StyleSpec 色板，Asset 的**创作态**文本一字不变

槽位名方案（`palette:rust`）会**破坏**它 —— 换色板若改了槽位名，drawlist 文本就得跟着改。
代价是可读性，用 prompt 里列出「索引 ↔ 色值 ↔ 颜色词」的对照来补（票 22 的实验已经证明模型能稳定用索引，6/6 通过）。

新增两条**确定性校验**（进 schema，不再是约定）：
- **色板内不得有重复色** —— 否则 `palette:3` 与 `palette:7` 等价，语义含糊；
- **hex 必须是规范化小写 `#rrggbb`** —— 否则同一份色板有两种合法文本，checksum 不稳。
  （现有实验产出的 StyleSpec 是大写，落进管线时统一转小写。）

---

### 4. 引用的粒度与失败语义（对应票面问题 4）

**引用 = `{ asset, state?, anim? }`**（契约里的 `AssetPackRef`）。规则：
- 静态单状态资源 → 只给 `asset`；
- 有多个状态 → 必须给 `state`；
- 要按时间播放 → 给 `anim`（`anim` **蕴含** state，不必同时给）。

⚠️ **这条与[票 09](09-game-config-contract.md) 是同一个接口的两侧，两票必须给出同一个答案。**
我在 A 侧定的是「能被解析的引用语法」：`{asset, state?, anim?}` 三段式，全部是**名字**不是索引。
票 09 请直接采纳，不要另起一套。

**失败语义：构建期静态解析 + fail fast，报出「哪个资源被哪个引用点引用」。**

理由不是风格偏好，是票 03 实测出来的教训：Phaser 的 loader **整个建立在 XHR 上、且静默失败** ——
`file://` 下游戏能启动、canvas 出来、横幅正常打印，**却一张图都不加载且不报错**（票 03 第 4a 项）。
R8 之后运行时外壳是固定死的手写代码、不做校验，所以**构建期是唯一还能报错的地方**。
运行时才发现 = 用户看到一个空场景，且没有任何线索。

不设 `--allow-missing` 逃生舱：缺资源就是包有问题或配置有问题，两者都该修，不该让它变成运行时静默。

---

### 5. 包的粒度（对应票面问题 5）

**一个包 = 一份自洽的资源集合（同一份 StyleSpec、一起交付、一起版本化），不绑定游戏。**

- 「一个游戏的全部资源」只是**最常见的一种包**，不是定义。包可以大于一个游戏用到的资源
  （多出来的就是「暂时没人用」），也可以被多个游戏复用；
- 包里**不含 game-config**。理由：R6 要求 A 不需要游戏；而 game-config 是[票 09](09-game-config-contract.md)
  的产物、是**产物 B 的输入**（R8：AI 只产数据，那份数据归 B 侧）。
  把 game-config 塞进包会让 A 反过来依赖「有个游戏」。
- 包的边界由**交付意图**划定，不由资源用途划定。这条留给[票 28](28-recipe-compilation.md)
  在定义「清单」时复用。

---

### 6. 降级标注写在哪（对应票面问题 6）

**三层，且第三层是强制的：**

1. **per-asset `origin`（必填）**：`generated` / `imported` / `fixture`。一个包里可以混。
2. **包级 `provenance.mode`（必填）**：`generated` / `fixture` / `mixed`。
   **它由 `assets[].origin` 唯一派生，schema 强制一致** ——
   所以「一个 fixture 包谎报自己是 generated」不是一条能被忽略的约定，而是**解析不通过**。
   这条已进反例测试，实测被拒。
3. **`provenance.degradations[]`**：哪一步、哪个资源、为什么、退到了什么。

⚠️ **下游义务**：[票 30](30-cli-and-mcp-surface.md) 要求 `mode` **必须**出现在 CLI 的输出与
MCP 的返回结构体里。agent 不知道手上这个包是不是 fixture，就无法正确报告。

---

### 7. 票面附加问题：人工导入的位图颜色不受色板约束

**per-asset `paletteBinding`，取值只有三种：**

| 值 | 含义 | 谁保证 |
|---|---|---|
| `exact` | 每一帧的**每个非透明像素**颜色 ∈ `StyleSpec.palette` | **光栅化后扫像素实测**，不是承诺 |
| `quantized` | 交付前被最近邻量化到色板；**原始色留在 `authoring/`** | 量化器 + 记录被改色比例 |
| `unbound` | 不量化，原样交付 | **必须在 `degradations[]` 里留一条**，否则 schema 拒绝 |

包级 `palette.coverage` 给出三类计数。**默认值是 `quantized`（导入路径）/ `exact`（drawlist 路径）**，
`unbound` 存在但没有免费午餐 —— 它会让「风格一致性可证明」这条性质在这个包上出现例外，
所以它必须是**显式的、且被记录在案的**。

**量化对光栅化产出的图和人工导入的图是同一份实现**（票 21 的要求），不写两份。

---

### 8. 实物验证：草案真的装下了什么

`../experiments/asset-pack-draft/` 用仓库里**已有的**真实产物跑出了一个真包
（零依赖，`node build.mjs`）：

| 输入 | 结果 |
|---|---|
| `animated-player/frame.*.json` × 6 | `player` —— **animation** 类，6 帧，2 个 animation（walk 4 帧 8fps loop / idle） |
| `style-transfer-.../drawlist.platform/pickup/hazard` | 3 个 **sprite** |
| `style-transfer-.../drawlist.bg_sign` | 1 个 **ui**，带 `scale9Borders` |
| `demo/test.png`（1218×685 真实位图） | 1 个 **background**，走**人工导入通道**，`paletteBinding: "quantized"` |
| `stylespec.json` | 9 色色板，全部资源只引用索引 |

产出：6 resources / 4 atlases / 20 files / 1520.9 KiB（其中 1218×685 的量化背景占 1200 KB 上下）。
`preview.png` 是放大联系表 —— **六帧确实是同一个角色**，风格确实是那个灰绿+奶油+橙的世界。

**两条硬性质实测成立：**
1. **逐字节确定**：连跑两次 `build.mjs`，`diff -r` 除 preview 外**无差异，PNG 字节也一样**。
   这是 checksum（票 18）与「换色板创作态文本不变」能传导到交付态的前提。
2. **契约可解析**：`node validate.mjs` —— manifest 通过 `assetpack/v1` Zod 校验，
   且 **9 条反例全部被正确拒绝**（硬编码色 / 版本号 0 / 指向不存在的图集 / 动画引用不存在的帧 /
   绝对路径 / `files[]` 漏文件 / 色板重复色 / `unbound` 不记降级 / **fixture 谎报 generated**）。

---

### 9. 实物验证**暴露**的四件事（纸上推演不会发现的）

**① `opacity` 击穿了「颜色 ∈ 色板」的构造恒真性 —— 这条需要人类裁决。**
`hazard` 用了 4 个 `opacity: 0.35` 的 `poly`。alpha 混合在色板内产生了**两个色板外颜色**
（`#7a6c5d` × 24px、`#898f78` × 8px，正是 `palette:5` 分别叠在 `palette:3` / `palette:1` 上的结果）。
所以 `CONTEXT.md` 那句「颜色 ∈ 色板因此是一个**构造上恒真**的命题」**只在没有 `opacity` 时成立**。
三条走法：

- **(a) schema 层面禁掉 `opacity`** —— 恒真性恢复，「半透明」只能用 `fill:"none"` / 网纹表达。
  最保守，且与「像素风」不冲突。**我推荐这条。**
- **(b) 允许 `opacity`，但混合后吸附回最近色板色** —— 保住恒真性，代价是渲染结果偏离作者本意。
- **(c) 承认它不是构造恒真，降级成「光栅化后扫像素验证」** —— 就是现在这个包在做的（`hazard` 因此
  被判 `paletteBinding: "exact"` **失败**，只能在 manifest 里如实标注）。

⚠️ 这条**必须与[票 20](20-drawlist-contract.md) 一起定**（它要写 `fill`/`stroke` 的 schema），
且会影响 `CONTEXT.md` 里那句被当作卖点的话，所以我不擅自拍。

**② 量化不是免费的。** 1218×685 的场景图量化到 9 色，**100.00% 的非透明像素被改色**。
成品能看（见 `preview.png`），但它已经不是原图了。所以 `paletteBinding` 不能是内部实现细节 ——
**调用方必须看得见**。这条也说明：把一张非像素画的图直接丢进 9 色管线，是一个需要人类过目的动作，
不该是自动的。→ 与[票 23](23-bitmap-asset-pipeline.md) 对齐。

**③ 锚点没有源头。** drawlist 里**根本不存在**「哪一点是锚点」的信息（票 25 已指出）。
`player` 的 `{x: 0.5, y: 0.92}` 是这次手填的。而 `player` 六帧的 ink 包围盒并不一样
（idle/walk 高 26.5、jump 高 24.5，见 `animated-player/README.md`），所以「用同一个归一化锚点」
和「逐帧各自对齐」会给出不同的动画观感。**票 26 必须给出锚点的来源规则**，本票只保证它有地方落。

**④ 图层与文件粒度不是一回事（这条是好消息）。** 表面上「多状态必须一次调用生成」
（票 22 问题 1 的实测结论）与 Q20 的「一个 `(asset, state)` 一份 `.json`」冲突，实际上不冲突 ——
**四层各自有自己的粒度**：

| 层 | 粒度 | 谁定的 |
|---|---|---|
| Recipe（资源清单，输入） | **per-asset**（一个 asset 的全部状态在一次里描述） | 本票草案，正式归票 28 |
| Authoring（源文件） | **per-(asset, state)**，一个文件的 diff 只管一个状态 | **Q20 原样保留，未改写** |
| Manifest（`assets[]`） | **per-asset**（B 引用的单位是「东西」） | 本票 |
| Atlas frames | 扁平帧名，靠 manifest 归属 | 本票 |

「一次调用生成、落盘拆成 N 份」是允许的，也是应该的。

---

### 10. 与下游的交界（写完这张票，哪些票可以开工了）

| 票 | 本票给了它什么 |
|---|---|
| [20](20-drawlist-contract.md) | 色板形状（有序数组 + `palette:N`）、`expectedSize` 比对时机、**`opacity` 的裁决待你** |
| [21](21-drawlist-renderer.md) | 交付态图集的形状（per-kind 一份 JSON Hash + PNG）、`anchor` / `scale9Borders` 的落点、量化的落点 |
| [26](26-animation-representation.md) | `frames[]` / `animations[]` 在 manifest 里的形状、**锚点必须有来源**、state 与 animation 的关系本票**刻意没替它定** |
| [27](27-asset-spec-kinds.md) | 四类 kind 在包里的分岔点（各自图集、各自打包参数）；`bg_sign` 归类为 `ui` 是本次的判断，**待裁决** |
| [28](28-recipe-compilation.md) | Recipe 草案（`experiments/asset-pack-draft/recipe.json`）可直接当起点；**Recipe 与 Manifest 的命名区分** |
| [29](29-monorepo-layout.md) / [07](07-project-workspace.md) | 包**内部**的形状已定，**包放在哪**归你们 |
| [30](30-cli-and-mcp-surface.md) | **`provenance.mode` 必须出现在输出里**；「校验一个已有资源包」这个动作现在有明确内容了（就是 `validate.mjs` 那套） |
| [33](33-runtime-assembly.md) | B 要发 4 次 `load.atlas`（每 kind 一次），不是 1 次 |
| [18](18-artifact-ref-consistency.md) | checksum 算法定为 `sha256:<hex>`、粒度是**逐文件**、覆盖 `files[]` 的完整性校验 |

**本票没有替别人做的决定**（刻意留白）：state 与 animation 的关系（[票 26](26-animation-representation.md)）、
四类 spec 各自要什么（[票 27](27-asset-spec-kinds.md)）、清单怎么推导（[票 28](28-recipe-compilation.md)）、
逐帧锚点怎么算（[票 26](26-animation-representation.md)）、包的存放路径（[票 29](29-monorepo-layout.md)）。

**本票需要人类签字的四件事**：`opacity` 的裁决（§9①）、`bg_sign` 的归类（§10 表）、
`paletteBinding: "unbound"` 这个逃生舱是否该存在（§7）、以及 `CONTEXT.md` 里
「资源清单」一词分给 Recipe 还是 Manifest（§0）。
