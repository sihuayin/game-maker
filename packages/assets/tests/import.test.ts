import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cropToBox, decodePNG, downscaleArea, emptyImage, importBitmap, importFrames, inkBBox,
  keyBackground, paletteExactness, quantizeToPalette, sliceGrid, thresholdAlpha, trimToInk,
  unionInkBBox,
} from "../src/index.js";
import type { RasterImage } from "../src/index.js";

/** 真实素材：模型用参考图风格条件生成的 1024×1024 像素风角色（票 23 的导入对象）。 */
const IMPORT_DIR = fileURLToPath(new URL("../../../fixtures/import/", import.meta.url));
const REAL = decodePNG(readFileSync(IMPORT_DIR + "wan-player-1024.png"));
const PALETTE = ["#7c968e", "#55685f", "#a9b7ac", "#3e3236", "#c3cdc9", "#ead8a6", "#c4694a", "#4ebba4", "#6d8f52"];

const solid = (w: number, h: number, rgba: [number, number, number, number]) => {
  const img = emptyImage(w, h);
  for (let i = 0; i < w * h; i++) img.data.set(rgba, i * 4);
  return img;
};
const px = (img: RasterImage, x: number, y: number) => { const s = (y * img.width + x) * 4; return [img.data[s], img.data[s + 1], img.data[s + 2], img.data[s + 3]]; };
const setPx = (img: RasterImage, x: number, y: number, c: number[]) => { img.data.set(c, (y * img.width + x) * 4); };

describe("keyBackground —— 只能按容差抠，不能判等", () => {
  it("平色背景整张被抠掉", () => {
    const img = solid(10, 10, [40, 40, 40, 255]);
    setPx(img, 5, 5, [200, 30, 30, 255]);
    const { image, keyedPixels } = keyBackground(img, { tolerance: 10 });
    expect(keyedPixels).toBe(99);
    expect(px(image, 0, 0)[3]).toBe(0);
    expect(px(image, 5, 5)[3]).toBe(255);
  });

  it("⚠️ 真实素材的背景**不是平色**，四角取样得到多种颜色 —— 判等的实现会留下大半背景", () => {
    const { backgroundColors, keyedPixels } = keyBackground(REAL, { tolerance: 30 });
    const distinct = new Set(backgroundColors.map((c) => c.join(",")));
    expect(distinct.size, "四角颜色相同 —— 那这张图就不需要容差抠图了").toBeGreaterThan(1);
    const ratio = keyedPixels / (REAL.width * REAL.height);
    expect(ratio).toBeGreaterThan(0.7);   // 实测 ≈ 0.79
    expect(ratio).toBeLessThan(0.85);
  });

  it("容差越小抠得越少（且不会反过来）", () => {
    let prev = Infinity;
    for (const tolerance of [0, 8, 16, 30, 60]) {
      const { keyedPixels } = keyBackground(REAL, { tolerance });
      expect(keyedPixels).toBeGreaterThanOrEqual(prev === Infinity ? 0 : 0);
      if (prev !== Infinity) expect(keyedPixels).toBeGreaterThanOrEqual(prev);
      prev = keyedPixels;
    }
  });
});

describe("downscaleArea —— 面积平均，且必须按 alpha 加权", () => {
  it("2×2 同色块 → 1×1 同色", () => {
    const img = solid(4, 4, [100, 150, 200, 255]);
    const out = downscaleArea(img, 2, 2);
    expect([out.width, out.height]).toEqual([2, 2]);
    expect(px(out, 0, 0)).toEqual([100, 150, 200, 255]);
  });

  it("透明像素不参与颜色平均 —— 否则主体边缘会烧出一圈暗边", () => {
    // 左半不透明白、右半全透明
    const img = emptyImage(2, 1);
    setPx(img, 0, 0, [255, 255, 255, 255]);
    setPx(img, 1, 0, [0, 0, 0, 0]);
    const out = downscaleArea(img, 1, 1);
    expect(px(out, 0, 0).slice(0, 3)).toEqual([255, 255, 255]);   // 不是 128 灰
    expect(px(out, 0, 0)[3]).toBe(128);                            // alpha 取均值，留给下一步阈值化
  });

  it("非整数尺寸被拒", () => {
    expect(() => downscaleArea(solid(4, 4, [0, 0, 0, 255]), 2.5, 2)).toThrow(/正整数/);
  });
});

describe("thresholdAlpha —— 像素风要「要么有要么没有」", () => {
  it("阈值两侧被切干净", () => {
    const img = emptyImage(3, 1);
    setPx(img, 0, 0, [10, 10, 10, 0]);
    setPx(img, 1, 0, [10, 10, 10, 100]);
    setPx(img, 2, 0, [10, 10, 10, 200]);
    const out = thresholdAlpha(img, { threshold: 0.5 });
    expect([px(out, 0, 0)[3], px(out, 1, 0)[3], px(out, 2, 0)[3]]).toEqual([0, 0, 255]);
  });
});

