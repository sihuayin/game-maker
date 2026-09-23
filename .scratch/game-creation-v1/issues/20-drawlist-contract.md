# 20. 把 DrawList 契约与静态分析器落进 demo/src

Type: task
Status: open
Blocked by: 12
Map: ../map.md

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
