import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ANIMATION_THRESHOLDS, alphaMaskDiff, bboxWidthDiffPct, boundaryDarkPct, cleanBBox,
  decodePNG, dominantColorL1, dominantOpaqueColor, emptyImage, importFrames, keyBackground,
  offPaletteCount, paletteCount, positionDriftPct, verdictOf,
  type AnimationMetrics, type InkBox, type RasterImage, type Rgb,
} from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const V7 = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20f-lurker");
const GEN = path.join(V7, "ruin-scavenger-extraction-assets/pack/v7/authoring/generated");
/** 与 qualify.mjs / finalist.mjs 编译进去的色板一致（34 色重建版）。 */
const PALETTE = (JSON.parse(fs.readFileSync(path.join(V7, "stylespec.json"), "utf8")) as { palette: string[] }).palette;

/**
 * v7 `scavenger-actor` idle 4 帧的 golden 读数（d 票 §3.3，来自 21d / 21f 两次独立运行）。
 * 测试不读 result.json —— 期望值写死在这里，指标实现漂移时测试才会红。
 */
const GOLD_RAW = [1, 2, 3, 4].map((n) => path.join(GEN, `scavenger-actor.idle${n}.png`));
const GOLD_BBOX: readonly InkBox[] = [
  { x: 141, y: 21, w: 455, h: 1122 },
  { x: 141, y: 18, w: 454, h: 1126 },
  { x: 141, y: 16, w: 455, h: 1127 },
  { x: 141, y: 18, w: 455, h: 1125 },
];
const GOLD_KEY: readonly Rgb[] = [
  [210, 60, 155], [211, 61, 155], [211, 60, 155], [211, 61, 156],
];
const GOLD_PALETTE_COUNT = [18, 18, 19, 19] as const;
const GOLD_BOUNDARY_DARK = [87.4, 89.6, 87.9, 87.4] as const;
const GOLD_PAIRS: readonly { pair: string; a: number; b: number; alpha: number; width: number; position: number; keyL1: number }[] = [
  { pair: "idle1~idle2", a: 0, b: 1, alpha: 0.4, width: 0.2, position: 0.3, keyL1: 2 },
  { pair: "idle1~idle3", a: 0, b: 2, alpha: 0.4, width: 0, position: 0.4, keyL1: 1 },
  { pair: "idle1~idle4", a: 0, b: 3, alpha: 0.3, width: 0, position: 0.3, keyL1: 3 },
  { pair: "idle2~idle3", a: 1, b: 2, alpha: 0.2, width: 0.2, position: 0.2, keyL1: 1 },
  { pair: "idle2~idle4", a: 1, b: 3, alpha: 0.4, width: 0.2, position: 0, keyL1: 1 },
  { pair: "idle3~idle4", a: 2, b: 3, alpha: 0.3, width: 0, position: 0.2, keyL1: 2 },
];

type Fixture = { name: string; raw: RasterImage; key: Rgb; bbox: InkBox; imported: RasterImage };

/** 与 qualify/finalist 的 measure() 同一条链：raw 量 bbox / key，导入后的帧量色板指标。 */
function loadFixture(n: number): Fixture {
  const raw = decodePNG(fs.readFileSync(GOLD_RAW[n]!));
  const key = dominantOpaqueColor(raw).color;
  const bbox = cleanBBox(raw);
  if (!bbox) throw new Error(`v7 基线 idle${n + 1} 抠底后没有墨 —— 夹具不成立`);
  const imported = importFrames([raw], {
    palette: PALETTE, targetWidth: 48, targetHeight: 64,
    background: { tolerance: 30, colors: [key] }, dropSpecks: true, dropBottomLines: true,
  })[0]!;
  return { name: `idle${n + 1}`, raw, key, bbox, imported };
}