describe("裁剪", () => {
  it("cropToBox 取到正确的子矩形", () => {
    const img = emptyImage(4, 4);
    setPx(img, 2, 1, [1, 2, 3, 255]);
    const out = cropToBox(img, { x: 1, y: 1, w: 2, h: 2 });
    expect(px(out, 1, 0)).toEqual([1, 2, 3, 255]);
  });

  it("trimToInk 裁到非透明包围盒；全透明时原样返回而不是产出 0×0", () => {
    const img = emptyImage(10, 10);
    for (let y = 3; y < 6; y++) for (let x = 4; x < 8; x++) setPx(img, x, y, [9, 9, 9, 255]);
    const t = trimToInk(img);
    expect([t.width, t.height]).toEqual([4, 3]);
    const empty = emptyImage(5, 5);
    expect(trimToInk(empty)).toBe(empty);
  });

  it("trimToInk 的 floor：极淡的 alpha 不算墨（它过不了后续的二值化）", () => {
    const img = emptyImage(10, 10);
    for (let y = 3; y < 6; y++) for (let x = 4; x < 8; x++) setPx(img, x, y, [9, 9, 9, 255]);
    setPx(img, 0, 0, [9, 9, 9, 1]);                       // 角落一颗肉眼不可见的孤点
    const loose = trimToInk(img);                         // 旧判据：被那颗孤点撑到画布左上角
    expect([loose.width, loose.height]).toEqual([8, 6]);  // 方块本占 x4~7 / y3~5，现在 x0~7 / y0~5
    const t = trimToInk(img, { floor: 128 });             // 新判据：孤点不算墨，方块原样
    expect([t.width, t.height]).toEqual([4, 3]);
  });
});

describe("⚠️ alpha 孤点不得改变构图（2026-09-25 修正）", () => {
  it("一颗 alpha=1 的孤点曾把角色缩到原大的 59%×88%", () => {
    // 这条只有拿**真实素材**跑才暴露得了 —— 模型给的透明底 PNG 常有这类极淡噪点，
    // 而合成的小图里没人会去种一颗 alpha=1 的像素。
    //
    // ⚠️ 2026-09-26：原版比较的是「原图」与「先抠过再种孤点的图」—— 两条**不同的**路径，
    // 只是当时恰好撞成同一个结果。四角取样改成跳过全透明像素之后就露馅了。
    // 现在两边走同一条路径（原图 / 原图+孤点），这才是这条不变量真正的意思。
    const speckled: RasterImage = { width: REAL.width, height: REAL.height, data: Buffer.from(REAL.data) };
    // ⚠️ **下标是像素 0 的 RGBA 四个字节**。原版写成 data[3..6] —— 那是**跨像素**的：
    // data[3] 是像素 0 的 alpha，data[4..6] 已经是像素 1 的 RGB。于是孤点被种成了一个
    // **不透明的怪色像素**，把包围盒从 428×809 撑到 725×922 —— 而那条"孤点不得改变构图"
    // 的断言居然一直是过的，因为它当时比的是两条**不同的**路径（原图 vs 先抠过再种点的图），
    // 两个错误恰好抵消。2026-09-26 把两条路径统一之后才露出来。
    speckled.data[0] = 90; speckled.data[1] = 106; speckled.data[2] = 138; speckled.data[3] = 1;   // 左上角，alpha=1

    const opt = { targetHeight: 48, palette: PALETTE, background: { tolerance: 30 } } as const;
    const clean = importBitmap(REAL, opt).report.trimmedTo;
    const dirty = importBitmap(speckled, opt).report.trimmedTo;

    expect(clean).toEqual({ w: 428, h: 809 });
    expect(dirty).toEqual(clean);   // 孤点不得改变裁到哪
  });
});

