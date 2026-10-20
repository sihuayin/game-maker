import { describe, expect, it } from "vitest";
import { dropBottomGroundLines, emptyImage, importFrames, type RasterImage } from "../src/index.js";

/** 造一张 RGBA 图：背景透明，`rects` 里每块涂成不透明。 */
function canvas(w: number, h: number, rects: readonly { x: number; y: number; w: number; h: number }[]): RasterImage {
  const img = emptyImage(w, h);
  for (const r of rects)
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) {
        const s = (y * w + x) * 4;
        img.data[s] = 200; img.data[s + 1] = 120; img.data[s + 2] = 60; img.data[s + 3] = 255;
      }
  return img;
}

const opaque = (img: RasterImage, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3] !== 0;
const opaqueCount = (img: RasterImage) => {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 0) n++;
  return n;
};

describe("帧底部地面线过滤（票 03 的零付费后处理）", () => {
  it("贴脚的细横线被删掉，脚部像素一个不少", () => {
    const body = { x: 12, y: 10, w: 16, h: 30 };
    const line = { x: 4, y: 40, w: 32, h: 3 }; // 紧贴身体底边（y 40 = 身体下一行）
    const img = canvas(40, 60, [body, line]);
    const out = dropBottomGroundLines(img, { maxRows: 4 });
    for (let y = body.y; y < body.y + body.h; y++)
      for (let x = body.x; x < body.x + body.w; x++) expect(opaque(out, x, y), `身体 (${x},${y})`).toBe(true);
    // 身体外侧的线整段消失
    expect(opaque(out, 4, 40), "线左端").toBe(false);
    expect(opaque(out, 4, 41), "线左端第二行").toBe(false);
    expect(opaque(out, 35, 42), "线右端").toBe(false);
    // 正上方有墨的列保留 —— 那是脚底的延伸，不是把脚切掉
    expect(opaque(out, 15, 42), "脚底正下方被保护").toBe(true);
    expect(opaque(img, 4, 41), "原图不被改动").toBe(true);
  });

  it("虚线（多段）整段删掉", () => {
    const body = { x: 15, y: 5, w: 10, h: 20 };
    const dashes = [
      { x: 2, y: 30, w: 6, h: 2 }, { x: 17, y: 30, w: 6, h: 2 }, { x: 32, y: 30, w: 6, h: 2 },
    ];
    const img = canvas(40, 40, [body, ...dashes]);
    const out = dropBottomGroundLines(img);
    for (const d of dashes)
      for (let y = d.y; y < d.y + d.h; y++)
        for (let x = d.x; x < d.x + d.w; x++) expect(opaque(out, x, y), `虚线 (${x},${y})`).toBe(false);
    for (let y = body.y; y < body.y + body.h; y++)
      for (let x = body.x; x < body.x + body.w; x++) expect(opaque(out, x, y), `身体 (${x},${y})`).toBe(true);
  });

  it("宽身体 / 厚底座不是地面线 —— 原样返回", () => {
    const img = canvas(40, 40, [{ x: 2, y: 5, w: 36, h: 30 }]);
    expect(dropBottomGroundLines(img)).toBe(img);
  });

  it("没有线时原样返回（同一个对象）", () => {
    const img = canvas(40, 40, [{ x: 10, y: 10, w: 10, h: 10 }]);
    expect(dropBottomGroundLines(img)).toBe(img);
  });

  it("最底一行的抗锯齿残边不影响识别", () => {
    const body = { x: 10, y: 5, w: 20, h: 15 };
    const line = { x: 2, y: 30, w: 36, h: 2 };
    const img = canvas(40, 40, [body, line, { x: 20, y: 32, w: 1, h: 1 }]);
    const out = dropBottomGroundLines(img, { maxRows: 4 });
    expect(opaque(out, 2, 30), "线左端").toBe(false);
    expect(opaque(out, 37, 31), "线右端").toBe(false);
    for (let y = body.y; y < body.y + body.h; y++)
      for (let x = body.x; x < body.x + body.w; x++) expect(opaque(out, x, y), `身体 (${x},${y})`).toBe(true);
  });

  it("并集包围盒不再被地面线拉高（跳跃帧不再被压小）", () => {
    const a = canvas(100, 120, [{ x: 30, y: 10, w: 40, h: 50 }]);
    const b = canvas(100, 120, [{ x: 30, y: 10, w: 40, h: 30 }, { x: 5, y: 100, w: 90, h: 2 }]);
    const opts = { palette: ["#c8783c"], targetWidth: 20, targetHeight: 24 } as const;
    const dirty = importFrames([a, b], opts);
    const clean = importFrames([a, b], { ...opts, dropBottomLines: true });
    // 线在框里时，B 的角色被缩得更小；线被丢掉后 B 恢复得更大。
    expect(opaqueCount(clean[1]!)).toBeGreaterThan(opaqueCount(dirty[1]!));
  });
});
