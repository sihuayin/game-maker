// drawlist+curve/v1 → RGBA 位图。**交付态的唯一生产者**（票 21）。
//
// 它**不是**渲染器，是**编译器后端**：产物 B 直接加载它产出的 PNG，
// Phaser 根本不认识 drawlist，所以这里不碰任何浏览器/Phaser API。
//
// 三条硬要求（票 21 的抬头）：
//   1. **确定性** —— 同一份 drawlist 两次光栅化逐字节相同，否则 checksum 不成立。
//      做法：逐像素取中心点做二值覆盖判定（**不抗锯齿**）、浮点累积、最后一次量化。
//      像素风资源本来就不该有抗锯齿 —— 它还会在色板色之间插值出**色板外**颜色。
//   2. **目标尺寸与像素格** —— 见 `resizeNearest()`。
//   3. **失败要报是哪个 asset 的哪个 op** —— 见 `RasterError`。
import type { DrawList, DrawListOp } from "@game-maker/contracts";
import { paletteColor } from "@game-maker/contracts";
import { emptyImage, resizeNearest, type RasterImage } from "./image.js";

/** 每个 curve 段的折线段数。**常量**，所以确定 —— 用自适应的段数会让输出随几何变化。 */
const CURVE_SEGMENTS = 24;

/** 光栅化失败。带着**资源 id 与 op 下标**，因为「某个资源有问题」在 20 个 op 的产物上等于没说。 */
export class RasterError extends Error {
  constructor(readonly assetId: string, readonly opIndex: number, message: string) {
    super(`drawlist "${assetId}" ops[${opIndex}]: ${message}`);
    this.name = "RasterError";
  }
}

const hexToRgba = (hex: string): [number, number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
};

/** 单点取色。走票 20 的 `paletteColor()` —— 解析规则只有那一处。 */
function rgbaOf(ref: string, palette: readonly string[], assetId: string, opIndex: number): [number, number, number, number] {
  const hex = paletteColor(ref, palette);
  if (hex === undefined) throw new RasterError(assetId, opIndex, `颜色引用 "${ref}" 越界（色板只有 ${palette.length} 项）`);
  return hexToRgba(hex);
}

/** Catmull-Rom → 折线。曲线**只用数值控制点**表示，所以这里不需要解析任何字符串。 */
function flattenCurve(points: readonly (readonly number[])[], closed: boolean): number[][] {
  const n = points.length;
  const out: number[][] = [[points[0]![0]!, points[0]![1]!]];
  const limit = closed ? n : n - 1;
  for (let i = 0; i < limit; i++) {
    const p0 = points[i - 1] ?? (closed ? points[n - 1]! : points[i]!);
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n] ?? points[i + 1]!;
    const p3 = points[(i + 2) % n] ?? (closed ? points[0]! : p2);
    for (let s = 1; s <= CURVE_SEGMENTS; s++) {
      const t = s / CURVE_SEGMENTS, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0]! + (-p0[0]! + p2[0]!) * t + (2 * p0[0]! - 5 * p1[0]! + 4 * p2[0]! - p3[0]!) * t2 + (-p0[0]! + 3 * p1[0]! - 3 * p2[0]! + p3[0]!) * t3),
        0.5 * (2 * p1[1]! + (-p0[1]! + p2[1]!) * t + (2 * p0[1]! - 5 * p1[1]! + 4 * p2[1]! - p3[1]!) * t2 + (-p0[1]! + 3 * p1[1]! - 3 * p2[1]! + p3[1]!) * t3),
      ]);
    }
  }
  if (closed) out.push([points[0]![0]!, points[0]![1]!]);
  return out;
}

const ellipseOutline = (cx: number, cy: number, rx: number, ry: number, n = 64): number[][] =>
  Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });

/** 有序抖动矩阵（归一化到 [0,1)）。`bayer2` 在 ratio=0.5 时恰好是棋盘。 */
const BAYER: Record<string, number[][]> = {
  bayer2: [[0 / 4, 2 / 4], [3 / 4, 1 / 4]],
  bayer4: Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => {
    const m = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    return m[y]![x]! / 16;
  })),
};
/** `checker` 恒为 50/50（忽略 ratio）—— 最常用的那种像素画抖动。 */
const isCheckerB = (x: number, y: number) => ((x + y) & 1) === 1;

/** 把一个 op 归约成 { 填充多边形 | null, 描边折线 | null }。 */
function shapeOf(op: DrawListOp, assetId: string, i: number): { fill: number[][] | null; stroke: number[][] | null } {
  if (op.op === "dither") return { fill: null, stroke: null };   // 单独走一条路，见下面
  switch (op.op) {
    case "rect": {
      const p = [[op.x, op.y], [op.x + op.w, op.y], [op.x + op.w, op.y + op.h], [op.x, op.y + op.h]];
      return { fill: p, stroke: [...p, p[0]!] };
    }
    case "poly": return { fill: op.points, stroke: [...op.points, op.points[0]!] };
    case "line": return { fill: null, stroke: [[op.x1, op.y1], [op.x2, op.y2]] };
    case "curve": { const f = flattenCurve(op.points, op.closed ?? false); return { fill: f, stroke: f }; }
    case "circle": { const p = ellipseOutline(op.cx, op.cy, op.r, op.r); return { fill: p, stroke: null }; }
    case "ellipse": { const p = ellipseOutline(op.cx, op.cy, op.rx, op.ry); return { fill: p, stroke: null }; }
    default: throw new RasterError(assetId, i, `未知的 op "${(op as { op: string }).op}"`);
  }
}

