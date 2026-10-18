// 票 02：抠底后的**品红边缘**（真图回归 + 合成边界）。
//
// ⚠️ 分工与 `model-paint*.test.ts` 同一条纪律：
//   · 合成图验**判据的形状**（哪些颜色该删、哪些不许删、阈值可配、透明像素不动）；
//   · C/C2 的真图验**事实**（抠完之后还剩多少命中判据的像素）。
//   上游依赖写在 `fixtures/model-paint-despill/README.md`：换模型/供应商 ⇒ 这 6 张要重量、要换掉。
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodePNG } from "../src/png.js";
import {
  DESPILL_THRESHOLDS, despillMagenta, dominantOpaqueColor, emptyImage, importBitmap, importFrames,
  keyBackground, sliceGridCells, type RasterImage,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DIR = path.join(ROOT, "fixtures/model-paint-despill");
const LAYERS = path.join(ROOT, "fixtures/model-paint-layers");
const TOL = 30;
const PALETTE = ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#808080", "#8b4513", "#ffc0cb"];

const load = (dir: string, file: string): RasterImage => decodePNG(readFileSync(path.join(dir, file)));

/** 命中票面判据的不透明像素数。 */
const matching = (img: RasterImage, t = DESPILL_THRESHOLDS): number => {
  let n = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * 4;
    if (img.data[s + 3]! < 128) continue;
    const r = img.data[s]!, g = img.data[s + 1]!, b = img.data[s + 2]!;
    if (r > t.rMin && g < t.gMax && b > t.bMin && r - g > t.rgMin && b - g > t.bgMin) n++;
  }
  return n;
};

/** 红/棕/橙（暖色）：与品红判据正交 —— 品红要求 B−G > 35，这里要求 B ≤ G。 */
const warm = (img: RasterImage): number => {
  let n = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * 4;
    if (img.data[s + 3]! < 128) continue;
    const r = img.data[s]!, g = img.data[s + 1]!, b = img.data[s + 2]!;
    if (r > 100 && r - g > 30 && b <= g) n++;
  }
  return n;
};

const modeOf = (img: RasterImage) => dominantOpaqueColor(img).color;

/** 一张图：抠底（实测众数色）→ despill。返回抠完与删掉的像素数。 */
const keyAndDespill = (img: RasterImage, opts: Parameters<typeof despillMagenta>[1] = {}) => {
  const mode = modeOf(img);
  const keyed = keyBackground(img, { tolerance: TOL, colors: [mode] }).image;
  const before = matching(keyed);
  const out = despillMagenta(keyed, opts);
  return { keyed, mode, before, ...out };
};

/** 票面读数（`fixtures/model-paint-despill/README.md`）：抠完之后仍命中判据的像素数。 */
const READINGS = [
  { file: "c-master.png",  fringe: 5_260 },
  { file: "c-idle.png",    fringe: 11_943 },
  { file: "c-run.png",     fringe: 7_692 },
  { file: "c2-master.png", fringe: 5_201 },
  { file: "c2-idle.png",   fringe: 9_162 },
  { file: "c2-run.png",    fringe: 12_116 },
] as const;

describe("§ 合成图：判据的形状", () => {
  it("只删品红；红/棕/亮粉（B−G 不够）与透明像素都不动", () => {
    const img = emptyImage(5, 1);
    const set = (x: number, c: [number, number, number], a = 255) => {
      const s = x * 4;
      img.data[s] = c[0]; img.data[s + 1] = c[1]; img.data[s + 2] = c[2]; img.data[s + 3] = a;
    };
    set(0, [200, 40, 130]);   // 品红 → 删
    set(1, [180, 40, 30]);    // 红（B 低）→ 留
    set(2, [90, 60, 40]);     // 棕 → 留
    set(3, [230, 100, 120]);  // 亮粉：B−G = 20 ≤ 35 → 留
    set(4, [200, 40, 130], 0);

    const out = despillMagenta(img);
    expect(out.removedPixels).toBe(1);
    expect([0, 1, 2, 3].map((x) => out.image.data[x * 4 + 3])).toEqual([0, 255, 255, 255]);
    expect(out.image.data[4 * 4 + 3], "本来透明的像素不动").toBe(0);
    // 不原地改输入
    expect(img.data[3]).toBe(255);
  });

  it("阈值可配：把 rMin 抬到 250 ⇒ 一个都不删", () => {
    const img = emptyImage(1, 1);
    img.data.set([200, 40, 130, 255]);
    expect(despillMagenta(img, { thresholds: { ...DESPILL_THRESHOLDS, rMin: 250 } }).removedPixels).toBe(0);
  });
});

describe("§ 真图：C / C2 的 6 张（读数钉死）", () => {
  it.each(READINGS)("$file：抠完命中判据 = $fringe，despill 后 = 0", ({ file, fringe }) => {
    const { keyed, before, image, removedPixels } = keyAndDespill(load(DIR, file));
    expect(before, "前提：这张图上真有边缘残留").toBe(fringe);
    expect(removedPixels).toBe(fringe);
    expect(matching(image)).toBe(0);
    expect(keyed.width).toBe(image.width);
  });

  it("⚠️ 红色/棕色像素**一个不少**（判据与暖色正交）", () => {
    for (const { file } of READINGS) {
      const raw = load(DIR, file);
      const mode = modeOf(raw);
      const keyed = keyBackground(raw, { tolerance: TOL, colors: [mode] }).image;
      const before = warm(keyed);
      expect(before, `${file}：这张图上得有暖色可保`).toBeGreaterThan(0);
      expect(warm(despillMagenta(keyed).image), `${file}：暖色被误删`).toBe(before);
    }
  });
});

