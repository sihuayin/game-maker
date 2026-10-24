# 03. Visual Design Spec 正式契约（schema 草案）

Type: prototype
Status: resolved
Owner: claude · 2026-10-24
Blocked by: 01
Map: ../map.md

## Question

产出一份**可反应的 Visual Design Spec 契约草案**（不落代码，落到概念级 JSON shape + 字段约束），供人审查。
PRD §5.3 只有「概念示例」，这里要把它推成正式契约。至少钉死：

- 顶层字段：`schemaVersion` / `viewport`（依赖票 01 的坐标系结论）/ `style`（palette 引用自哪？VisualWorldSpec？）/
  `objects[]`。
- 每个 object 的字段：`id`（唯一、稳定）、`role`（封闭枚举，候选人：player / pickup / hazard / npc / decor /
  terrain / ui-panel / ui-pip / objective-marker ……—— 与 GameDesignSpec 实体桶 + Game Config 的 EntityKind 对齐）、
  `bounds`（x/y/w/h，单位待票 01）、`layer`（z 序，语义是什么：渲染顺序？）、`visualRef`（指向哪个资产/母版/占位）、
  `sourceIntent`（指向 GameDesignSpec 的实体/机制 id）。
- 必需字段 vs 可选字段；哪些字段缺失必须是判据（拒绝），哪些只是观察。
- 与 `contracts/*` 现有 schema 技术（zod `.strict()`、封闭枚举、superRefine）保持一致 —— 不许另起一套。

交付：一份契约草案（JSON shape + 每字段的约束 + 判据/观察标注），链接为资产。这是 HITL：草出来给人反应，不是定稿。

## Draft

- [03-vds-contract-draft.md](../assets/03-vds-contract-draft.md) —— 契约草案 v1（顶层 + VDSObject + role 枚举 + 判据/观察标注）。已按人裁收口。

## Answer

VDS 契约形状钉死（细节在草案资产，此处只收口）：

- **顶层**：`format: "visual-design/v1"`（判别式，替 PRD 的 `schemaVersion`）· `viewport: {w,h}` = 外壳 `VIEWPORT`（480×270，注入）· `style: { visualWorldFormat }`（出处指针，**不重写色板**）· `objects[]`（非空）。
- **对象字段**：`id`（唯一）· `role` · `bounds{x,y,w,h}`（视口坐标 int）· `layer`（int z 序）· `fill: palette:N`（→ visual-world 的 `style.palette`）· `sourceIntent`（GameDesignSpec 实体 id，可选）。
- **人裁四条（2026-10-24）**：① `role` = `{player} ∪ EntityKind ∪ {background, ui-panel, ui-pip}`（11 值，`npc/enemy/interactable/resource` 由 `sourceIntent` 落桶、`terrain` 不进 VDS、`objective-marker` 并入 `goal`）；② `style` 留出处指针；③ `visualRef` **砍掉**（V1，P2 再补）；④ `layer` = 逐对象 z 序（越大越在上），与视差 `layers` 拆开。
- **判据 vs 观察**：`format`/`viewport`/`id` 重复/`role` 越界/`bounds` 越界/`layer` 非整数/`fill` 悬空/`sourceIntent` 悬空 = **判据**；色板色没人用、同层重叠 = **观察**。

下游消费：票 04（覆盖按 `sourceIntent` id 判）、票 05（SVG 派生 + `fill` 只能引 palette）、票 07（`role`↔`kind` 一一对应）。
