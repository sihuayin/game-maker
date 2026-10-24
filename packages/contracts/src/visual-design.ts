// `visual-design/v1` —— **这个设计的视觉构图**：每个对象在视口（屏幕空间）坐标里说清
// 「我是谁、在哪、多大、几层、什么色、对应哪个设计实体」（visual-design-v1 票 03 定的形状）。
//
// ⚠️ **它是 V2 契约 ⇒ 用 `zod/v4`**（票 28 定的边界：旧契约 `zod`、V2 新契约 `zod/v4`，
//   两边**不许互相嵌套**）。它是 Visual Design Compiler（旁轨）的**唯一**输出契约，
//   由 `packages/visual-design` 的确定性布局产出、SVG 由它派生（票 05）、GameConfig 由它交叉验证（票 07）。
//
// ⚠️ **VDS 不**：重写色板（色只有 `fill: palette:N` 一个来源，hex 只住在 `visual-world.json` 的
//   `style.palette` 那一份）；声明玩法几何的精确落点（那是 GameConfig 的活）；指向 SVG
//   （SVG 是 VDS 的**派生视图**，不是第二个语义来源）。
//
// ⚠️ **`viewport` 只验形状，不钉值**：视口是「**不是数据**」的壳常量（`CONTEXT.md:608-614`），
//   由**调用方注入**（`draw.ts:15` / `ops.ts:830` 的 480×270）。schema 看不见那个常量，
//   所以这里只收 `{w,h}` 正整数；「`viewport` 是否等于壳 VIEWPORT」这条是**判据**，
//   住在 validator（visual-design-impl-v1 票 05 的画布判据），不在 schema 里硬编码。
import { z } from "zod/v4";
import { EntityKind } from "./game-config.js";
import { PaletteRefShape, VISUAL_WORLD_FORMAT } from "./visual-world.js";

/** 判别式。沿用全仓惯例：`format: "<name>/v1"` 字面量（替换 PRD §5.3 的自由数字 `schemaVersion`）。 */
export const VISUAL_DESIGN_FORMAT = "visual-design/v1" as const;

/**
 * 对象的**视觉/身份角色** —— 封闭枚举，共 11 值：`{ player } ∪ EntityKind ∪ { background, ui-panel, ui-pip }`
 * （visual-design-v1 票 03 已裁定）。
 *
 * ⚠️ **EntityKind 的 7 值从 v3 契约 `EntityKind.options` 派生，不复制定义**（单一来源）：
 *   `Role` 与 `EntityKind` 的实体子集**结构上不可能漂** —— 票 07 的 `role↔kind` 串桶判据
 *   拿它当对账键，一旦两份定义各写一遍，「对不齐」会变成一类静默错误。
 *   ⚠️ 跨方言 import 的**只有这个字符串元组**，不是 schema（同 `config-tool.ts` import
 *   `PLAYER_ACTION_NAMES` 的先例）—— 两层从头到尾没有互相嵌套。
 * ⚠️ `npc/enemy/interactable/resource` 不进 `Role`：它们是**设计桶**，由 `sourceIntent` 的 id
 *   落桶表达（`ENTITY_BUCKETS`）。VDS 的 `role` 说的是**视觉/身份**那一层 —— 一只 `enemy`
 *   在画面里要么 `hazard`、要么 `decor`、要么 `solid`，那正是 GameConfig `EntityKind` 要决定的；
 *   VDS 只**提前声明**一个 role 供票 07 对账，不越界替它决定。`terrain` 也不进（看不见的进地形、
 *   不进 VDS）。
 */
const ROLE_VALUES = [...EntityKind.options, "player", "background", "ui-panel", "ui-pip"] as const;
export const Role = z.enum(ROLE_VALUES);
export type Role = z.infer<typeof Role>;

/**
 * 构图里的**一个对象**。
 *
 * ⚠️ `bounds` 是**粗略的构图盒**（视口坐标），不是 GameConfig 的精确碰撞盒 —— 与 GameConfig
 *   几何的**漂移归观察**（票 07 已裁：几何漂移只报、不暗示「错」）。
 * ⚠️ `layer` 是**逐对象 z 序**，越大越在上（后画）。与视差 `layers`（`camera:parallax`）是**两把尺子**：
 *   那个是背景层的滚动因子，这个逐对象（票 03 裁定）。
 * ⚠️ `fill` 是 VDS 里**唯一**的颜色入口 —— SVG 的 `fill`（票 05）直接派生自它，
 *   所以「同一 VDS（+ 同一 visual-world）⇒ 逐字节同一 SVG」。
 * ⚠️ `sourceIntent` 可选：**纯装饰**（`decor`/`background`）可以没有它；有则原样指向
 *   GameDesignSpec 的实体/机制 id（不改名、不新造 id 空间）。
 */
export const VisualDesignObjectSchema = z.strictObject({
  id: z.string().min(1),
  role: Role,
  bounds: z.strictObject({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
  layer: z.number().int(),
  fill: PaletteRefShape,
  sourceIntent: z.string().min(1).optional(),
});

/**
 * Visual Design Spec 本体（`visual-design/v1`）。
 *
 * ⚠️ `style` **只做出处指针，不重写色板**（票 03 裁定）：`visualWorldFormat` 说这份 VDS 读的是
 *   哪个世界的风格；对象用色一律 `palette:N`（指向 visual-world.json 的 `style.palette`）。
 * ⚠️ `objects` 非空：空的 `objects` 一定是生成失败（同 `DrawListSchema.ops.min(1)`）。
 * ⚠️ 唯一的 `superRefine` 是**对象 id 不重复**（重复 = 语义含糊，parse 拒）。跨文件的悬空引用
 *   （`palette:N` 越界、`sourceIntent` 指向设计里没有的 id）**不在这里判** —— parse 时 VDS 自己
 *   看不见 visual-world.json / game-design.json，那两条归装配/QA 步（与 `levels[].entities[]` 解得到
 *   那条引用族判据同形）。
 */
export const VisualDesignSpecSchema = z.strictObject({
  format: z.literal(VISUAL_DESIGN_FORMAT),
  viewport: z.strictObject({ w: z.number().int().positive(), h: z.number().int().positive() }),
  style: z.strictObject({ visualWorldFormat: z.literal(VISUAL_WORLD_FORMAT) }),
  objects: z.array(VisualDesignObjectSchema).min(1),
}).superRefine((v, ctx) => {
  const seen = new Set<string>();
  for (const o of v.objects) {
    if (seen.has(o.id))
      ctx.addIssue({ code: "custom", message: `object id 重复："${o.id}"`, path: ["objects"] });
    seen.add(o.id);
  }
});

export type VisualDesignSpec = z.infer<typeof VisualDesignSpecSchema>;
export type VisualDesignObject = z.infer<typeof VisualDesignObjectSchema>;