const FIXTURES = GOLD_RAW.map((_, i) => loadFixture(i));
const placement = (f: Fixture) => ({ bbox: f.bbox, sourceWidth: f.raw.width, sourceHeight: f.raw.height });
const metricsOf = (frames: readonly Fixture[]): AnimationMetrics => {
  const pairs = [];
  for (let i = 0; i < frames.length; i++)
    for (let j = i + 1; j < frames.length; j++) {
      const x = frames[i]!, y = frames[j]!;
      pairs.push({
        alphaMaskDiffPct: alphaMaskDiff(x.imported, y.imported),
        bboxWidthDiffPct: bboxWidthDiffPct(x.bbox, y.bbox) ?? 0,
        positionDriftPct: positionDriftPct(placement(x), placement(y)) ?? 0,
        backgroundL1: dominantColorL1(x.key, y.key),
      });
    }
  return {
    alphaMaskDiffPct: Math.max(...pairs.map((p) => p.alphaMaskDiffPct)),
    bboxWidthDiffPct: Math.max(...pairs.map((p) => p.bboxWidthDiffPct)),
    positionDriftPct: Math.max(...pairs.map((p) => p.positionDriftPct)),
    backgroundL1: Math.max(...pairs.map((p) => p.backgroundL1)),
    paletteCountMin: Math.min(...frames.map((f) => paletteCount(f.imported))),
    offPalette: Math.max(...frames.map((f) => offPaletteCount(f.imported, PALETTE))),
    boundaryDarkPctMin: Math.min(...frames.map((f) => boundaryDarkPct(f.imported, PALETTE) ?? 0)),
  };
};

