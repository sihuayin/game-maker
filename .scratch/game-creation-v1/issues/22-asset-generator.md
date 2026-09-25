# 22. AssetGenerator（drawlist 路线）：StyleSpec + AssetSpec → drawlist 的生成契约

> ⚠️ **范围已收窄**（2026-09-23）：位图生成解锁后，Q3 修正为混合路线 ——
> **英雄角色走位图（[票 23](23-bitmap-asset-pipeline.md)），本票只负责道具/关卡几何等 drawlist 资源。**
> 本票的六个问题里，问题 1（多状态同一性）与问题 3（characterStyle）
> **在位图路线下由票 23 接手**；问题 2（dither 图元）对 drawlist 路线仍是真问题。


Type: prototype
Status: resolved
Blocked by: —
Map: ../map.md
> 🔴 **票 38 已 resolved —— 你是产物 A 的最后一环**（2026-09-24）：
> 组装链路（`packages/assets/src/pack.ts` 的 `buildAssetPack()`）已经通了，
> 但它把 drawlist 生成做成一个**注入的端口**，因为那是你的事：
> ```ts
> export type DrawListGenerator = (spec: AssetSpec, style: StyleSpec) => DrawList[] | Promise<DrawList[]>;
> ```
> **你要交付的就是这个接口的一个实现。** 它的契约约束：
> ① 返回的帧数必须等于 spec 声明的帧数（`sprite` = 1；`animation` = 各动画帧数之和，**按 animations 声明顺序**）；
> ② 每份 drawlist 要过 `DrawListSchema`（`format` / `id` / **`frame`** / `viewBox` / `expectedSize` / `ops`）——
> 注意字段叫 **`frame` 不叫 `state`**（票 26 收掉的）；
> ③ **同一个 asset 的所有帧必须在一次调用里生成** —— 票 22 你自己的实测结论，
> 也是票 28 推导那份清单时踩到的坑（模型默认把它们拆成三个资源）；
> ④ `viewBox` 必须等于 spec 的 `size`，否则锚点的分母就错了（票 27 的对账会报）。
> 现成的对照：`experiments/pack-assembly/build-pack.mjs` 里那个**桩生成器**（确定性、离线，不是真生成器）。


> 🔴 **输入侧出现缺口**（2026-09-24，[票 34](34-wan-quota-facts.md)）：
> 本票的输入是 `StyleSpec`，而 StyleSpec 来自「参考图 → 视觉模型」——
> 那条路（千问 Token Plan）现在**配额耗尽且条款禁止管线化调用**。
> 也就是说**本票现在拿不到自动产出的 StyleSpec**。
>
> 应对（见[票 35](35-bitmap-provenance.md)）：**StyleSpec 降级为「人机协作的一次交互」** ——
> 条款明确允许在 Claude Code 这类工具里交互式使用，所以「人在会话里让模型看图、产出
> StyleSpec JSON、存成文件」是**合法且几乎免费**的，管线只消费这个文件。
> 本票**不需要等票 35** 就能开工：拿[票 15](15-stylespec-fixture.md) 的 fixture StyleSpec 当输入，
> 本票要回答的问题（多状态同一性、dither 图元、few-shot 模板）**全都与 StyleSpec 从哪来无关**。
>
> 另：本票**问题 5**（视觉路径有没有 thinking 开关）**作废** —— 视觉路径整个不可用了。

> ✅ **本票范围不变，地位上升**（2026-09-24，R3/R7）：drawlist 生成从「Asset 的产出」
> 变成「**创作态**的产出」，是产物 A 的两条生产线之一（另一条是[票 23](23-bitmap-asset-pipeline.md)）。
>
> 票内六个问题在 R3 下的归属：
> - 问题 1（多状态同一性）：**仍归票 23**（位图路线的帧一致性是同一个问题）
> - 问题 2（dither 图元）：仍是本票的真问题 —— 且现在多了一层：若材质靠 renderer 叠加，
>   它只活在**交付态**里，创作态文本不变，票 20 的「换色板产物文本不变」性质会**被绕过**。要判这算不算问题。
> - 问题 3（characterStyle）：**归票 23**（英雄角色走位图）
> - 问题 4（few-shot prompt 模板归谁维护）：**仍归本票**，且现在与[票 09](09-game-config-contract.md)、
>   [票 28](28-recipe-compilation.md) 三票共用同一个模板渲染器，要合成一个决定
> - 问题 5（thinking 开关在视觉路径上是否存在）：**仍归本票**，答案进[票 19](19-latency-budget.md)
> - 问题 6（「像不像」谁判）：**改判** —— R2 砍掉了自动评分，
>   眼下只有人眼 + 参考基准；要不要引入视觉模型**抽查**已移进 fog

