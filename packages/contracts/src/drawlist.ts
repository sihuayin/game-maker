// `drawlist+curve/v1` —— **创作态**的表达（票 05 / Q20 定格式，票 24 定它不再是 Asset 的定义）。
//
// 它描述「实际做出了什么」，与 `AssetSpec`（描述「需要什么」）是 **Spec 与 Artifact 的两层**，
// 不是同一层，不要互相填充：
//   AssetSpec.visual / .geometry 是**设计意图**（自由形状，票 27 负责把它们结构化）；
//   DrawList 是**产物本身**（有版本、可 diff、可静态分析）。
//
// ⚠️ 一条 drawlist = **一帧**（票 26 定的术语）。它不带锚点、不带时长：
//   锚点是 Asset 级的（逐资源声明），时长属于 Animation 的播放参数。
//
// 关键性质：**不含任何不透明字符串**。曲线是数值控制点列而不是 SVG 的 `d`，
// 所以包围盒、用色、尺寸都能在**不渲染**的前提下算出来。
import { z } from "zod";

/** 颜色的唯一合法形式：`palette:<下标>` 指向 `StyleSpec.palette` 的有序数组。
 *  **硬编码色值不是「不推荐」，而是根本无法通过 schema** —— 这是「颜色 ∈ 色板」的落点。 */
export const PaletteRef = z
  .string()
  .regex(/^palette:\d+$/, "必须是 palette:<下标> 引用；硬编码色值无法通过 schema");

export const DRAW_LIST_FORMAT = "drawlist+curve/v1" as const;

const Finite = z.number().finite();
const Point = z.tuple([Finite, Finite]);

/** 六种 op 共有的绘制属性。
 *  `opacity` 由[票 36](../../../.scratch/game-creation-v1/issues/36-opacity-and-palette-invariant.md) 裁定**保留**：
 *  它不引入色板之外的**来源**（来源仍恒为 palette 引用），只让渲染出的复合色成为色板的确定函数。 */
const PAINT = {
  fill: PaletteRef.optional(),
  stroke: PaletteRef.optional(),
  strokeWidth: Finite.positive().optional(),
  opacity: z.number().min(0).max(1).optional(),
};

// `.strict()` 是刻意的：多出来的字段会被拒。格式带版本号（`/v1`），
// 未来新增字段属于 v2，不该悄悄出现在 v1 的文档里。
export const RectOp = z.object({ op: z.literal("rect"), ...PAINT, x: Finite, y: Finite, w: Finite, h: Finite }).strict();
export const CircleOp = z.object({ op: z.literal("circle"), ...PAINT, cx: Finite, cy: Finite, r: Finite }).strict();
export const EllipseOp = z.object({ op: z.literal("ellipse"), ...PAINT, cx: Finite, cy: Finite, rx: Finite, ry: Finite }).strict();
/** 闭合多边形。≥3 个点是多边形的定义；缺了就是退化数据，解析期直接拒。 */
export const PolyOp = z.object({ op: z.literal("poly"), ...PAINT, points: z.array(Point).min(3, "poly 至少 3 个点") }).strict();
export const LineOp = z.object({ op: z.literal("line"), ...PAINT, x1: Finite, y1: Finite, x2: Finite, y2: Finite }).strict();
/** Catmull-Rom 数值控制点列。≥2 个点；`closed` 缺省为开放曲线。 */
export const CurveOp = z.object({ op: z.literal("curve"), ...PAINT, points: z.array(Point).min(2, "curve 至少 2 个点"), closed: z.boolean().optional() }).strict();

/**
 * 抖动填充 —— 两种色板色的有序混合。
 *
 * ⚠️ 它不只是「多一种画法」：**抖动是像素风里唯一不出色板的调色手段**
 * （[票 36](../../../.scratch/game-creation-v1/issues/36-opacity-and-palette-invariant.md) 实测过
 * `opacity` 会做 alpha 混合、产出色板外的复合色）。两种色板色交替得到第三种观感，
 * 而**每一个像素仍然严格 ∈ 色板** —— 所以含 dither 的资源 `paletteBinding` 仍是 `exact`。
 *
 * 参考图的核心材质是 "pixel dithering / rust streaks"，加它之前生成出来全是平涂。
 */
export const DitherOp = z.object({
  op: z.literal("dither"),
  x: Finite, y: Finite, w: Finite, h: Finite,
  /** 两种色板色。**恰好两个** —— 双色抖动是像素画的常规。 */
  colors: z.tuple([PaletteRef, PaletteRef]),
  /** 第二种色占的比例。`checker` 忽略它（恒为 50/50）。 */
  ratio: z.number().min(0).max(1),
  pattern: z.enum(["checker", "bayer2", "bayer4"]),
}).strict();

export const DrawListOp = z.discriminatedUnion("op", [RectOp, CircleOp, EllipseOp, PolyOp, LineOp, CurveOp, DitherOp]);

/** `viewBox` = [x, y, w, h]；`expectedSize` = [w, h]，是**编译期期望**。
 *  两者的比对只判**过大**：`boundsOfOps()` 对 curve 返回的是凸包上界，
 *  保守高估，所以能安全地判「超出」，不能判「偏小」。 */
