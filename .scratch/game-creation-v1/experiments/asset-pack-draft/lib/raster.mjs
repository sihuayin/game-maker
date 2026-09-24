// drawlist+curve/v1 → RGBA8 的**最小确定性**光栅化器（草案验证用）。
//
// 与生产实现（票 21）的差距，明确写在这里，别当成能直接提上去的代码：
//   1. 不做抗锯齿 —— 逐像素取中心点做二值覆盖判定。这正是像素风要的，也让它逐字节确定。
//      代价：1px 描边的落点与浏览器 SVG 的 50% 覆盖不同（SVG 会跨两行各半）。
//   2. 只做最近邻缩放，没有目标尺寸网格对齐。
//   3. 不知道锚点，锚点由清单/recipe 声明（票 24 的结论）。
//   4. curve 用 24 段折线近似 Catmull-Rom，段数是常量，所以确定。
// 失败时抛出带 {@link RasterError.op} 的错误，调用方要能报是「哪个 asset 的哪个 op」。

export class RasterError extends Error {
  constructor(message, { assetId, op }) { super(`${assetId} ops[${op}]: ${message}`); this.assetId = assetId; this.op = op; }
}

const SEG = 24; // curve 每段折线数（常量 ⇒ 确定）

const hex2rgba = (hex) => {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`palette entry is not #rrggbb: ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
};

/** `palette:N` → rgba。硬编码 hex 不是「不推荐」而是**根本无法通过** —— 这里同样拒绝。 */
export function resolveColor(ref, palette) {
  const m = /^palette:(\d+)$/.exec(String(ref));
  if (!m) throw new Error(`color must be a palette reference, got ${JSON.stringify(ref)}`);
  const i = Number(m[1]);
  if (i >= palette.length) throw new Error(`palette:${i} out of range (palette has ${palette.length})`);
  return hex2rgba(palette[i]);
}

const catmull = (P, closed) => {
  const out = [P[0]];
  const n = P.length;
  const lim = closed ? n : n - 1;
  for (let i = 0; i < lim; i++) {
    const p0 = P[i - 1] || (closed ? P[n - 1] : P[i]), p1 = P[i], p2 = P[(i + 1) % n] || P[i + 1], p3 = P[(i + 2) % n] || (closed ? P[0] : p2);
    for (let s = 1; s <= SEG; s++) {
      const t = s / SEG, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (closed) out.push(P[0]);
  return out;
};

const ellipsePoly = (cx, cy, rx, ry, n = 64) =>
  Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });

/** 把 op 归约成 { fill: 闭合多边形|null, stroke: 折线|null }。这是 renderer 与静态分析器共用的那层。 */
function shapeOf(op, assetId, i) {
  switch (op.op) {
    case 'rect':
      if (![op.x, op.y, op.w, op.h].every(Number.isFinite)) throw new RasterError('rect needs finite x/y/w/h', { assetId, op: i });
      return { fill: [[op.x, op.y], [op.x + op.w, op.y], [op.x + op.w, op.y + op.h], [op.x, op.y + op.h]], stroke: [[op.x, op.y], [op.x + op.w, op.y], [op.x + op.w, op.y + op.h], [op.x, op.y + op.h], [op.x, op.y]] };
    case 'poly': {
      const pts = op.points;
      if (!Array.isArray(pts) || pts.length < 3) throw new RasterError('poly needs ≥3 points', { assetId, op: i });
      return { fill: pts, stroke: [...pts, pts[0]] };
    }
    case 'line':
      return { fill: null, stroke: [[op.x1, op.y1], [op.x2, op.y2]] };
    case 'curve': {
      const pts = op.points;
      if (!Array.isArray(pts) || pts.length < 2) throw new RasterError('curve needs ≥2 points', { assetId, op: i });
      const flat = catmull(pts, !!op.closed);
      return { fill: op.closed ? flat : flat, stroke: flat };
    }
    case 'circle': return { fill: ellipsePoly(op.cx, op.cy, op.r, op.r), stroke: null };
    case 'ellipse': return { fill: ellipsePoly(op.cx, op.cy, op.rx, op.ry), stroke: null };
    default: throw new RasterError(`unknown op "${op.op}"`, { assetId, op: i });
  }
}

const insidePoly = (poly, px, py) => {
  let w = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py)) { const x = xi + ((py - yi) / (yj - yi)) * (xj - xi); if (px < x) w += yj > yi ? 1 : -1; }
  }
  return w !== 0; // nonzero：自交多边形也稳定
};
const distSegSq = (px, py, [x1, y1], [x2, y2]) => {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L));
  const qx = x1 + t * dx, qy = y1 + t * dy;
  return (px - qx) ** 2 + (py - qy) ** 2;
};

/**
 * @param {{id:string, viewBox:number[], ops:object[]}} drawlist
 * @param {{palette:string[], scale?:number}} opts
 * @returns {{width:number,height:number,data:Buffer}}
 */
export function rasterize(drawlist, { palette, scale = 1 }) {
  const id = drawlist.id;
  const [vbx, vby, vbw, vbh] = drawlist.viewBox;
  const W = Math.round(vbw * scale), H = Math.round(vbh * scale);
  const acc = new Float32Array(W * H * 4); // 浮点累积，最后一次性量化 ⇒ 与运算顺序无关的确定性
  const blend = (i, rgba, a) => {
    if (a <= 0) return;
    acc[i] = rgba[0] * a + acc[i] * (1 - a);
    acc[i + 1] = rgba[1] * a + acc[i + 1] * (1 - a);
    acc[i + 2] = rgba[2] * a + acc[i + 2] * (1 - a);
    acc[i + 3] = 255 * a + acc[i + 3] * (1 - a);
  };
  const toPx = ([x, y]) => [(x - vbx) * scale, (y - vby) * scale];

  drawlist.ops.forEach((op, i) => {
    const { fill, stroke } = shapeOf(op, id, i);
    const alpha = op.opacity == null ? 1 : op.opacity;
    const F = op.fill && op.fill !== 'none' ? resolveColor(op.fill, palette) : null;
    const S = op.stroke ? resolveColor(op.stroke, palette) : null;
    if (F && fill) {
      const poly = fill.map(toPx);
      const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
      for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(H, Math.ceil(Math.max(...ys))); y++)
        for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(W, Math.ceil(Math.max(...xs))); x++)
          if (insidePoly(poly, x + 0.5, y + 0.5)) blend((y * W + x) * 4, F, alpha);
    }
    if (S && stroke) {
      const sw = (op.strokeWidth == null ? 1 : op.strokeWidth) * scale, r2 = (sw / 2) ** 2;
      const pts = stroke.map(toPx);
      for (let k = 0; k < pts.length - 1; k++) {
        const [x1, y1] = pts[k], [x2, y2] = pts[k + 1];
        for (let y = Math.max(0, Math.floor(Math.min(y1, y2) - sw / 2 - 1)); y < Math.min(H, Math.ceil(Math.max(y1, y2) + sw / 2 + 1)); y++)
          for (let x = Math.max(0, Math.floor(Math.min(x1, x2) - sw / 2 - 1)); x < Math.min(W, Math.ceil(Math.max(x1, x2) + sw / 2 + 1)); x++)
            if (distSegSq(x + 0.5, y + 0.5, [x1, y1], [x2, y2]) <= r2) blend((y * W + x) * 4, S, alpha);
      }
    }
  });

  const data = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H * 4; i++) data[i] = Math.max(0, Math.min(255, Math.round(acc[i])));
  return { width: W, height: H, data };
}
