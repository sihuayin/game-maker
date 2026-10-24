# 01 资产：Visual Design Spec 契约草案（落码对照）

> **已落码**：`packages/contracts/src/visual-design.ts`（`zod/v4`，`z.strictObject`）。
> 本资产是**给人反应**的对照表 —— 字段 + 约束 + 一个示例。判据/观察的分界沿用
> `CONTEXT.md` [[观察 / 判据]]；**跨文件**的悬空引用（`palette:N` 越界、`sourceIntent` 指向
> 设计里没有的 id）不在 schema 里判（parse 时 VDS 看不见别的文件），归装配/QA 步。

## 顶层 `VisualDesignSpecSchema`

| 字段 | 约束 | 判据/观察 |
|---|---|---|
| `format` | `z.literal("visual-design/v1")` | **判据**（parse 拒） |
| `viewport` | `{ w, h }`，`int().positive()` | **判据**；值 = 壳 VIEWPORT（480×270）由调用方注入，schema 只验形状 |
| `style` | `{ visualWorldFormat: z.literal("visual-world/v1") }` | **判据**；只做出处指针，不重写色板 |
| `objects` | `z.array(...).min(1)` | **判据**（空 = 生成失败） |

## `VisualDesignObjectSchema`

| 字段 | 约束 | 判据/观察 |
|---|---|---|
| `id` | `string.min(1)`；顶层 superRefine 判**不重复** | **判据** |
| `role` | 11 值：`{ player } ∪ EntityKind ∪ { background, ui-panel, ui-pip }` | **判据**（封闭枚举） |
| `bounds` | `{ x, y, w, h }`，`int().nonnegative()`（w/h `positive()`） | **判据**（越出 viewport 归 validator） |
| `layer` | `int()`，逐对象 z 序，越大越在上 | **判据**（非整数拒） |
| `fill` | `PaletteRefShape`（`^palette:\d+$`） | **判据**；越界归装配/QA 步 |
| `sourceIntent` | `string.min(1)`，可选 | 指向设计里没有的 id = **判据**（跨文件，装配/QA 步） |

## `role` 的单一来源

`Role = z.enum([...EntityKind.options, "player", "background", "ui-panel", "ui-pip"])` —— 实体子集
**从 v3 契约的 `EntityKind.options` 派生**，不复制 7 个字面量。`tests/visual-design.test.ts` 有漂移测试盯着：
一旦有人把它改成手写 7 个字面量（重声明），`role↔kind` 串桶判据（票 07）就会漂、测试当场红。

## 工作示例（480×270，废土寻宝）

```json
{
  "format": "visual-design/v1",
  "viewport": { "w": 480, "h": 270 },
  "style": { "visualWorldFormat": "visual-world/v1" },
  "objects": [
    { "id": "bg-wasteland", "role": "background", "bounds": { "x": 0, "y": 0, "w": 480, "h": 270 }, "layer": 0, "fill": "palette:0" },
    { "id": "e-player",   "role": "player",   "bounds": { "x": 40, "y": 190, "w": 24, "h": 40 }, "layer": 10, "fill": "palette:1", "sourceIntent": "player" },
    { "id": "e-chest",    "role": "chest",    "bounds": { "x": 380, "y": 224, "w": 24, "h": 20 }, "layer": 20, "fill": "palette:3", "sourceIntent": "e-chest" }
  ]
}
```

> `fill` 的 `palette:N` 指向 `visual-world.json` 的 `style.palette`（此处不列 hex，因为 hex 只住那一份）。