## Question

**这张票是建图时漏掉的。** `ports.ts` 里的 `AssetGenerator.generate(manifest, style)`
是整个系统最核心的创造步骤 —— 拿到 StyleSpec 和 AssetSpec，产出 drawlist ——
但建图时没有任何票负责它（票 05 定输出格式、票 08 修状态机、票 16 定修改、
票 18 定落盘，全是外围）。

人类在 2026-09-23 用 `demo/test.png`（像素风反乌托邦商店内景）跑了一次真实实验，
产物在 `experiments/style-transfer-from-test-png/`（含 `sheet.png` 联系表与
`view.html` 可交互页）。**实验证明这条路能走通，也精确暴露了六个没答案的问题。**

### 实验已证明的

- 链路 test.png →（qwen3.8-max 视觉，61s）StyleSpec →（deepseek-v4-pro 文本，
  **关 thinking 后 3.5-8.4s/个，5 路并行 8s 总耗时**）drawlist → SVG 渲染，**全程无人工修图**
- StyleSpec 提取质量**远超预期**：`shapeLanguage` 抓到
  "hard-edged rectangles / pixel-stepped diagonals / nested panel frames"，
  `constraints` 甚至给出可执行规则（"无纯黑纯白、阴影保持绿灰调"、
  "暖色点缀 <15% 面积"、"1px 深色描边"），且**这次没有色板补全幻觉**
- **颜色风格迁移是结构性成立的**：6 份资源全部只用了色板索引，
  渲染出来确实是参考图那个灰绿+奶油+橙点缀的世界
- **直角/嵌套面板的形状语言迁移成功**：pickup 的嵌套面板框 + CRT 发光屏、
  platform 的锈迹斑点，都与参考图的设备美学吻合
- schema 6/6 通过（用了 few-shot 示例之后，见问题 4）

### 六个待决问题

1. **⚠️ 同一资源的多状态画成了不同角色。**
   `player.idle` 与 `player.jump` 是**两次独立调用**生成的，结果：
   idle 是 11×29 的瘦长人形，jump 是 15×24 的宽块 —— 明显不是同一个角色。
   票 05 定了「一个 (asset, state) 一份产物」，但**没说怎么保证它们是同一个角色**。
   候选：① 多状态一次调用生成（一份响应里给全部 state 的 ops）
   ② 先单独生成「角色骨架」（头身比、部件坐标），再让各状态在骨架上摆姿势
   ③ 生成 jump 时把 idle 的 drawlist 塞进 prompt 当参照。
   三者对 prompt 长度、schema 形状、repair 粒度的影响都不同。
2. **材质迁移撞到了格式极限。**
   参考图的核心材质是 "pixel dithering / rust streaks"。
   实验里只有 platform **偶然**带上了斑点噪点，其余资源全是平涂 ——
   因为 **drawlist 没有 dither 图元**。
   候选：① 加 `dither`/`stipple` op（密度、颜色对、区域）② 接受材质缺失，
   把 dither 当作后期统一叠加的渲染效果（renderer 层做，不进数据）
   ③ 在 `material` 维度上认输，降级 StyleSpec 的材质要求。
   ② 最省事但让「材质」脱离数据、脱离校验；① 最忠实但加 op 就要改票 20 的 schema。
3. **characterStyle 兑现不了。**
   参考图说 "semi-realistic adult proportions (~6 heads)"，生成的是 ~3 heads 积木人。
   `StyleSpec.characterStyle` 是自由文本，模型读到了但没有执行。
   要不要把 characterStyle 结构化成可执行的数值约束（头身比、部件比例）？
   还是承认平台跳跃游戏本来就该 Q 版，在编译 StyleSpec 时按游戏类型改写它？
4. **few-shot 示例是形状合规的必要条件。**
   没有示例时模型把 ops 包进 `"drawlist"` 键、丢掉顶层字段；
   加了一个 3-op 示例后 6/6 通过。
   这份 schema-to-prompt 渲染器（schema + 色板 + 示例 + 风格约束）
   会被 `compileStyle` 之后的**所有**生成调用共用（AssetGenerator、GameConfig、
   GameplayTestPlan 补充、Repair 诊断）—— **它归谁维护？**
   票 09 也提过同样的问题，两张票要统一成一个决定。
