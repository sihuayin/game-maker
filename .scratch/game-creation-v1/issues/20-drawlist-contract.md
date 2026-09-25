# 20. 把 DrawList 契约与静态分析器落进 packages/contracts

Type: task
Status: resolved
Blocked by: 24, 29, 36, 07
Map: ../map.md

> ✅ **`opacity` 已裁决**（2026-09-24，[票 36](36-opacity-and-palette-invariant.md)）：
> **保留 `opacity`**。不变量从「渲染后像素 ∈ 色板」精确化为
> 「来源 ∈ 色板 ∧ 复合色是色板的确定函数」，前两段都构造恒真。
> 因此本票的 op schema **保留 `opacity: z.number().min(0).max(1).optional()`**，
> 并把 `paletteBinding` 的四值判定作为一条**纯静态**校验函数一起落地
> （走一遍 ops 看有没有 `opacity`，不需要渲染）。

> 🔴 **本票还不能开工：`packages/` 尚不存在**（2026-09-24 补连的边）。
> 本票抬头写明目的地是 `packages/contracts/`，但定义那个目录形态的是
> [票 29](29-monorepo-layout.md)（它正文第 6 条明说「本票要给出目标形态，否则票 07 无从下手」），
> 而 `package.json` / `tsconfig` / 包管理器都由票 29 定。
> 往一个还不存在的目录里写代码就是「先写再改」—— 所以 `29 → 20` 这条边补上了。

> ✅ **票 24 已 resolved，本票解除阻塞**（2026-09-24）。可以直接开工的是：
> 色板形状 = 有序数组 + `palette:N` 索引（`#rrggbb` 小写、不得重复色）、
> `expectedSize` 的比对放在光栅化之后（凸包上界只判过大）。契约草案见
> `packages/contracts/src/assetpack.ts`（已由[票 37](37-assetpack-manifest-landing.md) 落地）。

> ⚠️ **范围已重画**（2026-09-24，R3/R9）：两处变化。
>
> **① 目的地变了**：从 `demo/src/` 变成 `packages/contracts/`（R9），
> 且 drawlist 的地位从「Asset 的**定义**」降为「**创作态**格式」（R3）——
> 因此本票的产物**不是**「Asset 的类型」，而是「创作态的类型 + 静态分析器」，
> 交付态（位图）的类型在[票 24](24-asset-pack-contract.md) 的 manifest 里。
>
> **② 阻塞关系变了**：原阻塞在票 12（palette 用索引还是槽位名），票 12 已随 R2 出局。
> 那个决策**没有消失**，只是搬了家 —— 它现在是[票 24](24-asset-pack-contract.md)
> 资源包契约的一部分（StyleSpec 是资源包的一部分，色板形状由它定）。
>
> 其余要求（Zod discriminated union、`boundsOfOps()` 保守上界、
> `resolveRefs()` 不写两份、硬编码色被拒、`curve` 点数约束、换色板后产物文本一字不变）
> **全部原样保留** —— 它们在 R2 下不但没过时，反而更重要了：
> 生成路径上的确定性校验是 R2 唯一留下的质量控制。

## Question

票 05 已定 Asset 格式为 `drawlist+curve/v1`，原型里的实现是**纯函数、零 DOM 依赖**，
可以直接提升。这张票是纯执行：把它们搬进真实代码并补测试。

**为什么阻塞在票 12**：schema 里 `fill` / `stroke` 字段的合法形式取决于
票 12 的「palette 索引 vs 槽位名」决策 —— 索引是 `palette:5`，
槽位名是 `palette:white`，两者的 Zod 正则不同，而且槽位名方案还要求
**改 `StyleSpecSchema`**（把 `palette: z.array(z.string())` 改成带名字的结构）。
在票 12 定之前写 schema 会白写一遍。

要落地（原型 → 真实代码的对照见票 05 Answer 末尾）：

1. **`demo/src/contracts/drawlist.ts`**：把原型的 `validateDrawList()` 改写成 Zod schema。
   - 六个 op 的 discriminated union（`z.discriminatedUnion("op", [...])`）
   - `fill` / `stroke` 的 palette 引用类型（形式待票 12）
   - `curve` 的 `points` 约束：≥2 个点、每点恰好 2 个有限数值
   - 顶层 `{format, id, state, viewBox, expectedSize, ops}`
   - `format` 用 `z.literal("drawlist+curve/v1")` 钉死版本
2. **`demo/src/qa/visual/geometry.ts`**：搬 `boundsOfOps()` 与 `resolveRefs()`。
   - 必须保留「curve 用点列凸包 = 保守上界」的语义，并在返回类型里
     **显式标注这是上界**（例如返回 `{box, exact: boolean}`），
     否则票 12 的容差逻辑会以为它是精确值。
