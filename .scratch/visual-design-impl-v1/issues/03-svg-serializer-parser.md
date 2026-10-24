# 03. SVG 序列化 + 最小白名单解析器

Type: task
Status: open
Owner: —
Blocked by: 01
Map: ../map.md

## Question

实现两个确定性函数（`packages/visual-design/src/svg.ts`），供 `VisualDesignCompiler.compile` 与 validator 用：

1. **`serializeVds(vds, palette): string`** —— 按 `visual-design-v1` 票 05 派生规则：1 object → 1 `<g id>` + `<rect>`，
   `layer` = 文档序（升序）、`fill` = `paletteColor` 解析成 hex（`drawlist.ts:132`，hex 必须 ∈ `style.palette`）、
   `bounds` 直接写 `x/y/width/height`。白名单 `<svg>/<g>/<rect>` + 10 属性；只 `<rect>`；单份 `scene.svg`。
   确定性：同 VDS ⇒ 逐字节同 SVG 字符串。
2. **`parseWhitelistedSvg(svg): {viewport, rects[]}`（最小白名单解析器）** —— 供票 05 validator 做 round-trip 校验。

**约束 #1（用户逐字，本票的硬门槛）**：零依赖**不代表**能用脆弱的字符串检查。解析器必须正确处理：
- XML 基本语法（元素、属性、闭合）；
- 属性解析（引号单/双、实体转义 `&amp;` 等、空白）；
- **重复属性**、**非法结构**（拒绝，不是静默吞）；
- `foreignObject` / 脚本 / 外部引用 / 外部字体 / 动态内容一律拒绝（PRD §6.3）。

**不得**只靠正则找 `<rect>` 和 `id` 就交差。若最小解析器**证明不了**满足上述契约，零依赖就不是天然最优 ——
先做**针对性验证**（对一组恶意/畸变 SVG 用例），据此决定手写是否够，**但不因此自动引入 native 依赖**。

**测试**（TDD）：serialize 的确定性（同 VDS 逐字节同 SVG）；parse 对合法白名单 SVG 正确取 viewport+rects；
对重复属性/非法结构/转义/外部实体给出确定拒绝；round-trip（serialize 后 parse 回，rects 与 VDS 一致）。
资产参考 `../visual-design-v1/assets/05-svg-derived-view-whitelist.md`（白名单清单）。