/** 造 RGBA 图：默认全透明。 */
const put = (img: RasterImage, x: number, y: number, rgb: Rgb, alpha = 255) => {
  const s = (y * img.width + x) * 4;
  img.data[s] = rgb[0]; img.data[s + 1] = rgb[1]; img.data[s + 2] = rgb[2]; img.data[s + 3] = alpha;
};
const solid = (w: number, h: number, rgb: Rgb, alpha = 255): RasterImage => {
  const img = emptyImage(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(img, x, y, rgb, alpha);
  return img;
};

describe("v7 scavenger-actor idle 4 帧 golden（d 票 §3.3）", () => {
  it("逐帧：干净 bbox、背景众数色、色数、off-palette、边界深色", () => {
    FIXTURES.forEach((f, i) => {
      expect(f.bbox, `${f.name} bbox`).toEqual(GOLD_BBOX[i]);
      expect(f.key, `${f.name} 众数色`).toEqual(GOLD_KEY[i]);
      expect(paletteCount(f.imported), `${f.name} 色数`).toBe(GOLD_PALETTE_COUNT[i]);
      expect(offPaletteCount(f.imported, PALETTE), `${f.name} off-palette`).toBe(0);
      expect(boundaryDarkPct(f.imported, PALETTE), `${f.name} 边界深色`).toBe(GOLD_BOUNDARY_DARK[i]);
    });
  });

  it("6 个帧对：alpha 掩码差、bbox 宽差、位置漂移、背景 L1", () => {
    for (const p of GOLD_PAIRS) {
      const x = FIXTURES[p.a]!, y = FIXTURES[p.b]!;
      expect(alphaMaskDiff(x.imported, y.imported), `${p.pair} alpha`).toBe(p.alpha);
      expect(bboxWidthDiffPct(x.bbox, y.bbox), `${p.pair} bbox 宽`).toBe(p.width);
      expect(positionDriftPct(placement(x), placement(y)), `${p.pair} 位置`).toBe(p.position);
      expect(dominantColorL1(x.raw, y.raw), `${p.pair} 背景 L1（传图）`).toBe(p.keyL1);
      expect(dominantColorL1(x.key, y.key), `${p.pair} 背景 L1（传 RGB）`).toBe(p.keyL1);
    }
  });

  it("汇总读数等于 d 票 §3.3，整体判绿", () => {
    const metrics = metricsOf(FIXTURES);
    expect(metrics).toEqual({
      alphaMaskDiffPct: 0.4, bboxWidthDiffPct: 0.2, positionDriftPct: 0.4, backgroundL1: 3,
      paletteCountMin: 18, offPalette: 0, boundaryDarkPctMin: 87.4,
    });
    expect(verdictOf(metrics)).toBe("green");
  });
});

describe("阈值边界（票 12：绿 ≤1/≤2/≤1/≤10，黄 ≤3/≤5/≤3/≤20；硬门槛 14 色 / 0 off / 50%）", () => {
  const GREEN: AnimationMetrics = {
    alphaMaskDiffPct: 0.4, bboxWidthDiffPct: 0.2, positionDriftPct: 0.4, backgroundL1: 3,
    paletteCountMin: 18, offPalette: 0, boundaryDarkPctMin: 87.4,
  };

  it("阈值常量只有这一处", () => {
    expect(ANIMATION_THRESHOLDS).toEqual({
      alphaMaskDiffPct: { green: 1, yellow: 3 },
      bboxWidthDiffPct: { green: 2, yellow: 5 },
      positionDriftPct: { green: 1, yellow: 3 },
      backgroundL1: { green: 10, yellow: 20 },
      paletteCountMin: 14,
      offPaletteMax: 0,
      boundaryDarkPctMin: 50,
    });
  });

  it("四道上界指标：恰好等于绿档是绿、越界一分是黄、恰好等于黄档还是黄", () => {
    const cases: readonly [keyof AnimationMetrics, number, number, number][] = [
      ["alphaMaskDiffPct", 1, 1.1, 3],
      ["bboxWidthDiffPct", 2, 2.1, 5],
      ["positionDriftPct", 1, 1.1, 3],
      ["backgroundL1", 10, 11, 20],
    ];
    for (const [key, green, yellow, red] of cases) {
      expect(verdictOf({ ...GREEN, [key]: green }), `${key}=${green}`).toBe("green");
      expect(verdictOf({ ...GREEN, [key]: yellow }), `${key}=${yellow}`).toBe("yellow");
      expect(verdictOf({ ...GREEN, [key]: red }), `${key}=${red}`).toBe("yellow");
      expect(verdictOf({ ...GREEN, [key]: red + 0.1 }), `${key}=${red + 0.1}`).toBe("red");
    }
  });

  it("三个硬门槛只有绿 / 红，且红灯压过黄灯", () => {
    expect(verdictOf({ ...GREEN, paletteCountMin: 14 })).toBe("green");
    expect(verdictOf({ ...GREEN, paletteCountMin: 13 })).toBe("red");
    expect(verdictOf({ ...GREEN, offPalette: 0 })).toBe("green");
    expect(verdictOf({ ...GREEN, offPalette: 1 })).toBe("red");
    expect(verdictOf({ ...GREEN, boundaryDarkPctMin: 50 })).toBe("green");
    expect(verdictOf({ ...GREEN, boundaryDarkPctMin: 49.9 })).toBe("red");
    expect(verdictOf({ ...GREEN, alphaMaskDiffPct: 1.1, paletteCountMin: 13 })).toBe("red");
  });
});

describe("纯指标：改一像素 / 边界语义", () => {
  it("alphaMaskDiff：只比 alpha ≥128 的掩码；4×4 改一像素 = 6.3%（红）", () => {
    const a = solid(4, 4, [10, 20, 30]);
    const b = solid(4, 4, [10, 20, 30]);
    put(b, 0, 0, [10, 20, 30], 0);
    expect(alphaMaskDiff(a, b)).toBe(6.3);
    // RGB 不同但掩码相同 → 0；alpha 127 / 128 的边界按「128 才算不透明」
    put(b, 0, 0, [255, 255, 255], 128);
    expect(alphaMaskDiff(a, b)).toBe(0);
    const lo = solid(1, 1, [1, 2, 3], 127);
    const hi = solid(1, 1, [1, 2, 3], 128);
    expect(alphaMaskDiff(lo, hi)).toBe(100);
    expect(() => alphaMaskDiff(solid(2, 2, [0, 0, 0]), solid(3, 3, [0, 0, 0]))).toThrow(/尺寸必须一致/);
  });

  it("bboxWidthDiffPct：2% 绿 / 3% 黄 / 6% 红；缺 bbox 返回 null", () => {
    const box = (w: number): InkBox => ({ x: 0, y: 0, w, h: 10 });
    expect(bboxWidthDiffPct(box(100), box(102))).toBe(2);
    expect(bboxWidthDiffPct(box(100), box(103))).toBe(3);
    expect(bboxWidthDiffPct(box(100), box(106))).toBe(6);
    expect(bboxWidthDiffPct(null, box(100))).toBeNull();
  });

  it("positionDriftPct：1% 绿 / 2% 黄 / 4% 红；分母取两帧源图较大者", () => {
    const at = (x: number, source = 100) => ({ bbox: { x, y: 0, w: 10, h: 10 }, sourceWidth: source, sourceHeight: source });
    expect(positionDriftPct(at(0), at(1))).toBe(1);
    expect(positionDriftPct(at(0), at(2))).toBe(2);
    expect(positionDriftPct(at(0), at(4))).toBe(4);
    expect(positionDriftPct(at(0, 200), at(2, 100))).toBe(1);
    expect(positionDriftPct(at(0), { bbox: null, sourceWidth: 100, sourceHeight: 100 })).toBeNull();
  });

  it("dominantColorL1：L1 10 绿 / 11 黄 / 20 黄 / 21 红", () => {
    expect(dominantColorL1([0, 0, 0], [10, 0, 0])).toBe(10);
    expect(dominantColorL1([0, 0, 0], [21, 0, 0])).toBe(21);
  });

  it("paletteCount / offPaletteCount：14 色硬门槛；alpha <128 不计；改一像素即 off-palette", () => {
    const img = emptyImage(5, 3); // 15 像素
    const palette: string[] = [];
    for (let i = 0; i < 14; i++) {
      put(img, i % 5, Math.floor(i / 5), [i, 0, 0]);
      palette.push(`#${i.toString(16).padStart(2, "0")}0000`);
    }
    put(img, 4, 2, [200, 0, 0], 127); // 第 15 像素：半透明，不算
    expect(paletteCount(img)).toBe(14);
    expect(offPaletteCount(img, palette)).toBe(0);
    put(img, 4, 2, [200, 0, 0], 255); // 改一像素：多一色、且是 off-palette
    expect(paletteCount(img)).toBe(15);
    expect(offPaletteCount(img, palette)).toBe(1);
  });

  it("boundaryDarkPct：3×3 边界 4 深 4 浅 = 50%；改一像素变 37.5%", () => {
    const dark: Rgb = [0, 0, 0], light: Rgb = [255, 255, 255], mid: Rgb = [128, 128, 128];
    const img = solid(3, 3, mid);
    const ring: readonly [number, number, Rgb][] = [
      [0, 0, dark], [1, 0, dark], [2, 0, dark], [0, 1, dark],
      [2, 1, light], [0, 2, light], [1, 2, light], [2, 2, light],
    ];
    for (const [x, y, c] of ring) put(img, x, y, c);
    expect(boundaryDarkPct(img, ["#000000", "#808080", "#ffffff"])).toBe(50);
    put(img, 0, 0, light);
    expect(boundaryDarkPct(img, ["#000000", "#808080", "#ffffff"])).toBe(37.5);
  });

  it("cleanBBox：抠底 + 去地面线 + 去碎点；改一像素把 bbox 撑大", () => {
    const bg: Rgb = [200, 0, 200], ink: Rgb = [10, 20, 30];
    const img = solid(10, 10, bg);
    for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) put(img, x, y, ink);
    expect(cleanBBox(img)).toEqual({ x: 2, y: 2, w: 3, h: 3 });
    put(img, 2, 5, ink); // 与主体相连的一像素
    expect(cleanBBox(img)).toEqual({ x: 2, y: 2, w: 3, h: 4 });
    // 抠底确实发生：只留主体像素，背景不算墨
    put(img, 9, 9, bg); // no-op，确保背景仍是众数
    expect(cleanBBox(img)?.w).toBe(3);
  });
});