export const DrawListSchema = z.object({
  format: z.literal(DRAW_LIST_FORMAT),
  id: z.string().min(1),
  /** 这一帧在 Asset 内的**名字**（票 26：`state` 已降格为「单帧动画」，不再是独立维度）。 */
  frame: z.string().min(1),
  viewBox: z.tuple([Finite, Finite, Finite.positive(), Finite.positive()]),
  expectedSize: z.tuple([Finite.positive(), Finite.positive()]),
  ops: z.array(DrawListOp).min(1, "空的 drawlist 一定是生成失败"),
}).strict();

export type DrawList = z.infer<typeof DrawListSchema>;
export type DrawListOp = z.infer<typeof DrawListOp>;

/** 一个资源在某一种 [[Palette Binding]] 上的静态判定 —— 见下面的 `paletteBindingOf`。
 *  ⚠️ 只有两个取值：drawlist 资源的绑定**只可能是** exact 或 composited。
 *  manifest 里那个四值字段（多出 quantized / unbound，只可能来自导入路径）叫 `PaletteBinding`，
 *  定义在 `assetpack.ts` —— 两者不是同一个类型，别混用。 */
export type DrawListPaletteBinding = "exact" | "composited";

/** 单个色值：**规范化的**小写 `#rrggbb`。大写、三位缩写、颜色名一律不接受 ——
 *  一个色值有两种合法拼写，checksum 就不稳，而 `palette:N` 的解析结果也会跟着变。 */
export const PaletteColor = z.string().regex(/^#[0-9a-f]{6}$/, "色值必须是规范化的小写 #rrggbb");

/** 色板：**有序**数组（`palette:N` 的稳定性全靠这个顺序），且不得有重复色
 *  （重复会让 `palette:3` 与 `palette:7` 等价，语义含糊）。 */
export const PaletteSchema = z.array(PaletteColor).superRefine((values, ctx) => {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `色板里有重复色 ${v} —— palette:N 会变得含糊` });
    seen.add(v);
  }
});

/**
 * 票 36 的结论：对 drawlist 资源，色板绑定是**解析期静态可判**的 ——
 * 走一遍 ops 看有没有 `opacity` 就够了，**不需要渲染**。
 *
 * - `exact`：每个不透明像素的颜色 ∈ 色板（无 opacity 时的必然结果）
 * - `composited`：每个不透明像素都是**色板色的 alpha 复合**；来源仍恒为色板引用
 *
 * 它**不是**「渲染后扫像素」的近似，而是那个扫描的**判据** —— 扫描退化成对它的测试。
 */
export function paletteBindingOf(ops: readonly DrawListOp[]): DrawListPaletteBinding {
  // ⚠️ `dither` 没有 opacity —— 它是**逐像素二选一**，不做 alpha 混合，
  //   所以含 dither 的资源仍然是 `exact`（这正是它相对 opacity 的价值，票 36）。
  return ops.some((o) => o.op !== "dither" && o.opacity !== undefined) ? "composited" : "exact";
}

/**
 * 解析**单个** `palette:N` 引用 → 实际色值；越界返回 `undefined`。
 *
 * ⚠️ 全仓库**只有这一处**做这件事：`resolveRefs()`（统计用色）与光栅化器（取色）都走它。
 * 两份实现迟早会对「越界怎么算」给出不同答案。
 */
export function paletteColor(ref: string, palette: readonly string[]): string | undefined {
  const i = Number(ref.slice("palette:".length));
  return Number.isInteger(i) && i >= 0 ? palette[i] : undefined;
}

/**
 * 把 Zod 的错误摊平成 `ops[1].cy: 期望 number` 这种可定位的字符串。
 *
 * 为什么需要它：R2 之后确定性校验是唯一留下的质量控制，而**校验的价值取决于报错能不能定位** ——
 * 「某个 op 有问题」在 20 个 op 的产物上等于没说。
 */
export function formatIssues(error: z.ZodError): string[] {
  const flat = (issues: z.ZodIssue[]): z.ZodIssue[] =>
    issues.flatMap((i) => ("unionErrors" in i && Array.isArray(i.unionErrors)
      ? i.unionErrors.flatMap((u) => flat(u.issues))
      : "issues" in i && Array.isArray(i.issues) ? flat(i.issues as z.ZodIssue[]) : [i]));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of flat(error.issues)) {
    const path = i.path.reduce<string>((acc, p) => (typeof p === "number" ? `${acc}[${p}]` : acc ? `${acc}.${p}` : String(p)), "");
    const line = `${path || "<根>"}: ${i.message}`;
    if (!seen.has(line)) { seen.add(line); out.push(line); }
  }
  return out;
}

/** `DrawListSchema.safeParse` + 摊平报错，一次调用拿到「能不能用」和「哪里不能用」。 */
export function parseDrawList(input: unknown): { ok: true; value: DrawList } | { ok: false; errors: string[] } {
  const r = DrawListSchema.safeParse(input);
  return r.success ? { ok: true, value: r.data } : { ok: false, errors: formatIssues(r.error) };
}