5. **`thinking: {type:"disabled"}` 改变了输出风格。**
   开着 thinking：9/9 零 markdown 围栏（票 01 实测）；
   关掉 thinking：会加围栏、JSON 形状纪律下降 —— 但**快 18 倍且真的产出内容**。
   视觉路径（`/v1/messages` 走 qwen3.8-max）**有没有同样的开关？没测过。**
   票 01 测 StyleSpec 提取时 thinking 是开着的，花了 61s ——
   如果 qwen 也支持关 thinking，票 15 的耗时能砍到多少？
6. **「够不够像参考风格」谁来判？**
   结构化校验能查颜色（恒真）、尺寸（凸包）、图元合法性 —— 但查不了「像不像」。
   实验里「pickup 像不像参考图的设备」这种判断是**人眼看 sheet.png 做出来的**。
   这是否就是 fog 里那条「视觉模型打分」该出场的地方？
   如果是，它应该只在**生成后抽查**（便宜），还是进 Creation Gate（贵且不稳）？

### 产出要求

调用 `prototype` skill：把上面 6 问里**能用实物回答的**（1、2、3）做成可看的对比 ——
特别是问题 1，把三种多状态策略各跑一次，把三组 player 并排渲染出来让人眼判。
问题 4、5 是调用契约问题，产出可直接执行的 prompt 模板与参数表。
问题 6 是判断题，产出结论即可。

实验脚本的起点：`/tmp/gen/step1_stylespec.mjs` 与 `step2_assets.mjs`
（未入库；入库时放本票目录下）。

## Answer

_（待填）_

## Answer

**结论：产物 A 端到端跑通了 —— 用真生成器。** 77.7 秒、8 个资源、28 个文件、spec↔产物对账 0 问题，
186 条测试全绿。**14 帧的玩家是同一个角色。**

### 0. 四条裁决

| 问题 | 裁决 | 落点 |
|---|---|---|
| 材质（dither） | **加 `dither` op** | 契约 + 静态分析 + 光栅化器（三处） |
| `characterStyle` | **当自由文本用，数值从 `spec.size` 推** | `headCount()` |
| prompt 渲染器归谁 | **一个共享模块，放进 `assets`** | `packages/assets/src/prompt.ts` |
| 「像不像」谁判 | **生成后抽查，产出观察清单交给人** | `packages/assets/src/review.ts` |

票面六问里另外两问已被上游证据回答：
- **问题 1（多帧同一性）**：[票 22](../experiments/animated-player/README.md) 自己的实验证明
  「一次调用出全部帧」有效，[票 28](28-recipe-compilation.md) 的推导实验又独立撞到同一个坑
  （模型默认把角色拆成三个资源）。**已写死进实现**：一个 asset 的全部帧一次调用。
- **问题 5（thinking 开关在视觉路径）**：作废（视觉路径当时不可用；
  且它现在也通了 —— 见 §5）。

### 1. `dither` 的落地理由：它不只是「多一种画法」

**抖动是像素风里唯一不出色板的调色手段。** [票 36](36-opacity-and-palette-invariant.md) 实测过
`opacity` 会做 alpha 混合、产出色板外的复合色；而两种**色板色**交替得到第三种观感，
**每一个像素仍然严格 ∈ 色板** —— 所以含 dither 的资源 `paletteBinding` 仍是 `exact`。
参考图的核心材质就是 "pixel dithering / rust streaks"，加它之前生成出来全是平涂。

一处改动落到三个模块：`drawlist.ts`（第七种 op）· `geometry.ts`（包围盒精确、`resolveRefs` 收 `colors`）
· `raster.ts`（逐像素按 Bayer 矩阵二选一）。

### 2. 🔴 真跑：产物 A 端到端

```
清单 → 真包：77.7s · 8 个资源 · 28 个文件 · 1182.7 KiB
manifest 过 schema ✅ · 对账（spec ↔ 产物）0 问题
provenance.mode = mixed · coverage = {exact:4, composited:3, quantized:1, unbound:0}
```

**14 帧的玩家是同一个角色**（头、帽、躯干、胸口那块 CRT 屏在全部帧里一致，只有四肢在变）
—— 这是把「一个 asset 的全部帧放一次调用」写死进实现换来的。
实例与联系表：[`../experiments/real-generation/`](../experiments/real-generation/)。

### 3. 抽查真的抓到了结构化校验查不出的东西

`reviewPack()` 把联系表 + 风格规格给视觉模型，**只要观察、不要分数**。它报的第一条：

> 房间场景（左下角）的墙面和部分道具使用了带有平滑渐变或较高对比度阴影的色块，
> 并非全部依赖像素抖动；橙色海报与暖黄色发光的面积占比明显超过规格里的 15% 上限。

