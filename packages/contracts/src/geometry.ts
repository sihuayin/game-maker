// 静态几何与用色分析 —— **不渲染**就能算出来的东西。票 12 出局时，它的确定性检查搬到了这里。
import { paletteColor, type DrawListOp } from "./drawlist.js";

export type Box = { x: number; y: number; w: number; h: number };

/**
 * 静态包围盒。⚠️ **`exact` 是返回值的一部分，不是注释**：
 *
 * - `exact: true`  —— 所有 op 都是精确可算的（rect / circle / ellipse / line / poly）。
 * - `exact: false` —— 含 `curve`。此时 `box` 是**控制点凸包 ∪ 描边半宽**，
 *   是一个**保守上界**：只会高估，不会漏报。
 *
 * 这个区分是为了让调用方**没机会忘记** —— 尺寸校验因此只能判「过大」，不能判「偏小」。
 * 一个把上界当精确值用的调用方，会误报「画得太小」。
 */
export type Bounds = { box: Box | null; exact: boolean };

/** 描边以路径为中心线，向两侧各扩 strokeWidth/2；所有图元都按这个半宽外扩。 */
function padFor(op: DrawListOp): number {
  const sw = "strokeWidth" in op && op.strokeWidth !== undefined ? op.strokeWidth : 0;
  return sw / 2;
}

export function boundsOfOps(ops: readonly DrawListOp[]): Bounds {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, hasCurve = false;
  const pt = (x: number, y: number) => {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  };
  for (const o of ops) {
    const s = padFor(o);
    switch (o.op) {
      case "rect": pt(o.x - s, o.y - s); pt(o.x + o.w + s, o.y + o.h + s); break;
      case "circle": pt(o.cx - o.r - s, o.cy - o.r - s); pt(o.cx + o.r + s, o.cy + o.r + s); break;
      case "ellipse": pt(o.cx - o.rx - s, o.cy - o.ry - s); pt(o.cx + o.rx + s, o.cy + o.ry + s); break;
      case "line": pt(o.x1 - s, o.y1 - s); pt(o.x2 + s, o.y2 + s); break;
      // poly 的顶点就是形状本身；描边再外扩半宽（原型的实现漏了这一项，那会让上界失效）
      case "poly": for (const p of o.points) { pt(p[0] - s, p[1] - s); pt(p[0] + s, p[1] + s); } break;
      // dither：就是一块矩形，精确可算
      case "dither": pt(o.x, o.y); pt(o.x + o.w, o.y + o.h); break;
      // curve：Catmull-Rom 完全落在控制点凸包内，所以控制点的极值 + 半宽就是一个合法上界
      case "curve":
        hasCurve = true;
        for (const p of o.points) { pt(p[0] - s, p[1] - s); pt(p[0] + s, p[1] + s); }
        break;
    }
  }
  if (!Number.isFinite(x0)) return { box: null, exact: !hasCurve };
  return { box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, exact: !hasCurve };
}

export type RefResolution = {
  /** 实际用到的色值（去重、按首次出现排序）。 */
  used: string[];
  /** 解析不了的引用。因为硬编码色进不来，这里**只会**出现索引越界。 */
  off: string[];
};

/**
 * 把 `palette:N` 解析成实际色值，并报出越界引用。
 *
 * 与票 24 的 `paletteBinding` 分工：本函数回答「用了哪些颜色、有没有越界」，
 * `paletteBindingOf()` 回答「这些颜色是不是色板色的直接使用」。
 */
export function resolveRefs(ops: readonly DrawListOp[], palette: readonly string[]): RefResolution {
  const used = new Set<string>();
  const off = new Set<string>();
  for (const o of ops) {
    // dither 的颜色在 `colors` 元组里，不在 fill/stroke 上
    if (o.op === "dither") for (const v of o.colors) { const hex = paletteColor(v, palette); if (hex === undefined) off.add(v); else used.add(hex); }
    for (const key of ["fill", "stroke"] as const) {
      if (o.op === "dither") break;
      const v = o[key];
      if (v === undefined) continue;
      const hex = paletteColor(v, palette);
      if (hex === undefined) off.add(v);
      else used.add(hex);
    }
  }
  return { used: [...used], off: [...off] };
}