describe("sliceGrid —— 只在图真有网格时成立", () => {
  const sheet = (() => {
    const colors = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255], [255, 0, 255, 255], [0, 255, 255, 255]];
    const img = emptyImage(6, 4);           // 3 列 × 2 行，每格 2×2
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++)
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) setPx(img, c * 2 + x, r * 2 + y, colors[r * 3 + c]!);
    return img;
  })();

  it("按行优先切，每格内容正确", () => {
    const frames = sliceGrid(sheet, { columns: 3, rows: 2, frameWidth: 2, frameHeight: 2 });
    expect(frames).toHaveLength(6);
    expect(px(frames[0]!, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(px(frames[1]!, 0, 0)).toEqual([0, 255, 0, 255]);   // 行优先：第 2 格是同行的右邻
    expect(px(frames[3]!, 0, 0)).toEqual([255, 255, 0, 255]); // 第 4 格换行
    expect(px(frames[5]!, 0, 0)).toEqual([0, 255, 255, 255]);
  });

  it("支持偏移与格间距", () => {
    const padded = emptyImage(9, 6);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++)
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) setPx(padded, 1 + c * 4 + x, 1 + r * 3 + y, [10 * (r * 2 + c + 1), 0, 0, 255]);
    const frames = sliceGrid(padded, { columns: 2, rows: 2, frameWidth: 2, frameHeight: 2, offsetX: 1, offsetY: 1, spacingX: 2, spacingY: 1 });
    expect(frames.map((f) => px(f, 0, 0)[0])).toEqual([10, 20, 30, 40]);
  });

  it("网格超出图范围时报错，而不是静默给出裁剪过的帧", () => {
    expect(() => sliceGrid(sheet, { columns: 4, rows: 2, frameWidth: 2, frameHeight: 2 })).toThrow(/网格需要/);
  });

  it("非正整数参数被拒", () => {
    expect(() => sliceGrid(sheet, { columns: 0, rows: 2, frameWidth: 2, frameHeight: 2 })).toThrow(/正整数/);
  });
});

describe("importBitmap —— 端到端，用真实素材", () => {
  const run = () => importBitmap(REAL, { targetHeight: 48, palette: PALETTE, background: { tolerance: 30 } });

  it("1024×1024 → 25×48，且量化后完全 ∈ 色板", () => {
    const r = run();
    expect([r.width, r.height]).toEqual([25, 48]);
    expect(paletteExactness(r, PALETTE).exact).toBe(true);
  });

  it("report 如实记录事实（供写进 manifest 的 provenance）", () => {
    const r = run();
    expect(r.report.sourceSize).toEqual({ w: 1024, h: 1024 });
    expect(r.report.keyedPixels).toBeGreaterThan(700_000);
    expect(r.report.trimmedTo).toEqual({ w: 428, h: 809 });
    expect(r.report.distinctColorsBeforeQuantize).toBeGreaterThan(100);   // 网格上仍有上百种颜色
  });

  it("⚠️ 不量化的话，1200 个格子里有几百种颜色 —— 那不是像素画", () => {
    const r = run();
    const colors = new Set<string>();
    for (let i = 0; i < r.grid.width * r.grid.height; i++) {
      const s = i * 4;
      if (r.grid.data[s + 3] !== 0) colors.add(`${r.grid.data[s]},${r.grid.data[s + 1]},${r.grid.data[s + 2]}`);
    }
    expect(colors.size).toBeGreaterThan(300);       // 实测 700 上下
    expect(colors.size).toBeLessThan(r.grid.width * r.grid.height);
  });

  it("确定性：两次导入逐字节相同", () => {
    expect(run().data.equals(run().data)).toBe(true);
  });

  it("alpha 阈值化后是二值 alpha（没有半透明像素）", () => {
    const r = run();
    for (let i = 0; i < r.width * r.height; i++) {
      const a = r.data[i * 4 + 3]!;
      expect(a === 0 || a === 255).toBe(true);
    }
  });

  it("⚠️ 顺序不能反：先量化再降采样 ≠ 先降采样再量化", () => {
    const keyed = keyBackground(REAL, { tolerance: 30 }).image;
    const sprite = trimToInk(keyed);
    const a = quantizeToPalette(downscaleArea(sprite, 25, 48), PALETTE);
    const b = downscaleArea(quantizeToPalette(sprite, PALETTE), 25, 48);
    expect(a.data.equals(b.data), "两种顺序结果相同 —— 那这条测试就没在守东西了").toBe(false);
  });

  it("不给 background 就不抠（假定人已经给了透明底）", () => {
    const transparent = trimToInk(keyBackground(REAL, { tolerance: 30 }).image);
    const r = importBitmap(transparent, { targetHeight: 48, palette: PALETTE });
    expect(r.report.keyedPixels).toBe(0);
    expect(r.report.backgroundColors).toEqual([]);
  });

  it("pixelScale 做整数倍放大（像素风放大）", () => {
    const r = importBitmap(REAL, { targetHeight: 48, palette: PALETTE, background: {}, pixelScale: 2 });
    expect([r.width, r.height]).toEqual([50, 96]);
  });
});