3. **`AssetSpec` 的关系**：现有 `AssetSpecSchema` 有
   `visual: z.record(z.unknown())` 和 `geometry: z.record(z.unknown())` 两个逃生舱。
   DrawList 是**取代**它们、还是**填充**它们？
   建议：`AssetSpec` 描述「需要什么」（设计意图），DrawList 是「实际做出的东西」
   （产物），两者是 Spec 与 Artifact 的关系，不是同一层。
   **要在契约注释里写清楚**，否则下一个人会把它们混起来。
4. **测试**：原型的 26 项断言里，与 drawlist 相关的那些应该变成
   `demo/tests/drawlist.test.ts`。至少覆盖：
   - 合法产物通过校验（用原型里真实的 cow/tomato/player 8 个组合当 fixture）
   - 硬编码颜色被拒（`#FF00FF`）
   - 非数值坐标被拒且**错误信息定位到 `ops[1].cy`**
   - `curve` 点数不足被拒
   - 包围盒计算：`poly` 精确、`curve` 凸包上界
   - 换色板后产物文本不变（这条是 Q11 的根基，必须有测试守着）
5. **fixture 迁移**：原型里的 `GEOM`（cow / tomato / player 的几何数据）
   搬进 `demo/projects/<projectId>/fixtures/`，按票 05 的
   `(asset, state)` 一份 JSON 的粒度拆开。
   **这些是真实可用的 fixture**，不是测试数据 —— 票 14 的降级链会用到它们。

不要在本票里做的事：renderer（票 21）、版本目录（票 18）、
Visual QA 的检查项与阈值（票 12）。

## Answer

_（待填）_

## Answer

**结论：`drawlist+curve/v1` 的 Zod 契约与静态分析器已落进 `packages/contracts/`，21 条测试全绿、
`pnpm check` / `typecheck` / `test` 全过。契约接受实验里 6/6 份 style-transfer 真实产物；
另外 6 份 animated-player 产物被拒 —— 根因是**拆分脚本的 bug**，不是契约太严（§4）。**

### 0. 落地了什么

| 文件 | 内容 |
|---|---|
| `packages/contracts/src/drawlist.ts` | 六个 op 的 `discriminatedUnion`（`.strict()`）· `DrawListSchema` · `parseDrawList()` 报错摊平 · `paletteBindingOf()` |
| `packages/contracts/src/geometry.ts` | `boundsOfOps()`（含 `exact` 标注）· `resolveRefs()` |
| `packages/contracts/src/index.ts` | 两个模块 re-export |
| `fixtures/drawlist/*.json` | 原型 `GEOM` 的 8 个 `(asset, state)` 组合，**一份 JSON 一个组合**（Q20 粒度） |
| `packages/contracts/tests/drawlist.test.ts` | 21 条测试 |
| `packages/contracts/tsconfig.spec.json` + `typecheck` 脚本 | 测试也进类型检查（构建用的 tsconfig 只管 `src`） |

⚠️ fixture 放在**仓库根 `fixtures/drawlist/`**，不是票面正文写的 `demo/projects/<projectId>/fixtures/`
（那个路径属于旧终点，已随票 29 的目录形态作废）。仓库根 `fixtures/` 是票 29 定的入库输入位置。

### 1. 票 12 搬家过来的那条规则：`exact` 是**返回值的一部分**

`boundsOfOps()` 返回 `{box, exact}`。`exact: false` 表示含 `curve`，此时 `box` 是
**控制点凸包 ∪ 描边半宽**的保守上界 —— 只会高估，不会漏报。

做成返回字段而不是注释，是为了让调用方**没机会忘记**：尺寸校验因此只能判「过大」，
不能判「偏小」。一个把上界当精确值用的调用方会误报「画得太小」。

测试里用密集采样（Catmull-Rom 每 0.01 步）逐点验证了这个上界真的罩得住实际曲线。

**顺带修掉原型的一个 bug**：原型对 `poly` 没有加描边半宽，那会让上界的性质失效
（描了边的多边形会超出顶点范围）。已修，并加断言守着。

### 2. `opacity` 保留，`paletteBinding` 成为**解析期静态可判**（票 36 的落点）

`paletteBindingOf(ops)` 走一遍 ops 看有没有 `opacity` —— **不需要渲染**。
它不是「渲染后扫像素」的近似，而是那个扫描的**判据**：扫描退化成对它的测试。
[票 37](37-assetpack-manifest-landing.md) 落 manifest 时直接 import 这个函数。

判据在真实数据上成立：`tomato.ripe` 有一个 `opacity: 0.45` 的高光 → `composited`；
其余 7 份 → `exact`。

