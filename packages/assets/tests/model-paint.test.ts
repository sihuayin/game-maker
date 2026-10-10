// **真图回归**（票 37 的 Q5）：把「模型到底交付了什么颜色」变成一条用**真字节**跑得出来的判据。
//
// ⚠️ 这一份与 `pack.test.ts` 里那些桩测的分工：
//   · 桩测（`_model-paint.ts`）验的是**逻辑**——「交付色 ≠ 声明色时抠底还认不认得出」；
//   · 这一份验的是**事实**——那 9 张已付费的真图，在**今天这版实现**下抠不抠得开。
//   桩可以是错的（它只是我以为模型会做的事），真图不会 —— 所以两者都要有。
//
// ⚠️ **上游依赖**写在 `fixtures/model-paint/README.md`（票 37 的 Q5 边界第 4 条）：
//   颜色量自 `gemini-2.5-flash-image`（2026-10-09）。**换上游 ⇒ 这 5 张要重量、要换掉**，
//   而不是把断言放宽到「怎么画都算过」。
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { AssetRecipe, DrawList, StyleSpec } from "@game-maker/contracts";
import { decodePNG } from "../src/png.js";
import {
  buildAssetPack, dominantOpaqueColor, foregroundBlocks,
  keyBackground, keyColorFor, l1Distance, type DrawListGenerator, type ImageGenerator, type RasterImage,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const DIR = path.join(ROOT, "fixtures/model-paint");
const RECIPE: AssetRecipe = JSON.parse(readFileSync(path.join(ROOT, "fixtures/recipes/shift-change.json"), "utf8"));
const STYLE: StyleSpec = JSON.parse(
  readFileSync(path.join(ROOT, ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json"), "utf8"));
const EPOCH = 1790208000;
/** 提示词里逐字写着的那个（`keyColorFor(palette)` 在本轮色板下的返回值）。 */
const DECLARED = "#ff00ff";
/** 我们**要求**模型铺的那个色 —— 与它实际铺的差多远，就是票 37 那件事的全部。 */
const declaredRgb = [255, 0, 255] as const;

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "mpaint-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const load = (file: string): RasterImage => decodePNG(readFileSync(path.join(DIR, file)));

/**
 * 这 5 张图的**实测**读数（2026-10-10 用交付版实现量得；原始读数见
 * `experiments/e2e-wasteland/raw/key-colour-third-run/measured-2026-10-09.txt`）。
 *
 * ⚠️ `mode` 三个通道是**钉死的**：它们必须等于那张图上真铺着的那个颜色 ——
 *   实现改一次量法，这里就该红一次（而不是悄悄换一个数继续绿）。
 */
const IMAGES = [
  { file: "a-normal-master.png",           cells: 1, w: 832,  h: 1248, mode: [223, 48, 152] },
  { file: "a-normal-idle.png",             cells: 1, w: 832,  h: 1248, mode: [222, 48, 152] },
  { file: "third-run-master-enemy.png",    cells: 1, w: 832,  h: 1248, mode: [200, 30, 124] },
  { file: "third-run-treasure-chest.png",  cells: 1, w: 896,  h: 1152, mode: [243, 195, 219] },
  { file: "third-run-scavenger-idle.png",  cells: 2, w: 1184, h: 864,  mode: [225, 31, 139] },
] as const;

/** 众数色在容差 30 下覆盖了多少**不透明**像素（= 真抠的话抠掉多少）。 */
const coverage = (img: RasterImage, color: readonly number[], tolerance: number) => {
  const keyed = keyBackground(img, { tolerance, colors: [[color[0]!, color[1]!, color[2]!]] }).keyedPixels;
  return keyed / img.width / img.height;
};
const opaqueCount = (img: RasterImage) => {
  let n = 0;
  for (let i = 0; i < img.width * img.height; i++) if (img.data[i * 4 + 3]! >= 128) n++;
  return n;
};

describe("真图回归：**5 张已付费的真图**，抠底按实测众数色抠得开（票 37 的 Q5）", () => {
  it("前提：这 5 张的提示词里写的就是 `#ff00ff`，而色板派生的也正是它", () => {
    // 声明色这一侧钉死了，下面「声明色覆盖率 = 0」才有意义。
    expect(keyColorFor(STYLE.palette)).toBe(DECLARED);
  });

  it("先把清单点清 —— 少一张就等于少一份保证", () => {
    for (const img of IMAGES) {
      const loaded = load(img.file);
      expect({ file: img.file, w: loaded.width, h: loaded.height })
        .toEqual({ file: img.file, w: img.w, h: img.h });
    }
  });

  it("⚠️ **声明色覆盖率 = 0** —— 5 张一张都没交付 `#ff00ff`（这就是本票的全部来由）", () => {
    for (const img of IMAGES) {
      const loaded = load(img.file);
      expect(coverage(loaded, declaredRgb, 30), `${img.file} 竟然抠到了声明色`).toBe(0);
    }
  });

  it("⚠️ **众数色覆盖率 ≥ 60%** —— 每张图自己内部极稳，那个底就在那儿", () => {
    for (const img of IMAGES) {
      const loaded = load(img.file);
      const m = dominantOpaqueColor(loaded);
      expect(m.color, `${img.file} 的实测众数色`).toEqual([...img.mode]);
      // ⚠️ 全不透明：`keyed / (w*h)` 与 `keyed / opaquePixels` 因此是同一个数，
      //   而 `pack.ts` 的门禁用的正是前者 —— 这条前提不成立的话两边会打架。
      expect(opaqueCount(loaded), `${img.file} 不是全不透明`).toBe(img.w * img.h);
      expect(coverage(loaded, m.color, 30), `${img.file} 的众数色覆盖率`).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("⚠️ 众数色与声明色**差得很远**（L1 ≥ 100）—— 「差不多」不成立，是**另一个色**", () => {
    for (const img of IMAGES) {
      const l1 = l1Distance(dominantOpaqueColor(load(img.file)).color, declaredRgb);
      expect(l1, `${img.file} 的众数色离声明色只差 L1 ${l1}`).toBeGreaterThanOrEqual(100);
    }
  });

  it("⚠️ 单帧那 4 张：**两条结构判据都过**（抠掉的是多数、剩下的连成一块）", () => {
    // 这两条正是 `pack.ts` 在单帧上跑的那两条（阈值也照抄：> 0.5、≥ 0.6）。
    for (const img of IMAGES.filter((i) => i.cells === 1)) {
      const loaded = load(img.file);
      const mode = dominantOpaqueColor(loaded).color;
      const keyedRatio = coverage(loaded, mode, 30);
      expect(keyedRatio, `${img.file}：抠掉的是不是多数`).toBeGreaterThan(0.5);
      const blocks = foregroundBlocks(keyBackground(loaded, { tolerance: 30, colors: [mode] }).image);
      expect(blocks.largestShare, `${img.file}：剩下的墨连不连成一块`).toBeGreaterThanOrEqual(0.6);
    }
  });
});

describe("真图回归：**真的走一遍 `buildAssetPack`**（不只是量一量）", () => {
  /** 把某张真图当作「生图接口交回来的那一张」喂进去。 */
  const paints = (file: string): ImageGenerator => {
    const image = load(file);
    return async (req) => ({
      image,
      call: { protocol: "openai", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 },
    });
  };

  const build = (recipe: AssetRecipe, gen: ImageGenerator) => buildAssetPack({
    recipe, style: STYLE, outDir: tmp(), recipeDir: ROOT, generate: stub, generateImage: gen,
    sourceDateEpoch: EPOCH,
  });

  it("⚠️ 单帧真图（`treasure-chest`）⇒ **出得了包**（票 37 之前这一张必挂）", async () => {
    // ⚠️ 这张是本组里最难的一张：底色是**浅粉** [243,195,219]，与另外 8 张的洋红族差得很远；
    //   而且模型沿四周画了一圈洋红描边（抠完剩下 2 块）—— 所以它同时是
    //   「众数不是声明色」与「块数不是 1」两个坑的现场。
    const recipe: AssetRecipe = {
      ...RECIPE, id: "real-chest", referenceImage: undefined,
      assets: [{
        spec: { kind: "sprite", id: "chest", role: "道具", description: "一只旧箱子",
          styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size: { w: 32, h: 48 }, required: true },
        source: { kind: "image" },
      }],
    };
    const { manifest, audit } = await build(recipe, paints("third-run-treasure-chest.png"));
    expect(audit).toEqual([]);
    expect(manifest.assets[0]!.frames.map((f) => f.name)).toEqual(["chest"]);
  });

  it("⚠️ 多帧真图（`scavenger-idle`，2 格）⇒ 切得出 **2 帧**（抠底没把两格连成一片）", async () => {
    const recipe: AssetRecipe = {
      ...RECIPE, id: "real-idle", referenceImage: undefined,
      assets: [{
        spec: { kind: "animation", id: "idle", role: "角色", description: "一个站着的人",
          styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size: { w: 32, h: 48 }, required: true,
          animations: [{ name: "idle", frames: 2, fps: 6, loop: true }] },
        source: { kind: "image" },
      }],
    };
    const { manifest, audit } = await build(recipe, paints("third-run-scavenger-idle.png"));
    expect(audit).toEqual([]);
    expect(manifest.assets[0]!.frames.map((f) => f.name)).toEqual(["idle.idle1", "idle.idle2"]);
  });
});

/** 与 `recipes-sweep.test.ts` 同款的桩 drawlist 生成器（这一份走的是生图那条路，桩只为凑形状）。 */
const stub: DrawListGenerator = (spec) => {
  const n = spec.kind === "animation" ? spec.animations.reduce((s, a) => s + a.frames, 0)
    : spec.kind === "background" && spec.layers ? spec.layers.length : 1;
  return Array.from({ length: n }, (_, i) => ({
    format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
    viewBox: [0, 0, spec.size.w, spec.size.h], expectedSize: [spec.size.w, spec.size.h],
    ops: [
      { op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: `palette:${i % 5}` },
      { op: "rect", x: 1, y: 1, w: Math.max(1, spec.size.w - 2), h: 2, fill: "palette:1" },
    ] as DrawList["ops"],
  }));
};
