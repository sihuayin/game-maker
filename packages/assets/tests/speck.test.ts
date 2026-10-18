import { describe, expect, it } from "vitest";
import { emptyImage, dropDetachedSpecks, importFrames, type RasterImage } from "../src/index.js";

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
const bodyRects = [{ x: 4, y: 10, w: 12, h: 14 }] as const;
const speckRects = [{ x: 4, y: 2, w: 1, h: 1 }, { x: 9, y: 3, w: 2, h: 1 }, { x: 14, y: 1, w: 1, h: 2 }] as const;

describe("帧内碎点过滤（票 107 的免费前置）", () => {
  it("头顶孤立的 1–2px 碎点被清掉，主体原样保留", () => {
    const img = canvas(22, 28, [...bodyRects, ...speckRects]);
    const out = dropDetachedSpecks(img);
    expect(opaque(out, 4, 2), "头顶碎点 1").toBe(false);
    expect(opaque(out, 9, 3), "头顶碎点 2").toBe(false);
    expect(opaque(out, 14, 1), "头顶碎点 3").toBe(false);
    for (const r of bodyRects)
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) expect(opaque(out, x, y), `主体 (${x},${y})`).toBe(true);
    expect(img.data[(2 * 22 + 4) * 4 + 3], "原图不被改动").toBe(255);
  });

  it("大的独立部件（≥ 主块 5%）保留 —— 不是把所有分离块都删掉", () => {
    const big = { x: 2, y: 1, w: 5, h: 5 }; // 25px vs 主块 168px ⇒ 14.9%
    const img = canvas(22, 28, [...bodyRects, big]);
    const out = dropDetachedSpecks(img);
    expect(opaque(out, big.x, big.y)).toBe(true);
  });

  it("小但与主体包围盒相交的块保留（贴身的小饰件不是碎点）", () => {
    const touch = { x: 15, y: 20, w: 2, h: 2 }; // 贴在主体右边
    const img = canvas(22, 28, [...bodyRects, touch]);
    const out = dropDetachedSpecks(img);
    expect(opaque(out, touch.x, touch.y)).toBe(true);
  });

  it("两帧的并集包围盒只算留下来的主体 —— 清掉头顶碎点后角色恢复满高", () => {
    const clean = importFrames([canvas(22, 28, bodyRects)], { palette: ["#c8783c"], targetWidth: 12, targetHeight: 14 });
    const withSpecks = importFrames(
      [canvas(22, 28, [...bodyRects, ...speckRects])],
      { palette: ["#c8783c"], targetWidth: 12, targetHeight: 14, dropSpecks: true },
    );
    const count = (img: RasterImage) => {
      let n = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i] !== 0) n++;
      return n;
    };
    // 两者都应当裁到主体（14px 高），而不是把头顶 2..9 的空白一起裁进来再缩下去
    expect(count(withSpecks[0]!)).toBe(count(clean[0]!));
    expect(withSpecks[0]!.height).toBe(14);
  });
});