describe("§ 三条路都走到 despill（单帧 / 多帧 / 背景层）", () => {
  it("单帧：importBitmap 的 report 记下删除数，且与直接调用一致", () => {
    const raw = load(DIR, "c2-master.png");
    const mode = modeOf(raw);
    const direct = keyAndDespill(raw).removedPixels;
    const out = importBitmap(raw, {
      palette: PALETTE, targetWidth: 48, targetHeight: 64,
      background: { tolerance: TOL, colors: [mode] },
    });
    expect(out.report.despilledPixels).toBe(direct);
    expect(out.report.despilledPixels).toBe(5_201);
    // 交付态（降采样 + 二值化 + 量化之后）也不许再把判据像素混回来
    expect(matching(out)).toBe(0);
  });

  it("多帧（横排 4 格）：importFrames 每一格的删除数之和 = 整图", () => {
    const raw = load(DIR, "c2-idle.png");
    const mode = modeOf(raw);
    const cells = sliceGridCells(raw, { columns: 4, rows: 1 });
    const outs = importFrames(cells, {
      palette: PALETTE, targetWidth: 48, targetHeight: 64,
      background: { tolerance: TOL, colors: [mode] },
    });
    expect(outs.reduce((s, o) => s + o.report.despilledPixels, 0)).toBe(9_162);
    for (const o of outs) expect(matching(o), "交付帧里不许有判据像素").toBe(0);
  });

  it("多帧（2 行 × 6 格，票 01 的现场）：同样按格删干净", () => {
    const raw = load(DIR, "c2-run.png");
    const mode = modeOf(raw);
    const cells = sliceGridCells(raw, { columns: 6, rows: 2 });
    const outs = importFrames(cells, {
      palette: PALETTE, targetWidth: 48, targetHeight: 64,
      background: { tolerance: TOL, colors: [mode] },
    });
    expect(outs.reduce((s, o) => s + o.report.despilledPixels, 0)).toBe(12_116);
    for (const o of outs) expect(matching(o), "交付帧里不许有判据像素").toBe(0);
  });

  it("背景层（非最远层）：wall / ground 的真图也会跑 despill", () => {
    for (const [file, fringe] of [["layer-exp-treatment-wall.png", 374], ["layer-exp-treatment-ground.png", 212]] as const) {
      const raw = load(LAYERS, file);
      const mode = modeOf(raw);
      expect(keyAndDespill(raw).removedPixels).toBe(fringe);
      const out = importBitmap(raw, {
        palette: PALETTE, targetWidth: 480, targetHeight: 270,
        background: { tolerance: TOL, colors: [mode] },
      });
      expect(out.report.despilledPixels, file).toBe(fringe);
      expect(matching(out), `${file}：交付层里不许有判据像素`).toBe(0);
    }
  });

  it("⚠️ 底色不是品红（天空层）⇒ 省略时不跑 despill，内容不被误删", () => {
    // 票 38 的三张天空真图就是靠这一点保住交付读数的：它们的众数色是 `[41,41,64]` 一类深蓝，
    // 不在品红家族里；硬按颜色删会把交付态透明率从 25.46% 推到 27.18%。
    for (const file of ["third-run-wasteland-skyline-sky.png", "layer-exp-treatment-sky.png", "layer-exp-control-sky.png"]) {
      const raw = load(LAYERS, file);
      const mode = modeOf(raw);
      const out = importBitmap(raw, {
        palette: PALETTE, targetWidth: 64, targetHeight: 48,
        background: { tolerance: TOL, colors: [mode] },
      });
      expect(out.report.despilledPixels, file).toBe(0);
    }
  });

  it("⚠️ 不抠底的图（最远层 / 人给的透明 PNG）**不跑** despill —— 不许动暖色与品红", () => {
    // 一张带品红像素的图：没有 `background` ⇒ prepareFrame 原样返回。
    const img = emptyImage(2, 1);
    img.data.set([200, 40, 130, 255, 180, 40, 30, 255]);
    const out = importBitmap(img, { palette: PALETTE, targetWidth: 2, targetHeight: 1 });
    expect(out.report.despilledPixels).toBe(0);
  });

  it("可关可配：despill:false 关掉；partial 阈值只改一格", () => {
    const raw = load(DIR, "c2-master.png");
    const mode = modeOf(raw);
    const base = { palette: PALETTE, targetWidth: 48, targetHeight: 64, background: { tolerance: TOL, colors: [mode] } };
    expect(importBitmap(raw, { ...base, despill: false }).report.despilledPixels).toBe(0);
    expect(importBitmap(raw, { ...base, despill: { rMin: 250 } }).report.despilledPixels).toBe(0);
    expect(importBitmap(raw, base).report.despilledPixels).toBe(5_201);
  });
});
