// 极小的绘图原语 —— 原型用，不追求完备。
// 建在**仓库自己的 RasterImage + encodePNG** 上（packages/assets），
// 于是「用什么造」这个问题的答案与管线同源：零第三方依赖、同一个 PNG 编码器。
import { encodePNG } from "../../../../packages/assets/dist/png.js";
import { emptyImage } from "../../../../packages/assets/dist/image.js";

export function canvas(w, h, bg) {
  const img = emptyImage(w, h);
  const c = {
    img, w, h,
    px(x, y, col) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const s = (y * w + x) * 4;
      img.data[s] = col[0]; img.data[s + 1] = col[1]; img.data[s + 2] = col[2]; img.data[s + 3] = 255;
    },
    rect(x0, y0, x1, y1, col) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.px(x, y, col); },
    frame(x0, y0, x1, y1, col, t = 1) {
      for (let k = 0; k < t; k++) { for (let x = x0; x <= x1; x++) { c.px(x, y0 + k, col); c.px(x, y1 - k, col); }
        for (let y = y0; y <= y1; y++) { c.px(x0 + k, y, col); c.px(x1 - k, y, col); } }
    },
    ell(cx, cy, rx, ry, col) {
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++)
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) c.px(cx + x, cy + y, col);
    },
    line(x0, y0, x1, y1, col) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (let i = 0; i <= n; i++) c.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, col);
    },
    poly(pts, col) {                                   // 扫描线填充
      const ys = pts.map((p) => p[1]); const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
      for (let y = y0; y <= y1; y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
          if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + (bx - ax) * (y - ay) / (by - ay));
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i]); x <= Math.floor(xs[i + 1]); x++) c.px(x, y, col);
      }
    },
    /** 抖动填充：两种色板色交替 —— 像素风里唯一**不出色板**的调色手段（票 36/票 22）。 */
    dither(x0, y0, x1, y1, a, b, k = 2) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const o = ((x % k) + (y % k)) % (k * k);
        c.px(x, y, o < k * k / 2 ? a : b);
      }
    },
    png() { return encodePNG(img); },
  };
  if (bg) c.rect(0, 0, w - 1, h - 1, bg);
  return c;
}
