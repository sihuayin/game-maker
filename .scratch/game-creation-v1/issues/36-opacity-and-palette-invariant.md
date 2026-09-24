# 36. `opacity` 与「颜色 ∈ 色板」不变量

Type: grilling
Status: resolved
Blocked by: —
Blocks: 20
Map: ../map.md

> 本票由[票 24](24-asset-pack-contract.md) 的实测**长出来**的：它本来不是一张票，
> 是「把草案用真实产物填一遍」时被撞出来的。票 24 把它写进 map 的 Not yet specified，
> 按 wayfinder 的判据（问题已经足够锐利）在此毕业成票。
>
> 为什么是票而不是「执行者顺手定」：它会改写 `CONTEXT.md` 里被当作**卖点**的那句话，
> 且直接决定[票 20](20-drawlist-contract.md) 要写的 op schema 长什么样。

## Question

`hazard.idle.json` 用了 4 个 `opacity: 0.35` 的 `poly`。alpha 混合在色板内产生了
**两个色板外颜色**：`#7a6c5d`（24px）与 `#898f78`（8px）。
验算无误 —— `0.35×palette:5 + 0.65×palette:3 = #7a6c5d`，
`0.35×palette:5 + 0.65×palette:1 = #898f78`，与光栅化器扫出的像素逐字节一致
（见 [`../experiments/asset-pack-draft/`](../experiments/asset-pack-draft/)）。

于是 `CONTEXT.md` 里那句「颜色 ∈ 色板因此是一个**构造上恒真**的命题」**只在没有 `opacity` 时成立**。
三条走法：禁掉 `opacity` / 混合后吸附回最近色板色 / 承认它不恒真。

## Answer

**裁决：保留 `opacity`，把不变量精确化，并把它从「渲染后扫描」提前成「解析期可判」。**

### 精确化后的不变量（三段，前两段恒真）

1. **来源层面（不变，构造恒真）**：drawlist 里所有颜色**都必须是 `palette:N` 引用** ——
   硬编码 hex 无法通过 schema。这条一个字没改。
2. **函数层面（新增，构造恒真）**：渲染出的每个不透明像素颜色，都是**色板颜色的确定函数**。
   `opacity` 只是这个函数里的一个标量参数，它**不引入任何色板之外的来源**。
3. **失效的只是这个更强的说法**：「渲染后的像素集合 ⊆ 色板」。
   它从来不是设计目标，只是第 2 条在「没有 opacity」时的偶然推论。

### 两条被当作卖点的性质都还活着

- **「换掉整个 StyleSpec 色板，创作态文本一字不变」** —— 文本里只有索引与一个标量，
  换色板不动一个字符。✓
- **「换掉色板 → 交付态整体换色」** —— 复合色是色板的函数，色板变则复合色跟着变。✓

### 顺带拿到一个更好的结果：这条现在是**解析期**可判的

`paletteBinding` 对 drawlist 资源**可以静态判定** —— 走一遍 ops 看有没有 `opacity` 就够了，
**不需要渲染**。R2 要的正是「生成路径上的确定性校验」，这条现在在解析期完成；
票 24 草案里那次扫像素退化成**对它的测试**，而不是判据本身。

### `paletteBinding` 取值修订：3 值 → 4 值

| 值 | 含义 | 怎么判 |
|---|---|---|
| `exact` | 每个不透明像素的颜色 ∈ 色板 | **静态**：无任何 op 带 `opacity` |
| **`composited`** | 每个不透明像素都是**色板色的 alpha 复合** | **静态**：有 op 带 `opacity`（来源已由 schema 保证） |
| `quantized` | 被吸附到色板 | 生成侧记录（导入路径） |
| `unbound` | 既不 ∈ 色板、也不是复合 | 生成侧声明，且**必须在 `degradations[]` 里留一条** |

### 明确否决的两条

- **禁掉 `opacity`**：会直接判现有真实产物 `hazard` 非法，要重生成或改写；
  且「半透明」在像素风里是正当手段，禁它是拿 schema 表达审美偏好。
  代价大于收益 —— 它救回来的只是一个**本就不重要**的强说法。
- **混合后吸附回最近色板色**：`0.35` 的奶油色叠在深绿上会被吸成实心暗绿，
  半透明的观感**直接消失**。代价最大，收益同样只是那个强说法。

### 对下游的直接影响

- [票 20](20-drawlist-contract.md)：op schema **保留 `opacity`**（`z.number().min(0).max(1)`，可选）；
  `paletteBinding` 的四值判定作为一条**纯静态**校验函数进 `contracts`。
- [票 24](24-asset-pack-contract.md)：manifest 的 `paletteBinding` 枚举加 `composited`（Answer §7 已同步）。
- `CONTEXT.md`：Asset 一节那句「构造上恒真」已按上面三段改写。
