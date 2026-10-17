// 票 99 / 票 100：多帧动画的**底部横带救援**。
//
// ⚠️ 合成图的形状与 17c 的真现场同构：N 个分开的角色 + 一条**贯穿全宽的底部横带** ⇒
//   第一次分块只得到 1 块。救援必须把它裁掉、重新分块出 N 帧，**而且交付帧里不能带那条横带**。
//   ⚠️ 只让分块「忽略这些行」是不够的 —— 像素不裁，每一帧脚下都会留下一条横带（票 99 §2 ①）。
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { type AssetRecipe, type StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, decodePNG, type ImageGenerator, type RasterImage } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const RECIPE: AssetRecipe = JSON.parse(readFileSync(ROOT + "fixtures/recipes/shift-change.json", "utf8"));
const BASE_STYLE: StyleSpec = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const BAND = "#0000ff";
const STYLE: StyleSpec = { ...BASE_STYLE, palette: [...BASE_STYLE.palette, BAND] };
const EPOCH = 1790208000;

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "ground-band-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const px = (hex: string): [number, number, number] =>
  [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

const recipe = (frames: number): AssetRecipe => ({
  ...RECIPE, id: "ground-band-test", referenceImage: undefined,
  assets: [{
    spec: {
      kind: "animation", id: "guard", role: "角色", description: "一个走路的人",
      styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 20 }, required: true,
      animations: [{ name: "idle", frames, fps: 6, loop: true }],
    },
    source: { kind: "image" },
  }],
});

/**
 * 与真生成图同构的合成 sheet：底色铺满、N 个角色分开站、可选一条**全宽底部横带**。
 * ⚠️ 角色的墨**不碰到画布底边**：横带独占底部 4 行（y=16..19），角色占 y=2..15。
 */
