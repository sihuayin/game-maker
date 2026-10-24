# 01. Visual Design Spec 契约 schema 落码

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md

## Question

把 `visual-design-v1` 票 03 锁定的 VDS 契约落成 `packages/contracts/src/visual-design.ts` 的 zod schema，并在
`packages/contracts/src/index.ts` re-export。**只写契约，不写编译器。**

- **zod 实例**：用 `zod/v4`，与 `game-design.ts` / `visual-world.ts` 同实例，`z.strictObject` / `.strict()` 处处；
  `export type X = z.infer<...>`。不得跨 v3/v4 实例嵌套。
- **顶层**：`format: z.literal("visual-design/v1")`（沿用「format 字面量」判别惯例，不是 PRD 的 `schemaVersion`）+ 
  `viewport`（壳 VIEWPORT 480×270，`{w:480,h:270}`，与 `ops.ts:830` `DEFAULT_VIEWPORT` 同值，**不是数据**）+
  `style`（仅出处指针，不重写色板）+ `objects[]`。
- **object**：`{ id: string.min(1), role, bounds: {x,y,width,height}, layer: number.int().nonnegative(), fill: "palette:N", sourceIntent?: string }`。
  `bounds` 的坐标/尺寸沿用 `game-config.ts:32-42` 的 `Coord`/`Size`/`Rect`（整数、非负）。
- **role 枚举（复用，不复制）**：`{ player } ∪ EntityKind ∪ { background, ui-panel, ui-pip }`，共 11 值。
  `EntityKind` 直接从 `game-config.ts:50` 导入（7 值 `solid/pickup/hazard/goal/chest/danger/decor`），**不重新声明**
  （单一来源，否则 `role↔kind` 串桶判据会对不齐）。`fill: "palette:N"` 的 `N` 是 `style.palette` 的数组下标，
  与 `drawlist.ts:132` 的 `paletteColor` 解析约定一致。
- **判据 vs 观察**：本 schema 只声明结构；哪些缺失是硬判据（拒绝）在票 05 validator 里定，不在 schema 里写 gate。
  （契约草案参考 `../visual-design-v1/assets/03-vds-contract-draft.md`，但以本票落码为准。）

**资产**：落一份 schema 草案到 `assets/01-vds-contract-draft.md`（字段表 + 一个示例 JSON），供人反应。
**测试**（TDD）：schema 接受合法样例、拒绝未知/非法关键字段（`.strict()`）、`role` 枚举只认 11 值、`fill` 只认
`palette:N`、`bounds` 拒绝负/非整数。确定性：同一对象经 `jstr`（2-space + trailing newline）逐字节一致。
