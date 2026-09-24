# 20. 把 DrawList 契约与静态分析器落进 packages/contracts

Type: task
Status: open
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
> [`../experiments/asset-pack-draft/schema.mjs`](../experiments/asset-pack-draft/schema.mjs)。

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