### 3. `AssetSpec` 与 `DrawList` 的关系（票面第 3 条）

写在 `drawlist.ts` 的文件头注释里：**Spec 与 Artifact 是两层，不互相填充。**

- `AssetSpec.visual` / `.geometry` 是**设计意图**（自由形状，票 27 负责结构化，本票不动它们）
- `DrawList` 是**产物本身**（有版本、可 diff、可静态分析）

票 20 的原始建议是「取代 vs 填充」二选一；正确答案是**都不是** —— 它们回答不同的问题。

### 4. 🔴 从真实产物里挖出来的东西

票面只要求用原型里 `cow / tomato / player` 的 8 个组合当 fixture。我顺手把
**实验里那 12 份真实产物**也过了一遍 schema —— 结果 **6 过 6 不过**：

| 来源 | 结果 |
|---|---|
| `experiments/style-transfer-from-test-png/drawlist.*.json`（6 份） | ✅ 全部通过 |
| `experiments/animated-player/frame.*.json`（6 份） | ❌ 全部 `state: Required` |

**根因不是模型吐漏了，是拆分脚本的 bug。** `gen_player.mjs` 第 90 行把多状态响应摊平时：
`JSON.stringify({...o, states:undefined, ops:st.ops})` —— **忘了写 `state`**。

而模型真正产出的是**另一种形状**：
`{format, id, viewBox, expectedSize, states:{"<帧名>":{ops}}}` —— 一次调用出全部状态，
**正是[票 22](22-asset-generator.md) 问题 1 证明「单次调用才能保证帧间同一性」的那个生成形状**。

于是暴露出更大的事：**Q20 的落盘粒度（一个 `(asset, state)` 一份）与生成粒度
（一个 asset 全部状态一次调用）在真实产物里已经分叉出两种形状。**

**本票的裁决**：形状 A 是唯一**落盘**形态，形状 B 是**生成期的暂存形态**（落盘前必须摊平），
`state` **必填**。理由：`state` 是最小自描述，且它应当是资源包 manifest 里 `frames[].state` 的
**主来源** —— 主来源在产物里、索引在 manifest 里；反过来才是制造漂移。缺 `state` 就该在解析期被抓住。

**但这是一个可推翻的裁决**：若[票 26](26-animation-representation.md) 认为形状 B 也该成为落盘形态，
那 `state` 就变可选、`states` 需要正式 schema。完整的证据与那条 bug 已记进票 26。

### 5. 报错的可定位性（实测输出）

```
【硬编码色 #FF00FF 混进 fill】  ✗ ops[1].fill: 必须是 palette:<下标> 引用；硬编码色值无法通过 schema
【坐标被写成字符串】            ✗ ops[1].cy: Expected number, received string
【curve 只有 1 个点】           ✗ ops[0].points: curve 至少 2 个点
【op 名拼错】                   ✗ ops[0].op: Invalid discriminator value. Expected 'rect' | 'circle' | …
【版本号写成 drawlist+path/v1】 ✗ format: Invalid literal value, expected "drawlist+curve/v1"
```

`formatIssues()` 会把 zod 的 `unionErrors` 摊平 —— 不摊的话 `discriminatedUnion` 的报错会包一层，
路径就定位不到 `ops[1].cy`，而票面恰恰点名要这条。

### 6. 顺手定的两条（票面没写，但不得不定）

- **`poly` 至少 3 个点**（原型用的是 ≥2）。两个点的「多边形」是退化数据，解析期直接拒。
- **`.strict()`**：多出未知字段被拒。格式带版本号（`/v1`），未来新增字段属于 v2，
  不该悄悄出现在 v1 的文档里。

### 7. 发现的缺口（记给下游，不在本票射程内）

- **`StyleSpecSchema.palette` 尚未规范化**（[票 24](24-asset-pack-contract.md) Q3 已定：
  小写 `#rrggbb` + 不得有重复色）。实测的色板是**大写**，直接收紧会让现有 fixtures 失败，
  所以它是一次跨票的迁移，不属于本票。已加进[票 37](37-assetpack-manifest-landing.md) 的射程。
- 本票没有碰 `boundsOfOps` 与 `expectedSize` 的**比对时机与阈值** —— 那是[票 27](27-asset-spec-kinds.md)
  的搬家规则。本票只保证「上界」这件事在类型上不会被误用。

### 8. 解除阻塞

[票 37](37-assetpack-manifest-landing.md) 可以开工（它的 `paletteBinding` 判定要用本票的 ops 类型）。
另：`fixtures/` 目录建起来了，[票 14](14-degradation-chain.md) 的降级链与
[票 23](23-bitmap-asset-pipeline.md) 的导入通道可以直接用。