const sheet = (frames: number, opts: { band?: boolean; characters?: number } = {}): RasterImage => {
  const w = 16 * frames, h = 20;
  const data = Buffer.alloc(w * h * 4);
  const put = (x: number, y: number, c: [number, number, number]) => {
    const o = (y * w + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, px("#ff00ff"));
  const ink = px(STYLE.palette[0]!);
  const n = opts.characters ?? frames;
  for (let i = 0; i < n; i++) for (let y = 2; y < 16; y++) for (let x = i * 16 + 4; x < i * 16 + 12; x++) put(x, y, ink);
  if (opts.band === true) for (let y = 16; y < 20; y++) for (let x = 0; x < w; x++) put(x, y, px(BAND));
  return { width: w, height: h, data };
};

/** 真正连成一块的角色（没有横带）：分块必须仍然**硬失败**，救援不能把它放过。 */
const merged = (frames: number): RasterImage => {
  const w = 16 * frames, h = 20;
  const data = Buffer.alloc(w * h * 4);
  const put = (x: number, y: number, c: [number, number, number]) => {
    const o = (y * w + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, px("#ff00ff"));
  const ink = px(STYLE.palette[0]!);
  for (let y = 2; y < 16; y++) for (let x = 4; x < w - 4; x++) put(x, y, ink);
  return { width: w, height: h, data };
};

const generateImage = (img: RasterImage): ImageGenerator => async (req) => ({
  image: img,
  call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 },
});

const build = (img: RasterImage, frames = 4) => buildAssetPack({
  recipe: recipe(frames), style: STYLE, outDir: tmp(), recipeDir: ROOT,
  generate: () => { throw new Error("本测试只有 image 资源，drawlist 不该被调用"); },
  generateImage: generateImage(img), sourceDateEpoch: EPOCH,
});

describe("多帧底部横带：失败才触发的救援（票 99 / 票 100）", () => {
  it("⭐ 有横带 ⇒ 切出 N 帧，**且交付帧里横带颜色 0 像素**", async () => {
    const { manifest, packDir, groundBands } = await build(sheet(4, { band: true }));
    const anim = manifest.assets[0]!.animations![0]!;
    expect(anim.frames).toEqual(["guard.idle1", "guard.idle2", "guard.idle3", "guard.idle4"]);
    expect(groundBands, "救援必须留痕 —— 不许静默").toEqual([
      { assetId: "guard", anim: "idle", rows: 4, cover: 1 },
    ]);

    // ⚠️ 这一条才是「裁掉像素」与「只让分块忽略」的分水岭：后者每一帧脚下都会留下一条横带。
    const atlas = decodePNG(readFileSync(path.join(packDir, "delivery/atlas.animations.png")));
    let bandPixels = 0;
    for (let i = 0; i < atlas.width * atlas.height; i++) {
      const o = i * 4;
      if (atlas.data[o + 3]! > 0 && atlas.data[o] === 0 && atlas.data[o + 1] === 0 && atlas.data[o + 2] === 255) bandPixels++;
    }
    expect(bandPixels, "交付帧里不许有横带色").toBe(0);
  });

  it("正常图（无横带）⇒ 行为一字不改，且**没有**救援记录", async () => {
    const { manifest, groundBands } = await build(sheet(4));
    expect(manifest.assets[0]!.animations![0]!.frames).toEqual(["guard.idle1", "guard.idle2", "guard.idle3", "guard.idle4"]);
    expect(groundBands).toBeUndefined();
  });

  it("阴性①：角色真的连成一块（无横带）⇒ 仍然抛「检测到 1 块」", async () => {
    await expect(build(merged(4))).rejects.toThrow(/检测到 1 块/);
  });

  it("阴性②：有横带但只画了 N-1 个角色 ⇒ 裁完仍不是 N 块，照样抛", async () => {
    await expect(build(sheet(4, { band: true, characters: 3 })))
      .rejects.toThrow(/检测到 1 块[\s\S]*底部一条贯穿画面的横带/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 票 101 / 102：**两块时的碎块过滤**（`>=3` guard → `>=2`）与 80% 横带阈值。
//
// ⚠️ 本组测试的形状是量出来的，不是拍的：
//   · 13h 的真现场 = 角落一块 28×31 碎块 + 一块 1189×575 大块（宽度比 2.4%）；
//   · 盘上合法 2 帧的最低宽度比是 **0.647**（10-09 scavenger-idle）；
//   · 13h 的底部横带 **15 行 / 每行 ≥85% / 均值 88.5%**（90% 阈值救不了它）。
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 两块形状的合成 sheet（64×20）。
 *
 * - `widths`：每个真角色的矩形宽度，角色之间留 ≥2 列的底色缝；
 * - `speck`：左上角另画一个 **2×2** 的墨点 —— 它恰好通过 `minWidth` (=2) 与
 *   `minInkRows` (=2)，是 13h 那块 28×31 碎块的缩小同构；
 * - `band`：底部 4 行的横带宽度（像素）。取值要 **≥ 0.8·w 且 < 0.9·w**，
 *   才能证明「80% 阈值」真的生效，而不是只测 100%。
 */
const twoBlockSheet = (opts: {
  widths: readonly number[];
  speck?: boolean;
  band?: { width: number };
}): RasterImage => {
  const w = 64, h = 20;
  const data = Buffer.alloc(w * h * 4);
  const put = (x: number, y: number, c: [number, number, number]) => {
    const o = (y * w + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, px("#ff00ff"));
  const ink = px(STYLE.palette[0]!);
  let x = 4;
  for (const bw of opts.widths) {
    for (let y = 2; y < 16; y++) for (let xx = x; xx < x + bw; xx++) put(xx, y, ink);
    x += bw + 6;
  }
  if (opts.speck === true) for (let y = 0; y < 2; y++) for (let xx = 0; xx < 2; xx++) put(xx, y, ink);
  if (opts.band !== undefined) {
    const offset = Math.floor((w - opts.band.width) / 2);
    for (let y = 16; y < 20; y++) for (let xx = offset; xx < offset + opts.band.width; xx++) put(xx, y, px(BAND));
  }
  return { width: w, height: h, data };
};

describe("两块时的碎块过滤（票 101 / 102）", () => {
  it("⭐ 碎块 + 1 个真角色、spec 2 ⇒ 过滤后只剩 1 块，**硬失败**", async () => {
    await expect(build(twoBlockSheet({ widths: [8], speck: true }), 2))
      .rejects.toThrow(/检测到 1 块/);
  });

  it("合法双帧、宽度比 0.65（实测最低 0.647 的量级）⇒ **不误杀**", async () => {
    const { manifest } = await build(twoBlockSheet({ widths: [10, 15] }), 2);
    expect(manifest.assets[0]!.animations![0]!.frames).toEqual(["guard.idle1", "guard.idle2"]);
  });

  it("碎块 + 2 个真角色（3 块）⇒ 现有 median 过滤行为不变", async () => {
    const { manifest } = await build(twoBlockSheet({ widths: [8, 12], speck: true }), 2);
    expect(manifest.assets[0]!.animations![0]!.frames).toEqual(["guard.idle1", "guard.idle2"]);
  });

  it("⭐ 底部横带 **84.4%** 宽 + 2 个分离角色 ⇒ 80% 阈值救得了（90% 救不了）", async () => {
    const { manifest, groundBands } = await build(twoBlockSheet({ widths: [8, 8], band: { width: 54 } }), 2);
    expect(manifest.assets[0]!.animations![0]!.frames).toEqual(["guard.idle1", "guard.idle2"]);
    expect(groundBands).toEqual([{ assetId: "guard", anim: "idle", rows: 4, cover: 0.84375 }]);
  });

  it("已知代价：宽度比 0.30 的第二帧被当碎块丢弃 ⇒ 预期**硬失败**（不列为必须通过的合法帧）", async () => {
    await expect(build(twoBlockSheet({ widths: [4, 13] }), 2))
      .rejects.toThrow(/检测到 1 块/);
  });
});
