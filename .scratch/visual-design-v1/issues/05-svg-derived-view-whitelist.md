# 05. SVG 派生视图 + 安全白名单

Type: prototype
Status: resolved
Owner: claude · 2026-10-24
Blocked by: 01, 03
Map: ../map.md

## Question

产出一份 **SVG 如何从 VDS 确定性生成**的规则草案 + **允许元素/属性白名单**，供人反应。

- 派生规则：VDS 的每个 object（bounds + layer + visualRef）→ SVG 的哪个结构？`<g id=… data-role=…>` 包
  `<rect>`？装饰性元素（无业务 id）怎么表达？`layer` → SVG 文档顺序还是 `z-index`？
- **白名单**：SVG 允许哪些元素/属性？对照现有 DrawList op 集（`rect/circle/ellipse/poly/line/curve/dither`）与
  `raster.ts` —— SVG 侧只允许能表达「VDS 对象 + 其视觉引用」的最小集，其余一律拒绝。PRD §6.3 已禁
  JS / foreignObject / 外部引用 / 外部字体 / 动态内容，白名单要把它落成可机械判的清单。
- SVG 是**派生视图**（票 02/03 之上）：它必须是 VDS 的确定性函数（同一 VDS ⇒ 逐字节同一 SVG），不能是第二个语义来源。
  `fill` 用色怎么办？SVG 允许任意 hex，但 VDS 的颜色来自 VisualWorldSpec 的 palette —— SVG 的 fill 是否必须
  只能引用 palette（否则色板不变量被打破）？这条要明确。

交付：派生规则草案 + 白名单清单，链接为资产。HITL：草出来给人反应。

## Draft

- [05-svg-derived-view-whitelist.md](../assets/05-svg-derived-view-whitelist.md) —— 派生规则 + 白名单。已按人裁收口。

## Answer

SVG 派生规则 + 白名单钉死（细节在草案资产，此处只收口）：

- **派生**：`render(VDS, palette)` —— 1 VDS object → 1 `<g id>` + 1 `<rect>`；`bounds`→`x/y/width/height`，`fill`→`paletteColor(fill, palette)` 解析出的 hex（**唯一**解析处）；**顺序 = `layer` 升序**（稳定排序，`layer` 不进属性）。
- **白名单**：元素 `<svg>/<g>/<rect>`；属性 `xmlns/width/height/viewBox`(svg) + `id`(g) + `x/y/width/height/fill`(rect) = **10 个**。其余全拒 ⇒ PRD §6.3 禁项全部自动落白名单外。
- **色板不变量**：SVG 每个 `fill` 必须是色板解析出的 hex（∈ `style.palette`），不是任意 hex。
- **人裁三条（2026-10-24）**：① `data-role` 砍（`<g>` 只留 `id`，role 住 VDS）；② 一份 `scene.svg`（不拆三份）；③ 白名单只收 `<rect>`。
- **确定性**：排序全序 + 唯一解析 + 整数坐标 ⇒ 同一 VDS（+ 同一 visual-world）逐字节同一 SVG。

下游消费：票 06 拿这份白名单当「资源安全/禁止内容」清单、「文件完整」= 一份 scene.svg + preview/scene.png；票 07 不涉及。