**那正是人工导入的那张背景。** 它被量化到 9 色，但**量化不会把一张照片变成像素画** ——
「颜色 ∈ 色板」是构造成立的，而「看起来属于同一个视觉世界」不是。
这条是这一轮抽查最有价值的产出，也是[票 24](24-asset-pack-contract.md) 的
`paletteBinding: "quantized"` 这个字段存在的意义：它诚实地标注了「这个资源只是被吸附进来」。

### 4. 施工中抓到的三件事

**① 失败的构建会白吃一个版本号。** 连跑四次失败留下 `v1`–`v4` 四个空目录。
改成**先建在工作目录里、全部成功才改名过去** —— 这一步之后才对「绝不覆盖」负责。

**② `max_tokens` 默认 8192，而 14 帧要 ~14000 输出 token。** 被截断的表现是
「JSON 不合法」，极易误判成模型吐坏数据。现在**读 `stop_reason` 分开报**：
「撞上 max_tokens 被截断」与「返回的不是合法 JSON」是两条不同的错。

**③ 同一个 prompt 三次里有一次返回坏 JSON**（票 01 记的是「9/9 通过」，但那是 9 次）。
加了**有界重试**（默认 2 次）。⚠️ 这**不是** R2 砍掉的修复循环：重试只是**重采样**，
不把错误喂回去，模型不会被引导去改上一次的结果。

另外：抽查工具自己被抓出一个 bug —— `packContactSheet` 把 `Buffer.copy` 的参数写反了
（它是 `src.copy(target, ...)`），静默拷了个空，于是视觉模型看到一张纯色图说「图里没有内容」。
**是抽查替我发现的**；现在有一条专门的回归测试钉着它。

### 5. 🔴 一条环境事实又翻了：文本路径的 `/v1/chat/completions` 现在不通

实测：那条路 403，报 **`INSUFFICIENT_BALANCE`** —— 代理故障转移到新 provider
`dragoncode.codes`，而那个账号没钱。**同一时刻 `/v1/messages` 仍然可用**
（0.7s、干净 JSON、也仍然能收图），所以生成器的端点已做成**参数**（默认走后者）。

**票 01 那份「文本走 chat/completions」的配方因此作废。** 已订正地图的环境事实。

> **这就是「代理活不过重启」的现场重演。** [票 14](14-degradation-chain.md)（降级链）
> 仍在前沿，而这次它**不再是理论上的兜底 —— 它就是眼下的常态**。
> 这一票的全部实测都是在「上游随时会断」的条件下做出来的。

### 6. 落地清单与验收

| 文件 | 内容 |
|---|---|
| `packages/contracts/src/{drawlist,geometry}.ts` | `dither` op + 包围盒 + 用色收集 |
| `packages/assets/src/raster.ts` | dither 真的画出来（Bayer 矩阵） |
| `packages/assets/src/prompt.ts` | **新增** —— schema-to-prompt 渲染器（生成与推导共用） |
| `packages/assets/src/generate.ts` | **新增** —— `createDrawListGenerator()`，票 38 那个端口的实现 |
| `packages/assets/src/review.ts` | **新增** —— `packContactSheet()` / `reviewPack()` |
| `packages/assets/src/pack.ts` | 失败不再消耗版本号 |
| `experiments/real-generation/` | 真跑的脚本 + 预览（可复跑） |

| # | 检查 | 结果 |
|---|---|---|
| ① | 全部测试 | ✅ **186 passed** |
| ② | **真跑端到端**（真生成器） | ✅ 77.7s · 8 资源 · 对账 0 问题 |
| ③ | 帧间一致性（14 帧同一角色） | ✅ 人眼 + 联系表 |
| ④ | 视觉抽查 | ✅ 抓到「导入的背景不像像素画」 |
| ⑤ | `pnpm check` / `typecheck` | ✅ |

### 7. 已知不足（对着联系表看得见）

- **dither 用过头了**：参考图的 `material` 写着 "pixel dithering"，模型把它铺满整个角色，
  读起来是噪点纹理而不是「衣服上有锈迹」。prompt 里该给它一个面积上限。
- 角色的头看起来像头盔面罩，参考图里那张脸没迁移过来。

### 8. 产物 A 现在的状态

**两个产物里，产物 A 的整条链路（清单 → 生成 / 导入 → 光栅化 → 图集 → 包）已经端到端可跑。**
剩下的是**质量调优**（dither 过度、脸部迁移）与**降级**（票 14）——
后者因为上游一直在断，已经不是可选项。