describe("⚠️ 多帧必须共用裁框（2026-09-25 修）", () => {
  /** 真实素材抠完背景的样子 —— 它是**一个**角色，包围盒 428×809 @ (298,113)。 */
  const keyed = keyBackground(REAL, { tolerance: 30 }).image;
  /** 把右边缘一条墨抹掉：模拟走路循环里「腿并拢」那一帧 —— 包围盒**变窄**，但角色本身没动。 */
  const narrower = (() => {
    const img: RasterImage = { width: keyed.width, height: keyed.height, data: Buffer.from(keyed.data) };
    for (let y = 0; y < img.height; y++) for (let x = 700; x < 730; x++) img.data[(y * img.width + x) * 4 + 3] = 0;
    return img;
  })();

  // ⚠️ 判据取「**同一个特征**被画成多宽」，不能取「整帧的 ink 包围盒」——
  // 后者两帧本来就该不同（b 的墨真的少了），测它等于测错了东西。
  // 头部在两次里都是同一批像素，它被画成多宽**只**反映源图到交付网格的缩放系数。
  const opt = { targetWidth: 32, targetHeight: 48, palette: PALETTE } as const;
  const headWidth = (img: RasterImage) => {
    const b = inkBBox(img)!;
    let lo = Infinity, hi = -Infinity;
    for (let y = b.y; y < b.y + Math.max(1, Math.round(b.h * 0.3)); y++)
      for (let x = 0; x < img.width; x++)
        if (img.data[(y * img.width + x) * 4 + 3] !== 0) { if (x < lo) lo = x; if (x > hi) hi = x; }
    return hi - lo + 1;
  };

  it("逐帧各裁各的：同一个头被画成不同宽度（这就是那个 bug）", () => {
    const a = headWidth(importBitmap(keyed, opt));
    const b = headWidth(importBitmap(narrower, opt));
    expect(a).not.toEqual(b);      // 实测 22 vs 23 —— 播起来就是逐帧缩放脉动
  });

  it("共用裁框：同一个头两帧画成同样的宽度", () => {
    const [a, b] = importFrames([keyed, narrower], opt) as [RasterImage, RasterImage];
    expect(headWidth(a)).toEqual(headWidth(b));      // 实测两帧都是 22
    // 比例保住了，不代表内容相同 —— 窄掉的那条边是真没了
    expect(a.data.equals(b.data)).toBe(false);
  });

  it("单帧走 importFrames 与走 importBitmap 等价", () => {
    const one = importBitmap(keyed, opt);
    const many = importFrames([keyed], opt)[0]!;
    expect(many.data.equals(one.data)).toBe(true);
  });

  it("各帧尺寸必须一致 —— 不同尺寸无从并起，要报错而不是算出一个错的框", () => {
    expect(() => importFrames([keyed, emptyImage(10, 10)], opt)).toThrow(/尺寸必须一致/);
    expect(() => importFrames([], opt)).toThrow(/至少要有一帧/);
  });

  it("unionInkBBox 与 inkBBox 在单帧时一致；显式裁框越界要报错", () => {
    expect(unionInkBBox([keyed])).toEqual(inkBBox(keyed));
    expect(unionInkBBox([emptyImage(4, 4)])).toBeNull();
    expect(() => importBitmap(keyed, { ...opt, trimBox: { x: 0, y: 0, w: 9999, h: 9999 } }))
      .toThrow(/超出图像/);
  });
});

describe("⚠️ 抠背景的四角必须跳过全透明像素（2026-09-26 修）", () => {
  it("补白过的格子四角是全透明，按 RGB 读会读成黑色 —— 于是抠的是角色的暗部，背景原地不动", () => {
    // 这是真跑一个生图动画包时抓到的：`cellsFromBoxes` 把每格**居中补白**到统一宽度，
    // 补出来的是全透明（RGB=0）。旧的四角取样不看 alpha，于是「背景色」被读成黑色。
    // 实测后果：交付帧 94% 不透明、主色是色板里的橙（洋红背景被量化成的），角色反而被啃。
    const img = emptyImage(20, 20);
    // 背景：一片洋红（跟实测里模型给的一样）
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) setPx(img, x, y, [201, 42, 143, 255]);
    // 角色：中间一块深色
    for (let y = 8; y < 13; y++) for (let x = 8; x < 13; x++) setPx(img, x, y, [62, 50, 54, 255]);
    // 左边两列「补白」—— 全透明
    for (let y = 0; y < 20; y++) for (let x = 0; x < 2; x++) setPx(img, x, y, [0, 0, 0, 0]);

    const { image, backgroundColors } = keyBackground(img, { tolerance: 40 });
    // 参考色必须是洋红，**不是**补白列的 (0,0,0)
    for (const c of backgroundColors) expect(c.join(",")).not.toBe("0,0,0");
    // 洋红被抠掉、角色留下
    expect(px(image, 10, 10)[3]).toBe(255);            // 角色
    expect(px(image, 15, 15)[3]).toBe(0);              // 洋红背景
    expect(px(image, 0, 10)[3]).toBe(0);               // 补白列本来就没东西
  });
});