/** 非零环绕规则。自交多边形也稳定。 */
const insidePolygon = (poly: number[][], px: number, py: number): boolean => {
  let w = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if (yi! > py !== yj! > py) { const x = xi! + ((py - yi!) / (yj! - yi!)) * (xj! - xi!); if (px < x) w += yj! > yi! ? 1 : -1; }
  }
  return w !== 0;
};
const distToSegmentSq = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len));
  return (px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2;
};

export type RasterizeOptions = {
  /** 有序色板。`palette:N` 按这个顺序解析。 */
  palette: readonly string[];
  /** 整数倍放大（默认 1）。像素风放大请用 `resizeNearest()`，不要用小数缩放。 */
  scale?: number;
};

/**
 * 光栅化。产出尺寸 = `viewBox` 的宽高 × `scale`（向上取整）。
 *
 * **不抗锯齿**：逐像素取中心点做二值覆盖判定。这既是像素风要的，也是确定性的来源。
 * 代价是 1px 描边的落点与浏览器 SVG 的「跨两行各半」不同 —— 但那个「半」正是要避免的。
 */
export function rasterize(drawlist: DrawList, { palette, scale = 1 }: RasterizeOptions): RasterImage {
  if (!Number.isInteger(scale) || scale < 1) throw new Error(`scale 必须是 ≥1 的整数，收到 ${scale}`);
  const id = drawlist.id;
  const [vbx, vby, vbw, vbh] = drawlist.viewBox;
  const W = Math.ceil(vbw * scale), H = Math.ceil(vbh * scale);
  const acc = new Float32Array(W * H * 4);
  const blend = (i: number, rgba: readonly number[], a: number): void => {
    if (a <= 0) return;
    acc[i] = rgba[0]! * a + acc[i]! * (1 - a);
    acc[i + 1] = rgba[1]! * a + acc[i + 1]! * (1 - a);
    acc[i + 2] = rgba[2]! * a + acc[i + 2]! * (1 - a);
    acc[i + 3] = 255 * a + acc[i + 3]! * (1 - a);
  };
  const toPx = (p: number[]): number[] => [(p[0]! - vbx) * scale, (p[1]! - vby) * scale];

  drawlist.ops.forEach((op, i) => {
    // ── dither：逐像素按有序矩阵在两种色板色之间选 ──────────────────────────
    if (op.op === "dither") {
      if (op.ratio <= 0 && op.pattern !== "checker") return;          // 全用第一种色？那也是画满
      const A = rgbaOf(op.colors[0], palette, id, i);
      const B = rgbaOf(op.colors[1], palette, id, i);
      const matrix = BAYER[op.pattern]!;
      const alpha = 0;   // dither 不带 opacity；留着这一行是为了提醒它**不会**做 alpha 混合
      void alpha;
      for (let y = Math.max(0, Math.floor(op.y)); y < Math.min(H, Math.ceil(op.y + op.h)); y++)
        for (let x = Math.max(0, Math.floor(op.x)); x < Math.min(W, Math.ceil(op.x + op.w)); x++) {
          const useB = op.pattern === "checker" ? isCheckerB(x, y) : matrix[y % matrix.length]![x % matrix[0]!.length]! < op.ratio;
          blend((y * W + x) * 4, useB ? B : A, 1);
        }
      return;
    }
    const { fill, stroke } = shapeOf(op, id, i);
    const alpha = op.opacity ?? 1;
    const F = op.fill !== undefined ? rgbaOf(op.fill, palette, id, i) : null;
    const S = op.stroke !== undefined ? rgbaOf(op.stroke, palette, id, i) : null;
    if (F && fill) {
      const poly = fill.map(toPx);
      const xs = poly.map((p) => p[0]!), ys = poly.map((p) => p[1]!);
      const yEnd = Math.min(H, Math.ceil(Math.max(...ys))), xEnd = Math.min(W, Math.ceil(Math.max(...xs)));
      for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < yEnd; y++)
        for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < xEnd; x++)
          if (insidePolygon(poly, x + 0.5, y + 0.5)) blend((y * W + x) * 4, F, alpha);
    }
    if (S && stroke) {
      const sw = (op.strokeWidth ?? 1) * scale, r2 = (sw / 2) ** 2;
      const pts = stroke.map(toPx);
      for (let k = 0; k < pts.length - 1; k++) {
        const [x1, y1] = pts[k]!, [x2, y2] = pts[k + 1]!;
        const yEnd = Math.min(H, Math.ceil(Math.max(y1!, y2!) + sw / 2 + 1)), xEnd = Math.min(W, Math.ceil(Math.max(x1!, x2!) + sw / 2 + 1));
        for (let y = Math.max(0, Math.floor(Math.min(y1!, y2!) - sw / 2 - 1)); y < yEnd; y++)
          for (let x = Math.max(0, Math.floor(Math.min(x1!, x2!) - sw / 2 - 1)); x < xEnd; x++)
            if (distToSegmentSq(x + 0.5, y + 0.5, x1!, y1!, x2!, y2!) <= r2) blend((y * W + x) * 4, S, alpha);
      }
    }
  });

  const out = emptyImage(W, H);
  for (let i = 0; i < W * H * 4; i++) out.data[i] = Math.max(0, Math.min(255, Math.round(acc[i]!)));
  return out;
}

/**
 * 一次性做「光栅化 → 最近邻缩放到目标尺寸」。
 *
 * ⚠️ 放大走**最近邻**而不是小数缩放重绘：后者会让几何落在半像素上、产生软边与色板外插值色。
 * 先按 1 单位 = 1 像素渲染，再整块放大，才是像素风该有的样子。
 */
export function rasterizeToGrid(drawlist: DrawList, opts: RasterizeOptions & { pixelScale?: number }): RasterImage {
  const native = rasterize(drawlist, opts);
  const ps = opts.pixelScale ?? 1;
  if (ps === 1) return native;
  return resizeNearest(native, native.width * ps, native.height * ps);
}
