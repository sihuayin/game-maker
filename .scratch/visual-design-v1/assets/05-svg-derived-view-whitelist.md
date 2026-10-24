# 05 资产：SVG 派生视图规则 + 安全白名单（v1，待反应）

> **原型，不是定稿。** 把 PRD §6 的「SVG 设计规范」推成一份**可机械判**的派生规则 + 白名单。
> 前提已锁：票 01（viewport=480×270 屏幕空间）、票 03（VDS 契约 `{id, role, bounds, layer, fill:palette:N, sourceIntent?}`、
> **`visualRef` 已砍**）、票 04（`sourceIntent` 悬空/缺失都是硬失败）。
>
> **三岔裁定**（本图不许推翻）：**SVG 是 VDS 的派生视图，不是第二个语义来源** —— SVG 只带「渲染它需要的」，
> 语义（role/sourceIntent）一律留在 VDS，SVG 不复制。

---

## 0. 一句总览

`render(VDS, palette) → SVG`：VDS 的每个 object 按其 `bounds` 画一个平涂 `<rect>`，颜色由 `fill:palette:N`
**解析成** visual-world 色板里的 hex，`layer` 变成**文档顺序**（SVG 同 stacking context 内没有 `z-index`）。
白名单 = 最小可表达集（`<svg>/<g>/<rect>` + 10 个属性），其余全拒 —— PRD §6.3 的禁项**全部自动落在白名单外**。

---

## 1. 派生规则（确定性）

### 1.1 根 `<svg>`

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
```

- `width`/`height` = VDS `viewport.{w,h}`（票 01：= 外壳 `VIEWPORT`，480×270）。`viewBox` = `0 0 w h`。
- **判据**（票 06 消费）：`width/height/viewBox` 与 VDS `viewport` 一致，否则拒（PRD §6.1「画布尺寸一致」）。

### 1.2 每个 object → 一个 `<g>` 包一个 `<rect>`

```xml
<g id="e-player">
  <rect x="40" y="190" width="24" height="40" fill="#6b8e55"/>
</g>
```

- **1 VDS object ↔ 1 `<g>`**：`id` = VDS object `id`（原样），`<rect>` 的 `x/y/width/height` = `bounds`，
  `fill` = `paletteColor(object.fill, visualWorld.style.palette)`（**唯一**解析处 `drawlist.ts:132` 同款，
  不许另写一份「`palette:N` → hex」）。
- **顺序 = `layer` 升序**（稳定排序，`layer` 相同按 `objects[]` 数组序）。SVG 文档顺序即绘制顺序，
  所以 `layer` **不进** SVG 属性 —— 它就是顺序本身。**判据**：非整数 `layer` 已在票 03 parse 拒。
- **装饰对象**：`background`/`decor` 也是 VDS object（有 `id`），照样画，只是没有 `sourceIntent`。
  PRD §6.2「装饰性元素可不具业务 ID」在我们的模型里**退化为「不具 `sourceIntent`」** ——
  因为 SVG 是 VDS 的纯函数，**每个 SVG 元素都对应一个 VDS object**，不存在「VDS 之外凭空多出的装饰元素」。

### 1.3 确定性 = 三件事全定

同一 VDS（+ 同一 visual-world）⇒ 逐字节同一 SVG，因为：排序全序（`layer` 升序 + 数组序稳定）、
颜色解析唯一（`paletteColor`）、坐标整数（票 01 不重采样，无浮点格式问题）。不引入时间戳、随机、id 生成。

---

## 2. 安全白名单（机械判）

**允许的元素**（3 个）：`<svg>` · `<g>` · `<rect>`

**允许的属性**（10 个）：

| 元素 | 属性 |
|---|---|
| `<svg>` | `xmlns` `width` `height` `viewBox` |
| `<g>` | `id` |
| `<rect>` | `x` `y` `width` `height` `fill` |

**其余一律拒绝**。PRD §6.3 的禁项逐个点名，看它们怎么自动落在白名单外：

| §6.3 禁项 | 白名单怎么拒 |
|---|---|
| JavaScript（`<script>`、`onclick` 等） | `<script>` 不在元素集；`on*` 不在属性集 |
| 外部脚本 / 外部资源引用（`href`/`xlink:href`） | `href`/`xlink:*` 不在属性集（连 `xmlns:xlink` 都不许） |
| `foreignObject` | 不在元素集 |
| 未经批准的外部字体（`<text>`/`font-family`） | `<text>` 不在元素集；`font-*` 不在属性集 |
| 未经批准的动态内容（SMIL `<animate*>`、`<style>`/CSS） | `<animate*>`/`<style>`/`<defs>`/`<use>` 都不在元素集；`style`/`class` 属性不在属性集 |

**`fill` 用色 = 必须 ∈ 色板**（票 05 的核心一问）：`fill` 的值必须是 `paletteColor()` 从 visual-world 色板
**解析出来的** hex（`#rrggbb`），**不是**任意 hex。这不是「SVG 只能写 `palette:N`」（SVG 不懂 `palette:N`），
而是「SVG 里出现的每个 hex **必须**是色板里的那个值」—— 于是「颜色只有一个来源」的色板不变量在派生视图里也不破。
**判据**（票 06 消费）：SVG 里每个 `fill` 值 ∈ visual-world `style.palette`；更强的精确对账
（`fill == paletteColor(vds.fill)`）归票 06 的「对象边界与规格一致」族。

---

## 3. 一个工作示例（对应票 03 的废土示例）

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
  <g id="bg-wasteland"><rect x="0" y="0" width="480" height="270" fill="#1a1a1a"/></g>
  <g id="e-player"><rect x="40" y="190" width="24" height="40" fill="#6b8e55"/></g>
  <g id="e-scrap-01"><rect x="180" y="230" width="16" height="16" fill="#c8b432"/></g>
  <g id="e-chest"><rect x="380" y="224" width="24" height="20" fill="#8a5a2b"/></g>
  <g id="e-spike"><rect x="260" y="250" width="20" height="12" fill="#d0433a"/></g>
  <g id="e-gate"><rect x="440" y="150" width="24" height="80" fill="#3fae4a"/></g>
  <g id="ui-panel"><rect x="8" y="8" width="160" height="24" fill="#3a3a3a"/></g>
  <g id="ui-pip"><rect x="16" y="16" width="12" height="8" fill="#d0c8a0"/></g>
</svg>
```

> `fill` 的 hex 是从 visual-world `style.palette` 解析出的**真值**，不是随便挑的；`<g>` 顺序 = `layer` 升序。

---

## 4. 已裁定（人裁 2026-10-24）

1. **`data-role` 砍掉**：`<g>` 只留 `id`（够 AC-03 关联用）。role 已住 VDS，SVG 是派生视图不复制语义。
2. **一份 `scene.svg`**：整屏合成（一个 viewport、一个 `objects[]`、一个 `layer` 空间），不拆三份。
3. **白名单只收 `<rect>`**：平涂占位用矩形就够；形状辨识度是主观视觉 QA（§8.3，出本图）。
