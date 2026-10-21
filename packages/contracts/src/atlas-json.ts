// 交付态图集 JSON（TexturePacker JSON Hash）—— **读**侧契约，不是包的自描述。
//
// ⚠️ 与 `assetpack.ts` 的分工：manifest 只说「哪个资源属于哪张图集」，帧的 x/y/w/h
//   只住在图集 JSON 里（票 24 原则 1）。验收器要逐帧核对矩形 / 锚点 / 九宫格，
//   所以需要一份**可信的读码器**，而不是 `JSON.parse` + `as`。
//
// ⚠️ 形状按 v7 的四张实际图集**收紧**（Phase 0 计划 §4.2）：`frames` + `meta`；
//   每帧 `frame` / `rotated` / `trimmed` / `spriteSourceSize` / `sourceSize` /
//   可选 `anchor` / `scale9Borders`。未来 TexturePacker 加键时**显式在这里加**；
//   不用 `.passthrough()` 吞未知字段 —— 验收器悄悄忽略一个它不认识的字段，
//   正是「报告说全绿、实际没核对」的那类假绿。
import { z } from "zod";

/** 图集里的一个像素矩形。`x` / `y` 可为 0；`w` / `h` 必须为正。 */
const Rect = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive()
}).strict();

/** 未裁剪的源画布尺寸。 */
const Size = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive()
}).strict();

/**
 * 图集里的一帧。
 *
 * ⚠️ `rotated` / `trimmed` 给默认值 `false`：TexturePacker 在未开启对应选项时**会省略**
 *   这两个键。默认值让「省略 = 没旋转 / 没裁剪」在 schema 里只有一处解释，
 *   而不是让每个读者各自写一遍 `?? false`。
 */
export const AtlasFrame = z.object({
  frame: Rect,
  rotated: z.boolean().default(false),
  trimmed: z.boolean().default(false),
  spriteSourceSize: Rect,
  sourceSize: Size,
  /** 归一化锚点。图集里有它时，验收器会与 manifest 的 `anchor` 逐帧对账。 */
  anchor: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1)
  }).strict().optional(),
  /** 九宫格中央区域。与 manifest 的 `scale9Borders`（存在时）对账。 */
  scale9Borders: Rect.optional()
}).strict();

export type AtlasFrame = z.infer<typeof AtlasFrame>;

/**
 * 一份 TexturePacker JSON Hash 图集。
 *
 * ⚠️ `meta` **故意宽松**（`z.record(z.unknown())`）：它的内容是 TexturePacker 的
 *   工具元数据（app / version / image / size / scale …），验收器不靠它做判据；
 *   但顶层与每一帧仍然 `.strict()`，未知的**帧**字段不会被无声吞掉。
 */
export const AtlasJson = z.object({
  frames: z.record(z.string().min(1), AtlasFrame),
  meta: z.record(z.unknown()).optional()
}).strict();

export type AtlasJson = z.infer<typeof AtlasJson>;
